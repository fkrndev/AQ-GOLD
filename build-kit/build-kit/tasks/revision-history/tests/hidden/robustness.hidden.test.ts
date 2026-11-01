import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listRevisions,
  loadRevision,
  saveRevision,
} from "../../app/(site)/brief/revisions";
import { buildRevisionListText } from "../../app/(site)/brief/export";
import { makeBrief } from "../helpers";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => void store.clear(),
  length: 0,
  key: (_index: number) => null,
};

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", { localStorage: localStorageMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Writes a payload to every key currently in storage, whatever the module calls them. */
const corruptEveryKey = (payload: string) => {
  for (const key of Array.from(store.keys())) {
    store.set(key, payload);
  }
};

const seedHistory = () => {
  const saved = saveRevision(makeBrief(), "before corruption");
  expect(saved.ok).toBe(true);
  expect(store.size).toBeGreaterThan(0);
};

describe("hidden corrupt stored history", () => {
  it("hidden_garbage_history_lists_as_empty", () => {
    seedHistory();
    corruptEveryKey("{{{ not json at all");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(0);
  });

  it("hidden_wrong_shape_history_lists_as_empty", () => {
    seedHistory();
    corruptEveryKey(JSON.stringify({ schema: 99, unexpected: true }));
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(0);
  });

  it("hidden_null_entries_in_history_do_not_crash", () => {
    seedHistory();
    corruptEveryKey(JSON.stringify({ anchorId: "a", entries: [null, 5, {}] }));
    const list = listRevisions();
    expect(list.ok).toBe(true);
  });

  it("hidden_save_works_after_corrupt_history", () => {
    seedHistory();
    corruptEveryKey("]]] broken");
    const saved = saveRevision(makeBrief(), "fresh start");
    expect(saved.ok).toBe(true);
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(1);
    expect(list.revisions[0].name).toBe("fresh start");
  });

  it("hidden_load_after_corrupt_history_is_not_found", () => {
    seedHistory();
    corruptEveryKey("###");
    const loaded = loadRevision("before corruption");
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.reason).toBe("not-found");
  });
});

describe("hidden failing writes", () => {
  it("hidden_setitem_failure_reports_storage_unavailable", () => {
    const refusing = {
      ...localStorageMock,
      setItem: (_key: string, _value: string) => {
        throw new Error("quota exceeded");
      },
    };
    vi.stubGlobal("window", { localStorage: refusing });
    const saved = saveRevision(makeBrief(), "nowhere to write");
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.reason).toBe("storage-unavailable");
  });
});

describe("hidden export without storage", () => {
  it("hidden_export_text_needs_no_storage", () => {
    vi.unstubAllGlobals();
    const text = buildRevisionListText([
      { id: "one", name: "alpha", savedAt: "2026-01-05T10:00:00.000Z", briefId: "b1" },
      { id: "two", name: "beta", savedAt: "2026-01-06T10:00:00.000Z", briefId: "b1" },
    ]);
    expect(text).toContain("alpha");
    expect(text).toContain("beta");
    expect(buildRevisionListText([])).toContain("No saved revisions");
  });
});

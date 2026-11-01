import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveBrief } from "../../app/(site)/brief/storage";
import {
  ensureEditable,
  getStatus,
  getTrail,
  transitionBrief,
} from "../../app/(site)/brief/lifecycle";
import { buildLifecycleText } from "../../app/(site)/brief/export";
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

/** Writes a payload to the lifecycle keys only, so the saved brief stays intact. */
const lifecycleKeys = (): string[] => {
  saveBrief(makeBrief({ projectName: "Robust lifecycle" }));
  const before = new Set(store.keys());
  const moved = transitionBrief("in-review");
  expect(moved.ok).toBe(true);
  return Array.from(store.keys()).filter((key) => !before.has(key));
};

const corruptLifecycle = (payload: string) => {
  for (const key of lifecycleKeys()) {
    store.set(key, payload);
  }
};

describe("hidden corrupt stored lifecycle", () => {
  it("hidden_garbage_record_reads_as_draft", () => {
    corruptLifecycle("<<< not json");
    expect(getStatus()).toBe("draft");
  });

  it("hidden_garbage_record_lists_as_empty_trail", () => {
    corruptLifecycle("<<< not json");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events).toHaveLength(0);
  });

  it("hidden_wrong_shape_record_does_not_crash", () => {
    corruptLifecycle(JSON.stringify({ schema: 77, whatever: [1, 2, 3] }));
    expect(getStatus()).toBe("draft");
    const guard = ensureEditable();
    expect(guard.ok).toBe(true);
  });

  it("hidden_null_entries_in_record_do_not_crash", () => {
    corruptLifecycle(JSON.stringify({ status: "ready", events: [null, 7, {}] }));
    const trail = getTrail();
    expect(trail.ok).toBe(true);
  });

  it("hidden_moves_work_after_corrupt_record", () => {
    corruptLifecycle("###");
    const again = transitionBrief("in-review");
    expect(again.ok).toBe(true);
    expect(getStatus()).toBe("in-review");
  });
});

describe("hidden failing writes", () => {
  it("hidden_setitem_failure_reports_storage_unavailable", () => {
    saveBrief(makeBrief({ projectName: "Failing writes" }));
    const refusing = {
      ...localStorageMock,
      setItem: (_key: string, _value: string) => {
        throw new Error("quota exceeded");
      },
    };
    vi.stubGlobal("window", { localStorage: refusing });
    const moved = transitionBrief("in-review");
    expect(moved.ok).toBe(false);
    if (moved.ok) return;
    expect(moved.reason).toBe("storage-unavailable");
  });
});

describe("hidden trail text without storage", () => {
  it("hidden_trail_text_needs_no_storage", () => {
    vi.unstubAllGlobals();
    const text = buildLifecycleText([
      { at: "2026-01-05T10:00:00.000Z", from: null, to: "in-review", note: "" },
      { at: "2026-01-05T11:00:00.000Z", from: "in-review", to: "draft", note: "back again" },
    ]);
    expect(text.split("\n")[0]).toBe("start -> in-review");
    expect(text).toContain("(back again)");
    expect(buildLifecycleText([])).toBe("No lifecycle moves");
  });
});

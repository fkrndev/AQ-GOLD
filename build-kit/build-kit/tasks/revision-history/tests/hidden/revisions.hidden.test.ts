import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_REVISIONS,
  deleteRevision,
  listRevisions,
  loadRevision,
  restoreRevision,
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

describe("hidden saveRevision and listRevisions", () => {
  it("hidden_saves_and_lists_a_revision", () => {
    const result = saveRevision(makeBrief(), "hidden draft");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.name).toBe("hidden draft");
    expect(result.revision.id).toBeTruthy();
    expect(result.revision.savedAt).toBeTruthy();

    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(1);
    expect(list.revisions[0].name).toBe("hidden draft");
  });

  it("hidden_lists_newest_first", () => {
    saveRevision(makeBrief(), "first");
    saveRevision(makeBrief(), "second");
    saveRevision(makeBrief(), "third");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions[0].name).toBe("third");
    expect(list.revisions[2].name).toBe("first");
  });

  it("hidden_same_name_replaces_not_duplicates", () => {
    saveRevision(makeBrief({ projectName: "v1" }), "checkpoint");
    saveRevision(makeBrief({ projectName: "v2" }), "checkpoint");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(1);
    const loaded = loadRevision("checkpoint");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.revision.brief.projectName).toBe("v2");
  });

  it("hidden_refuses_blank_name", () => {
    const result = saveRevision(makeBrief(), "   ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("name-blank");
  });

  it("hidden_listing_returns_metadata_without_brief", () => {
    saveRevision(makeBrief(), "meta");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const entry = list.revisions[0] as Record<string, unknown>;
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("name");
    expect(entry).toHaveProperty("savedAt");
    expect(entry).toHaveProperty("briefId");
    expect(entry).not.toHaveProperty("brief");
  });

  it("hidden_empty_history_returns_empty_list", () => {
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(0);
  });
});

describe("hidden loadRevision", () => {
  it("hidden_loads_by_exact_name", () => {
    saveRevision(makeBrief({ projectName: "found me" }), "target");
    const loaded = loadRevision("target");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.revision.brief.projectName).toBe("found me");
  });

  it("hidden_not_found_for_unknown_name", () => {
    const result = loadRevision("ghost");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-found");
  });
});

describe("hidden deleteRevision", () => {
  it("hidden_deletes_a_non_anchor_revision", () => {
    saveRevision(makeBrief(), "first");
    saveRevision(makeBrief(), "second");
    const result = deleteRevision("second");
    expect(result.ok).toBe(true);
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(1);
  });

  it("hidden_refuses_to_delete_the_anchor", () => {
    saveRevision(makeBrief(), "the beginning");
    saveRevision(makeBrief(), "later");
    const result = deleteRevision("the beginning");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("anchor-protected");
  });

  it("hidden_not_found_when_deleting_unknown", () => {
    const result = deleteRevision("ghost");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-found");
  });
});

describe("hidden restoreRevision", () => {
  it("hidden_restore_creates_new_revision_not_overwrite", () => {
    saveRevision(makeBrief({ projectName: "original" }), "checkpoint");
    const restored = restoreRevision("checkpoint");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.revision.name).toContain("restored");

    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.length).toBeGreaterThanOrEqual(2);

    const original = loadRevision("checkpoint");
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    expect(original.revision.brief.projectName).toBe("original");
  });

  it("hidden_not_found_when_restoring_unknown", () => {
    const result = restoreRevision("ghost");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-found");
  });

  it("hidden_restore_adds_a_restored_copy", () => {
    saveRevision(makeBrief(), "base");
    restoreRevision("base");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const restoredNames = list.revisions.filter((r) => r.name.includes("restored"));
    expect(restoredNames.length).toBeGreaterThanOrEqual(1);
  });
});

describe("hidden cap eviction", () => {
  it("hidden_caps_at_max_revisions", () => {
    for (let i = 0; i < MAX_REVISIONS + 5; i++) {
      saveRevision(makeBrief(), `rev ${i}`);
    }
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.length).toBeLessThanOrEqual(MAX_REVISIONS);
  });

  it("hidden_anchor_survives_eviction", () => {
    saveRevision(makeBrief(), "anchor keeper");
    for (let i = 1; i < MAX_REVISIONS + 5; i++) {
      saveRevision(makeBrief(), `rev ${i}`);
    }
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.length).toBeLessThanOrEqual(MAX_REVISIONS);
    expect(list.revisions.some((r) => r.name === "anchor keeper")).toBe(true);
    const anchor = loadRevision("anchor keeper");
    expect(anchor.ok).toBe(true);
  });

  it("hidden_oldest_non_anchor_evicted_first", () => {
    saveRevision(makeBrief(), "oldest keeper");
    saveRevision(makeBrief(), "first to go");
    for (let i = 3; i <= MAX_REVISIONS + 2; i++) {
      saveRevision(makeBrief(), `rev ${i}`);
    }
    const anchor = loadRevision("oldest keeper");
    expect(anchor.ok).toBe(true);
    const evicted = loadRevision("first to go");
    expect(evicted.ok).toBe(false);
  });
});

describe("hidden buildRevisionListText", () => {
  it("hidden_exports_revision_names", () => {
    saveRevision(makeBrief(), "alpha");
    saveRevision(makeBrief(), "beta");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const text = buildRevisionListText(list.revisions);
    expect(text).toContain("alpha");
    expect(text).toContain("beta");
  });

  it("hidden_empty_revision_export", () => {
    const text = buildRevisionListText([]);
    expect(text).toContain("No saved revisions");
  });
});

describe("hidden storage unavailable", () => {
  it("hidden_save_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const result = saveRevision(makeBrief(), "nowhere");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("storage-unavailable");
  });

  it("hidden_list_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const list = listRevisions();
    expect(list.ok).toBe(false);
    if (list.ok) return;
    expect(list.reason).toBe("storage-unavailable");
  });
});

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
import type { RevisionMeta } from "../../app/(site)/brief/revisions";
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

describe("hidden restore semantics", () => {
  it("hidden_restore_appends_restored_suffix", () => {
    saveRevision(makeBrief(), "baseline");
    const restored = restoreRevision("baseline");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.revision.name).toContain("restored");
    expect(restored.revision.name).toContain("baseline");
  });

  it("hidden_restore_preserves_original_unchanged", () => {
    const brief = makeBrief({ projectName: "before restore" });
    saveRevision(brief, "source");
    restoreRevision("source");
    const original = loadRevision("source");
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    expect(original.revision.brief.projectName).toBe("before restore");
  });

  it("hidden_restore_gives_new_revision_a_fresh_id", () => {
    saveRevision(makeBrief(), "target");
    const before = loadRevision("target");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const restored = restoreRevision("target");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.revision.id).not.toBe(before.revision.id);
  });

  it("hidden_restore_not_found_is_reported", () => {
    const result = restoreRevision("nothing here");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-found");
  });

  it("hidden_restore_then_delete_original_leaves_restored", () => {
    saveRevision(makeBrief(), "anchor base");
    saveRevision(makeBrief(), "to restore");
    restoreRevision("to restore");
    const deleted = deleteRevision("to restore");
    expect(deleted.ok).toBe(true);
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.some((r) => r.name === "to restore")).toBe(false);
    expect(list.revisions.some((r) => r.name.includes("restored"))).toBe(true);
  });

  it("hidden_double_restore_keeps_original", () => {
    saveRevision(makeBrief(), "origin");
    restoreRevision("origin");
    restoreRevision("origin");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.some((r) => r.name === "origin")).toBe(true);
    expect(list.revisions.some((r) => r.name.includes("restored"))).toBe(true);
    const loaded = loadRevision("origin");
    expect(loaded.ok).toBe(true);
  });
});

describe("hidden cap eviction with anchor", () => {
  it("hidden_cap_is_exactly_max_revisions", () => {
    for (let i = 0; i < MAX_REVISIONS + 3; i++) {
      saveRevision(makeBrief(), `fill ${i}`);
    }
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.length).toBeLessThanOrEqual(MAX_REVISIONS);
    expect(list.revisions.length).toBeGreaterThanOrEqual(MAX_REVISIONS - 1);
  });

  it("hidden_anchor_is_oldest_and_survives", () => {
    saveRevision(makeBrief(), "the very first one");
    for (let i = 1; i < MAX_REVISIONS + 5; i++) {
      saveRevision(makeBrief(), `later ${i}`);
    }
    const anchor = loadRevision("the very first one");
    expect(anchor.ok).toBe(true);
  });

  it("hidden_anchor_cannot_be_deleted_even_when_full", () => {
    saveRevision(makeBrief(), "anchor entry");
    for (let i = 1; i < MAX_REVISIONS + 2; i++) {
      saveRevision(makeBrief(), `more ${i}`);
    }
    const result = deleteRevision("anchor entry");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("anchor-protected");
  });

  it("hidden_non_anchor_old_entries_are_evicted", () => {
    saveRevision(makeBrief(), "anchor stays");
    saveRevision(makeBrief(), "this goes");
    for (let i = 3; i <= MAX_REVISIONS + 2; i++) {
      saveRevision(makeBrief(), `filler ${i}`);
    }
    const evicted = loadRevision("this goes");
    expect(evicted.ok).toBe(false);
    const anchor = loadRevision("anchor stays");
    expect(anchor.ok).toBe(true);
  });

  it("hidden_eviction_respects_same_name_replacement", () => {
    for (let i = 0; i < MAX_REVISIONS; i++) {
      saveRevision(makeBrief(), `rev ${i}`);
    }
    // replace the middle one, count should stay the same
    saveRevision(makeBrief({ projectName: "updated" }), `rev ${Math.floor(MAX_REVISIONS / 2)}`);
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions.length).toBeLessThanOrEqual(MAX_REVISIONS);
  });
});

describe("hidden revision export", () => {
  it("hidden_export_includes_all_names", () => {
    saveRevision(makeBrief(), "alpha");
    saveRevision(makeBrief(), "beta");
    saveRevision(makeBrief(), "gamma");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const text = buildRevisionListText(list.revisions);
    expect(text).toContain("alpha");
    expect(text).toContain("beta");
    expect(text).toContain("gamma");
  });

  it("hidden_export_handles_empty_history", () => {
    const text = buildRevisionListText([]);
    expect(text.length).toBeGreaterThan(0);
  });

  it("hidden_export_with_many_revisions", () => {
    for (let i = 0; i < 10; i++) {
      saveRevision(makeBrief(), `rev ${i}`);
    }
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const text = buildRevisionListText(list.revisions);
    for (let i = 0; i < 10; i++) {
      expect(text).toContain(`rev ${i}`);
    }
  });
});

describe("hidden revision listing determinism", () => {
  it("hidden_listing_is_stable_across_calls", () => {
    saveRevision(makeBrief(), "one");
    saveRevision(makeBrief(), "two");
    saveRevision(makeBrief(), "three");
    const first = listRevisions();
    const second = listRevisions();
    expect(first).toEqual(second);
  });

  it("hidden_listing_after_delete_shrinks", () => {
    saveRevision(makeBrief(), "one");
    saveRevision(makeBrief(), "two");
    saveRevision(makeBrief(), "three");
    deleteRevision("two");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.revisions).toHaveLength(2);
    expect(list.revisions.some((r) => r.name === "two")).toBe(false);
  });

  it("hidden_revision_meta_fields_are_strings", () => {
    saveRevision(makeBrief(), "typed");
    const list = listRevisions();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const entry: RevisionMeta = list.revisions[0];
    expect(typeof entry.id).toBe("string");
    expect(typeof entry.name).toBe("string");
    expect(typeof entry.savedAt).toBe("string");
    expect(typeof entry.briefId).toBe("string");
  });
});

describe("hidden revision edge cases", () => {
  it("hidden_name_trimming_is_applied", () => {
    const result = saveRevision(makeBrief(), "  padded name  ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.name).toBe("padded name");
  });

  it("hidden_saved_revision_carries_brief_id", () => {
    const brief = makeBrief();
    const result = saveRevision(brief, "with id");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.revision.briefId).toBe(brief.id);
  });

  it("hidden_delete_then_save_same_name_works", () => {
    saveRevision(makeBrief(), "other");
    saveRevision(makeBrief(), "recycled");
    const deleted = deleteRevision("recycled");
    expect(deleted.ok).toBe(true);
    const result = saveRevision(makeBrief({ projectName: "v2" }), "recycled");
    expect(result.ok).toBe(true);
    const loaded = loadRevision("recycled");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.revision.brief.projectName).toBe("v2");
  });
});

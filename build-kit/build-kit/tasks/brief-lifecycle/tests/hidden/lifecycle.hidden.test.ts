import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveBrief } from "../../app/(site)/brief/storage";
import { ensureEditable, getFrozenEstimate, getStatus, getTrail, transitionBrief } from "../../app/(site)/brief/lifecycle";
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

const seed = () => {
  const brief = makeBrief({ projectName: "Hidden lifecycle" });
  saveBrief(brief);
  return brief;
};

const reachSignedOff = (brief = seed()) => {
  transitionBrief("in-review");
  transitionBrief("ready");
  const signed = transitionBrief("signed-off");
  expect(signed.ok).toBe(true);
  return brief;
};

describe("hidden getStatus", () => {
  it("hidden_status_is_draft_before_any_move", () => {
    seed();
    expect(getStatus()).toBe("draft");
  });

  it("hidden_status_is_draft_without_any_saved_brief", () => {
    expect(getStatus()).toBe("draft");
  });

  it("hidden_status_tracks_the_last_move", () => {
    seed();
    transitionBrief("in-review");
    expect(getStatus()).toBe("in-review");
    transitionBrief("ready");
    expect(getStatus()).toBe("ready");
  });

  it("hidden_status_returns_to_draft_after_reopen", () => {
    reachSignedOff();
    transitionBrief("draft", "hidden reopen");
    expect(getStatus()).toBe("draft");
  });
});

describe("hidden move results", () => {
  it("hidden_move_returns_the_event_it_appended", () => {
    seed();
    const result = transitionBrief("in-review");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.from).toBe(null);
    expect(result.event.to).toBe("in-review");
    expect(result.event.note).toBe("");
  });

  it("hidden_refusal_carries_a_message", () => {
    seed();
    const result = transitionBrief("ready");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("hidden allowed moves", () => {
  it("hidden_draft_moves_to_in_review", () => {
    seed();
    const result = transitionBrief("in-review");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("in-review");
  });

  it("hidden_in_review_moves_to_ready", () => {
    seed();
    transitionBrief("in-review");
    const result = transitionBrief("ready");
    expect(result.ok).toBe(true);
  });

  it("hidden_ready_moves_to_signed_off", () => {
    seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    const result = transitionBrief("signed-off");
    expect(result.ok).toBe(true);
  });

  it("hidden_signed_off_reopens_to_draft_with_note", () => {
    reachSignedOff();
    const result = transitionBrief("draft", "scope changed");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("draft");
  });

  it("hidden_brief_can_move_again_after_reopen", () => {
    reachSignedOff();
    transitionBrief("draft", "hidden reopen");
    const again = transitionBrief("in-review");
    expect(again.ok).toBe(true);
  });
});

describe("hidden rejected moves", () => {
  it("hidden_refuses_skip_from_draft_to_ready", () => {
    seed();
    const result = transitionBrief("ready");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("move-not-allowed");
    expect(getStatus()).toBe("draft");
  });

  it("hidden_refuses_skip_from_draft_to_signed_off", () => {
    seed();
    const result = transitionBrief("signed-off");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("move-not-allowed");
  });

  it("hidden_refuses_skip_from_in_review_to_signed_off", () => {
    seed();
    transitionBrief("in-review");
    const result = transitionBrief("signed-off");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("move-not-allowed");
  });

  it("hidden_refuses_backwards_move_to_draft", () => {
    seed();
    transitionBrief("in-review");
    const result = transitionBrief("draft");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("move-not-allowed");
  });

  it("hidden_refuses_move_to_the_same_status", () => {
    seed();
    const result = transitionBrief("draft");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("move-not-allowed");
  });

  it("hidden_refuses_move_without_a_saved_brief", () => {
    const result = transitionBrief("in-review");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-found");
  });

  it("hidden_refuses_reopen_to_anything_but_draft", () => {
    reachSignedOff();
    const result = transitionBrief("in-review");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("move-not-allowed");
    expect(getStatus()).toBe("signed-off");
  });

  it("hidden_refuses_reopen_with_a_blank_note", () => {
    reachSignedOff();
    const blank = transitionBrief("draft", "   ");
    expect(blank.ok).toBe(false);
    if (blank.ok) return;
    expect(blank.reason).toBe("note-required");
    expect(getStatus()).toBe("signed-off");
  });

  it("hidden_failed_move_keeps_status_unchanged", () => {
    seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    transitionBrief("ready");
    expect(getStatus()).toBe("signed-off");
  });
});

describe("hidden storage unavailable", () => {
  it("hidden_transition_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const result = transitionBrief("in-review");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("storage-unavailable");
  });

  it("hidden_trail_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const trail = getTrail();
    expect(trail.ok).toBe(false);
    if (trail.ok) return;
    expect(trail.reason).toBe("storage-unavailable");
  });

  it("hidden_edit_guard_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const guard = ensureEditable();
    expect(guard.ok).toBe(false);
    if (guard.ok) return;
    expect(guard.reason).toBe("storage-unavailable");
  });

  it("hidden_frozen_estimate_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const frozen = getFrozenEstimate();
    expect(frozen.ok).toBe(false);
    if (frozen.ok) return;
    expect(frozen.reason).toBe("storage-unavailable");
  });
});

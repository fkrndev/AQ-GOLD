import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveBrief } from "../../app/(site)/brief/storage";
import { createEstimate } from "../../app/(site)/brief/estimate";
import { buildLifecycleText } from "../../app/(site)/brief/export";
import { getFrozenEstimate, getTrail, transitionBrief } from "../../app/(site)/brief/lifecycle";
import { service, makeBrief } from "../helpers";

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
  const brief = makeBrief({ projectName: "Hidden trail" });
  saveBrief(brief);
  return brief;
};

const reachSignedOff = () => {
  seed();
  transitionBrief("in-review");
  transitionBrief("ready");
  transitionBrief("signed-off");
};

describe("hidden trail", () => {
  it("hidden_trail_is_empty_before_any_move", () => {
    seed();
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events).toHaveLength(0);
  });

  it("hidden_trail_fails_without_a_saved_brief", () => {
    const trail = getTrail();
    expect(trail.ok).toBe(false);
    if (trail.ok) return;
    expect(trail.reason).toBe("not-found");
  });

  it("hidden_first_event_comes_from_start", () => {
    seed();
    transitionBrief("in-review");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events[0].from).toBe(null);
    expect(trail.events[0].to).toBe("in-review");
  });

  it("hidden_trail_keeps_one_event_per_move", () => {
    seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events).toHaveLength(3);
  });

  it("hidden_trail_is_ordered_oldest_first", () => {
    seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events[0].to).toBe("in-review");
    expect(trail.events[1].from).toBe("in-review");
    expect(trail.events[1].to).toBe("ready");
  });

  it("hidden_reopen_appends_its_event_with_the_note", () => {
    reachSignedOff();
    transitionBrief("draft", "client request");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events).toHaveLength(4);
    const last = trail.events[3];
    expect(last.from).toBe("signed-off");
    expect(last.to).toBe("draft");
    expect(last.note).toBe("client request");
  });

  it("hidden_event_note_is_trimmed", () => {
    seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    transitionBrief("draft", "  padded reopen  ");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events[trail.events.length - 1].note).toBe("padded reopen");
  });

  it("hidden_event_carries_a_timestamp", () => {
    seed();
    transitionBrief("in-review");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(typeof trail.events[0].at).toBe("string");
    expect(trail.events[0].at.length).toBeGreaterThan(0);
  });

  it("hidden_trail_cannot_be_changed_through_its_copy", () => {
    seed();
    transitionBrief("in-review");
    const first = getTrail();
    if (!first.ok) return;
    first.events.push({ at: "fake", from: "draft", to: "ready", note: "tampered" });
    const second = getTrail();
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events).toHaveLength(1);
  });

  it("hidden_trail_reads_the_same_on_repeat_calls", () => {
    seed();
    transitionBrief("in-review");
    const first = getTrail();
    const second = getTrail();
    expect(first).toEqual(second);
  });

  it("hidden_moves_after_reopen_append_not_reset", () => {
    reachSignedOff();
    transitionBrief("draft", "hidden reopen");
    transitionBrief("in-review");
    const trail = getTrail();
    expect(trail.ok).toBe(true);
    if (!trail.ok) return;
    expect(trail.events).toHaveLength(5);
    expect(trail.events[4].from).toBe("draft");
  });
});

describe("hidden frozen estimate", () => {
  it("hidden_estimate_is_not_frozen_before_sign_off", () => {
    seed();
    transitionBrief("in-review");
    const frozen = getFrozenEstimate();
    expect(frozen.ok).toBe(false);
    if (frozen.ok) return;
    expect(frozen.reason).toBe("not-frozen");
  });

  it("hidden_frozen_estimate_matches_the_estimate_at_sign_off", () => {
    const brief = seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    const frozen = getFrozenEstimate();
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    const expected = createEstimate(brief);
    expect(frozen.estimate.estimatedHours).toBe(expected.estimatedHours);
    expect(frozen.estimate.estimatedWeeks).toBe(expected.estimatedWeeks);
    expect(frozen.estimate.minCost).toBe(expected.minCost);
    expect(frozen.estimate.maxCost).toBe(expected.maxCost);
    expect(frozen.estimate.risk).toBe(expected.risk);
  });

  it("hidden_frozen_estimate_survives_a_reopen", () => {
    const brief = seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    transitionBrief("draft", "hidden reopen");
    const frozen = getFrozenEstimate();
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    expect(frozen.estimate.estimatedHours).toBe(createEstimate(brief).estimatedHours);
  });

  it("hidden_second_sign_off_refreezes_with_new_numbers", () => {
    const first = makeBrief({ projectName: "Freeze one" });
    saveBrief(first);
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    const frozenOne = getFrozenEstimate();
    expect(frozenOne.ok).toBe(true);
    if (!frozenOne.ok) return;

    transitionBrief("draft", "wider scope");
    const second = makeBrief({
      projectName: "Freeze two",
      selectedServices: [service("brand-strategy"), service("website-development")],
    });
    saveBrief(second);
    transitionBrief("in-review");
    transitionBrief("ready");
    transitionBrief("signed-off");
    const frozenTwo = getFrozenEstimate();
    expect(frozenTwo.ok).toBe(true);
    if (!frozenTwo.ok) return;
    expect(frozenTwo.estimate.estimatedHours).toBe(createEstimate(second).estimatedHours);
    expect(frozenTwo.estimate.estimatedHours).toBeGreaterThan(0);
  });
});

describe("hidden lifecycle text", () => {
  it("hidden_empty_trail_text_is_exact", () => {
    expect(buildLifecycleText([])).toBe("No lifecycle moves");
  });

  it("hidden_first_line_starts_from_the_word_start", () => {
    seed();
    transitionBrief("in-review");
    const trail = getTrail();
    if (!trail.ok) return;
    const text = buildLifecycleText(trail.events);
    expect(text.split("\n")[0]).toBe("start -> in-review");
  });

  it("hidden_note_appears_in_parentheses", () => {
    reachSignedOff();
    transitionBrief("draft", "client request");
    const trail = getTrail();
    if (!trail.ok) return;
    const text = buildLifecycleText(trail.events);
    expect(text).toContain("signed-off -> draft (client request)");
  });

  it("hidden_lines_without_note_have_no_parentheses", () => {
    seed();
    transitionBrief("in-review");
    const trail = getTrail();
    if (!trail.ok) return;
    expect(buildLifecycleText(trail.events)).not.toContain("(");
  });

  it("hidden_text_has_one_line_per_event", () => {
    seed();
    transitionBrief("in-review");
    transitionBrief("ready");
    const trail = getTrail();
    if (!trail.ok) return;
    const lines = buildLifecycleText(trail.events).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("in-review -> ready");
  });

  it("hidden_text_is_stable_for_the_same_events", () => {
    seed();
    transitionBrief("in-review");
    const trail = getTrail();
    if (!trail.ok) return;
    expect(buildLifecycleText(trail.events)).toBe(buildLifecycleText(trail.events));
  });
});

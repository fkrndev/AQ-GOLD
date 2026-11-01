import { describe, expect, it } from "vitest";
import {
  compressForLaunch,
  rebalanceMilestones,
  weeksUntil,
} from "../../app/(site)/brief/rebalance";
import { estimateWithTimeline } from "../../app/(site)/brief/estimate";
import type { EstimateMilestone } from "../../app/(site)/brief/types";
import { makeBrief, service } from "../helpers";

const milestone = (
  id: string,
  weeks: number,
  paymentPercent: number,
): EstimateMilestone => ({
  id,
  name: `Milestone ${id}`,
  weeks,
  description: `${id} work`,
  outputs: [`${id} output`],
  paymentPercent,
});

const plan = (): EstimateMilestone[] => [
  milestone("align", 3, 30),
  milestone("direction", 4, 30),
  milestone("develop", 5, 25),
  milestone("launch", 2, 15),
];

const sumWeeks = (items: EstimateMilestone[]): number =>
  items.reduce((total, item) => total + item.weeks, 0);

const sumPayment = (items: EstimateMilestone[]): number =>
  items.reduce((total, item) => total + item.paymentPercent, 0);

describe("hidden rebalanceMilestones contract", () => {
  it("hidden_keeps_a_locked_milestone_weeks_and_payment_untouched", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 12, lockedIds: ["develop"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const develop = outcome.milestones.find((item) => item.id === "develop");
    expect(develop?.weeks).toBe(5);
    expect(develop?.paymentPercent).toBe(25);
  });

  it("hidden_lands_the_week_total_exactly", () => {
    for (const total of [5, 8, 12, 20]) {
      const outcome = rebalanceMilestones(plan(), { totalWeeks: total });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expect(sumWeeks(outcome.milestones)).toBe(total);
    }
  });

  it("hidden_lands_the_payment_total_at_exactly_one_hundred", () => {
    for (const total of [5, 9, 16]) {
      const outcome = rebalanceMilestones(plan(), { totalWeeks: total, lockedIds: ["launch"] });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expect(sumPayment(outcome.milestones)).toBe(100);
    }
  });

  it("hidden_keeps_at_least_one_week_and_one_percent_everywhere", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 4 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones.every((item) => item.weeks >= 1)).toBe(true);
    expect(outcome.milestones.every((item) => item.paymentPercent >= 1)).toBe(true);
  });

  it("hidden_returns_an_unchanged_plan_for_a_no_op_request", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 14 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones).toEqual(plan());
  });

  it("hidden_is_deterministic_and_does_not_mutate_its_input", () => {
    const original = plan();
    const first = rebalanceMilestones(original, { totalWeeks: 9, lockedIds: ["direction"] });
    const second = rebalanceMilestones(original, { totalWeeks: 9, lockedIds: ["direction"] });
    expect(first).toEqual(second);
    expect(original).toEqual(plan());
  });

  it("hidden_keeps_order_names_and_outputs_of_every_milestone", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 7, lockedIds: ["align"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones.map((item) => item.id)).toEqual(["align", "direction", "develop", "launch"]);
    expect(outcome.milestones.every((item) => item.name.length > 0)).toBe(true);
    expect(outcome.milestones.every((item) => item.outputs.length > 0)).toBe(true);
  });

  it("hidden_ignores_lock_ids_that_do_not_match_a_milestone", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 14, lockedIds: ["ghost", "align"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sumWeeks(outcome.milestones)).toBe(14);
    expect(outcome.milestones.find((item) => item.id === "align")?.weeks).toBe(3);
  });

  it("hidden_refuses_totals_that_are_not_whole_positive_numbers", () => {
    for (const bad of [0, -4, 3.5, Number.NaN]) {
      const outcome = rebalanceMilestones(plan(), { totalWeeks: bad });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.reason).toBe("invalid-total");
      expect(outcome.releaseCandidates).toEqual([]);
    }
  });

  it("hidden_names_locks_to_release_when_pins_leave_no_room", () => {
    const tight = [
      milestone("align", 6, 50),
      milestone("direction", 6, 40),
      milestone("develop", 1, 5),
      milestone("launch", 1, 5),
    ];
    const outcome = rebalanceMilestones(tight, { totalWeeks: 9, lockedIds: ["align", "direction"] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
    expect(outcome.releaseCandidates.length).toBeGreaterThan(0);
    const retry = rebalanceMilestones(tight, {
      totalWeeks: 9,
      lockedIds: ["align", "direction"].filter((id) => !outcome.releaseCandidates.includes(id)),
    });
    expect(retry.ok).toBe(true);
  });

  it("hidden_refuses_a_timeline_shorter_than_the_milestone_count", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 3 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
    expect(outcome.releaseCandidates).toEqual([]);
  });

  it("hidden_refuses_pins_that_hog_the_whole_payment_split", () => {
    const greedy = [
      milestone("align", 2, 60),
      milestone("direction", 2, 40),
      milestone("develop", 2, 1),
      milestone("launch", 2, 1),
    ];
    const outcome = rebalanceMilestones(greedy, { totalWeeks: 10, lockedIds: ["align", "direction"] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
    expect(outcome.releaseCandidates.length).toBeGreaterThan(0);
  });
});

describe("hidden rebalanceMilestones edge cases", () => {
  it("hidden_is_independent_of_the_order_locks_are_listed_in", () => {
    const first = rebalanceMilestones(plan(), { totalWeeks: 10, lockedIds: ["align", "develop"] });
    const second = rebalanceMilestones(plan(), { totalWeeks: 10, lockedIds: ["develop", "align"] });
    expect(first).toEqual(second);
  });

  it("hidden_returns_an_unchanged_plan_when_everything_is_locked_and_the_total_matches", () => {
    const outcome = rebalanceMilestones(plan(), {
      totalWeeks: 14,
      lockedIds: ["align", "direction", "develop", "launch"],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones).toEqual(plan());
  });

  it("hidden_refuses_when_everything_is_locked_and_the_total_moves", () => {
    const outcome = rebalanceMilestones(plan(), {
      totalWeeks: 10,
      lockedIds: ["align", "direction", "develop", "launch"],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
    expect(outcome.releaseCandidates.length).toBeGreaterThan(0);
  });

  it("hidden_rebalances_plans_of_a_single_milestone", () => {
    const single = [milestone("solo", 4, 100)];
    const outcome = rebalanceMilestones(single, { totalWeeks: 7 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones[0].weeks).toBe(7);
    expect(outcome.milestones[0].paymentPercent).toBe(100);
  });

  it("hidden_holds_the_invariants_across_a_range_of_totals", () => {
    for (let total = 5; total <= 24; total += 1) {
      const outcome = rebalanceMilestones(plan(), { totalWeeks: total, lockedIds: ["launch"] });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) continue;
      expect(sumWeeks(outcome.milestones)).toBe(total);
      expect(sumPayment(outcome.milestones)).toBe(100);
      expect(outcome.milestones.every((item) => item.weeks >= 1)).toBe(true);
      expect(outcome.milestones.every((item) => item.paymentPercent >= 1)).toBe(true);
      expect(outcome.milestones.find((item) => item.id === "launch")?.weeks).toBe(2);
    }
  });

  it("hidden_keeps_a_lock_that_leaves_plenty_of_room_unbinding", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 30, lockedIds: ["launch"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones.find((item) => item.id === "launch")?.weeks).toBe(2);
    expect(outcome.milestones.find((item) => item.id === "launch")?.paymentPercent).toBe(15);
    expect(sumWeeks(outcome.milestones)).toBe(30);
  });
});

describe("hidden distribution and refusal detail", () => {
  const weighted = (): EstimateMilestone[] => [
    milestone("heavy", 8, 40),
    milestone("mid", 4, 30),
    milestone("light", 2, 20),
    milestone("tail", 1, 10),
  ];

  it("hidden_spreads_a_shrinking_timeline_over_the_unlocked_share", () => {
    const outcome = rebalanceMilestones(weighted(), { totalWeeks: 12, lockedIds: ["heavy"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones.find((item) => item.id === "heavy")?.weeks).toBe(8);
  });

  it("hidden_keeps_exact_totals_for_many_plan_shapes", () => {
    const shapes: Array<[number, number][]> = [
      [[2, 25], [2, 25], [2, 25], [2, 25]],
      [[6, 10], [3, 20], [1, 30], [1, 40]],
      [[1, 55], [1, 15], [1, 15], [1, 15]],
    ];
    for (const shape of shapes) {
      const items = shape.map(([weeks, percent], index) => milestone(`m${index}`, weeks, percent));
      for (const total of [4, 6, 9, 13, 18]) {
        const outcome = rebalanceMilestones(items, { totalWeeks: total });
        expect(outcome.ok).toBe(true);
        if (!outcome.ok) continue;
        expect(sumWeeks(outcome.milestones)).toBe(total);
        expect(sumPayment(outcome.milestones)).toBe(100);
      }
    }
  });

  it("hidden_prefers_the_heaviest_pin_when_naming_release_candidates", () => {
    const tight = [
      milestone("small-pin", 2, 10),
      milestone("big-pin", 7, 40),
      milestone("rest-a", 2, 25),
      milestone("rest-b", 2, 25),
    ];
    const outcome = rebalanceMilestones(tight, { totalWeeks: 8, lockedIds: ["small-pin", "big-pin"] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.releaseCandidates[0]).toBe("big-pin");
  });

  it("hidden_does_not_mutate_nested_fields_of_the_input", () => {
    const original = plan();
    const snapshot = JSON.stringify(original);
    rebalanceMilestones(original, { totalWeeks: 7, lockedIds: ["develop"] });
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("hidden_treats_equal_unlocked_weights_fairly", () => {
    const even = [
      milestone("a", 3, 25),
      milestone("b", 3, 25),
      milestone("c", 3, 25),
      milestone("d", 3, 25),
    ];
    const outcome = rebalanceMilestones(even, { totalWeeks: 10, lockedIds: ["a"] });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones.find((item) => item.id === "a")?.weeks).toBe(3);
    const others = outcome.milestones.filter((item) => item.id !== "a").map((item) => item.weeks);
    expect(Math.max(...others) - Math.min(...others)).toBeLessThanOrEqual(1);
    expect(others.reduce((total, weeks) => total + weeks, 0)).toBe(7);
    expect(sumWeeks(outcome.milestones)).toBe(10);
  });

  it("hidden_keeps_refusals_stable_across_repeated_calls", () => {
    const tight = [
      milestone("align", 6, 50),
      milestone("direction", 6, 40),
      milestone("develop", 1, 5),
      milestone("launch", 1, 5),
    ];
    const first = rebalanceMilestones(tight, { totalWeeks: 9, lockedIds: ["align", "direction"] });
    const second = rebalanceMilestones(tight, { totalWeeks: 9, lockedIds: ["align", "direction"] });
    expect(first).toEqual(second);
    expect(JSON.stringify(tight)).toContain('"weeks":6');
  });

  it("hidden_works_when_only_the_payment_split_is_under_pressure", () => {
    const paymentHeavy = [
      milestone("anchor", 2, 70),
      milestone("second", 2, 30),
      milestone("third", 2, 2),
      milestone("fourth", 2, 2),
    ];
    const outcome = rebalanceMilestones(paymentHeavy, { totalWeeks: 8, lockedIds: ["anchor", "second"] });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
    expect(outcome.releaseCandidates.length).toBeGreaterThan(0);
  });

  it("hidden_fits_a_compress_request_with_two_locks_when_room_allows", () => {
    const outcome = compressForLaunch(plan(), "2026-01-05", "2026-03-09", ["align", "launch"]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sumWeeks(outcome.milestones)).toBe(9);
    expect(outcome.milestones.find((item) => item.id === "align")?.weeks).toBe(3);
    expect(outcome.milestones.find((item) => item.id === "launch")?.weeks).toBe(2);
    expect(sumPayment(outcome.milestones)).toBe(100);
  });
});

  it("hidden_always_explains_a_refusal_in_plain_text", () => {
    const outcome = rebalanceMilestones(plan(), { totalWeeks: 2 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.message.length).toBeGreaterThan(10);
  });

import { describe, expect, it } from "vitest";
import { compressForLaunch, weeksUntil } from "../../app/(site)/brief/rebalance";
import { createEstimate, estimateWithTimeline } from "../../app/(site)/brief/estimate";
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

describe("hidden weeksUntil contract", () => {
  it("hidden_counts_whole_weeks_and_rounds_down", () => {
    expect(weeksUntil("2026-01-05", "2026-02-02")).toBe(4);
    expect(weeksUntil("2026-01-05", "2026-02-01")).toBe(3);
    expect(weeksUntil("2026-01-05", "2026-01-11")).toBe(0);
    expect(weeksUntil("2026-01-05", "2026-01-12")).toBe(1);
    expect(weeksUntil("2026-01-05", "2026-01-05")).toBe(0);
    expect(weeksUntil("2026-02-02", "2026-01-05")).toBe(0);
  });

  it("hidden_treats_unparseable_dates_as_zero_weeks", () => {
    expect(weeksUntil("not-a-date", "2026-02-02")).toBe(0);
    expect(weeksUntil("2026-01-05", "not-a-date")).toBe(0);
  });
});

describe("hidden compressForLaunch contract", () => {
  it("hidden_leaves_a_plan_alone_when_it_already_fits", () => {
    const outcome = compressForLaunch(plan(), "2026-01-05", "2026-04-14");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.milestones).toEqual(plan());
  });

  it("hidden_treats_an_exact_fit_as_fitting", () => {
    // fourteen weeks to the day is exactly the plan's footprint
    const outcome = compressForLaunch(plan(), "2026-01-05", "2026-04-13");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sumWeeks(outcome.milestones)).toBe(14);
  });

  it("hidden_compresses_into_the_available_weeks_keeping_locks", () => {
    const outcome = compressForLaunch(plan(), "2026-01-05", "2026-02-09", ["launch"]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sumWeeks(outcome.milestones)).toBe(5);
    expect(outcome.milestones.find((item) => item.id === "launch")?.weeks).toBe(2);
    expect(outcome.milestones.find((item) => item.id === "launch")?.paymentPercent).toBe(15);
    expect(sumPayment(outcome.milestones)).toBe(100);
    expect(outcome.milestones.every((item) => item.weeks >= 1)).toBe(true);
  });

  it("hidden_compresses_without_locks_when_none_are_given", () => {
    const outcome = compressForLaunch(plan(), "2026-01-05", "2026-02-02");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sumWeeks(outcome.milestones)).toBe(4);
    expect(sumPayment(outcome.milestones)).toBe(100);
  });

  it("hidden_refuses_a_launch_date_that_cannot_hold_the_plan", () => {
    const outcome = compressForLaunch(plan(), "2026-01-05", "2026-01-20", ["align"]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
  });

  it("hidden_refuses_a_launch_before_the_kickoff", () => {
    const outcome = compressForLaunch(plan(), "2026-02-02", "2026-01-05");
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
  });
});

describe("hidden estimateWithTimeline contract", () => {
  const brief = makeBrief({
    selectedServices: [service("research"), service("brand-strategy")],
    timelineRange: "six-to-ten",
  });

  it("hidden_returns_an_estimate_whose_plan_fits_the_request", () => {
    const outcome = estimateWithTimeline(brief, { totalWeeks: 9 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(sumWeeks(outcome.estimate.milestones)).toBe(9);
    expect(outcome.estimate.estimatedWeeks).toBe(9);
    expect(sumPayment(outcome.estimate.milestones)).toBe(100);
  });

  it("hidden_keeps_the_real_milestone_ids_from_the_estimator", () => {
    const outcome = estimateWithTimeline(brief, { totalWeeks: 12 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.estimate.milestones.map((item) => item.id)).toEqual([
      "align",
      "direction",
      "develop",
      "launch",
    ]);
  });

  it("hidden_leaves_the_cost_side_of_the_estimate_intact", () => {
    const outcome = estimateWithTimeline(brief, { totalWeeks: 11 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.estimate.currency).toBe("INR");
    expect(outcome.estimate.minCost).toBeGreaterThan(0);
    expect(outcome.estimate.lines.length).toBeGreaterThan(0);
  });

  it("hidden_honours_a_pin_through_the_full_estimate", () => {
    const base = createEstimate(brief);
    const baseAlign = base.milestones.find((item) => item.id === "align");
    const total = Math.max(base.estimatedWeeks, 12);
    const pinned = estimateWithTimeline(brief, { totalWeeks: total, lockedIds: ["align"] });
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) return;
    const align = pinned.estimate.milestones.find((item) => item.id === "align");
    expect(align?.weeks).toBe(baseAlign?.weeks);
    expect(align?.paymentPercent).toBe(baseAlign?.paymentPercent);
    expect(sumWeeks(pinned.estimate.milestones)).toBe(total);
  });

  it("hidden_carries_a_refusal_through_from_the_rules", () => {
    const refusal = makeBrief({ selectedServices: [service("research")] });
    const outcome = estimateWithTimeline(refusal, { totalWeeks: 2 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("unsatisfiable");
  });
});

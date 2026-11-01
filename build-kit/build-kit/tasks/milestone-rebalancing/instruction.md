Milestone math, by hand, again. Client moves a launch date and four week counts need redoing. I got sick of it.

The estimate page hands me milestones with weeks and a payment percent that always sums to one hundred. Nothing can be locked. I change the total, everything moves, including the part the client already approved. That is the hole in my week.

Fix goes in app/(site)/brief/rebalance.ts. A pinned milestone keeps its weeks and its percent, untouched, always. The unpinned ones absorb whatever change is left over. Every milestone keeps at least 1 week and at least 1 percent. Weeks land on the requested total exactly, payment still sums to 100 exactly. The input array is never mutated. Two calls with the same arguments give the same answer.

rebalanceMilestones(milestones, request) takes a totalWeeks number and optional lockedIds and returns { ok: true, milestones } or { ok: false, reason, message, releaseCandidates }. reason is "invalid-total" when the total is not a whole positive number, "unsatisfiable" when the pins leave no room. releaseCandidates names the pinned ids worth dropping, heaviest first, empty when there is nothing to suggest.

weeksUntil(kickoff, launch) → whole weeks between two ISO dates, floored. Launch before kickoff, or a date that will not parse, gives zero.

compressForLaunch(milestones, kickoff, launch, lockedIds) → the same plan when it already fits, a compressed plan when it does not, a refusal when even compression cannot save it.

estimateWithTimeline(brief, request) in estimate.ts → { ok: true, estimate } with estimate.estimatedWeeks equal to totalWeeks.

Estimates that are not touched stay byte-identical to today.

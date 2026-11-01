import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEstimate } from "../../app/(site)/brief/estimate";
import { buildRatesGapText } from "../../app/(site)/brief/export";
import {
  CURRENT_RATES_VERSION,
  LEGACY_RATES_VERSION,
  estimateAtRates,
  getStampedVersion,
  ratesGap,
  snapshotRates,
  stampRates,
  tableFor,
} from "../../app/(site)/brief/rates";
import type { RateTable } from "../../app/(site)/brief/types";
import { makeBrief, service } from "../helpers";

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

const brief = () =>
  makeBrief({
    projectName: "Gap hidden",
    selectedServices: [service("brand-strategy"), service("website-development"), service("photography")],
  });

const history = (): RateTable[] => {
  const current = snapshotRates();
  const legacy: RateTable = { ...current, version: LEGACY_RATES_VERSION };
  const future: RateTable = {
    ...current,
    version: 3,
    services: {
      ...current.services,
      "brand-strategy": { ...current.services["brand-strategy"], hours: current.services["brand-strategy"].hours + 12 },
    },
  };
  return [legacy, current, future];
};

describe("hidden rate tables", () => {
  it("hidden_snapshot_carries_the_current_version", () => {
    expect(snapshotRates().version).toBe(CURRENT_RATES_VERSION);
  });

  it("hidden_snapshot_covers_services_and_deliverables", () => {
    const table = snapshotRates();
    expect(Object.keys(table.services).length).toBeGreaterThan(5);
    expect(Object.keys(table.deliverables).length).toBeGreaterThan(5);
  });

  it("hidden_table_for_finds_and_misses", () => {
    const tables = history();
    expect(tableFor(tables, 1)?.version).toBe(1);
    expect(tableFor(tables, 3)?.version).toBe(3);
    expect(tableFor(tables, 42)).toBe(null);
  });
});

describe("hidden estimate under a table", () => {
  it("hidden_snapshot_estimate_equals_createEstimate", () => {
    expect(estimateAtRates(brief(), snapshotRates())).toEqual(createEstimate(brief()));
  });

  it("hidden_changed_table_changes_the_estimate", () => {
    const tables = history();
    const before = estimateAtRates(brief(), tables[0]);
    const after = estimateAtRates(brief(), tables[2]);
    expect(after.estimatedHours).toBeGreaterThan(before.estimatedHours);
  });

  it("hidden_costs_follow_the_table", () => {
    const tables = history();
    const before = estimateAtRates(brief(), tables[0]);
    const after = estimateAtRates(brief(), tables[2]);
    expect(after.minCost).toBeGreaterThanOrEqual(before.minCost);
  });
});

const stampedVersionNow = (): number => {
  const read = getStampedVersion();
  return read.ok ? read.version : -1;
};

describe("hidden gap between stamped and newest", () => {
  it("hidden_identical_numbers_read_as_unchanged", () => {
    const tables = history().slice(0, 2);
    const gap = ratesGap(brief(), tables);
    expect(gap.ok).toBe(true);
    if (!gap.ok) return;
    expect(buildRatesGapText(gap.gap)).toBe("Rates unchanged");
  });

  it("hidden_unchanged_gap_has_no_changed_lines", () => {
    const gap = ratesGap(brief(), history().slice(0, 2));
    if (!gap.ok) return;
    expect(gap.gap.changedLines).toHaveLength(0);
    expect(gap.gap.hoursThen).toBe(gap.gap.hoursNow);
  });

  it("hidden_gap_compares_stamp_to_newest_version", () => {
    const tables = history();
    stampRates("gap-brief", 2, tables);
    const gap = ratesGap(brief(), tables);
    expect(gap.ok).toBe(true);
    if (!gap.ok) return;
    expect(gap.gap.versionThen).toBe(2);
    expect(gap.gap.versionNow).toBe(3);
  });

  it("hidden_unstamped_brief_reads_the_legacy_table", () => {
    const gap = ratesGap(brief(), history());
    expect(gap.ok).toBe(true);
    if (!gap.ok) return;
    expect(gap.gap.versionThen).toBe(LEGACY_RATES_VERSION);
  });

  it("hidden_gap_then_side_matches_the_stamped_estimate", () => {
    const tables = history();
    stampRates("gap-brief", 1, tables);
    const expected = estimateAtRates(brief(), tables[0]);
    const gap = ratesGap(brief(), tables);
    if (!gap.ok) return;
    expect(gap.gap.hoursThen).toBe(expected.estimatedHours);
    expect(gap.gap.minThen).toBe(expected.minCost);
    expect(gap.gap.maxThen).toBe(expected.maxCost);
  });

  it("hidden_gap_lists_only_the_changed_service", () => {
    const tables = history();
    stampRates("gap-brief", 2, tables);
    const gap = ratesGap(brief(), tables);
    if (!gap.ok) return;
    expect(gap.gap.changedLines).toHaveLength(1);
    expect(gap.gap.changedLines[0].name.toLowerCase()).toContain("brand");
    expect(gap.gap.changedLines[0].hoursNow).toBeGreaterThan(gap.gap.changedLines[0].hoursThen);
  });

  it("hidden_gap_survives_a_missing_stamp_table", () => {
    const tables = history();
    stampRates("gap-brief", 2, tables);
    const withoutTwo = tables.filter((table) => table.version !== 2);
    const gap = ratesGap(brief(), withoutTwo);
    expect(gap.ok).toBe(false);
    if (gap.ok) return;
    expect(gap.reason).toBe("version-unknown");
  });

  it("hidden_gap_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const gap = ratesGap(brief(), history());
    expect(gap.ok).toBe(false);
    if (gap.ok) return;
    expect(gap.reason).toBe("storage-unavailable");
  });

  it("hidden_reading_the_gap_does_not_restamp", () => {
    const tables = history();
    stampRates("gap-brief", 2, tables);
    ratesGap(brief(), tables);
    ratesGap(brief(), tables);
    expect(stampedVersionNow()).toBe(2);
  });
});

describe("hidden gap text format", () => {
  it("hidden_gap_text_lines_are_exact", () => {
    const tables = history();
    stampRates("gap-brief", 2, tables);
    const gap = ratesGap(brief(), tables);
    if (!gap.ok) return;
    const text = buildRatesGapText(gap.gap);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Rates then and now");
    expect(lines[1]).toMatch(/: \d+ -> \d+ hours$/);
    expect(lines[2]).toBe(`Total: ${gap.gap.hoursThen} -> ${gap.gap.hoursNow} hours`);
  });

  it("hidden_gap_text_needs_no_storage", () => {
    vi.unstubAllGlobals();
    const text = buildRatesGapText({
      versionThen: 1,
      versionNow: 3,
      hoursThen: 10,
      hoursNow: 22,
      minThen: 1,
      minNow: 2,
      maxThen: 3,
      maxNow: 4,
      changedLines: [{ id: "service-brand-strategy", name: "Brand strategy", hoursThen: 10, hoursNow: 22 }],
    });
    expect(text.split("\n")[0]).toBe("Rates then and now");
    expect(text).toContain("Brand strategy: 10 -> 22 hours");
    expect(text).toContain("Total: 10 -> 22 hours");
  });

  it("hidden_unchanged_text_is_exact_without_storage", () => {
    vi.unstubAllGlobals();
    expect(
      buildRatesGapText({
        versionThen: 2,
        versionNow: 2,
        hoursThen: 5,
        hoursNow: 5,
        minThen: 1,
        minNow: 1,
        maxThen: 2,
        maxNow: 2,
        changedLines: [],
      }),
    ).toBe("Rates unchanged");
  });
});

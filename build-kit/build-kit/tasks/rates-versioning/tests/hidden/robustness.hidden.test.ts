import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_RATES_VERSION,
  LEGACY_RATES_VERSION,
  estimateAtRates,
  getStampedVersion,
  ratesGap,
  snapshotRates,
  stampRates,
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
  makeBrief({ projectName: "Robust rates", selectedServices: [service("brand-strategy"), service("naming")] });

const history = (): RateTable[] => {
  const current = snapshotRates();
  const legacy: RateTable = { ...current, version: LEGACY_RATES_VERSION };
  const future: RateTable = {
    ...current,
    version: 3,
    services: {
      ...current.services,
      naming: { ...current.services.naming, hours: current.services.naming.hours + 20 },
    },
  };
  return [legacy, current, future];
};

describe("hidden old numbers survive", () => {
  it("hidden_stamped_brief_keeps_its_numbers_after_a_rate_change", () => {
    const tables = history();
    const stamped = stampRates("robust-brief", 2, tables);
    expect(stamped.ok).toBe(true);
    const before = estimateAtRates(brief(), tables[1]);
    ratesGap(brief(), tables);
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(2);
    const gap = ratesGap(brief(), tables);
    if (!gap.ok) return;
    expect(gap.gap.hoursThen).toBe(before.estimatedHours);
  });

  it("hidden_gap_never_upgrades_the_stamp", () => {
    const tables = history();
    stampRates("robust-brief", 1, tables);
    for (let i = 0; i < 3; i += 1) {
      ratesGap(brief(), tables);
    }
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(1);
  });

  it("hidden_estimate_reads_do_not_restamp", () => {
    const tables = history();
    estimateAtRates(brief(), tables[2]);
    estimateAtRates(brief(), snapshotRates());
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(LEGACY_RATES_VERSION);
  });

  it("hidden_stamp_survives_storage_round_trip", () => {
    const tables = history();
    stampRates("robust-brief", CURRENT_RATES_VERSION, tables);
    const raw = Array.from(store.entries());
    store.clear();
    for (const [key, value] of raw) store.set(key, value);
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(CURRENT_RATES_VERSION);
  });
});

describe("hidden storage guards", () => {
  it("hidden_every_read_reports_storage_unavailable_without_window", () => {
    vi.stubGlobal("window", {});
    expect(getStampedVersion().ok).toBe(false);
    expect(ratesGap(brief(), history()).ok).toBe(false);
  });
});

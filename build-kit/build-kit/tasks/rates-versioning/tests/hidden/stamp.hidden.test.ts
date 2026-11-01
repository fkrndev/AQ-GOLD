import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_RATES_VERSION,
  LEGACY_RATES_VERSION,
  getStampedVersion,
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

const briefId = () => makeBrief({ projectName: "Stamp hidden", selectedServices: [service("brand-strategy")] }).id;

/** v1 legacy numbers, v2 today, v3 a future edit of one service. */
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

describe("hidden stamped version reads", () => {
  it("hidden_unstamped_brief_reads_the_legacy_version", () => {
    const read = getStampedVersion();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.version).toBe(LEGACY_RATES_VERSION);
  });

  it("hidden_stamped_version_round_trips", () => {
    const stamped = stampRates(briefId(), 3, history());
    expect(stamped.ok).toBe(true);
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(3);
  });

  it("hidden_stamp_carries_brief_id_and_time", () => {
    const id = briefId();
    const stamped = stampRates(id, 2, history());
    expect(stamped.ok).toBe(true);
    if (!stamped.ok) return;
    expect(stamped.stamp.briefId).toBe(id);
    expect(typeof stamped.stamp.stampedAt).toBe("string");
    expect(stamped.stamp.stampedAt.length).toBeGreaterThan(0);
  });

  it("hidden_restamping_replaces_the_stamp", () => {
    const tables = history();
    stampRates(briefId(), 2, tables);
    stampRates(briefId(), 3, tables);
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(3);
  });

  it("hidden_stamped_version_does_not_drift_on_repeat_reads", () => {
    const tables = history();
    stampRates(briefId(), 2, tables);
    const first = getStampedVersion();
    const second = getStampedVersion();
    expect(first).toEqual(second);
  });

  it("hidden_stamp_refuses_an_unknown_version", () => {
    const refused = stampRates(briefId(), 99, history());
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe("version-unknown");
    const read = getStampedVersion();
    expect(read.ok && read.version).toBe(LEGACY_RATES_VERSION);
  });

  it("hidden_stamp_refuses_version_zero_and_negatives", () => {
    for (const bad of [0, -1]) {
      const refused = stampRates(briefId(), bad, history());
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.reason).toBe("version-unknown");
    }
  });
});

describe("hidden stamp storage failures", () => {
  it("hidden_stamp_read_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const read = getStampedVersion();
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe("storage-unavailable");
  });

  it("hidden_stamp_write_reports_storage_unavailable", () => {
    vi.stubGlobal("window", {});
    const stamped = stampRates(briefId(), CURRENT_RATES_VERSION, history());
    expect(stamped.ok).toBe(false);
    if (stamped.ok) return;
    expect(stamped.reason).toBe("storage-unavailable");
  });

  it("hidden_failing_setitem_reports_storage_unavailable", () => {
    const refusing = {
      ...localStorageMock,
      setItem: (_key: string, _value: string) => {
        throw new Error("quota exceeded");
      },
    };
    vi.stubGlobal("window", { localStorage: refusing });
    const stamped = stampRates(briefId(), CURRENT_RATES_VERSION, history());
    expect(stamped.ok).toBe(false);
    if (stamped.ok) return;
    expect(stamped.reason).toBe("storage-unavailable");
  });
});

/** Corrupts every stored key, whatever the module calls them. */
const seedThenCorrupt = (payload: string) => {
  const stamped = stampRates(briefId(), CURRENT_RATES_VERSION, history());
  expect(stamped.ok).toBe(true);
  expect(store.size).toBeGreaterThan(0);
  for (const key of Array.from(store.keys())) {
    store.set(key, payload);
  }
};

describe("hidden corrupt stamp data", () => {
  it("hidden_garbage_stamp_reads_as_legacy", () => {
    seedThenCorrupt("{{{ not json");
    const read = getStampedVersion();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.version).toBe(LEGACY_RATES_VERSION);
  });

  it("hidden_wrong_shape_stamp_reads_as_legacy", () => {
    seedThenCorrupt(JSON.stringify({ hello: "world" }));
    const read = getStampedVersion();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.version).toBe(LEGACY_RATES_VERSION);
  });

  it("hidden_non_numeric_version_reads_as_legacy", () => {
    seedThenCorrupt(JSON.stringify({ briefId: "b", version: "two", stampedAt: "x" }));
    const read = getStampedVersion();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.version).toBe(LEGACY_RATES_VERSION);
  });
});

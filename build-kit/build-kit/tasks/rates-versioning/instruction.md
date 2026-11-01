Estimates here quietly move. Rates live in the catalog, the catalog gets edited, and a saved brief wakes up with numbers the client never agreed to.

So rates become versioned data. A table carries a version, a brief is stamped with the version it was estimated under, and a stamped brief keeps reading its own version however often rates change later. Only stamping again moves the version. The gap report sets the stamped estimate next to the newest one.

It goes in app/(site)/brief/rates.ts, with estimate.ts reading numbers from the passed table, not the catalog. Other code imports these names, exact:

LEGACY_RATES_VERSION = 1, CURRENT_RATES_VERSION = 2
snapshotRates() → today's catalog numbers as a versioned table
tableFor(history, version) → the table with that version, else null
getStampedVersion() → { ok: true, version } or { ok: false, reason: "storage-unavailable" }; no stamp reads as version 1
stampRates(briefId, version, history) → { ok: true, stamp } or { ok: false, reason: "version-unknown" or "storage-unavailable" }
estimateAtRates(brief, table) → the estimate under that table
ratesGap(brief, history) → { ok: true, gap } or { ok: false, reason: "version-unknown" or "storage-unavailable" }

A stamp is { briefId, version, stampedAt }. A table is { version, services, deliverables }, a service carrying hours, minCost and maxCost, a deliverable additionalHours and additionalCost.

The rules that matter. Reading never restamps: getStampedVersion and ratesGap return the stored version untouched. Stamp data that will not parse reads as version 1. The gap takes the stamped side as then, the newest table as now. buildRatesGapText(gap) in export.ts renders one line per changed service as "name: then -> now hours" under "Rates then and now", closes with "Total: then -> now hours", and reads exactly "Rates unchanged" when nothing moved.

It all stays in the browser like the current save.

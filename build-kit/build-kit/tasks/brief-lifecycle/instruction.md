Our briefs have no state. One gets called finished, someone keeps typing, later nobody remembers what was agreed. Lost an evening to that once.

So a brief gets a lifecycle: draft, in-review, ready, signed-off. Draft goes to in review, then ready, then signed off, and signing off freezes the estimate with its hours, weeks, costs and risk. Editing is then refused until a reopen is recorded. A reopen returns the brief to draft and needs a note. Anything else is refused, skipping ahead included. The frozen numbers survive a reopen and are replaced only by the next sign off.

It goes in app/(site)/brief/lifecycle.ts. Other code imports these names, exact:

getStatus() → current status, draft by default
transitionBrief(to, note?) → { ok: true, status, event } or { ok: false, reason, message }: "not-found" without a saved brief, "move-not-allowed" outside the path, "note-required" on a noteless reopen, "storage-unavailable"
getTrail() → { ok: true, events } or { ok: false, reason }, same not-found and storage reasons
getFrozenEstimate() → { ok: true, estimate } or { ok: false, reason: "not-frozen" or "storage-unavailable" }
ensureEditable() → { ok: true } or { ok: false, reason: "signed-off" or "storage-unavailable" }

The rules that matter. The trail is append only, one event per move, oldest first, never rewritten, growing after a reopen. The first event comes from the start, not a status. An event is { at, from, to, note }, note trimmed. buildLifecycleText(events) in export.ts writes one line per move as from -> to, opening with the word start, a note in parentheses when present; an empty trail gives "No lifecycle moves".

All of it lives in the browser like the current save. Data that will not parse counts as a fresh draft, and a brief saved before this change starts as a draft.

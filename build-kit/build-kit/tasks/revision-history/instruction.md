We keep losing work. Someone refines a brief for an hour, saves, then tries a different direction and saves again. The old direction is gone. There is no undo, no history, nothing. Just one brief sitting in localStorage and that is it.

So: named revisions. I want to save the current brief under a label, list what I have saved, go back to any of them, and throw away the ones I do not need. All of this stays in the browser, same as the current save.

The rules that matter. Restoring must never overwrite what I am restoring from. It creates a new revision, not a replacement. The history is capped at twenty. When full, the oldest ones go first, except the very first revision I ever saved is always kept. Saving with the same label replaces that slot rather than making a duplicate. Labels are trimmed before use. A blank label is refused.

Put it in app/(site)/brief/revisions.ts. Names and shapes must be exact, other code imports them:

saveRevision(brief, name) → { ok: true, revision } or { ok: false, reason: "name-blank" | "storage-unavailable" }
listRevisions() → { ok: true, revisions: RevisionMeta[] } or { ok: false, reason: "storage-unavailable" } — newest first
loadRevision(name) → { ok: true, revision } or { ok: false, reason: "not-found" }
deleteRevision(name) → same shape, reason can also be "anchor-protected"
restoreRevision(name) → loads and saves as new, name gets " (restored)" appended

RevisionMeta has { id, name, savedAt, briefId } — no brief field in the listing.
MAX_REVISIONS = 20. buildRevisionListText(revisions) in export.ts formats the list as text. An empty list exports the text "No saved revisions". History data that cannot be parsed is treated as an empty history rather than an error.

Briefs saved today keep working exactly as they do now.

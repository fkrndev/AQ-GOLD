# maintkit 1.3.4

Write a task on your own machine, check its structure, and pack the zip the
task page takes. This release includes the platform's structural checks; a
local PASS does not guarantee submission or reference verification will pass.
Full local verification also requires a Git working copy containing the exact
pinned base commit and the approved environment Dockerfile.

## Requirements

- Node.js 20 or newer for structural checks and draft packaging.
- Git and the exact pinned commit for patch applicability or full verification.
- `verify` also needs Docker (images are built for linux/amd64; on Apple
  silicon Docker emulates it, which is slower).

## Install

```
cd build-kit
./maintkit rules
```

Add the folder to your PATH, or call `./maintkit` from it. Keep your tasks
under `tasks/`: updates never touch it.

## Workflow

1. **Create the task on the platform first** (New task): pick the repository,
   the environment version and a task name. Note the task's base commit: the
   `base_commit` line of its `tests/grader/grader.yaml` on the task page.
2. **Scaffold it here** with the same name:
   `maintkit init tasks/<name> --base <commit>`. The folder is exactly what the
   task page's workspace starts with.
3. **Write the task**: `instruction.md` (the description only; the
   repository's codebase guidelines are added when you submit), the three
   patches under `solution/` (unified diffs against the base commit),
   `tests/grader/grader.yaml` (the mechanical checks: tests, commands and
   scope; the `f2p` and `p2p` criteria list the id of every test they
   run), the `[[criterion]]` tables of `tests/grader/rubric.toml` (the
   judged criteria), hidden tests under `tests/hidden/`, and the two display
   fields in `task.toml`. Leave every other file as it is: the platform keeps
   its own copies (it also rewrites the `[judge]` table at the top of
   `rubric.toml` and `judge-prompt.md` beside it).
4. **Check structure**: `maintkit check tasks/<name>`. This does not apply
   patches or run tests. If you have the exact pinned commit in a Git working
   copy, add `--repo <working copy>` to check each patch's applicability.
5. **Verify locally, when supported**: `maintkit verify tasks/<name> --repo <working copy> --dockerfile <environment Dockerfile>`.
   This requires the exact pinned Git commit and the approved Dockerfile for
   that environment version, as available to a repository owner or with a
   supplied workspace. It builds images locally; it does not pull the
   platform's private environment image.
6. **Pack**: `maintkit pack tasks/<name>` writes `tasks/<name>.zip`.
7. **Upload**: drop the zip on the task page (or add it on New task). It
   replaces the description, the three patches, the grading criteria and the
   hidden tests; the generated files stay. Then submit from the task page.

## The instruction

`instruction.md` is plain prose from top to bottom: no Markdown headings (a
line starting with `#`, or a line of `===` or `---` under a line of text)
outside fenced code blocks. Where a label helps, put it in a sentence. You
write the description; on submit the platform adds the repository's codebase
guidelines, also plain prose, and a closing line. A submitted instruction
reads like this:

```text
Retrying a failed upload from the queue page sometimes sends the file twice when the first attempt timed out, and the second copy shows up as a separate item. Make retries safe: a retried upload should end up as one item, whatever happened to the first attempt.

Run the tests with `python -m pytest` from the repository root. Existing test files include `tests/test_uploads.py`. Every behavior change comes with tests that cover it.

Run the linter with `ruff check .` from the repository root. Run the formatter with `ruff format .` from the repository root.

Match the structure, naming and error handling of the surrounding code; keep public interfaces stable unless the change requires otherwise.

You are already on the correct base commit. Do not rebase or start from master, main, or any other branch.
```

## Borrowed repository ZIPs

A connected repository's borrowed ZIP is a source snapshot without Git history.
It cannot resolve the pinned commit required by `--repo` or `verify`. The
published environment Dockerfile may also be unavailable in that ZIP.

Use `maintkit check tasks/<name>` and `maintkit pack tasks/<name>` without
`--repo` for structural checks and draft packaging only. These commands do
not prove patch applicability or execute the verifier. Full local verification
is currently unavailable from that borrowed ZIP alone. Keep the original base
commit unchanged. Private-registry login does not fix this workflow. If the
required inputs are unavailable, report the local setup issue; submitting a
task is not a way to debug missing local inputs.

## Commands

- `maintkit init tasks/<name> --base <commit>`: Scaffold a task folder the way New task does: the description, the three patches, the grading criteria, hidden tests and the verifier frame. Use the task's base commit (its grader.yaml shows it).
- `maintkit check tasks/<name>`: Structural checks on your files, offline, without executing tests: the description, the grading criteria and their structure, the size and test-count minimums, scope, the calibrations, and that each patch is a clean diff.
- `maintkit verify tasks/<name> --repo <working copy> --dockerfile <environment Dockerfile>`: Requires a real Git working copy containing the pinned base and the approved environment Dockerfile. Build locally and grade the four patches; a borrowed source ZIP alone cannot support this command.
- `maintkit pack tasks/<name>`: Run structural checks, then package a draft zip for the task page. This does not apply patches or execute the verifier.
- `maintkit rules`: The ranges every check uses. Ranges, not targets.

Run `maintkit <command> --help` for a command's options.

## The test criteria

The `f2p` (fail-to-pass: your new tests) and `p2p` (pass-to-pass: the
existing tests next to the change) criteria in `tests/grader/grader.yaml`
each run a command that writes a test report, and list the id of every test
that must pass in that report:

```
  - id: f2p
    category: patch_specific
    description: The new tests that prove the change pass.
    method: classical
    role: f2p
    blocker: true
    weight: 1
    command: "python -m pytest -q /tests/hidden --junitxml=/logs/verifier/f2p.xml"
    timeout_seconds: 100
    report: /logs/verifier/f2p.xml
    tests:
      - test_subtract.test_subtract_two_positives
      - test_subtract.test_subtract_to_a_negative
```

- `report` is the file the command writes, under `/logs/verifier/`.
  `format` is `junit` (the default) or `ctrf`.
- Each entry in `tests` is a test id as the report names it: for JUnit,
  `classname.name` of a `<testcase>` (just `name` when it has no
  classname); for ctrf, the test's `name` (`suite.name` with
  `node_id: suite.name`). Run the command once and copy the ids from the
  report it writes.
- Every listed id must come back passed in the report. An id the report does
  not have fails the criterion, so `verify` shows a misspelled id at once.
- The minimum test counts are counted from these lists: a criterion with no
  `tests` names no test.

## The judged criteria

`tests/grader/rubric.toml` holds one `[[criterion]]` table per yes/no
question a maintainer asks about the change:

```
[[criterion]]
id = "errors-use-module-pattern"
description = "Does the change in src/api/client.ts report failures the way the rest of the module does?"
type = "binary"
weight = 1

[criterion.annotations]
blocker = false
```

The judge asks each question once and answers yes (1) or no (0). A
criterion counts toward the task's score at its weight. With
`blocker = true`, a no makes the attempt score 0, like a blocker in
grader.yaml: use it only where a maintainer would refuse the change over that
alone. Each question checks one thing, names the file or directory it judges,
and describes behavior, not a name the change must use.

`verify` grades them with a judge you provide: any chat-completions
endpoint.

```
export MAINTKIT_JUDGE_BASE_URL=https://<your endpoint>/v1
export MAINTKIT_JUDGE_KEY=<your key>
export MAINTKIT_JUDGE_MODEL=<a model your endpoint serves>
```

Optional: `MAINTKIT_JUDGE_EFFORT` (low, medium, high) and `MAINTKIT_JUDGE_SAMPLES`
(answers per criterion, their median taken; 1 by default, as on the platform).
Without the first three, verify leaves rubric.toml out and says which results it
could not decide. A local score is an estimate: the platform's own judge
decides after you submit.

## What the checks hold you to

- Task description: 60 to 300 words, not counting the guidelines.
- `instruction.md`: no Markdown headings outside fenced code blocks.
- 5 to 15 judged criteria in `rubric.toml`, each `type = "binary"`, optionally a blocker.
- `grader.yaml` holds tests, commands and scope only (methods `classical`, `command`, `reverse_classical`, `scope`).
- `f2p` and `p2p` blockers, method `classical`, `blocker: true`, each with a `report` and the ids it must pass in `tests`.
- Golden patch size: at least 450 added lines across at least 4 files (solution/patch.diff).
- Hidden tests: at least 430 non-blank lines across at least 2 test files under tests/hidden/.
- F2P tests: at least 10 test ids listed in the f2p criterion's tests (a warning below 20).
- P2P tests: at least 50 test ids listed in the p2p criterion's tests.
- Patch lines per word: 0.9–7.5 golden patch added lines per task description word.
- Golden patch: every blocker passes and the judged score is at least 0.9.
- No change: reward 0.
- Negative patch: fails a blocker, or scores under 0.5.
- Alternative patch: passes every blocker.

## Not checked here

The names a task may not carry, the three checks the platform writes into
`grader.yaml` from your repository's toolchain on submit (you can change
their blocker and weight), and the repository's codebase guidelines. The
submit checks them.

## Updating

When a new release is published, the Build kit tab offers an update zip:

```
unzip maintkit-build-kit-<version>-update.zip
sh maintkit-build-kit-<version>-update/apply.sh <path to build-kit>
```

Re-run `maintkit pack` before your next upload: the task page says when a
bundle was packed with an older kit.

The kit and everything you build with it are covered by your contributor
agreement; do not share it.

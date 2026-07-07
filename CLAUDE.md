# smr-workout-tracker

## Session Notes

**Standing order: log to this section proactively, without being asked.** Before ending any turn that involved a notable fix, decision, debugging session, or unfinished work, add a dated entry below — don't wait for the user to say "remember this."

Log key facts, decisions, and in-progress context here so future sessions can pick up where the last one left off. Add a dated entry whenever you make a notable architectural decision, learn an important constraint, or leave work unfinished. Keep entries short — a few lines each. Newest entries at the top.

### 2026-07-07
- Fixed accidental-tap fragmentation on `js/log.js`'s Save button: an inadvertent early tap mid-workout on iPhone was saving a partial session, then finishing the workout created a second, separate history entry for the same day (and duplicate rows in the Sheet, with `elbowPain`/`notes`/`totalSessionVolume` split across them). Two fixes in `saveBtn`'s click handler: (1) if a history entry already exists for today's date + this `dayId`, merge the new exercises into it in place (by exercise name, canonical `day.exercises` order, latest non-empty value wins for pain/notes) instead of pushing a new entry; (2) if the merged result still doesn't cover every exercise for the day, `confirm()` before saving ("Only X of Y exercises have a weight entered. Save anyway?"). To avoid re-posting already-synced rows to the Sheet on a merge, sessions now track `sentExerciseNames` (exercise names confirmed POSTed) and only the delta gets sent on subsequent merges/resyncs — `syncResyncBtn`'s handler was updated the same way. Also fixed `showSummary`'s "prior session" lookup, which previously assumed the just-saved session was always the last array element (`hist.reverse().slice(1)`) — broken once merges update an entry in place rather than always appending; now excludes by object reference (`s !== session`). Verified with a Playwright script simulating a 2-exercise then 4-exercise save on the same day: confirm dialog fired on the incomplete save, and the two saves merged into one 6-exercise history entry with correct combined volume.
- Added `.github/workflows/auto-merge-claude-prs.yml`: any PR from a `claude/*` branch (i.e. opened by a Claude Code GUI/browser session) is merged automatically the moment it's opened — no manual step. This exists because the repo has no `main`; Claude Code GUI sessions were leaving unmerged `claude/*` branches around, risking a future session branching off a stale point and fragmenting work.
- Had to flip the repo's Settings → Actions → General → "Workflow permissions" from the default `read` to `write` — otherwise `GITHUB_TOKEN` can't merge PRs even with `permissions: contents/pull-requests: write` set in the workflow file itself; the repo-level setting is a hard ceiling on what a workflow can request.
- This entry itself is the live test: written on a `claude/test-automerge-verify` branch, opened as a PR, and left for the new workflow to auto-merge — confirms the whole pipeline end-to-end.

### 2026-07-04
- Fixed and confirmed: Cardio — Zone 2 sessions now write to the Google Sheet. Root cause was two-layered: (1) the site posts with `mode: "no-cors"`, so a POST that reaches Apps Script but fails server-side looks identical to success on the client — no error ever surfaces. (2) The user's actual Apps Script project was a standalone/unbound "Untitled project" using `SpreadsheetApp.getActiveSpreadsheet()`, which returns null when unbound, so every write silently threw and was swallowed by the try/catch. Fixed by switching to `SpreadsheetApp.openById("1-bUIHEt9hy20i2ERMTKHwJeXrYeBJfo74fIi8UqBFLw")` in the Apps Script (user edited it directly, not in this git repo — the deployed script lives in Google's Apps Script editor, not tracked in version control).
- Also had to force-resync the phone's saved Script URL via the `?sheeturl=` query-param bootstrap (already built into log.js for the iOS-localStorage-wipe case) after multiple rounds of URL/deployment confusion — the phone had been pointed at a stale URL that didn't match the fixed deployment.
- Client-side fix shipped in PR #1 (merged to `claude/python-workout-tracker-sheets-tot1lg`, the actual default branch — note the repo has no branch literally named `main`): sessions now track `sheetsStatus` (`sent`/`no-url`/`failed`), the summary screen warns on non-`sent` saves, and a "Resync Now" banner on the Log page resends unsynced sessions from local history. This won't catch future *server-side* Apps Script failures (still invisible due to `no-cors`), only client-side skip/throw cases.
- Verified live: SMR Workout Tracker Sheet (Drive file id `1-bUIHEt9hy20i2ERMTKHwJeXrYeBJfo74fIi8UqBFLw`) now has both Cardio — Zone 2 rows.

<!-- Example:
### 2026-07-04
- Decided to use X for Y because Z.
- In progress: refactoring the auth flow, blocked on choosing a session store.
-->

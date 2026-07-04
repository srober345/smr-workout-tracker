# smr-workout-tracker

## Session Notes

**Standing order: log to this section proactively, without being asked.** Before ending any turn that involved a notable fix, decision, debugging session, or unfinished work, add a dated entry below — don't wait for the user to say "remember this."

Log key facts, decisions, and in-progress context here so future sessions can pick up where the last one left off. Add a dated entry whenever you make a notable architectural decision, learn an important constraint, or leave work unfinished. Keep entries short — a few lines each. Newest entries at the top.

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

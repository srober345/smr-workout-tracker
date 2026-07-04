# SMR Workout Tracker

A mobile-friendly static web app for logging 5-day strength + cardio workouts to Google Sheets, with automatic pull-volume monitoring for elbow safety (medial epicondylitis awareness).

No build step. No framework. Plain HTML/CSS/JS — works directly from GitHub Pages.

---

## Quick start

1. **Enable GitHub Pages** on this repo (Settings → Pages → Deploy from branch → `main` → `/ (root)` → Save). Your site will be live at `https://<your-username>.github.io/<repo-name>/`.
2. **Set up the Google Sheet and Apps Script** (see below).
3. Open the site on your phone, paste the Web App URL when prompted, and start logging.

---

## Google Sheets setup

### 1 — Create the Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it exactly: **`Workout Tracker`**
3. Rename the first tab (Sheet1) to **`Log`**
4. Add these headers in row 1 (one per column, A through J):

   ```
   Date | Day Type | Exercise | Sets | Reps | Weight / Duration | Volume (lbs) | Elbow Pain (0-10) | Notes | Total Session Volume
   ```

### 2 — Create the Apps Script

1. In the Sheet, click **Extensions → Apps Script**.
2. Delete any boilerplate and paste the entire script below.
3. Click **Save** (Ctrl/Cmd + S).

### 3 — Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Description**: `Workout Tracker v1` (optional)
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy** and authorize when prompted.
5. Copy the **Web App URL** — it looks like `https://script.google.com/macros/s/AKfy…/exec`

> ⚠️ Every time you edit the script and redeploy, choose "New deployment" (not "Manage deployments → Edit") to get a fresh URL.

### 4 — Connect the site

Open `log.html` in your browser. A yellow setup banner will appear at the top asking for the Web App URL. Paste it in and click **Save URL**. The URL is stored in your browser's `localStorage` — you only need to do this once per device.

> **iOS Home Screen tip:** iOS periodically clears `localStorage` for Home Screen web apps (Settings → Safari → Clear History and Website Data wipes it, and so can Intelligent Tracking Prevention or low-storage cleanup) — if that happens, the setup banner reappears. To make it survive a clear, add the Home Screen icon using the URL with your script URL embedded as a query param instead of the plain one:
>
> ```
> https://<your-username>.github.io/<repo-name>/log.html?sheeturl=<URL-ENCODE-YOUR-SCRIPT-URL>
> ```
>
> URL-encode the Apps Script URL (e.g. `https://script.google.com/…/exec` → `https%3A%2F%2Fscript.google.com%2F…%2Fexec`) before appending it. On launch the app reads `?sheeturl=` and re-saves it to `localStorage` automatically, so even after a clear the setup banner won't come back. If you already added the icon with the plain URL, delete it and re-add it with this one.

---

## Apps Script (paste into Extensions → Apps Script)

```javascript
const SHEET_NAME = "Log";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const rows    = payload.rows;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return jsonResp({ status: "error", message: "No rows provided" });
    }

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResp({ status: "error", message: `Sheet "${SHEET_NAME}" not found` });
    }

    const toAppend = rows.map(r => [
      r.date              ?? "",
      r.dayType           ?? "",
      r.exercise          ?? "",
      r.sets              ?? "",
      r.reps              ?? "",
      r.weight            ?? "",
      r.volume            ?? "",
      r.elbowPain         ?? "",   // only on first row of session
      r.notes             ?? "",   // only on first row of session
      r.totalSessionVolume ?? "",  // only on first row of session
    ]);

    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, 10)
         .setValues(toAppend);

    return jsonResp({ status: "ok", rowsWritten: toAppend.length });

  } catch (err) {
    return jsonResp({ status: "error", message: err.toString() });
  }
}

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> **Note on `no-cors`:** The site posts with `mode: "no-cors"` so the browser doesn't block cross-origin requests, and with `Content-Type: text/plain;charset=utf-8` so the request stays a "simple request" and never triggers a CORS preflight (which Apps Script Web Apps can't answer). This means the response is opaque — the site can't tell whether the *request* was accepted by the server. It can, however, tell whether a request was even sent (e.g. no Script URL configured, or the `fetch` itself threw) — see below.

---

## Recovering a session that didn't sync

Each saved session is tagged with a sync status: `sent`, `no-url` (no Script URL was configured on this device when you saved), or `failed` (the `fetch` itself errored, e.g. offline). If a session isn't `sent`:

- The summary screen shows a warning banner right after saving.
- A **"N sessions haven't synced to Google Sheets"** banner appears at the top of the Log page with a **Resync Now** button. Once your Script URL is set up correctly, click it to resend every unsynced session from local history — no need to re-enter anything.

This is most likely to happen on iOS Home Screen installs, where `localStorage` (and the saved Script URL) can get cleared out from under you — see the tip above about baking `?sheeturl=` into the Home Screen icon to avoid it.

---

## Changing the Web App URL

If you redeploy the script and get a new URL, open the browser console on `log.html` and run:

```js
localStorage.setItem("smr_wt_script_url", "YOUR_NEW_URL_HERE");
```

Then reload the page.

---

## Resetting local history

All session history for the volume comparison is stored in `localStorage`. To clear it:

```js
localStorage.removeItem("smr_wt_history");
```

---

## Project structure

```
index.html        — landing page with split overview
log.html          — main logging + summary screen
exercises.html    — quick-reference exercise list
css/style.css     — all styles (dark theme, mobile-first)
js/data.js        — exercise data (edit to add/change exercises)
js/log.js         — log page logic (day selector, volume calc, save, summary)
js/main.js        — shared nav active-link behavior
README.md
.gitignore
```

---

## Volume & elbow safety logic

After each save, the summary screen compares today's **total session volume** (sum of weight × sets × reps across all logged exercises) to the most recent prior session of the **same day type**, stored in `localStorage`.

| Condition | Warning shown |
|---|---|
| Pull-day volume up > 20% vs last Pull session | ⚠️ orange warning with numbers |
| Elbow pain logged ≥ 3/10 | 🔴 red deload recommendation |
| No elbow pain (0) | ✓ green confirmation |
| No prior session of same day type | "First session" — no comparison |

---

## Mobile tips

- Add to Home Screen (iOS: Share → Add to Home Screen; Android: browser menu → Add to Home Screen) for app-like access at the gym.
- The weight inputs are numeric with decimal support. Tab between them to move through the exercise list quickly.
- Tap **← Log Another Workout** on the summary screen to return and log another day without losing the day's history.

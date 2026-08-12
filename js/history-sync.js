/* ── history-sync.js — best-effort recovery of session history from the
   Google Sheet ───────────────────────────────────────────────────────────

   localStorage is the only place session history lives on-device, and iOS
   can wipe it out from under a Home Screen web app (Safari's Intelligent
   Tracking Prevention, or low-storage eviction — see README "iOS Home
   Screen tip"). When that happens, Log and Progress both silently fall
   back to whatever's left in localStorage, which after a wipe is nothing
   until the next save — that's why Progress can appear to only ever show
   "today."

   The Sheet already holds every row that made it through a successful
   sync, so on page load we pull it back via the Apps Script's `doGet` and
   merge it into local history. This never throws and never blocks the
   page on the network — any failure (no Script URL configured yet,
   offline, stale/pre-doGet deployment, CORS) just leaves local history as
   the only source of truth, exactly like before this existed. */

const HISTORY_SYNC_TIMEOUT_MS = 6000;

function dayIdForLabel(label) {
  const day = DAYS.find((d) => d.label === label);
  return day ? day.id : label;
}

// Sheet rows are one-per-exercise, tagged with the date + day type the
// session belongs to. elbowPain/notes/totalSessionVolume are meant to only
// be set on the first row of a session, but a later delta-resync can
// append more rows for the same date+dayType non-contiguously — so pull
// those fields from whichever row in the group actually has them, not
// just the first.
function buildSessionsFromRows(rows) {
  const groups = new Map();
  const order  = [];
  rows.forEach((r) => {
    const key = `${r.date}|${r.dayType}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push(r);
  });

  return order.map((key) => {
    const [date, dayType] = key.split("|");
    const groupRows = groups.get(key);
    const exercises = groupRows
      .filter((r) => r.exercise)
      .map((r) => ({
        name:   r.exercise,
        sets:   Number(r.sets)   || 0,
        reps:   Number(r.reps)   || 0,
        weight: Number(r.weight) || 0,
        volume: Number(r.volume) || 0,
      }));
    const painRow  = groupRows.find((r) => r.elbowPain !== "" && r.elbowPain != null);
    const noteRow  = groupRows.find((r) => r.notes);
    const totalRow = groupRows.find((r) => r.totalSessionVolume !== "" && r.totalSessionVolume != null);

    return {
      date,
      dayId:       dayIdForLabel(dayType),
      dayLabel:    dayType,
      exercises,
      elbowPain:   painRow ? Number(painRow.elbowPain) : null,
      notes:       noteRow ? noteRow.notes : "",
      totalVolume: totalRow ? Number(totalRow.totalSessionVolume) : exercises.reduce((s, e) => s + e.volume, 0),
      sheetsStatus: "sent",
      sentExerciseNames: exercises.map((e) => e.name),
    };
  });
}

// Local session data wins on a per-exercise conflict (it may hold edits not
// yet reflected in the Sheet); the Sheet fills in exercises/sessions local
// history is missing entirely — which is the whole point after a wipe.
function mergeHistories(local, remote) {
  const merged  = local.slice();
  const keyOf   = (s) => `${s.date}|${s.dayId}`;
  const indexOf = new Map(merged.map((s, i) => [keyOf(s), i]));

  remote.forEach((rs) => {
    const key = keyOf(rs);
    if (!indexOf.has(key)) {
      merged.push(rs);
      indexOf.set(key, merged.length - 1);
      return;
    }

    const i  = indexOf.get(key);
    const ls = merged[i];

    const byName = new Map();
    rs.exercises.forEach((e) => byName.set(e.name, e));
    ls.exercises.forEach((e) => byName.set(e.name, e)); // local wins on overlap

    const day = DAYS.find((d) => d.id === ls.dayId);
    const exercises = day
      ? day.exercises.map((ex) => byName.get(ex.name)).filter(Boolean)
      : [...byName.values()];

    merged[i] = {
      ...ls,
      exercises,
      elbowPain:   ls.elbowPain != null ? ls.elbowPain : rs.elbowPain,
      notes:       ls.notes || rs.notes,
      totalVolume: Math.max(ls.totalVolume || 0, rs.totalVolume || 0),
      sentExerciseNames: Array.from(new Set([...(ls.sentExerciseNames || []), ...rs.sentExerciseNames])),
    };
  });

  merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return merged;
}

async function fetchSheetRows(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HISTORY_SYNC_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}?action=history`, { method: "GET", signal: controller.signal });
    const data = await resp.json();
    if (data.status !== "ok" || !Array.isArray(data.rows)) throw new Error(data.message || "Bad response from Apps Script");
    return data.rows;
  } finally {
    clearTimeout(timer);
  }
}

// Best-effort: pulls history back from the Sheet and merges it into
// localStorage. Resolves to true/false (whether it actually updated
// anything) and never rejects — callers can fire-and-forget this, then
// re-render/re-check whatever reads local history once it settles.
async function syncHistoryFromSheet() {
  const url = localStorage.getItem("smr_wt_script_url");
  if (!url) return false;

  try {
    const rows   = await fetchSheetRows(url);
    const remote = buildSessionsFromRows(rows);
    const local  = JSON.parse(localStorage.getItem("smr_wt_history") || "[]");
    const merged = mergeHistories(local, remote);
    localStorage.setItem("smr_wt_history", JSON.stringify(merged));
    return true;
  } catch (err) {
    // Expected on: no doGet yet on this deployment, offline, CORS, timeout.
    console.warn("History sync from Sheet skipped:", err);
    return false;
  }
}

/* ── log.js — all logic for log.html ──────────────────────────────── */

const LS_KEY_URL    = "smr_wt_script_url";
const LS_KEY_HIST   = "smr_wt_history";      // [{date, dayId, dayLabel, exercises, elbowPain, notes, totalVolume}]

/* ── Helpers ──────────────────────────────────────────────────────── */
function fmt(n)  { return Number(n).toLocaleString(); }
function fmtPct(n) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}
function today() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}
function todayDisplay() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_HIST) || "[]"); }
  catch { return []; }
}
function saveHistory(hist) {
  localStorage.setItem(LS_KEY_HIST, JSON.stringify(hist));
}
function getScriptUrl() { return localStorage.getItem(LS_KEY_URL) || ""; }
function setScriptUrl(u) { localStorage.setItem(LS_KEY_URL, u.trim()); }

// iOS clears localStorage for Home Screen web apps more aggressively than it
// clears regular Safari tabs (Settings > Safari > Clear History and Website
// Data wipes both; so can Intelligent Tracking Prevention or low-storage
// eviction). If the Home Screen icon's URL carries ?sheeturl=..., re-seed
// localStorage from it on every launch so the setup banner doesn't return
// after a clear. See README for how to add the icon with this param.
function bootstrapScriptUrlFromQuery() {
  const fromQuery = new URLSearchParams(location.search).get("sheeturl");
  if (fromQuery && fromQuery.startsWith("https://")) setScriptUrl(fromQuery);
}
bootstrapScriptUrlFromQuery();

/* ── Setup banner ─────────────────────────────────────────────────── */
const setupBanner  = document.getElementById("setup-banner");
const setupInput   = document.getElementById("setup-url-input");
const setupSaveBtn = document.getElementById("setup-save-btn");

function refreshBanner() {
  if (!getScriptUrl()) setupBanner.classList.add("visible");
  else setupBanner.classList.remove("visible");
}

setupSaveBtn.addEventListener("click", () => {
  const val = setupInput.value.trim();
  if (!val.startsWith("https://")) {
    alert("Please paste a valid Apps Script web app URL (starts with https://).");
    return;
  }
  setScriptUrl(val);
  refreshBanner();
});

refreshBanner();

/* ── Sync banner (unsent sessions) ────────────────────────────────── */
// Only sessions saved *after* this feature shipped carry a sheetsStatus —
// older history entries are left alone so resync never re-posts a session
// that predates sync tracking (and may already be in the Sheet).
const syncBanner     = document.getElementById("sync-banner");
const syncBannerText = document.getElementById("sync-banner-text");
const syncResyncBtn  = document.getElementById("sync-resync-btn");

function unsentSessions() {
  return getHistory()
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.sheetsStatus && s.sheetsStatus !== "sent");
}

function refreshSyncBanner() {
  const pending = unsentSessions();
  if (pending.length === 0) {
    syncBanner.style.display = "none";
    return;
  }
  syncBanner.style.display = "block";
  syncBannerText.textContent = pending.length === 1
    ? "1 session hasn't synced to Google Sheets."
    : `${pending.length} sessions haven't synced to Google Sheets.`;
}

syncResyncBtn.addEventListener("click", async () => {
  const url = getScriptUrl();
  if (!url) {
    alert("Paste your Google Apps Script Web App URL above first, then resync.");
    return;
  }

  syncResyncBtn.disabled = true;
  syncResyncBtn.textContent = "Resyncing…";

  const hist    = getHistory();
  const pending = unsentSessions();
  let sent = 0;

  for (const { s, i } of pending) {
    // Only resend exercises not already confirmed sent, so resyncing a
    // session that was merged from multiple saves doesn't duplicate rows
    // for exercises that already made it into the Sheet.
    const sentNames = s.sentExerciseNames || [];
    const delta     = s.exercises.filter(e => !sentNames.includes(e.name));

    if (delta.length === 0) {
      hist[i].sheetsStatus = "sent";
      sent++;
      continue;
    }

    try {
      await postToSheets(url, { ...s, exercises: delta });
      hist[i].sentExerciseNames = s.exercises.map(e => e.name);
      hist[i].sheetsStatus = "sent";
      sent++;
    } catch (err) {
      console.warn("Resync failed for session", i, err);
      hist[i].sheetsStatus = "failed";
    }
  }

  saveHistory(hist);
  syncResyncBtn.disabled = false;
  syncResyncBtn.textContent = "Resync Now";
  refreshSyncBanner();
  alert(`Resynced ${sent} of ${pending.length} session${pending.length === 1 ? "" : "s"}.`);
});

refreshSyncBanner();

/* ── Day selector ─────────────────────────────────────────────────── */
let activeDayIdx = 0;

const daySelectorEl = document.getElementById("day-selector");

DAYS.forEach((day, i) => {
  const btn = document.createElement("button");
  btn.className = "day-btn" + (i === 0 ? " active" : "");
  btn.textContent = day.label;
  btn.addEventListener("click", () => selectDay(i));
  daySelectorEl.appendChild(btn);
});

function selectDay(idx) {
  activeDayIdx = idx;
  daySelectorEl.querySelectorAll(".day-btn").forEach((b, i) => {
    b.classList.toggle("active", i === idx);
  });
  renderExerciseTable();
  updateTotals();
}

/* ── Exercise table ───────────────────────────────────────────────── */
const tableBody    = document.getElementById("exercise-body");
const totalVolEl   = document.getElementById("total-vol");
const totalLoggedEl= document.getElementById("total-logged");
const thWeight     = document.getElementById("th-weight");
const thVolume     = document.getElementById("th-volume");
const totalsBar    = document.querySelector(".totals-bar");

// weightState[dayId][exerciseIndex] = string (lbs for strength, minutes for cardio)
const weightState  = {};

function renderExerciseTable() {
  const day    = DAYS[activeDayIdx];
  const cardio = isDurationLoggedDay(day);
  if (!weightState[day.id]) weightState[day.id] = {};

  // Show/hide weight & volume columns and totals bar
  thWeight.textContent          = cardio ? "Duration" : "Weight";
  thWeight.style.textAlign      = "right";
  thVolume.classList.toggle("hidden", cardio);
  totalsBar.classList.toggle("hidden", cardio);

  tableBody.innerHTML = "";
  day.exercises.forEach((ex, i) => {
    const savedVal = weightState[day.id][i] || "";
    const rx = formatRx(day, ex);

    const tr = document.createElement("tr");

    if (cardio) {
      tr.innerHTML = `
        <td class="exercise-name">${ex.name}</td>
        <td class="prescribed">${rx}</td>
        <td>
          <input
            type="number"
            inputmode="decimal"
            class="weight-input${savedVal ? " has-value" : ""}"
            placeholder="min"
            value="${savedVal}"
            data-idx="${i}"
            min="0"
            step="1"
            aria-label="${ex.name} duration in minutes"
          >
        </td>
      `;
    } else {
      const vol = calcVol(ex, savedVal);
      tr.innerHTML = `
        <td class="exercise-name">${ex.name}</td>
        <td class="prescribed">${rx}</td>
        <td>
          <input
            type="number"
            inputmode="decimal"
            class="weight-input${savedVal ? " has-value" : ""}"
            placeholder="lbs"
            value="${savedVal}"
            data-idx="${i}"
            min="0"
            step="2.5"
            aria-label="${ex.name} weight in pounds"
          >
        </td>
        <td class="vol-cell">${vol > 0 ? fmt(vol) : "—"}</td>
      `;
    }

    tableBody.appendChild(tr);
  });

  tableBody.querySelectorAll(".weight-input").forEach((inp) => {
    inp.addEventListener("input", onWeightChange);
  });
}

function onWeightChange(e) {
  const inp    = e.target;
  const idx    = parseInt(inp.dataset.idx, 10);
  const day    = DAYS[activeDayIdx];
  const val    = inp.value;
  const cardio = isDurationLoggedDay(day);

  weightState[day.id][idx] = val;
  inp.classList.toggle("has-value", !!val);

  if (!cardio) {
    const ex  = day.exercises[idx];
    const vol = calcVol(ex, val);
    inp.closest("tr").querySelector(".vol-cell").textContent = vol > 0 ? fmt(vol) : "—";
    updateTotals();
  }
  // Duration-logged days have no volume/totals bar to update.
}

function calcVol(ex, weightStr) {
  const w = parseFloat(weightStr);
  if (!weightStr || isNaN(w) || w <= 0) return 0;
  return w * ex.sets * ex.reps;
}

function updateTotals() {
  const day   = DAYS[activeDayIdx];
  const state = weightState[day.id] || {};
  let total = 0, logged = 0;
  day.exercises.forEach((ex, i) => {
    const v = calcVol(ex, state[i]);
    if (v > 0) { total += v; logged++; }
  });
  totalVolEl.textContent    = fmt(total);
  totalLoggedEl.textContent = `${logged} / ${day.exercises.length}`;
}

// Initial render
renderExerciseTable();
updateTotals();

/* ── Save workout ─────────────────────────────────────────────────── */
const saveBtn      = document.getElementById("save-btn");
const elbowPainEl  = document.getElementById("elbow-pain");
const notesEl      = document.getElementById("notes");

saveBtn.addEventListener("click", async () => {
  const day    = DAYS[activeDayIdx];
  const state  = weightState[day.id] || {};
  const cardio = isDurationLoggedDay(day);

  const exercises = day.exercises.map((ex, i) => {
    const raw      = parseFloat(state[i]) || 0;
    const protocol = formatRx(day, ex);
    return {
      name:     ex.name,
      sets:     ex.sets,
      reps:     ex.reps,
      note:     ex.note || "",
      protocol, // cardio summary label
      weight:   raw,   // duration (min) for cardio, lbs for strength
      volume:   cardio ? 0 : calcVol(ex, state[i]),
    };
  }).filter(e => e.weight > 0);

  if (exercises.length === 0) {
    const unit = cardio ? "duration" : "weight";
    alert(`Please enter at least one ${unit} before saving.`);
    return;
  }

  const painVal = elbowPainEl.value.trim();
  const pain    = painVal === "" ? null : parseInt(painVal, 10);
  if (painVal !== "" && (isNaN(pain) || pain < 0 || pain > 10)) {
    alert("Elbow pain must be a number from 0–10.");
    return;
  }

  // If a session for today + this day type already exists, merge into it
  // instead of creating a fragmented duplicate entry — this is what an
  // accidental early tap on this button used to cause (a partial save,
  // followed by another save once the rest of the workout was done).
  const hist        = getHistory();
  const existingIdx = hist.findIndex(s => s.date === today() && s.dayId === day.id);
  const existing    = existingIdx !== -1 ? hist[existingIdx] : null;

  const mergedByName = new Map();
  if (existing) existing.exercises.forEach(e => mergedByName.set(e.name, e));
  exercises.forEach(e => mergedByName.set(e.name, e)); // this save's values win on overlap
  const mergedExercises = day.exercises
    .map(ex => mergedByName.get(ex.name))
    .filter(Boolean);

  if (mergedExercises.length < day.exercises.length) {
    const unit    = cardio ? "duration" : "weight";
    const proceed = confirm(
      `Only ${mergedExercises.length} of ${day.exercises.length} exercises have a ${unit} entered. Save anyway?`
    );
    if (!proceed) return;
  }

  const totalVolume = mergedExercises.reduce((s, e) => s + e.volume, 0);
  const session = {
    date:        today(),
    dayId:       day.id,
    dayLabel:    day.label,
    exercises:   mergedExercises,
    elbowPain:   pain !== null ? pain : (existing ? existing.elbowPain : null),
    notes:       notesEl.value.trim() || (existing ? existing.notes : ""),
    totalVolume,
    sheetsStatus: "no-url", // "sent" | "no-url" | "failed" — surfaced in the summary and setup banner
    sentExerciseNames: existing ? (existing.sentExerciseNames || []) : [],
  };

  // Only POST exercises not already confirmed sent for this session, so a
  // merge never re-sends rows that already made it into the Sheet.
  const deltaExercises = mergedExercises.filter(e => !session.sentExerciseNames.includes(e.name));

  // POST to Apps Script *before* showing the summary, so a failure/skip is
  // known and can be surfaced — previously the summary appeared regardless
  // of sync outcome, so a missing Script URL (e.g. wiped by iOS) silently
  // dropped the session with the user none the wiser.
  const url = getScriptUrl();
  if (url && deltaExercises.length > 0) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';
    try {
      await postToSheets(url, { ...session, exercises: deltaExercises });
      session.sentExerciseNames = mergedExercises.map(e => e.name);
      session.sheetsStatus = "sent";
    } catch (err) {
      console.warn("Sheets post failed:", err);
      session.sheetsStatus = "failed";
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Save Workout &amp; See Report";
    }
  } else if (url) {
    // Everything in the merge was already sent — nothing new to POST.
    session.sheetsStatus = "sent";
  }

  // Save to history — update the existing same-day entry in place if merged.
  if (existing) hist[existingIdx] = session; else hist.push(session);
  saveHistory(hist);

  // Show summary
  showSummary(session, hist);
  refreshSyncBanner();
});

async function postToSheets(url, session) {
  const rows = session.exercises.map((ex, i) => ({
    date:              session.date,
    dayType:           session.dayLabel,
    exercise:          ex.name,
    sets:              ex.sets,
    reps:              ex.reps,
    weight:            ex.weight,
    volume:            ex.volume,
    elbowPain:         i === 0 ? (session.elbowPain ?? "") : "",
    notes:             i === 0 ? session.notes : "",
    totalSessionVolume: i === 0 ? session.totalVolume : "",
  }));

  await fetch(url, {
    method: "POST",
    mode:   "no-cors",
    // text/plain avoids a CORS preflight (application/json does not qualify as a
    // "simple request"), which Apps Script Web Apps can't handle. The Apps Script
    // side reads the raw body via e.postData.contents regardless of Content-Type.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body:   JSON.stringify({ rows }),
  });
}

/* ── Summary screen ───────────────────────────────────────────────── */
const logScreen     = document.getElementById("log-screen");
const summaryScreen = document.getElementById("summary-screen");
const backBtn       = document.getElementById("back-btn");

backBtn.addEventListener("click", () => {
  summaryScreen.classList.remove("visible");
  logScreen.classList.remove("hidden");
});

function showSummary(session, hist) {
  logScreen.classList.add("hidden");
  summaryScreen.classList.remove("hidden");
  summaryScreen.classList.add("visible");

  // Header
  const cardio = isDurationLoggedDay({ id: session.dayId });
  document.getElementById("rpt-date").textContent = todayDisplay();
  document.getElementById("rpt-day").textContent  = session.dayLabel;

  const volCompCard = document.querySelector(".volume-comparison").closest(".card");
  if (cardio) {
    volCompCard.classList.add("hidden");
  } else {
    volCompCard.classList.remove("hidden");
    document.getElementById("rpt-vol").textContent = fmt(session.totalVolume);
  }

  // Prior session of same day type — excluded by reference rather than by
  // position, since a merged save updates an existing entry in place instead
  // of always appending at the end of history.
  const prior = [...hist]
    .reverse()
    .find(s => s !== session && s.dayId === session.dayId);

  const priorVolEl   = document.getElementById("rpt-prior-vol");
  const priorLabelEl = document.getElementById("rpt-prior-label");
  const changePillEl = document.getElementById("rpt-change");
  const alertsEl     = document.getElementById("rpt-alerts");

  alertsEl.innerHTML = "";

  if (session.sheetsStatus === "no-url") {
    alertsEl.innerHTML += `
      <div class="alert-box warn">
        ⚠️ Not synced to Google Sheets — no Script URL is set up on this device.
        This session is saved locally only. Paste your Web App URL in the setup banner,
        then use "Resync Now" to send it.
      </div>`;
  } else if (session.sheetsStatus === "failed") {
    alertsEl.innerHTML += `
      <div class="alert-box danger">
        🔴 Google Sheets sync failed for this session. It's saved locally —
        check your connection, then use "Resync Now" to retry.
      </div>`;
  }

  if (cardio) {
    // No volume comparison for cardio days
  } else if (prior) {
    priorVolEl.textContent   = fmt(prior.totalVolume);
    priorLabelEl.textContent = prior.date;

    const pct = prior.totalVolume > 0
      ? ((session.totalVolume - prior.totalVolume) / prior.totalVolume) * 100
      : null;

    if (pct === null) {
      changePillEl.className   = "change-pill neutral";
      changePillEl.textContent = "—";
    } else {
      if (pct > 20) {
        changePillEl.className   = "change-pill up-danger";
        changePillEl.textContent = fmtPct(pct);
      } else if (pct > 0) {
        changePillEl.className   = "change-pill up";
        changePillEl.textContent = fmtPct(pct);
      } else {
        changePillEl.className   = "change-pill down";
        changePillEl.textContent = fmtPct(pct);
      }

      // Pull-day volume spike alert
      if (session.dayId === "pull" && pct > 20) {
        alertsEl.innerHTML += `
          <div class="alert-box warn">
            ⚠️ Pull volume up ${pct.toFixed(0)}% vs last session
            (${fmt(prior.totalVolume)} lbs → ${fmt(session.totalVolume)} lbs).
            Consider holding steady or backing off given elbow history.
          </div>`;
      }

    }
  } else {
    priorVolEl.textContent   = "—";
    priorLabelEl.textContent = "No prior session";
    changePillEl.className   = "change-pill neutral";
    changePillEl.textContent = "first session";
  }

  // Elbow pain alerts — shown for all non-cardio sessions
  if (!cardio) {
    if (session.elbowPain !== null && session.elbowPain >= 3) {
      alertsEl.innerHTML += `
        <div class="alert-box danger">
          🔴 Elbow pain logged at ${session.elbowPain}/10.
          Recommend a deload — reduce pull volume by 30–40% and check in with PT before your next pull session.
        </div>`;
    } else if (session.elbowPain === 0) {
      alertsEl.innerHTML += `<div class="alert-box ok">✓ No elbow pain logged today. Good sign.</div>`;
    }
  }

  // Exercise breakdown
  const tbody = document.getElementById("rpt-exercises");
  tbody.innerHTML = "";
  session.exercises.forEach(ex => {
    // Older saved sessions (pre-`protocol` field) fall back to the same formatter.
    const rx = ex.protocol || formatRx({ id: session.dayId }, ex);
    if (cardio) {
      tbody.innerHTML += `
        <tr>
          <td>${ex.name}</td>
          <td class="text-muted">${rx}</td>
          <td colspan="2" style="text-align:right;color:var(--muted)">${ex.weight > 0 ? ex.weight + " min" : "—"}</td>
        </tr>`;
    } else {
      tbody.innerHTML += `
        <tr>
          <td>${ex.name}</td>
          <td class="text-muted">${rx}</td>
          <td>${ex.weight > 0 ? ex.weight + " lbs" : "BW"}</td>
          <td>${ex.volume > 0 ? fmt(ex.volume) : "—"}</td>
        </tr>`;
    }
  });

  if (session.notes) {
    document.getElementById("rpt-notes-row").classList.remove("hidden");
    document.getElementById("rpt-notes").textContent = session.notes;
  } else {
    document.getElementById("rpt-notes-row").classList.add("hidden");
  }

  summaryScreen.scrollIntoView({ behavior: "smooth" });
}

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

  const totalVolume = exercises.reduce((s, e) => s + e.volume, 0);
  const session = {
    date:        today(),
    dayId:       day.id,
    dayLabel:    day.label,
    exercises,
    elbowPain:   pain,
    notes:       notesEl.value.trim(),
    totalVolume,
  };

  // Save to history
  const hist = getHistory();
  hist.push(session);
  saveHistory(hist);

  // Show summary
  showSummary(session, hist);

  // POST to Apps Script (non-blocking)
  const url = getScriptUrl();
  if (url) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving…';
    try {
      await postToSheets(url, session);
    } catch (err) {
      console.warn("Sheets post failed:", err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Save Workout &amp; See Report";
    }
  }
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

  // Prior session of same day type
  const prior = [...hist]
    .reverse()
    .slice(1)                           // exclude the session we just saved
    .find(s => s.dayId === session.dayId);

  const priorVolEl   = document.getElementById("rpt-prior-vol");
  const priorLabelEl = document.getElementById("rpt-prior-label");
  const changePillEl = document.getElementById("rpt-change");
  const alertsEl     = document.getElementById("rpt-alerts");

  alertsEl.innerHTML = "";

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

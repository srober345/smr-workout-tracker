/* ── progress.js — per-exercise weight/duration trend chart ─────────── */

const LS_KEY_HIST     = "smr_wt_history";
const LS_KEY_LAST_EX   = "smr_wt_progress_exercise";
const SVG_NS           = "http://www.w3.org/2000/svg";

function fmt(n) { return Number(n).toLocaleString(); }
function shortDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}`;
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_HIST) || "[]"); }
  catch { return []; }
}

// One entry per unique exercise name across the weekly split, tagged with
// the day it belongs to (for display grouping and lbs-vs-min unit).
function buildExerciseCatalog() {
  const catalog = [];
  const seen = new Set();
  DAYS.forEach((day) => {
    day.exercises.forEach((ex) => {
      if (seen.has(ex.name)) return;
      seen.add(ex.name);
      catalog.push({
        name: ex.name,
        dayLabel: day.label,
        unit: isDurationLoggedDay(day) ? "min" : "lbs",
      });
    });
  });
  return catalog;
}
const CATALOG = buildExerciseCatalog();
const CATALOG_BY_NAME = new Map(CATALOG.map((c) => [c.name, c]));

function getPoints(name) {
  return getHistory()
    .filter((s) => Array.isArray(s.exercises))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((s) => {
      const ex = s.exercises.find((e) => e.name === name);
      return ex && typeof ex.weight === "number" && ex.weight > 0
        ? { date: s.date, dayLabel: s.dayLabel, value: ex.weight }
        : null;
    })
    .filter(Boolean);
}

/* ── Exercise picker ──────────────────────────────────────────────── */
const select = document.getElementById("exercise-select");
const byDay  = new Map();
CATALOG.forEach((item) => {
  if (!byDay.has(item.dayLabel)) byDay.set(item.dayLabel, []);
  byDay.get(item.dayLabel).push(item);
});
byDay.forEach((items, dayLabel) => {
  const group = document.createElement("optgroup");
  group.label = dayLabel;
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.name;
    opt.textContent = item.name;
    group.appendChild(opt);
  });
  select.appendChild(group);
});
const savedEx = localStorage.getItem(LS_KEY_LAST_EX);
if (savedEx && CATALOG_BY_NAME.has(savedEx)) select.value = savedEx;
select.addEventListener("change", () => {
  localStorage.setItem(LS_KEY_LAST_EX, select.value);
  render();
});

/* ── Elements ─────────────────────────────────────────────────────── */
const emptyState   = document.getElementById("empty-state");
const chartCard    = document.getElementById("chart-card");
const chartTitle   = document.getElementById("chart-title");
const statLatest    = document.getElementById("stat-latest");
const statChange    = document.getElementById("stat-change");
const statCount     = document.getElementById("stat-count");
const svg           = document.getElementById("chart-svg");
const tooltip       = document.getElementById("chart-tooltip");
const chartWrap     = document.getElementById("chart-wrap");
const toggleTableBtn = document.getElementById("toggle-table-btn");
const tableWrap     = document.getElementById("table-wrap");
const tableBody     = document.getElementById("progress-table-body");

toggleTableBtn.addEventListener("click", () => {
  const willShow = tableWrap.classList.contains("hidden");
  tableWrap.classList.toggle("hidden");
  toggleTableBtn.textContent = willShow ? "Hide table" : "Show as table";
});

/* ── Render ───────────────────────────────────────────────────────── */
function render() {
  const name = select.value;
  const info = CATALOG_BY_NAME.get(name);
  const unit = info ? info.unit : "lbs";
  const points = getPoints(name);

  chartTitle.textContent = `${name} — ${unit === "min" ? "Duration" : "Weight"} Progress`;

  if (points.length === 0) {
    emptyState.classList.remove("hidden");
    chartCard.classList.add("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  chartCard.classList.remove("hidden");

  const latest = points[points.length - 1].value;
  const first  = points[0].value;
  const diff   = latest - first;

  statLatest.textContent = `${fmt(latest)} ${unit}`;
  statCount.textContent  = points.length;

  statChange.textContent = "";
  if (points.length < 2) {
    statChange.textContent = "—";
  } else {
    const pill = document.createElement("span");
    pill.className = "change-pill " + (diff > 0 ? "pos" : diff < 0 ? "neg" : "neutral");
    pill.textContent = `${diff > 0 ? "+" : ""}${fmt(diff)} ${unit}`;
    statChange.appendChild(pill);
  }

  renderChart(points, unit);
  renderTable(points, unit);
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function renderChart(points, unit) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 640, H = 280;
  const padL = 46, padR = 14, padT = 18, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.map((p) => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { const bump = Math.max(1, min * 0.1); min -= bump; max += bump; }
  const headroom = (max - min) * 0.15;
  const yMin = Math.max(0, min - headroom);
  const yMax = max + headroom;

  const xFor = (i) => (points.length === 1 ? padL + plotW / 2 : padL + (plotW * i) / (points.length - 1));
  const yFor = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Gridlines + y-axis ticks
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = yMin + ((yMax - yMin) * t) / ticks;
    const y = yFor(v);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, class: "chart-gridline" }));
    const label = svgEl("text", { x: padL - 8, y: y + 4, class: "chart-svg-text", "text-anchor": "end" });
    label.textContent = fmt(Math.round(v));
    svg.appendChild(label);
  }

  // X-axis date labels, thinned to avoid crowding
  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(points.length / maxLabels));
  points.forEach((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return;
    const label = svgEl("text", {
      x: xFor(i), y: H - padB + 18, class: "chart-svg-text", "text-anchor": "middle",
    });
    label.textContent = shortDate(p.date);
    svg.appendChild(label);
  });

  // Line
  if (points.length > 1) {
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`).join(" ");
    svg.appendChild(svgEl("path", { d, class: "chart-line" }));
  }

  // Dots
  points.forEach((p, i) => {
    svg.appendChild(svgEl("circle", { cx: xFor(i), cy: yFor(p.value), r: 4, class: "chart-dot" }));
  });

  // Direct label at the endpoint only (marks-and-anatomy: label selectively)
  const lastI = points.length - 1;
  const lastX = xFor(lastI), lastY = yFor(points[lastI].value);
  const endLabel = svgEl("text", {
    x: lastX, y: Math.max(padT + 10, lastY - 12),
    class: "chart-svg-text chart-endlabel",
    "text-anchor": lastX > W - padR - 40 ? "end" : "middle",
  });
  endLabel.textContent = `${fmt(points[lastI].value)} ${unit}`;
  svg.appendChild(endLabel);

  // Crosshair + hover dot (hidden until interaction)
  const crosshair = svgEl("line", { x1: 0, x2: 0, y1: padT, y2: H - padB, class: "chart-crosshair" });
  svg.appendChild(crosshair);
  const hoverDot = svgEl("circle", { r: 6, class: "chart-dot" });
  hoverDot.style.opacity = 0;
  svg.appendChild(hoverDot);

  // Hit area — pan-y keeps vertical page scroll working while we capture horizontal drag
  const hit = svgEl("rect", { x: padL, y: padT, width: plotW, height: plotH, class: "chart-hit" });
  hit.style.touchAction = "pan-y";
  svg.appendChild(hit);

  function nearestIndex(evt) {
    const rect = svg.getBoundingClientRect();
    const localX = ((evt.clientX - rect.left) / rect.width) * W;
    let nearest = 0, nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(xFor(i) - localX);
      if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    });
    return nearest;
  }

  function showAt(i) {
    const x = xFor(i), y = yFor(points[i].value);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.style.opacity = 1;
    hoverDot.setAttribute("cx", x);
    hoverDot.setAttribute("cy", y);
    hoverDot.style.opacity = 1;

    const rect = svg.getBoundingClientRect();
    const wrapRect = chartWrap.getBoundingClientRect();
    tooltip.style.left = `${(x / W) * rect.width + (rect.left - wrapRect.left)}px`;
    tooltip.style.top  = `${(y / H) * rect.height + (rect.top - wrapRect.top) - 10}px`;
    tooltip.textContent = "";
    const valEl = document.createElement("div");
    valEl.className = "tt-value";
    valEl.textContent = `${fmt(points[i].value)} ${unit}`;
    const dateEl = document.createElement("div");
    dateEl.className = "tt-date";
    dateEl.textContent = `${points[i].dayLabel} · ${shortDate(points[i].date)}`;
    tooltip.appendChild(valEl);
    tooltip.appendChild(dateEl);
    tooltip.classList.remove("hidden");
  }

  function hide() {
    crosshair.style.opacity = 0;
    hoverDot.style.opacity = 0;
    tooltip.classList.add("hidden");
  }

  hit.addEventListener("pointermove", (e) => showAt(nearestIndex(e)));
  hit.addEventListener("pointerdown", (e) => showAt(nearestIndex(e)));
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("pointerup", hide);

  hide();
}

function renderTable(points, unit) {
  tableBody.textContent = "";
  [...points].reverse().forEach((p) => {
    const tr = document.createElement("tr");
    const tdDate = document.createElement("td");
    tdDate.textContent = p.date;
    const tdDay = document.createElement("td");
    tdDay.textContent = p.dayLabel;
    const tdVal = document.createElement("td");
    tdVal.style.textAlign = "right";
    tdVal.style.color = "var(--muted)";
    tdVal.textContent = `${fmt(p.value)} ${unit}`;
    tr.appendChild(tdDate);
    tr.appendChild(tdDay);
    tr.appendChild(tdVal);
    tableBody.appendChild(tr);
  });
}

render();

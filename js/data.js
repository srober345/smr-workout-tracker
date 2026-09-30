/* Exercise data — edit this file to add/change exercises */

// True for day types logged by duration (minutes) rather than weight — no
// weight/volume tracking, "Duration" input shown instead of "Weight".
function isDurationLoggedDay(day) {
  return day.id === "cardio-intervals" || day.id === "cardio-zone2" || day.id === "mobility-hip";
}

// True for day types whose prescription is a single timed block (e.g. "35–45 min"
// or "7 rounds × 2 min") rather than a per-exercise sets×reps count.
function isTimedBlockDay(day) {
  return day.id === "cardio-intervals" || day.id === "cardio-zone2";
}

// Formats the prescribed protocol for an exercise, e.g. "3×10 per side".
// Timed-block days fall back to just the note (e.g. "35–45 min") when present.
function formatRx(day, ex) {
  if (isTimedBlockDay(day) && ex.note) return ex.note;
  return `${ex.sets}×${ex.reps}${ex.note ? " " + ex.note : ""}`;
}

// Per-exercise flags:
//   bodyweight: true — may be logged with 0 lbs (bodyweight); any added load is entered as weight.
//   noVolume:   true — excluded from volume math (e.g. carries, where reps are yards).
// Per-day `warmup` and `plan` (time-saving supersets to fit ~40 min) — shown
// above the exercise list on Log and Exercises.
const HIP_WARMUP =
  "3 min easy cardio, 1 round of the Mobility — Hip drills (Standing Marches, Half-Kneeling Hip Flexor " +
  "Stretch, 90/90 Hip Switches), then 1 light ramp-up set of the first lift.";

const DAYS = [
  {
    id: "lower-push",
    label: "Lower / Push",
    warmup: HIP_WARMUP,
    plan: "Leg Press and RDL on their own (rest ~90 sec). Then superset Chest Press + Leg Curl, " +
          "Lateral Raise + Calf Raises, and finish with Pallof Press. Rest ~60 sec between supersets.",
    exercises: [
      { name: "Leg Press or Goblet Squat",    sets: 3, reps: 8,  note: "fast up, slow down" },
      { name: "Romanian Deadlift",             sets: 3, reps: 8  },
      { name: "Cable or Machine Chest Press",  sets: 4, reps: 10 },
      { name: "Lateral Raise",                 sets: 3, reps: 12 },
      { name: "Leg Curl Machine",              sets: 3, reps: 10 },
      { name: "Calf Raises",                   sets: 3, reps: 12 },
      { name: "Pallof Press",                  sets: 3, reps: 10, note: "per side" },
    ],
  },
  {
    id: "pull",
    label: "Pull",
    warmup: "3 min easy cardio, then 1 light ramp-up set of Lat Pulldown.",
    plan: "Superset Lat Pulldown + Dead Bug, Seated Cable Row + Face Pulls, Biceps Curl + Triceps Pushdown, " +
          "then the Wrist Isometric. Rest ~60 sec between supersets. Golfer's elbow: use straps on pulls, " +
          "stop 2–3 reps short, and back off if elbow pain hits 3/10.",
    exercises: [
      { name: "Lat Pulldown",                               sets: 3, reps: 10, note: "neutral grip, straps" },
      { name: "Seated Cable Row",                           sets: 3, reps: 10, note: "V-handle, straps" },
      { name: "Cable Face Pulls",                           sets: 3, reps: 12 },
      { name: "Dead Bug",                                   sets: 3, reps: 8,  note: "per side", bodyweight: true },
      { name: "Biceps Curl",                                sets: 3, reps: 10, note: "hammer grip" },
      { name: "Triceps Pushdown",                           sets: 3, reps: 12 },
      { name: "Wrist Flexor/Pronator Isometric (PT)",       sets: 3, reps: 20, note: "sec hold" },
    ],
  },
  {
    id: "full-body-golf",
    label: "Full Body / Golf",
    warmup: HIP_WARMUP,
    plan: "Trap Bar Deadlift on its own (rest ~2 min). Then superset Split Squat + Push-Ups, " +
          "Iso-Lateral Row + Side Plank, and Woodchoppers + External Rotation. Rest ~60 sec between supersets.",
    exercises: [
      { name: "Trap Bar Deadlift",                               sets: 3, reps: 6  },
      { name: "Cable Woodchoppers or Rotational Med Ball Throw", sets: 3, reps: 8,  note: "per side, fast pull, slow return" },
      { name: "Single-Leg Split Squat or Step-Up",               sets: 3, reps: 8  },
      { name: "Push-Up or Landmine Press",                       sets: 3, reps: 12, note: "3-sec lower, 1-sec pause (0 lbs = push-ups)", bodyweight: true },
      { name: "Iso-Lateral Row Machine",                         sets: 3, reps: 10, note: "both arms together, neutral grip" },
      { name: "Side Plank or Suitcase Carry",                    sets: 3, reps: 30, note: "sec per side (carry only if elbow is calm)", bodyweight: true, noVolume: true },
      { name: "Shoulder External Rotation (Cable or Band)",      sets: 3, reps: 12 },
    ],
  },
  {
    id: "mobility-hip",
    label: "Mobility — Hip",
    exercises: [
      { name: "Standing Marches (Active Hip Flexion Drives)", sets: 2, reps: 10, note: "per side" },
      { name: "Half-Kneeling Hip Flexor Stretch",              sets: 3, reps: 30, note: "sec hold, per side, posterior pelvic tilt" },
      { name: "90/90 Hip Switches",                             sets: 2, reps: 6,  note: "per side" },
    ],
  },
  {
    id: "cardio-intervals",
    label: "Cardio — Intervals",
    exercises: [
      { name: "Bike or Rower Intervals", sets: 7, reps: 1, note: "7 rounds × 2 min hard / 2 min easy" },
    ],
  },
  {
    id: "cardio-zone2",
    label: "Cardio — Zone 2",
    exercises: [
      { name: "Easy Zone 2 Cardio",              sets: 1, reps: 1, note: "35–45 min" },
      { name: "PT Stretching/Isometric Routine", sets: 1, reps: 1, note: "as prescribed" },
    ],
  },
];

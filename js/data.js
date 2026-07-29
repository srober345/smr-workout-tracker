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

const DAYS = [
  {
    id: "lower-push",
    label: "Lower / Push",
    exercises: [
      { name: "Leg Press or Goblet Squat",    sets: 3, reps: 8  },
      { name: "Romanian Deadlift",             sets: 3, reps: 8  },
      { name: "Cable or Machine Chest Press",  sets: 3, reps: 10 },
      { name: "Leg Curl Machine",              sets: 3, reps: 10 },
      { name: "Calf Raises",                   sets: 3, reps: 12 },
      { name: "Pallof Press",                  sets: 3, reps: 10, note: "per side" },
    ],
  },
  {
    id: "pull",
    label: "Pull",
    exercises: [
      { name: "Lat Pulldown",                               sets: 3, reps: 10 },
      { name: "Chest-Supported Row Machine",                sets: 3, reps: 10 },
      { name: "Cable Face Pulls",                           sets: 3, reps: 12 },
      { name: "Reverse Fly Machine",                        sets: 3, reps: 12 },
      { name: "Triceps Pushdown",                           sets: 3, reps: 12 },
      { name: "Wrist Flexor/Pronator Isometric (PT)",       sets: 3, reps: 20, note: "sec hold" },
    ],
  },
  {
    id: "full-body-golf",
    label: "Full Body / Golf",
    exercises: [
      { name: "Trap Bar Deadlift",                                 sets: 3, reps: 6  },
      { name: "Cable Woodchoppers or Rotational Med Ball Throw",   sets: 3, reps: 8,  note: "per side" },
      { name: "Single-Leg Split Squat or Step-Up",                 sets: 3, reps: 8  },
      { name: "Shoulder External Rotation (Cable or Band)",        sets: 3, reps: 12 },
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

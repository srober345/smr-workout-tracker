#!/usr/bin/env python3
"""Log a workout session to Google Sheets."""

from datetime import date

from check_volume import run_volume_check
from config import DAY_TYPES
from sheets_client import append_rows, get_all_records


def prompt_day_type() -> str:
    print("\nSelect Day Type:")
    for i, dt in enumerate(DAY_TYPES, 1):
        print(f"  {i}. {dt}")
    while True:
        choice = input("Enter number: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(DAY_TYPES):
            return DAY_TYPES[int(choice) - 1]
        print(f"  Please enter a number between 1 and {len(DAY_TYPES)}.")


def prompt_exercises() -> list[tuple[str, str, str, str]]:
    """Return list of (exercise, weight, sets, reps) tuples."""
    exercises = []
    print('\nEnter exercises (type "done" when finished):\n')
    while True:
        name = input("Exercise name (or 'done'): ").strip()
        if name.lower() == "done":
            if not exercises:
                print("  No exercises logged yet — please add at least one.")
                continue
            break

        weight = prompt_number("  Weight (lbs, 0 for bodyweight): ", allow_zero=True)
        sets = prompt_number("  Sets: ")
        reps = prompt_number("  Reps: ")
        exercises.append((name, weight, sets, reps))
        print(f"  ✓ Logged: {name} — {weight} lbs × {sets} sets × {reps} reps\n")

    return exercises


def prompt_number(label: str, allow_zero: bool = False) -> str:
    while True:
        val = input(label).strip()
        try:
            n = float(val)
            if allow_zero and n >= 0:
                return val
            if not allow_zero and n > 0:
                return val
            print("  Please enter a positive number.")
        except ValueError:
            print("  Please enter a valid number.")


def prompt_elbow_pain() -> str:
    while True:
        val = input("\nElbow pain level today (0-10, 0 = none): ").strip()
        try:
            n = int(val)
            if 0 <= n <= 10:
                return str(n)
            print("  Please enter a number between 0 and 10.")
        except ValueError:
            print("  Please enter a whole number between 0 and 10.")


def main() -> None:
    print("═" * 52)
    print("  SMR Workout Tracker")
    print("═" * 52)

    today = date.today().isoformat()
    day_type = prompt_day_type()
    exercises = prompt_exercises()
    elbow_pain = prompt_elbow_pain()
    notes = input("Session notes (optional, press Enter to skip): ").strip()

    rows = []
    for exercise, weight, sets, reps in exercises:
        rows.append([today, day_type, exercise, weight, sets, reps, elbow_pain, notes])

    print("\nLogging to Google Sheets…")
    try:
        append_rows(rows)
    except SystemExit as e:
        print(f"\n❌ {e}")
        return

    print(f"✓ Logged {len(rows)} exercise(s) for {today} ({day_type}).")

    # Auto-run volume check after logging
    try:
        records = get_all_records()
        run_volume_check(records)
    except SystemExit as e:
        print(f"\n⚠️  Could not run volume check: {e}")


if __name__ == "__main__":
    main()

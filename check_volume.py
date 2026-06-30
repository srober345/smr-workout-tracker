#!/usr/bin/env python3
"""Volume spike checker for pull-day exercises (elbow safety monitor)."""

from datetime import date, timedelta

from sheets_client import get_all_records


def get_pull_volume_and_pain(records: list[dict], start: date, end: date) -> tuple[float, list[int]]:
    """Return (total_volume, [elbow_pain_scores]) for Pull days in [start, end)."""
    volume = 0.0
    pain_scores = []
    for row in records:
        try:
            row_date = date.fromisoformat(str(row.get("Date", "")).strip())
        except ValueError:
            continue
        if not (start <= row_date < end):
            continue
        if str(row.get("Day Type", "")).strip() != "Pull":
            continue

        try:
            w = float(row.get("Weight (lbs)", 0) or 0)
            s = float(row.get("Sets", 0) or 0)
            r = float(row.get("Reps", 0) or 0)
            volume += w * s * r
        except (ValueError, TypeError):
            pass

        pain_raw = row.get("Elbow Pain (0-10)", "")
        try:
            pain = int(str(pain_raw).strip())
            pain_scores.append(pain)
        except (ValueError, TypeError):
            pass

    return volume, pain_scores


def run_volume_check(records: list[dict] | None = None) -> None:
    if records is None:
        print("Fetching workout data from Google Sheets…")
        records = get_all_records()

    today = date.today()
    this_week_start = today - timedelta(days=6)   # last 7 days inclusive
    last_week_start = this_week_start - timedelta(days=7)

    this_vol, this_pain = get_pull_volume_and_pain(records, this_week_start, today + timedelta(days=1))
    last_vol, _ = get_pull_volume_and_pain(records, last_week_start, this_week_start)

    print("\n── Pull Volume Check ─────────────────────────────────────────")
    print(f"  This week ({this_week_start} → {today}): {this_vol:,.0f} lbs total volume")

    if last_vol == 0:
        if this_vol == 0:
            print("  No pull data recorded yet.")
        else:
            print("  No prior week of pull data — skipping comparison.")
        print("──────────────────────────────────────────────────────────────\n")
        return

    pct_change = ((this_vol - last_vol) / last_vol) * 100
    print(f"  Last week ({last_week_start} → {this_week_start - timedelta(days=1)}): {last_vol:,.0f} lbs total volume")
    print(f"  Change: {pct_change:+.1f}%")

    if pct_change > 20:
        print(
            f"\n⚠️  Pull volume up {pct_change:.0f}% vs last week "
            f"({last_vol:,.0f} lbs → {this_vol:,.0f} lbs).\n"
            "   Consider holding steady or backing off given elbow history."
        )

    if this_pain:
        avg_pain = sum(this_pain) / len(this_pain)
        if avg_pain >= 3:
            print(
                f"\n🔴 Elbow pain averaging {avg_pain:.1f}/10 this week.\n"
                "   Recommend a deload: reduce pull volume by 30-40% and reassess."
            )

    print("──────────────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    run_volume_check()

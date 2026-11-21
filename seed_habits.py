"""Seed HabiView with 6 habits and 45 days of realistic completion history.

Re-running this script resets the demo data so the dashboard always looks rich.
Engineered by Raj Gautam.
"""

import os
import random
import sqlite3
from datetime import date, timedelta

from app import DB_PATH

HABITS = [
    ("2 Hours Python & Linux Practice", "Deep Work", "⌘", 0.90),
    ("Ethical Hacking Lab", "Skill", "🛡", 0.74),
    ("Morning Exercise", "Health", "♥", 0.82),
    ("Read Tech Docs", "Skill", "✦", 0.72),
    ("Zero Sugar", "Health", "✧", 0.91),
    ("GitHub Daily Commit", "Deep Work", "⌥", 0.86),
]

HISTORY_DAYS = 45
FORCED_STREAK_DAYS = 21  # the emerald "active streak" run on the first habit


def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(
        """
        DELETE FROM habit_logs;
        DELETE FROM habits;
        DELETE FROM sqlite_sequence WHERE name IN ('habits', 'habit_logs');
        """
    )

    habit_ids = []
    for name, category, icon, _probability in HABITS:
        cursor = conn.execute(
            "INSERT INTO habits (name, category, icon, created_at) VALUES (?, ?, ?, ?)",
            (name, category, icon, (date.today() - timedelta(days=HISTORY_DAYS)).isoformat()),
        )
        habit_ids.append(cursor.lastrowid)

    rng = random.Random(20261122)
    today = date.today()
    inserted = 0

    for offset in range(HISTORY_DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        weekend = day.weekday() >= 5

        for index, (_name, _category, _icon, probability) in enumerate(HABITS):
            if offset == 0:
                done = index < 5  # today: 5 of 6 complete -> 83%
            elif index == 0 and offset < FORCED_STREAK_DAYS:
                done = True  # 21 consecutive days for the flame hero
            else:
                adjusted = probability
                if weekend and index in (0, 5):
                    adjusted *= 0.55  # deep work dips on weekends
                elif weekend and index == 3:
                    adjusted *= 0.8
                done = rng.random() < adjusted

            if done:
                conn.execute(
                    "INSERT OR IGNORE INTO habit_logs (habit_id, log_date, completed) "
                    "VALUES (?, ?, 1)",
                    (habit_ids[index], day.isoformat()),
                )
                inserted += 1

    conn.commit()
    conn.close()

    print("HabiView seeded successfully.")
    print(f"  Habits : {len(HABITS)}")
    print(f"  Days   : {HISTORY_DAYS} ({today - timedelta(days=HISTORY_DAYS - 1)} -> {today})")
    print(f"  Logs   : {inserted} completed check-ins")
    print(f"  DB     : {DB_PATH}")
    print("\nRun the app with:  python3 app.py")


if __name__ == "__main__":
    main()

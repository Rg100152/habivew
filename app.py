"""HabiView - Daily Habit, Streak & Analytics Engine.

Engineered by Raj Gautam.  Contact links: email, Instagram and GitHub only.
"""

import os
import sqlite3
from datetime import date, timedelta

from flask import Flask, g, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database", "habiview.db")

CATEGORIES = ("Deep Work", "Health", "Skill")
CATEGORY_META = {
    "Deep Work": {"color": "#10B981", "icon": "⌘"},
    "Health": {"color": "#F97316", "icon": "♥"},
    "Skill": {"color": "#8B5CF6", "icon": "✦"},
}
HEATMAP_DAYS = 90
ANALYTICS_DAYS = 30

DEVELOPER = {
    "name": "Raj Gautam",
    "email": "graj13099@gmail.com",
    "instagram": "@linux.userraj",
    "github": "https://github.com/Rg100152",
}

app = Flask(__name__)
app.json.sort_keys = False


# --------------------------------------------------------------------------- #
# Database helpers
# --------------------------------------------------------------------------- #
def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS habits (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            category   TEXT NOT NULL DEFAULT 'Deep Work',
            icon       TEXT NOT NULL DEFAULT '◆',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS habit_logs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id   INTEGER NOT NULL,
            log_date   TEXT NOT NULL,
            completed  INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0, 1)),
            UNIQUE (habit_id, log_date),
            FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs (log_date);
        """
    )
    conn.commit()
    conn.close()


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


init_db()


# --------------------------------------------------------------------------- #
# Streak + analytics core
# --------------------------------------------------------------------------- #
def completed_dates(db, habit_id):
    rows = db.execute(
        "SELECT log_date FROM habit_logs WHERE habit_id = ? AND completed = 1",
        (habit_id,),
    ).fetchall()
    result = set()
    for row in rows:
        try:
            result.add(date.fromisoformat(row["log_date"]))
        except ValueError:
            continue
    return result


def current_streak(dates):
    """Consecutive completed days ending today, or ending yesterday if today is open."""
    today = date.today()
    cursor = today if today in dates else today - timedelta(days=1)
    count = 0
    while cursor in dates:
        count += 1
        cursor -= timedelta(days=1)
    return count


def longest_streak(dates):
    best = run = 0
    previous = None
    for day in sorted(dates):
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return best


def week_dots(dates):
    """Mon -> Sun status dots for the current week: True / False / None (future)."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    dots = []
    for offset in range(7):
        day = monday + timedelta(days=offset)
        if day > today:
            dots.append(None)
        else:
            dots.append(day in dates)
    return dots


def fetch_habits(db):
    return db.execute("SELECT * FROM habits ORDER BY id ASC").fetchall()


def habit_view(row, dates, today):
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "icon": row["icon"],
        "color": CATEGORY_META.get(row["category"], {}).get("color", "#10B981"),
        "completed_today": today in dates,
        "current_streak": current_streak(dates),
        "longest_streak": longest_streak(dates),
        "week": week_dots(dates),
    }


def progress_payload(habits):
    done = sum(1 for h in habits if h["completed_today"])
    total = len(habits)
    return {
        "done": done,
        "total": total,
        "percent": round(done / total * 100) if total else 0,
    }


def summary_payload(habits):
    active = max((h["current_streak"] for h in habits), default=0)
    longest = max((h["longest_streak"] for h in habits), default=0)
    total_completed = db_total_completions()
    return {
        "active_streak": active,
        "longest_streak": longest,
        "total_completions": total_completed,
        "habit_count": len(habits),
    }


def db_total_completions():
    return get_db().execute("SELECT COUNT(*) FROM habit_logs WHERE completed = 1").fetchone()[0]


def heatmap_payload(habits):
    """90-day GitHub-style intensity matrix for the habits that exist today."""
    today = date.today()
    total = len(habits)
    start = today - timedelta(days=HEATMAP_DAYS - 1)
    rows = get_db().execute(
        "SELECT log_date, COUNT(*) AS n FROM habit_logs "
        "WHERE completed = 1 AND log_date >= ? AND log_date <= ? GROUP BY log_date",
        (start.isoformat(), today.isoformat()),
    ).fetchall()
    counts = {row["log_date"]: row["n"] for row in rows}

    cells = []
    for offset in range(HEATMAP_DAYS):
        day = start + timedelta(days=offset)
        count = min(counts.get(day.isoformat(), 0), total) if total else 0
        ratio = count / total if total else 0
        if count == 0:
            level = 0
        elif ratio <= 0.25:
            level = 1
        elif ratio <= 0.5:
            level = 2
        elif ratio < 1:
            level = 3
        else:
            level = 4
        cells.append(
            {
                "date": day.isoformat(),
                "weekday": day.weekday(),
                "count": count,
                "total": total,
                "level": level,
            }
        )
    return cells


def categories_payload():
    today = date.today()
    start = today - timedelta(days=ANALYTICS_DAYS - 1)
    rows = get_db().execute(
        "SELECT h.category AS category, COUNT(*) AS done FROM habit_logs l "
        "JOIN habits h ON h.id = l.habit_id "
        "WHERE l.completed = 1 AND l.log_date >= ? AND l.log_date <= ? "
        "GROUP BY h.category",
        (start.isoformat(), today.isoformat()),
    ).fetchall()
    done_by_category = {row["category"]: row["done"] for row in rows}

    buckets = get_db().execute(
        "SELECT category, COUNT(*) AS n FROM habits GROUP BY category"
    ).fetchall()
    possible = {row["category"]: row["n"] * ANALYTICS_DAYS for row in buckets}

    result = []
    for category in CATEGORIES:
        total = possible.get(category, 0)
        done = done_by_category.get(category, 0)
        result.append(
            {
                "category": category,
                "done": done,
                "total": total,
                "rate": round(done / total * 100) if total else 0,
                "color": CATEGORY_META[category]["color"],
                "icon": CATEGORY_META[category]["icon"],
            }
        )
    return result


def dashboard_payload():
    db = get_db()
    rows = fetch_habits(db)
    today = date.today()
    habits = [habit_view(row, completed_dates(db, row["id"]), today) for row in rows]
    return {
        "habits": habits,
        "progress": progress_payload(habits),
        "summary": summary_payload(habits),
        "heatmap": heatmap_payload(habits),
        "categories": categories_payload(),
        "today": today.isoformat(),
        "categories_available": list(CATEGORIES),
        "developer": DEVELOPER,
    }


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@app.route("/")
def index():
    return render_template("index.html", dashboard=dashboard_payload(), developer=DEVELOPER)


@app.route("/api/dashboard")
def api_dashboard():
    return jsonify(dashboard_payload())


@app.route("/api/analytics")
def api_analytics():
    payload = dashboard_payload()
    return jsonify(
        {
            "heatmap": payload["heatmap"],
            "categories": payload["categories"],
            "summary": payload["summary"],
        }
    )


@app.route("/api/toggle/<int:habit_id>", methods=["POST"])
def api_toggle(habit_id):
    db = get_db()
    row = db.execute("SELECT * FROM habits WHERE id = ?", (habit_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "error": "Habit not found"}), 404

    today = date.today().isoformat()
    body = request.get_json(silent=True) or {}
    existing = db.execute(
        "SELECT completed FROM habit_logs WHERE habit_id = ? AND log_date = ?",
        (habit_id, today),
    ).fetchone()

    if "completed" in body:
        desired = 1 if body["completed"] else 0
    else:
        desired = 0 if existing and existing["completed"] else 1

    if desired == 0:
        db.execute(
            "DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?", (habit_id, today)
        )
    else:
        db.execute(
            "INSERT INTO habit_logs (habit_id, log_date, completed) VALUES (?, ?, 1) "
            "ON CONFLICT(habit_id, log_date) DO UPDATE SET completed = 1",
            (habit_id, today),
        )
    db.commit()

    payload = dashboard_payload()
    updated = next((h for h in payload["habits"] if h["id"] == habit_id), None)
    return jsonify(
        {
            "ok": True,
            "habit": updated,
            "progress": payload["progress"],
            "summary": payload["summary"],
            "categories": payload["categories"],
            "heat_cell": next((c for c in payload["heatmap"] if c["date"] == today), None),
        }
    )


@app.route("/api/habits", methods=["POST"])
def api_create_habit():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    category = str(body.get("category", "Deep Work")).strip()
    icon = str(body.get("icon", "")).strip() or CATEGORY_META.get(category, {}).get("icon", "◆")

    if not 1 <= len(name) <= 60:
        return jsonify({"ok": False, "error": "Habit name must be 1-60 characters"}), 400
    if category not in CATEGORIES:
        return jsonify({"ok": False, "error": "Unknown category"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO habits (name, category, icon, created_at) VALUES (?, ?, ?, ?)",
        (name, category, icon, date.today().isoformat()),
    )
    db.commit()

    payload = dashboard_payload()
    return jsonify(
        {
            "ok": True,
            "habit": next((h for h in payload["habits"] if h["id"] == cursor.lastrowid), None),
            "progress": payload["progress"],
            "categories": payload["categories"],
        }
    ), 201


@app.route("/api/habits/<int:habit_id>", methods=["DELETE"])
def api_delete_habit(habit_id):
    db = get_db()
    cursor = db.execute("DELETE FROM habits WHERE id = ?", (habit_id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({"ok": False, "error": "Habit not found"}), 404

    payload = dashboard_payload()
    return jsonify(
        {
            "ok": True,
            "progress": payload["progress"],
            "summary": payload["summary"],
            "categories": payload["categories"],
            "heatmap": payload["heatmap"],
        }
    )


if __name__ == "__main__":
    # Set PORT=5055 (or any free port) if 5000 is already occupied.
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False, threaded=True)

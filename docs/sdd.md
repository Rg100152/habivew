# HabiView — Software Design Document (SDD)

**Version:** 1.0 · **Engineered by:** Raj Gautam · [GitHub](https://github.com/Rg100152) · [Email](mailto:graj13099@gmail.com) · [Instagram @linux.userraj](https://www.instagram.com/linux.userraj/)

> Privacy note: only the public developer links (email, Instagram, GitHub) are used — no telephony or private contact data is collected, stored, rendered or documented anywhere in HabiView.

---

## 1. Purpose

HabiView is a local-first daily habit tracker that turns check-ins into visible momentum: live streaks, an animated dual-ring completion orbit, a 90-day GitHub-style consistency heatmap and category-level behavioral analytics.

### 1.1 Design goals

| Goal | How it is met |
|---|---|
| Zero-friction logging | One-click check-in with optimistic visual feedback; no page reload |
| Instant feedback | Every mutation returns fresh progress, streak, heatmap and category payloads |
| Visual clarity | Obsidian canvas + emerald progress + flame streak + violet analytics |
| Rich first run | Seed script pre-fills 6 habits and 45 days of history |
| Lightweight | Flask + SQLite + vanilla JS; no build step, no npm, no heavy framework |
| Low resource use | Single SQLite file, small payloads, CSS transform/opacity animations |

---

## 2. Architecture

Layered three-tier design — see [`sdd-architecture.svg`](sdd-architecture.svg) and the DFD in [`dfd.svg`](dfd.svg).

```
Browser (HTML/CSS/JS)  ──Fetch/JSON──▶  Flask app (routes + streak engine + analytics)
       ▲                                          │
       └──────── repaint (no reload) ─────────────┤
                                                  ▼
                                        SQLite (habits, habit_logs)
```

- **Presentation:** `templates/base.html`, `templates/index.html`, `static/css/habiview.css`, `static/js/habiview.js`
- **Application:** `app.py` — routing, validation, streak calculation, heatmap/analytics aggregation
- **Data:** `database/habiview.db` — two tables, one UNIQUE constraint, one index

---

## 3. Data model

### 3.1 `habits`

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Stable identity |
| `name` | TEXT | NOT NULL, 1–60 chars (API validated) | Habit label |
| `category` | TEXT | `Deep Work` \| `Health` \| `Skill` | Analytics grouping + color |
| `icon` | TEXT | DEFAULT `◆` | Card glyph |
| `created_at` | TEXT | ISO date | Provenance |

### 3.2 `habit_logs`

| Column | Type | Constraint | Purpose |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Row id |
| `habit_id` | INTEGER | FK → `habits.id` ON DELETE CASCADE | Owner |
| `log_date` | TEXT | ISO `YYYY-MM-DD` | Day of check-in |
| `completed` | INTEGER | CHECK (0,1) | Completion flag |

`UNIQUE(habit_id, log_date)` makes check-ins idempotent. Index `idx_habit_logs_date` accelerates the 90-day heatmap query. Foreign keys are enabled per connection.

---

## 4. Core algorithms

### 4.1 Current streak

```
dates = completed log dates for the habit
cursor = today if today in dates else yesterday
count  = 0
while cursor in dates:
    count += 1
    cursor -= 1 day
return count
```

An uncompleted today does **not** break the streak — it keeps yesterday's run visible until the day closes.

### 4.2 Longest streak

Sort completed dates ascending; walk once, incrementing a running counter when `day - previous == 1 day`, resetting otherwise; return the maximum run.

### 4.3 Weekly mini-dots

Monday of the current week is derived with `today - timedelta(days=today.weekday())`; seven slots are emitted as `true` (done), `false` (missed) or `null` (future).

### 4.4 Heatmap intensity

For each of the last 90 days: `count = completed habits / total habits`.

| Ratio | Level | Color |
|---|---|---|
| 0 | 0 | `#171F29` |
| ≤ 25% | 1 | `#064E3B` |
| ≤ 50% | 2 | `#047857` |
| < 100% | 3 | `#10B981` |
| 100% | 4 | `#6EE7B7` + glow |

### 4.5 Category analytics

For each category, `done` counts completions in the last 30 days; `possible` = habits in that category × 30; `rate = done / possible × 100`.

---

## 5. API contract

| Method | Endpoint | Request | Response |
|---|---|---|---|
| GET | `/` | — | Rendered dashboard with embedded bootstrap JSON |
| GET | `/api/dashboard` | — | `habits`, `progress`, `summary`, `heatmap`, `categories`, `today`, `developer` |
| GET | `/api/analytics` | — | `heatmap`, `categories`, `summary` |
| POST | `/api/toggle/<id>` | `{}` or `{"completed": bool}` | `habit`, `progress`, `summary`, `categories`, `heat_cell` |
| POST | `/api/habits` | `{"name","category","icon"}` | `habit`, `progress`, `categories` — **201** |
| DELETE | `/api/habits/<id>` | — | `progress`, `summary`, `categories`, `heatmap` |

Errors use JSON `{"ok": false, "error": "..."}` with `400` (invalid input) or `404` (missing habit).

---

## 6. Check-in sequence

1. User clicks the check button on a habit card.
2. JS creates a DOM ripple at the click coordinates (instant feedback) and disables the button.
3. `POST /api/toggle/<id>` performs an `INSERT ... ON CONFLICT DO UPDATE` (or `DELETE` when unchecking).
4. Server recomputes the full dashboard payload in one request.
5. JS merges the response, repaints the rings, cards, heatmap cell and category bars, then fires the card-pop animation and a toast.
6. No navigation, no full reload.

---

## 7. UI design system

| Token | Value | Usage |
|---|---|---|
| Background | `#080C10` | Deep botanical obsidian canvas |
| Card surface | `#11171F` | Matte glass cards |
| Emerald | `#10B981` | Completion, progress ring, primary CTA |
| Flame | `#F97316` | Active streak, inner ring, mini-dot glow |
| Violet | `#8B5CF6` | Analytics and personal-best accents |
| Border | `rgba(16,185,129,0.22)` | Glass card outline |

Motion uses only `transform` and `opacity` where possible, with `prefers-reduced-motion` respected — suitable for a 4 GB RAM Pop!_OS laptop.

---

## 8. Non-functional considerations

- **Performance:** two small tables, one indexed aggregate query for the heatmap, no ORM overhead; payloads are a few KB.
- **Reliability:** `init_db()` is idempotent; missing tables are created on first import; seed script resets demo data deterministically.
- **Security:** parameterized SQL everywhere; foreign keys ON; HTML output escaped in JS; user input length + category validated server-side.
- **Privacy:** only email, Instagram and GitHub are displayed. No telephony data, no telemetry, no external analytics.
- **Portability:** `PORT` environment variable overrides the default `5000`.

---

## 9. Test evidence (local run)

| Check | Result |
|---|---|
| `GET /` | 200, correct `<title>` |
| `GET /api/dashboard` | 5/6 = 83%, 21-day active streak, 90 heatmap cells |
| `POST /api/toggle/6` | 6/6 = 100%, heat cell level 4; second call returns to 83% |
| `POST /api/habits` + `DELETE` | 6 → 7 → 6 habits |
| Invalid category / missing id | 400 / 404 |
| Headless Chrome screenshots | Captured from the real running UI |

---

## 10. Future work

- Streak freeze / vacation day (pause without breaking a run)
- Habit notes and per-day journaling
- Weekly digest email (opt-in) and CSV export
- PWA offline mode with local queue for check-ins

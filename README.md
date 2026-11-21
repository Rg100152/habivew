<div align="center">

<img src="static/assets/banner.jpg" alt="HabiView — dark productivity workspace banner" width="100%">

<br>

<img src="static/assets/logo-habiview.svg" alt="HabiView" width="340">

<br>

<img src="static/assets/typing-badge.svg" alt="HabiView — build unbreakable streaks" width="440">

# HabiView

**Build Unbreakable Streaks, Visualize Your Discipline.**

Daily Habit Tracker with a live Biometric Orbit, 90-day consistency heatmap and behavioral analytics.

Engineered by **[Raj Gautam](https://github.com/Rg100152)**

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-1572B6?logo=html5&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-10B981)
[![Stars](https://img.shields.io/github/stars/Rg100152/habivew?style=social)](https://github.com/Rg100152/habivew/stargazers)
[![Forks](https://img.shields.io/github/forks/Rg100152/habivew?style=social)](https://github.com/Rg100152/habivew/forks)
[![Last commit](https://img.shields.io/github/last-commit/Rg100152/habivew?color=10B981)](https://github.com/Rg100152/habivew/commits/main)

</div>

---

## ✨ What makes HabiView different

| Feature | What it does |
|---|---|
| 🟢 **Biometric Orbit Hero** | Dual animated SVG rings: outer = today's completion %, inner = live streak fire (pulsing orange glow). |
| ✅ **1-Click Ripple Check-in** | Tap a habit card button → emerald ripple + glow, SQLite write via Fetch API, **zero page reloads**. |
| 🔥 **Live Streak Engine** | Per-habit current & longest streaks recalculated on every check-in, plus a global active-streak counter. |
| ▦ **90-Day Consistency Heatmap** | GitHub-style intensity matrix with hover/focus tooltips showing date and daily score. |
| ◈ **Category Pulse** | Completion bars for Deep Work, Health and Skill over the last 30 days. |
| 🎛 **Focus Filter** | Instantly filter the habit matrix by All / Deep Work / Health / Skill. |
| ➕ **Add & Remove Habits** | Modal-driven creation and one-click removal — both synced to SQLite. |
| 🌙 **Zen-Botanical Obsidian UI** | `#080C10` canvas, `#11171F` glass cards, emerald/flame/violet accents, ambient glows, fully responsive. |

---

## 🖼 UI Showcase

| Biometric Orbit + Habit Matrix | 90-Day Heatmap + Category Analytics |
|:---:|:---:|
| <img src="static/assets/screenshot-hero.png" alt="HabiView hero orbit and habit cards" width="100%"> | <img src="static/assets/screenshot-heatmap.png" alt="HabiView 90 day heatmap and analytics" width="100%"> |

_Screenshots are captured from the real running app — not mockups._

---

## 🚀 Quick start

```bash
# 1. Clone & enter
git clone https://github.com/Rg100152/habivew.git
cd habivew

# 2. Virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 3. Dependencies
pip install -r requirements.txt

# 4. Seed 6 habits + 45 days of history
python3 seed_habits.py

# 5. Run
python3 app.py
```

Open **http://127.0.0.1:5000** in your browser.

> 💡 Port 5000 busy? Run `PORT=5055 python3 app.py` and open `http://127.0.0.1:5055`.

The seed script creates `database/habiview.db` with 6 habits and 45 days of realistic logs — the heatmap, streaks and analytics are rich immediately (today starts at **5/6 = 83%** so you can try a check-in right away).

---

## 📁 Project structure

```text
habiview/
├── app.py                      # Flask server, streak calculator & analytics API
├── seed_habits.py              # 6 habits + 45 days of realistic check-in history
├── requirements.txt            # flask
├── README.md                   # This dynamic README
├── .gitignore
├── database/
│   ├── .gitkeep
│   └── habiview.db             # Generated locally (SQLite)
├── templates/
│   ├── base.html               # Glass command bar, logo, dev pill, modal, footer
│   └── index.html              # Orbit hero, habit matrix, heatmap, analytics
├── static/
│   ├── css/habiview.css        # Zen-Botanical Obsidian design system
│   ├── js/habiview.js          # Rings, check-in ripple, heatmap, filters, modal
│   └── assets/
│       ├── logo-habiview.svg   # Emerald flame + orbit wordmark
│       ├── favicon.svg
│       ├── banner.jpg
│       ├── avatar.jpg
│       ├── typing-badge.svg    # Animated typing badge used above
│       ├── screenshot-hero.png
│       └── screenshot-heatmap.png
└── docs/
    ├── dfd.svg                 # Downloadable Data Flow Diagram (SVG)
    ├── sdd.md                  # Software Design Document
    └── sdd-architecture.svg    # Downloadable architecture diagram (SVG)
```

---

## 🔌 API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | Dashboard with server-rendered bootstrap data |
| `GET` | `/api/dashboard` | Full payload: habits, progress, summary, heatmap, categories |
| `GET` | `/api/analytics` | 90-day heatmap + category rates + summary |
| `POST` | `/api/toggle/<habit_id>` | Check in / uncheck today; recalculates every streak (optional `{"completed": true\|false}`) |
| `POST` | `/api/habits` | Create habit — `{"name", "category", "icon"}` |
| `DELETE` | `/api/habits/<habit_id>` | Remove a habit and its logs |

All mutations return the refreshed progress/summary/category data so the frontend can repaint in a single paint cycle — no reload, no extra round-trip.

---

## 🗄 Database model

```text
habits                       habit_logs
─────────────────────        ─────────────────────────────
id        INTEGER PK    ┌──── id         INTEGER PK
name      TEXT          │     habit_id   INTEGER FK → habits.id
category  TEXT          │     log_date   TEXT  (YYYY-MM-DD)
icon      TEXT          │     completed  INTEGER (0 | 1)
created_at TEXT         │     UNIQUE(habit_id, log_date)
                        └────
```

**Streak rule:** walk backwards from today; if today is still open, start at yesterday. Count consecutive completed days. Longest streak = maximum consecutive run across all history.

---

## 🔄 Data Flow Diagram (DFD)

```mermaid
flowchart LR
    U["👤 User / Raj"] -->|"1-Click Check-in"| UI["🌐 Browser UI<br/>Habit Cards · Orbit · Heatmap"]
    UI -->|"POST /api/toggle/:id"| API["⚙️ Flask API<br/>Streak Calculator + Analytics"]
    UI -->|"POST /api/habits<br/>DELETE /api/habits/:id"| API
    API -->|"SELECT / INSERT / DELETE"| DB[("🗄️ SQLite<br/>habits + habit_logs")]
    DB -->|"History rows"| API
    API -->|"JSON: progress · streaks · heatmap · categories"| UI
    UI -->|"Instant repaint (60fps)"| V["🔥 Rings · Ripple · 90-Day Matrix"]
    style API fill:#11171F,stroke:#10B981,stroke-width:2px,color:#E8EEF5
    style DB fill:#11171F,stroke:#8B5CF6,stroke-width:2px,color:#E8EEF5
    style UI fill:#11171F,stroke:#F97316,stroke-width:2px,color:#E8EEF5
```

<a href="docs/dfd.svg"><img src="docs/dfd.svg" alt="Download the HabiView Data Flow Diagram SVG" width="100%"></a>

📥 [Download the DFD as SVG](docs/dfd.svg) · 📐 [Read the full SDD](docs/sdd.md) · 🏗 [Architecture SVG](docs/sdd-architecture.svg)

---

## 👨‍💻 Developer

<div align="center">

<img src="static/assets/avatar.jpg" alt="Raj Gautam" width="90" style="border-radius:20px">

**Raj Gautam** — Full-Stack Developer · Discipline Systems

[![Email](https://img.shields.io/badge/Email-graj13099%40gmail.com-10B981?logo=gmail&logoColor=white)](mailto:graj13099@gmail.com)
[![Instagram](https://img.shields.io/badge/Instagram-%40linux.userraj-E1306C?logo=instagram&logoColor=white)](https://www.instagram.com/linux.userraj/)
[![GitHub](https://img.shields.io/badge/GitHub-Rg100152-181717?logo=github&logoColor=white)](https://github.com/Rg100152)

> "Build Unbreakable Streaks, Visualize Your Discipline."

</div>

---

## 📄 License

MIT — build on it, break a streak, then rebuild it stronger. 🔥

<p align="center">Made with emerald, obsidian and a lot of discipline by <a href="https://github.com/Rg100152">Raj Gautam</a>.</p>

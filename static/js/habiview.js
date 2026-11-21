/* ==========================================================================
   HabiView — Biometric Orbit & Habit Matrix interactions
   Vanilla JS · no dependencies · engineered by Raj Gautam
   ========================================================================== */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const boot = $("#bootstrapData");
  let state = {};

  try {
    state = JSON.parse(boot ? boot.textContent : "{}") || {};
  } catch (error) {
    console.error("HabiView: could not read bootstrap data", error);
  }

  const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
  const FILTERS = ["All", "Deep Work", "Health", "Skill"];
  let activeFilter = "All";
  let toastTimer = null;

  /* ---------- utilities ------------------------------------------------- */
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
  }

  function prettyDate(iso) {
    const date = new Date(`${iso}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? iso
      : date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }
    return payload;
  }

  /* ---------- orbit rings + summary ------------------------------------- */
  function renderOrbit(animate = true) {
    const progress = state.progress || { done: 0, total: 0, percent: 0 };
    const outer = $("#orbitOuter");
    const inner = $("#orbitInner");
    if (!outer || !inner) return;

    const outerLength = outer.getTotalLength();
    const innerLength = inner.getTotalLength();
    outer.setAttribute("stroke-dasharray", outerLength);
    inner.setAttribute("stroke-dasharray", innerLength);

    const apply = () => {
      const percent = Math.max(0, Math.min(100, progress.percent || 0));
      const streak = Math.min((state.summary?.active_streak || 0) / 30, 1);
      outer.style.strokeDashoffset = outerLength * (1 - percent / 100);
      inner.style.strokeDashoffset = innerLength * (1 - streak);
    };

    if (animate) {
      outer.style.strokeDashoffset = outerLength;
      inner.style.strokeDashoffset = innerLength;
      requestAnimationFrame(() => requestAnimationFrame(apply));
    } else {
      apply();
    }

    const percentEl = $("#ringPercent");
    const countEl = $("#ringCount");
    if (percentEl) percentEl.textContent = `${progress.percent || 0}%`;
    if (countEl) countEl.textContent = `${progress.done || 0} / ${progress.total || 0} HABITS`;

    const bar = $("#topProgressBar");
    if (bar) bar.style.width = `${progress.percent || 0}%`;
    const topText = $("#topProgressText");
    if (topText) topText.textContent = `${progress.done || 0} / ${progress.total || 0}`;

    const summary = state.summary || {};
    const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
    setText("#activeStreak", summary.active_streak || 0);
    setText("#longestStreak", summary.longest_streak || 0);
    setText("#totalCompletions", summary.total_completions || 0);
    setText("#analyticHabits", summary.habit_count || 0);
    setText("#analyticToday", `${progress.percent || 0}%`);
    const best = Math.max(0, ...(state.categories || []).map((c) => c.rate || 0));
    setText("#analyticBest", `${best}%`);

    const status = $("#disciplineStatus");
    if (status) {
      const percent = progress.percent || 0;
      const fire = percent >= 80;
      status.classList.toggle("is-fire", fire);
      status.lastChild.textContent = fire
        ? " ON FIRE"
        : percent >= 50 ? " ON TRACK" : " WARM UP";
    }
  }

  function renderDate() {
    const label = $("#todayLabel");
    if (!label || !state.today) return;
    const date = new Date(`${state.today}T00:00:00`);
    label.textContent = date.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  }

  /* ---------- habit cards ------------------------------------------------ */
  function habitCardHtml(habit) {
    const dots = habit.week.map((done, index) => {
      const klass = done === null ? "is-future" : done ? "is-done" : "";
      return `<span class="week__dot ${klass}" title="${WEEKDAYS[index]}"></span>`;
    }).join("");

    return `
      <article class="habit-card glass ${habit.completed_today ? "is-done" : ""}"
               data-id="${habit.id}" data-category="${escapeHtml(habit.category)}">
        <div class="habit-card__top">
          <span class="habit-card__icon" aria-hidden="true">${escapeHtml(habit.icon)}</span>
          <span class="habit-card__tag">${escapeHtml(habit.category)}</span>
          <button class="habit-delete" type="button" title="Remove habit" aria-label="Remove ${escapeHtml(habit.name)}">✕</button>
        </div>
        <h3>${escapeHtml(habit.name)}</h3>
        <div class="week">
          <div class="week__labels">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
          <div class="week__dots">${dots}</div>
        </div>
        <div class="habit-card__foot">
          <span class="streak-badge" title="Current streak">🔥 <b>${habit.current_streak}</b>d</span>
          <button class="check-btn" type="button" aria-pressed="${habit.completed_today}"
                  aria-label="${habit.completed_today ? "Uncheck" : "Check in"} ${escapeHtml(habit.name)}">✓</button>
        </div>
      </article>`;
  }

  function applyFilter() {
    $$(".habit-card").forEach((card) => {
      card.classList.toggle("is-hidden", activeFilter !== "All" && card.dataset.category !== activeFilter);
    });
  }

  function renderHabits() {
    const grid = $("#habitGrid");
    if (!grid) return;
    grid.innerHTML = (state.habits || []).map(habitCardHtml).join("");
    const badge = $("#habitCountBadge");
    if (badge) badge.textContent = `${(state.habits || []).length} ACTIVE`;
    applyFilter();
  }

  /* ---------- heatmap ---------------------------------------------------- */
  const tooltip = document.createElement("div");
  tooltip.className = "heat-tooltip";
  document.body.appendChild(tooltip);

  function showTooltip(cell, event) {
    const { date, count, total } = cell.dataset;
    tooltip.innerHTML = `<strong>${count}/${total}</strong> habits · ${prettyDate(date)}`;
    const rect = event.currentTarget.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.classList.add("is-visible");
  }
  function hideTooltip() { tooltip.classList.remove("is-visible"); }

  function renderHeatmap() {
    const container = $("#heatmap");
    if (!container) return;

    const cells = state.heatmap || [];
    if (!cells.length) { container.innerHTML = ""; return; }

    const labelColumn = `<div class="heat-labels">${["M", "T", "W", "T", "F", "S", "S"]
      .map((day) => `<span>${day}</span>`).join("")}</div>`;

    // Pad the first column so weekdays align with the Mon..Sun rows.
    const padded = Array(cells[0].weekday).fill(null).concat(cells);
    const weeks = [];
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

    const columns = weeks.map((week) => `
      <div class="heat-week">
        ${week.map((cell) => cell
          ? `<div class="heat-cell lv-${cell.level} ${cell.date === state.today ? "is-today" : ""}"
                  tabindex="0" data-date="${cell.date}" data-count="${cell.count}" data-total="${cell.total}"
                  aria-label="${cell.count} of ${cell.total} habits on ${cell.date}"></div>`
          : `<div class="heat-cell" style="visibility:hidden"></div>`).join("")}
      </div>`).join("");

    container.innerHTML = labelColumn + columns;
    const byDate = new Map(cells.map((cell) => [cell.date, cell]));
    $$(".heat-cell[data-date]", container).forEach((el) => {
      const cell = byDate.get(el.dataset.date);
      if (!cell) return;
      el.addEventListener("mouseenter", (event) => showTooltip(cell, event));
      el.addEventListener("focus", (event) => showTooltip(cell, event));
      el.addEventListener("mouseleave", hideTooltip);
      el.addEventListener("blur", hideTooltip);
    });

    const strongDays = cells.filter((cell) => cell.level >= 3).length;
    const totalChecks = cells.reduce((sum, cell) => sum + cell.count, 0);
    const summary = $("#heatmapSummary");
    if (summary) {
      summary.innerHTML = `<strong>${totalChecks}</strong> check-ins · <strong>${strongDays}</strong> high-intensity days in the last 90 days`;
    }
  }

  /* ---------- category bars ---------------------------------------------- */
  function renderCategories() {
    const container = $("#categoryBars");
    if (!container) return;
    container.innerHTML = (state.categories || []).map((cat) => `
      <div class="cat-row">
        <div class="cat-row__head">
          <span class="cat-row__name"><i style="color:${cat.color}">${cat.icon}</i> ${escapeHtml(cat.category)}</span>
          <span class="cat-row__value" style="color:${cat.color}">${cat.rate}%</span>
        </div>
        <div class="cat-row__track"><div class="cat-row__fill" data-width="${cat.rate}"
             style="background:linear-gradient(90deg, ${cat.color}88, ${cat.color})"></div></div>
        <div class="cat-row__meta">${cat.done} COMPLETIONS / ${cat.total} POSSIBLE · LAST 30 DAYS</div>
      </div>`).join("");

    requestAnimationFrame(() => {
      $$(".cat-row__fill", container).forEach((bar) => { bar.style.width = `${bar.dataset.width}%`; });
    });
  }

  function renderAll(animateRings = true) {
    renderDate();
    renderOrbit(animateRings);
    renderHabits();
    renderHeatmap();
    renderCategories();
  }

  /* ---------- interactions ------------------------------------------------ */
  function rippleAt(card, event) {
    const rect = card.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "habit-card__ripple";
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    card.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  }

  async function toggleHabit(button, event) {
    const card = button.closest(".habit-card");
    if (!card || button.disabled) return;
    const id = Number(card.dataset.id);
    button.disabled = true;
    rippleAt(card, event);

    try {
      const response = await api(`/api/toggle/${id}`, { method: "POST", body: "{}" });
      const index = (state.habits || []).findIndex((habit) => habit.id === id);
      if (index > -1) state.habits[index] = response.habit;
      state.progress = response.progress;
      state.summary = response.summary;
      state.categories = response.categories;
      if (response.heat_cell && state.heatmap.length) {
        state.heatmap[state.heatmap.length - 1] = response.heat_cell;
      }

      renderAll(false);
      const updated = $(`.habit-card[data-id="${id}"]`);
      if (updated) {
        updated.classList.add("is-celebrating");
        setTimeout(() => updated.classList.remove("is-celebrating"), 550);
      }
      toast(response.habit.completed_today ? "Check-in locked in. Streak burning! 🔥" : "Check-in removed — no judgment.");
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  }

  async function deleteHabit(card) {
    const id = Number(card.dataset.id);
    const name = $("h3", card)?.textContent || "this habit";
    if (!window.confirm(`Remove "${name}" and all of its history?`)) return;

    try {
      const response = await api(`/api/habits/${id}`, { method: "DELETE" });
      state.habits = (state.habits || []).filter((habit) => habit.id !== id);
      state.progress = response.progress;
      state.summary = response.summary;
      state.categories = response.categories;
      state.heatmap = response.heatmap;
      renderAll(false);
      toast("Habit removed from the matrix.");
    } catch (error) {
      toast(error.message);
    }
  }

  const grid = $("#habitGrid");
  if (grid) {
    grid.addEventListener("click", (event) => {
      const check = event.target.closest(".check-btn");
      if (check) { toggleHabit(check, event); return; }
      const remove = event.target.closest(".habit-delete");
      if (remove) deleteHabit(remove.closest(".habit-card"));
    });
  }

  /* ---------- focus filters ---------------------------------------------- */
  const filterRoot = $("#focusFilters");
  if (filterRoot) {
    filterRoot.addEventListener("click", (event) => {
      const button = event.target.closest(".filter");
      if (!button || !FILTERS.includes(button.dataset.filter)) return;
      activeFilter = button.dataset.filter;
      $$(".filter", filterRoot).forEach((el) => el.classList.toggle("is-active", el === button));
      applyFilter();
    });
  }

  /* ---------- add-habit modal -------------------------------------------- */
  const modal = $("#habitModal");
  const openModal = () => { if (modal) { modal.hidden = false; $("#habitName")?.focus(); } };
  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    const error = $("#formError");
    if (error) error.textContent = "";
    $("#habitForm")?.reset();
  };

  $("#openHabitModal")?.addEventListener("click", openModal);
  $("#closeHabitModal")?.addEventListener("click", closeModal);
  $("#cancelHabitModal")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal && !modal.hidden) closeModal(); });

  $("#habitForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#habitName").value.trim();
    const category = $("#habitCategory").value;
    const icon = $("#habitIcon").value.trim();
    const error = $("#formError");
    error.textContent = "";

    try {
      const response = await api("/api/habits", {
        method: "POST",
        body: JSON.stringify({ name, category, icon }),
      });
      state.habits.push(response.habit);
      state.progress = response.progress;
      state.categories = response.categories;
      const fresh = await api("/api/dashboard");
      state.summary = fresh.summary;
      state.heatmap = fresh.heatmap;
      renderAll(false);
      closeModal();
      toast("New habit planted in the matrix. 🌱");
    } catch (err) {
      error.textContent = err.message;
    }
  });

  /* ---------- boot -------------------------------------------------------- */
  renderAll();
})();

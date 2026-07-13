/* Marathon Countdown — client logic (vanilla, no jQuery). */
(function () {
  'use strict';

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ── Theme ──────────────────────────────────────────────────────────────
     Early inline script in <head> sets the initial theme to avoid FOUC; this
     just wires the toggle and persists the choice. */
  function initTheme() {
    var btn = $('#theme-toggle');
    if (!btn) return;
    function current() { return document.documentElement.getAttribute('data-theme'); }
    function apply(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('theme', theme); } catch (e) {}
      var icon = $('.material-symbols-outlined', btn);
      if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
    apply(current() || 'light');
    btn.addEventListener('click', function () {
      apply(current() === 'dark' ? 'light' : 'dark');
    });
  }

  /* ── Program selector ─────────────────────────────────────────────────── */
  function initPlanSelect() {
    $$('.trainingplan-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var params = new URLSearchParams(window.location.search);
        params.set('trainingplan', this.value);
        window.location.href = window.location.pathname + '?' + params.toString();
      });
    });
  }

  /* ── Week navigation (index view) ─────────────────────────────────────── */
  function initWeeks() {
    var weeks = $$('.week');
    if (!weeks.length) return;

    var total = weeks.length;
    var current = parseInt(document.body.getAttribute('data-current-week') || '1', 10);
    if (isNaN(current) || current < 1) current = 1;
    if (current > total) current = total;

    var prevBtn = $('#week-prev');
    var nextBtn = $('#week-next');
    var chips   = $$('.week-chip');
    var nowWk   = $('#now-week');
    var nowDates = $('#now-dates');

    function show(n) {
      current = Math.min(Math.max(n, 1), total);
      weeks.forEach(function (w) {
        w.classList.toggle('active', parseInt(w.getAttribute('data-week'), 10) === current);
      });
      chips.forEach(function (c) {
        c.setAttribute('aria-current', parseInt(c.getAttribute('data-week'), 10) === current ? 'true' : 'false');
      });
      var active = weeks[current - 1];
      if (nowWk) nowWk.textContent = 'Week ' + current;
      if (nowDates && active) nowDates.textContent = active.getAttribute('data-dates') || '';
      if (prevBtn) prevBtn.disabled = current === 1;
      if (nextBtn) nextBtn.disabled = current === total;

      var activeChip = chips[current - 1];
      if (activeChip && activeChip.scrollIntoView) activeChip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

      // Restore a sensible selected workout for the newly shown week.
      selectDefaultDay(active);
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { show(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { show(current + 1); });
    chips.forEach(function (c) {
      c.addEventListener('click', function () { show(parseInt(c.getAttribute('data-week'), 10)); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
    });

    show(current);
  }

  /* ── Workout detail panel ─────────────────────────────────────────────── */
  var infoMap = {};
  function buildInfoMap() {
    $$('#workout-info-source > [data-type]').forEach(function (n) {
      infoMap[n.getAttribute('data-type')] = n.innerHTML;
    });
  }

  function showWorkout(type, cat) {
    var panel = $('#workout-detail');
    if (!panel) return;
    var body = $('.detail-body', panel);
    ['a-run', 'a-repeats', 'a-tempo', 'a-long', 'a-race', 'a-rest'].forEach(function (c) { panel.classList.remove(c); });
    if (cat) panel.classList.add('a-' + cat);
    if (body) body.innerHTML = infoMap[type] || '<p>Select a day to see what the workout involves.</p>';
  }

  function selectDay(dayEl) {
    if (!dayEl) return;
    var week = dayEl.closest('.week');
    (week ? $$('.day', week) : $$('.day.selected')).forEach(function (d) { d.classList.remove('selected'); });
    dayEl.classList.add('selected');
    showWorkout(dayEl.getAttribute('data-type'), dayEl.getAttribute('data-cat'));

    // On stacked (mobile) layouts, bring the explanation into view.
    if (window.matchMedia('(max-width: 900px)').matches) {
      var panel = $('#workout-detail');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function selectDefaultDay(week) {
    if (!week) return;
    // Prefer today's workout, else the first non-rest day, else the first day.
    var target = $('.day.is-today', week) || $('.day:not(.is-rest)', week) || $('.day', week);
    selectDay(target);
  }

  function initDays() {
    buildInfoMap();
    $$('.day').forEach(function (d) {
      d.addEventListener('click', function () { selectDay(d); });
    });
  }

  /* ── Live counter (final <2 days) ─────────────────────────────────────── */
  function initCounter() {
    if (typeof window.countdownTimeout === 'undefined' || window.countdownTimeout == null) return;
    var counter = $('#counter');
    if (!counter) return;

    var h = $('#hours', counter), m = $('#minutes', counter), s = $('#seconds', counter);
    var hp = $('#hours-plural'), mp = $('#minutes-plural'), sp = $('#seconds-plural');
    if (!m || !s) return;

    var hours = h ? parseInt(h.textContent, 10) : 0;
    var mins  = parseInt(m.textContent, 10);
    var secs  = parseInt(s.textContent, 10);

    function plural(el, v) { if (el) el.textContent = v === 1 ? '' : 's'; }

    var id = setInterval(function () {
      if (secs > 0) { secs--; }
      else { secs = 59; if (mins > 0) { mins--; } else { mins = 59; hours--; } }

      if (hours <= 0 && mins <= 0 && secs <= 0) {
        counter.textContent = "It's here! 🎉";
        clearInterval(id);
        return;
      }
      if (h) h.textContent = hours;
      m.textContent = mins;
      s.textContent = secs;
      plural(hp, hours); plural(mp, mins); plural(sp, secs);
    }, window.countdownTimeout);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initPlanSelect();
    initDays();
    initWeeks();      // shows current week + selects its default day
    initCounter();
  });
})();

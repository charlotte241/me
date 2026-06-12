/* ─── DATA LAYER ─────────────────────────────────────────── */

const Storage = (() => {
  const PFX_DAILY = 'bi_daily_';
  const PFX_SCALE = 'bi_scale_';
  const KEY_SETTINGS = 'bi_settings';

  function fmt(date) {
    if (typeof date === 'string') return date;
    return date.toISOString().split('T')[0];
  }

  function today() { return fmt(new Date()); }

  /* ── Settings ─────────────────────────────────────────── */
  function getSettings() {
    const raw = localStorage.getItem(KEY_SETTINGS);
    return raw ? JSON.parse(raw) : {
      name: 'Charlotte',
      calorieTarget: 1600,
      proteinTarget: 120,
      waterTarget: 2.5,
      stepsTarget: 8000,
      cycleLengthDays: 28,
      setupDone: false
    };
  }
  function saveSettings(data) {
    const merged = { ...getSettings(), ...data };
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(merged));
    return merged;
  }

  /* ── Daily entries ────────────────────────────────────── */
  function getDaily(date) {
    const raw = localStorage.getItem(PFX_DAILY + fmt(date));
    return raw ? JSON.parse(raw) : null;
  }

  function saveDaily(date, data) {
    const key = PFX_DAILY + fmt(date);
    const existing = getDaily(date) || {};
    const merged = { ...existing, ...data, date: fmt(date) };
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  }

  function getAllDailyDates() {
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PFX_DAILY)) dates.push(k.slice(PFX_DAILY.length));
    }
    return dates.sort().reverse();
  }

  function getRecentDays(n = 14) {
    const result = [];
    for (let i = 0; i < n; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const entry = getDaily(d);
      if (entry) result.push(entry);
    }
    return result;
  }

  function getWeekDays(weekStartDate) {
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      if (d > new Date()) break;
      const entry = getDaily(d);
      result.push(entry || { date: fmt(d), _empty: true });
    }
    return result;
  }

  /* ── Smart scale entries ──────────────────────────────── */
  function getScale(date) {
    const raw = localStorage.getItem(PFX_SCALE + fmt(date));
    return raw ? JSON.parse(raw) : null;
  }

  function saveScale(date, data) {
    const key = PFX_SCALE + fmt(date);
    const existing = getScale(date) || {};
    const merged = { ...existing, ...data, date: fmt(date) };
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  }

  function getRecentScaleEntries(n = 10) {
    const result = [];
    for (let i = 0; i < 120; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const entry = getScale(d);
      if (entry) {
        result.push(entry);
        if (result.length >= n) break;
      }
    }
    return result;
  }

  function getAllScaleDates() {
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PFX_SCALE)) dates.push(k.slice(PFX_SCALE.length));
    }
    return dates.sort().reverse();
  }

  /* ── Helpers ──────────────────────────────────────────── */
  function avg(arr) {
    const vals = arr.filter(v => v != null && !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function getWeekStart(offsetWeeks = 0) {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff + offsetWeeks * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDisplayDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatDay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  }

  function isToday(dateStr) { return dateStr === today(); }
  function daysBetween(a, b) {
    const da = new Date(a); const db = new Date(b);
    return Math.round((db - da) / 86400000);
  }

  /* ── Glow score calculation ───────────────────────────── */
  function calcGlowScore(entry, settings) {
    if (!entry) return 0;
    const s = settings || getSettings();
    let score = 0; let possible = 0;

    if (entry.calories) {
      possible += 20;
      const ratio = entry.calories / s.calorieTarget;
      if (ratio >= 0.8 && ratio <= 1.15) score += 20;
      else if (ratio >= 0.7 && ratio <= 1.3) score += 12;
      else score += 4;
    }
    if (entry.protein) {
      possible += 25;
      const ratio = entry.protein / s.proteinTarget;
      if (ratio >= 0.9) score += 25;
      else if (ratio >= 0.7) score += 15;
      else score += 6;
    }
    if (entry.water != null) {
      possible += 15;
      if (entry.water >= s.waterTarget) score += 15;
      else if (entry.water >= s.waterTarget * 0.8) score += 10;
      else score += 3;
    }
    if (entry.steps != null) {
      possible += 10;
      if (entry.steps >= s.stepsTarget) score += 10;
      else if (entry.steps >= s.stepsTarget * 0.7) score += 6;
      else score += 2;
    }
    if (entry.sleep != null) {
      possible += 15;
      if (entry.sleep >= 7 && entry.sleep <= 9) score += 15;
      else if (entry.sleep >= 6) score += 9;
      else score += 3;
    }
    if (entry.mood != null) {
      possible += 10;
      score += Math.round(entry.mood / 10 * 10);
    }
    if (entry.water != null && entry.protein != null && entry.sleep != null) {
      possible += 5;
      score += 5;
    }
    if (!possible) return 0;
    return Math.min(100, Math.round(score / possible * 100));
  }

  return {
    fmt, today, getSettings, saveSettings,
    getDaily, saveDaily, getAllDailyDates, getRecentDays, getWeekDays,
    getScale, saveScale, getRecentScaleEntries, getAllScaleDates,
    avg, getWeekStart, formatDisplayDate, formatDay, isToday, daysBetween,
    calcGlowScore
  };
})();

/* ─── APP CONTROLLER ─────────────────────────────────────── */

const App = (() => {
  let currentView = 'today';
  let logDate = Storage.today();
  let scaleDate = Storage.today();
  let weekOffset = 0;
  let mealList = [];
  let scaleHistory = [];

  /* ─── TOAST ───────────────────────────────────────────── */
  function showToast(msg, duration = 2400) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  /* ─── NAVIGATION ─────────────────────────────────────── */
  function navigate(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    renderView();
  }

  /* ─── HEADER META ─────────────────────────────────────── */
  function updateHeader() {
    const todayEntry = Storage.getDaily(Storage.today());
    const meta = document.getElementById('header-meta');
    if (!meta) return;
    const parts = [];
    if (todayEntry && todayEntry.cyclePhase && todayEntry.cyclePhase !== 'none') {
      const labels = { menstrual:'Menstrual', follicular:'Follicular', ovulatory:'Ovulatory', luteal:'Luteal' };
      const classes = { menstrual:'badge-menstrual', follicular:'badge-follicular', ovulatory:'badge-ovulatory', luteal:'badge-luteal' };
      const phase = todayEntry.cyclePhase;
      parts.push(`<span class="cycle-badge ${classes[phase] || ''}">${labels[phase] || phase}</span>`);
    }
    const score = Storage.calcGlowScore(todayEntry, Storage.getSettings());
    if (score > 0) parts.push(`<span style="color:var(--gold);font-family:var(--font-serif);font-size:14px">${score}</span><span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin-left:3px;color:var(--text-3)">glow</span>`);
    meta.innerHTML = parts.join(' ');
  }

  /* ─── RENDER DISPATCH ─────────────────────────────────── */
  function renderView() {
    const el = document.getElementById('main-content');
    el.innerHTML = '';
    el.className = 'view-enter';
    switch (currentView) {
      case 'today':    renderToday(el); break;
      case 'log':      renderLog(el); break;
      case 'scale':    renderScale(el); break;
      case 'insights': renderInsights(el); break;
      case 'week':     renderWeek(el); break;
    }
    updateHeader();
    bindViewEvents();
  }

  /* ─── TODAY VIEW ──────────────────────────────────────── */
  function renderToday(el) {
    const entry = Storage.getDaily(Storage.today()) || {};
    const settings = Storage.getSettings();
    const recentDays = Storage.getRecentDays(14);
    const guidance = Engine.getAdaptiveGuidance(recentDays, entry, settings);
    const score = Storage.calcGlowScore(entry, settings);
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    const hasData = entry.calories || entry.protein || entry.water != null;

    /* ── Hero ─────────────────────────────────────────── */
    let html = `
    <div class="today-hero">
      <div class="today-hero-text">
        <div class="today-date-large">${dateLabel}</div>
        <div class="today-status">${hasData ? 'Today\'s data logged' : 'No data logged yet today'}</div>
      </div>
      <div class="glow-score-ring" id="glow-ring" style="border-color:${score > 70 ? 'var(--gold)' : score > 40 ? 'var(--amber)' : 'var(--border)'}">
        <div class="glow-score-val">${score || '—'}</div>
        <div class="glow-score-label">Glow</div>
      </div>
    </div>`;

    /* ── Quick metrics ────────────────────────────────── */
    const cal = entry.calories || 0;
    const prot = entry.protein || 0;
    const water = entry.water != null ? entry.water : null;
    const steps = entry.steps != null ? entry.steps : null;

    const calPct = Math.min(100, cal ? Math.round(cal / settings.calorieTarget * 100) : 0);
    const protPct = Math.min(100, prot ? Math.round(prot / settings.proteinTarget * 100) : 0);
    const waterPct = Math.min(100, water != null ? Math.round(water / settings.waterTarget * 100) : 0);
    const stepsPct = Math.min(100, steps != null ? Math.round(steps / settings.stepsTarget * 100) : 0);

    function metStatus(pct) {
      if (pct >= 90) return 'on-target';
      if (pct >= 60) return 'low';
      return pct === 0 ? '' : 'critical';
    }

    html += `<div class="metrics-grid">
      <div class="metric-card ${metStatus(calPct)}">
        <div class="metric-label">Calories</div>
        <div class="metric-value">${cal || '—'}</div>
        <div class="metric-bar"><div class="metric-bar-fill" style="width:${calPct}%"></div></div>
      </div>
      <div class="metric-card ${metStatus(protPct)}">
        <div class="metric-label">Protein</div>
        <div class="metric-value">${prot || '—'}<span class="metric-unit">g</span></div>
        <div class="metric-bar"><div class="metric-bar-fill" style="width:${protPct}%"></div></div>
      </div>
      <div class="metric-card ${metStatus(waterPct)}">
        <div class="metric-label">Water</div>
        <div class="metric-value">${water != null ? water : '—'}<span class="metric-unit">L</span></div>
        <div class="metric-bar"><div class="metric-bar-fill" style="width:${waterPct}%"></div></div>
      </div>
      <div class="metric-card ${metStatus(stepsPct)}">
        <div class="metric-label">Steps</div>
        <div class="metric-value">${steps != null ? (steps >= 1000 ? Math.round(steps/100)/10+'k' : steps) : '—'}</div>
        <div class="metric-bar"><div class="metric-bar-fill" style="width:${stepsPct}%"></div></div>
      </div>
    </div>`;

    /* ── Status chips ─────────────────────────────────── */
    const chips = [];
    if (entry.mood) chips.push(`<span class="chip ${entry.mood >= 7 ? 'good' : entry.mood >= 5 ? 'neutral' : 'warn'}">Mood ${entry.mood}/10</span>`);
    if (entry.energy) chips.push(`<span class="chip ${entry.energy >= 7 ? 'good' : entry.energy >= 5 ? 'neutral' : 'warn'}">Energy ${entry.energy}/10</span>`);
    if (entry.sleep) chips.push(`<span class="chip ${entry.sleep >= 7 ? 'good' : entry.sleep >= 6 ? 'neutral' : 'warn'}">${entry.sleep}h sleep</span>`);
    if (entry.gutSeverity && entry.gutSeverity !== 'none') chips.push(`<span class="chip warn">Gut: ${entry.gutSeverity}</span>`);
    if (entry.workoutType && entry.workoutType !== 'rest') chips.push(`<span class="chip good">${entry.workoutType}</span>`);
    if (entry.cyclePMS) chips.push(`<span class="chip mauve">PMS</span>`);
    if (entry.cyclePeriod) chips.push(`<span class="chip mauve">Period</span>`);

    if (chips.length) html += `<div class="chips">${chips.join('')}</div>`;

    /* ── Empty state prompt ───────────────────────────── */
    if (!hasData) {
      html += `<div class="empty-log-prompt" style="margin-top:20px">
        <div class="empty-log-title">Nothing logged yet today</div>
        <div class="empty-log-body">Log your meals, water, movement and wellbeing to get personalised guidance and build your body intelligence.</div>
        <button class="btn btn-primary" onclick="App.nav('log')">Log today</button>
      </div>`;
    }

    /* ── Adaptive guidance ────────────────────────────── */
    const allGuidance = [...guidance.priorities, ...guidance.adjustments];
    if (allGuidance.length || guidance.warnings.length) {
      html += `<div class="section-label" style="margin-top:24px">Your body intelligence today</div>`;

      if (guidance.priorities.length) {
        html += `<div class="guidance-card">
          <div class="guidance-title">Priority today</div>
          <div class="guidance-actions">${guidance.priorities.map(g => `<div class="guidance-action">${g}</div>`).join('')}</div>
        </div>`;
      }
      if (guidance.warnings.length) {
        html += `<div class="card" style="border-color:var(--amber-bg)">
          <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);margin-bottom:10px">Worth noting</div>
          ${guidance.warnings.map(w => `<div style="font-size:13px;color:var(--ivory-muted);margin-bottom:6px;padding-left:12px;border-left:2px solid var(--amber)">${w}</div>`).join('')}
        </div>`;
      }
      if (guidance.adjustments.length) {
        html += `<div class="card">
          <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px">Adjustments</div>
          <div class="guidance-actions">${guidance.adjustments.map(a => `<div class="guidance-action">${a}</div>`).join('')}</div>
        </div>`;
      }
    } else if (hasData) {
      html += `<div class="section-label" style="margin-top:24px">Body intelligence</div>
      <div class="card">
        <div style="font-size:13px;color:var(--ivory-muted);line-height:1.7">No specific adjustments flagged today. Keep tracking — patterns become clearer over time.</div>
      </div>`;
    }

    /* ── Recent days overview ─────────────────────────── */
    const recent = recentDays.slice(0, 5).filter(d => d.date !== Storage.today());
    if (recent.length) {
      html += `<div class="section-label">Recent days</div>`;
      recent.forEach(d => {
        const s = Storage.calcGlowScore(d, settings);
        const parts = [];
        if (d.calories) parts.push(`${d.calories} kcal`);
        if (d.protein) parts.push(`${d.protein}g prot`);
        if (d.water) parts.push(`${d.water}L`);
        html += `<div class="day-row">
          <div class="day-row-date">${Storage.formatDay(d.date)}</div>
          <div class="day-row-score" style="color:${s > 70 ? 'var(--gold)' : s > 40 ? 'var(--ivory-muted)' : 'var(--text-3)'}">${s || '—'}</div>
          <div class="day-row-detail">${parts.join(' · ') || 'Partial log'}</div>
        </div>`;
      });
    }

    /* ── Quick log button ─────────────────────────────── */
    html += `<div style="margin-top:24px"><button class="btn btn-ghost btn-full" onclick="App.nav('log')">→ Log today's data</button></div>`;

    el.innerHTML = html;
  }

  /* ─── LOG VIEW ────────────────────────────────────────── */
  function renderLog(el) {
    const entry = Storage.getDaily(logDate) || {};
    mealList = entry.meals ? [...entry.meals] : [];

    const meals = mealList;
    const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
    const totalProt = meals.reduce((s, m) => s + (m.protein || 0), 0);

    let html = `
    <div class="view-title">Daily Log</div>
    <div class="view-subtitle">${Storage.formatDisplayDate(logDate)}</div>

    <div class="date-picker-row">
      <button class="date-nav-btn" id="log-prev">‹</button>
      <input type="date" id="log-date-input" value="${logDate}" max="${Storage.today()}">
      <button class="date-nav-btn" id="log-next" ${logDate === Storage.today() ? 'disabled style="opacity:.4"' : ''}>›</button>
    </div>

    <div class="section-label">Nutrition</div>

    <div class="meal-list" id="meal-list">
      ${meals.length ? meals.map((m, i) => `
        <div class="meal-item">
          <div class="meal-name">${m.name} <span style="color:var(--text-4);font-size:11px;margin-left:4px">${m.mealType || ''}</span></div>
          <div class="meal-cals">${m.calories ? m.calories + ' kcal' : ''}</div>
          <div class="meal-prot">${m.protein ? m.protein + 'g prot' : ''}</div>
          <button class="meal-remove" data-meal-idx="${i}">×</button>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-4);padding:8px 0">No meals logged yet</div>'}
    </div>

    <div class="meal-add-form" id="meal-add-form">
      <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px">Add a meal or snack</div>
      <div class="meal-add-row">
        <div>
          <label>Food / meal name</label>
          <input type="text" id="meal-name" placeholder="e.g. Chicken breast, rice and salad">
        </div>
        <div>
          <label>Calories</label>
          <input type="number" id="meal-cals" placeholder="kcal" min="0">
        </div>
        <div>
          <label>Protein (g)</label>
          <input type="number" id="meal-prot" placeholder="g" min="0">
        </div>
        <div>
          <label style="opacity:0">Add</label>
          <button class="btn btn-ghost" id="meal-add-btn" style="width:100%">Add</button>
        </div>
      </div>
      <div style="margin-top:10px">
        <label style="display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:6px">Meal type</label>
        <div class="check-grid" id="meal-type-grid">
          ${['Breakfast','Lunch','Dinner','Snack'].map(t => `<div class="check-item" data-meal-type="${t.toLowerCase()}">${t}</div>`).join('')}
        </div>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div class="card-sm" style="flex:1;text-align:center">
        <div style="font-family:var(--font-serif);font-size:24px;color:var(--ivory)">${totalCal || '—'}</div>
        <div style="font-size:10px;color:var(--text-3);letter-spacing:.1em;text-transform:uppercase">Total kcal</div>
      </div>
      <div class="card-sm" style="flex:1;text-align:center">
        <div style="font-family:var(--font-serif);font-size:24px;color:var(--ivory)">${totalProt || '—'}<span style="font-size:14px">g</span></div>
        <div style="font-size:10px;color:var(--text-3);letter-spacing:.1em;text-transform:uppercase">Total protein</div>
      </div>
    </div>

    <div class="form-section">
      <div class="section-label">Food flags</div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:10px">Flag anything that might affect gut, scale or skin tomorrow</div>
      <div class="check-grid" id="food-flags">
        ${[
          {val:'dairy',label:'Dairy'},
          {val:'bread',label:'Bread'},
          {val:'rawFood',label:'Raw salad'},
          {val:'alcohol',label:'Alcohol'},
          {val:'highSodium',label:'High sodium'},
          {val:'takeaway',label:'Takeaway'},
          {val:'sugar',label:'High sugar'}
        ].map(f => `<div class="check-item ${(entry.foodFlags||[]).includes(f.val) ? 'selected' : ''}" data-flag="${f.val}">${f.label}</div>`).join('')}
      </div>
    </div>

    <div class="section-label">Hydration</div>
    <div class="form-row">
      <label>Water (litres)</label>
      <input type="number" id="water" value="${entry.water != null ? entry.water : ''}" placeholder="e.g. 2.5" min="0" max="6" step="0.25">
      <div class="quick-btn-row" style="margin-top:8px">
        ${[0.5, 1, 1.5, 2, 2.5, 3].map(v => `<button class="quick-btn water-quick" data-val="${v}">${v}L</button>`).join('')}
      </div>
    </div>
    <div class="form-row-inline">
      <div class="form-row">
        <label>Electrolytes</label>
        <select id="electrolytes">
          <option value="">—</option>
          <option value="yes" ${entry.electrolytes === 'yes' ? 'selected' : ''}>Yes</option>
          <option value="no" ${entry.electrolytes === 'no' ? 'selected' : ''}>No</option>
        </select>
      </div>
      <div class="form-row">
        <label>Coffee (cups)</label>
        <input type="number" id="coffee" value="${entry.coffee || ''}" min="0" max="10" placeholder="0">
      </div>
    </div>

    <div class="section-label">Movement</div>
    <div class="form-row-inline">
      <div class="form-row">
        <label>Steps</label>
        <input type="number" id="steps" value="${entry.steps || ''}" placeholder="e.g. 8000" min="0">
      </div>
      <div class="form-row">
        <label>Duration (min)</label>
        <input type="number" id="workout-duration" value="${entry.workoutDuration || ''}" placeholder="e.g. 45" min="0">
      </div>
    </div>
    <div class="form-row">
      <label>Workout type</label>
      <div class="check-grid" id="workout-type">
        ${['Strength','Cardio','Netball','Yoga','Pilates','Walk','Rest'].map(t =>
          `<div class="check-item ${entry.workoutType === t.toLowerCase() ? 'selected' : ''}" data-workout="${t.toLowerCase()}">${t}</div>`
        ).join('')}
      </div>
    </div>
    <div class="form-row">
      <label>Intensity</label>
      <div class="check-grid" id="workout-intensity">
        ${['Light','Moderate','Hard'].map(t =>
          `<div class="check-item ${entry.workoutIntensity === t.toLowerCase() ? 'selected' : ''}" data-intensity="${t.toLowerCase()}">${t}</div>`
        ).join('')}
      </div>
    </div>

    <div class="section-label">Wellbeing</div>
    <div class="slider-row">
      <label>Mood <span class="slider-val" id="mood-val">${entry.mood || 5}</span></label>
      <input type="range" id="mood" min="1" max="10" value="${entry.mood || 5}">
    </div>
    <div class="slider-row">
      <label>Energy <span class="slider-val" id="energy-val">${entry.energy || 5}</span></label>
      <input type="range" id="energy" min="1" max="10" value="${entry.energy || 5}">
    </div>
    <div class="slider-row">
      <label>Stress <span class="slider-val" id="stress-val">${entry.stress || 5}</span></label>
      <input type="range" id="stress" min="1" max="10" value="${entry.stress || 5}">
    </div>

    <div class="section-label">Gut &amp; Skin</div>
    <div class="form-row">
      <label>Gut symptoms</label>
      <div class="check-grid" id="gut-symptoms">
        ${['None','Bloating','Cramping','Loose','Constipation','Nausea'].map(s =>
          `<div class="check-item ${(entry.gutSymptoms||[]).includes(s.toLowerCase()) || (s === 'None' && (!entry.gutSymptoms || !entry.gutSymptoms.length)) ? 'selected' : ''}" data-gut="${s.toLowerCase()}">${s}</div>`
        ).join('')}
      </div>
    </div>
    <div class="form-row">
      <label>Gut severity</label>
      <div class="check-grid" id="gut-severity">
        ${['None','Mild','Moderate','Severe'].map(s =>
          `<div class="check-item ${entry.gutSeverity === s.toLowerCase() || (!entry.gutSeverity && s === 'None') ? 'selected' : ''}" data-sev="${s.toLowerCase()}">${s}</div>`
        ).join('')}
      </div>
    </div>
    <div class="form-row">
      <label>Skin</label>
      <div class="check-grid" id="skin-symptoms">
        ${['Clear','Breakout','Dryness','Inflammation','Redness'].map(s =>
          `<div class="check-item ${(entry.skinSymptoms||['clear']).includes(s.toLowerCase()) ? 'selected' : ''}" data-skin="${s.toLowerCase()}">${s}</div>`
        ).join('')}
      </div>
    </div>

    <div class="section-label">Sleep</div>
    <div class="form-row-inline">
      <div class="form-row">
        <label>Hours slept</label>
        <input type="number" id="sleep" value="${entry.sleep || ''}" placeholder="e.g. 7.5" min="0" max="14" step="0.5">
      </div>
      <div class="form-row">
        <label>Sleep quality (1–5)</label>
        <input type="number" id="sleep-quality" value="${entry.sleepQuality || ''}" placeholder="1–5" min="1" max="5">
      </div>
    </div>

    <div class="section-label">Cycle context</div>
    <div class="form-row">
      <label>Phase</label>
      <div class="check-grid" id="cycle-phase">
        ${['None','Menstrual','Follicular','Ovulatory','Luteal'].map(p =>
          `<div class="check-item ${entry.cyclePhase === p.toLowerCase() || (!entry.cyclePhase && p === 'None') ? 'selected' : ''}" data-phase="${p.toLowerCase()}">${p}</div>`
        ).join('')}
      </div>
    </div>
    <div class="form-row-inline">
      <div class="form-row">
        <label>Cycle day</label>
        <input type="number" id="cycle-day" value="${entry.cycleDay || ''}" placeholder="e.g. 14" min="1" max="40">
      </div>
      <div class="form-row">
        <label>Weight (kg)</label>
        <input type="number" id="daily-weight" value="${entry.weight || ''}" placeholder="e.g. 68.5" step="0.1">
      </div>
    </div>
    <div class="form-row">
      <label>Flags</label>
      <div class="check-grid" id="cycle-flags">
        <div class="check-item ${entry.cyclePMS ? 'selected' : ''}" data-cflag="pms">PMS</div>
        <div class="check-item ${entry.cyclePeriod ? 'selected' : ''}" data-cflag="period">Period</div>
      </div>
    </div>

    <div class="section-label">Supplements</div>
    <div class="check-grid" id="supplements">
      ${['Magnesium','Vitamin D','Iron','Omega-3','B12','Collagen','Probiotic','Creatine'].map(s =>
        `<div class="check-item ${(entry.supplements||[]).includes(s.toLowerCase().replace(/[^a-z0-9]/g,'')) ? 'selected' : ''}" data-supp="${s.toLowerCase().replace(/[^a-z0-9]/g,'')}">${s}</div>`
      ).join('')}
    </div>

    <div class="section-label">Notes</div>
    <div class="form-row">
      <label>End of day notes / summary</label>
      <textarea id="day-notes" placeholder="How was today overall? Anything to note?">${entry.notes || ''}</textarea>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" id="save-log-btn">Save log</button>
      <button class="btn btn-ghost" onclick="App.nav('today')">View today</button>
    </div>`;

    el.innerHTML = html;
  }

  /* ─── SCALE VIEW ──────────────────────────────────────── */
  function renderScale(el) {
    const entry = Storage.getScale(scaleDate) || {};
    const allScaleEntries = Storage.getRecentScaleEntries(20);
    const prevEntry = allScaleEntries.find(s => s.date < scaleDate) || null;
    const contextDay = Storage.getDaily(scaleDate) || Storage.getDaily(getPrevDate(scaleDate));

    let interpretation = null;
    if (entry.weight) {
      interpretation = Engine.interpretSmartScale(entry, prevEntry, contextDay, Storage.getSettings());
    }

    let html = `
    <div class="view-title">Smart Scale</div>
    <div class="view-subtitle">Body composition log &amp; interpretation</div>

    <div class="date-picker-row">
      <button class="date-nav-btn" id="scale-prev">‹</button>
      <input type="date" id="scale-date-input" value="${scaleDate}" max="${Storage.today()}">
      <button class="date-nav-btn" id="scale-next" ${scaleDate === Storage.today() ? 'disabled style="opacity:.4"' : ''}>›</button>
    </div>

    <div class="section-label">Scale entry</div>
    <div class="card">
      <div class="form-row-inline">
        <div class="form-row">
          <label>Weight (kg)</label>
          <input type="number" id="sc-weight" value="${entry.weight || ''}" placeholder="e.g. 68.5" step="0.1">
        </div>
        <div class="form-row">
          <label>Body fat %</label>
          <input type="number" id="sc-fat" value="${entry.bodyFatPercent || ''}" placeholder="e.g. 28.5" step="0.1">
        </div>
      </div>
      <div class="form-row-inline">
        <div class="form-row">
          <label>Fat mass (kg)</label>
          <input type="number" id="sc-fatmass" value="${entry.fatMass || ''}" placeholder="e.g. 18.2" step="0.1">
        </div>
        <div class="form-row">
          <label>Muscle mass (kg)</label>
          <input type="number" id="sc-muscle" value="${entry.muscleMass || ''}" placeholder="e.g. 44.0" step="0.1">
        </div>
      </div>
      <div class="form-row-inline">
        <div class="form-row">
          <label>Total body water %</label>
          <input type="number" id="sc-tbw" value="${entry.totalBodyWaterPercent || ''}" placeholder="e.g. 53.0" step="0.1">
        </div>
        <div class="form-row">
          <label>BMI</label>
          <input type="number" id="sc-bmi" value="${entry.bmi || ''}" placeholder="e.g. 23.4" step="0.1">
        </div>
      </div>
      <div class="form-row-inline">
        <div class="form-row">
          <label>BMR (kcal)</label>
          <input type="number" id="sc-bmr" value="${entry.bmr || ''}" placeholder="e.g. 1480">
        </div>
        <div class="form-row">
          <label>Visceral fat (level)</label>
          <input type="number" id="sc-visceral" value="${entry.visceralFat || ''}" placeholder="e.g. 4" min="1" max="30">
        </div>
      </div>
      <div class="form-row-inline">
        <div class="form-row">
          <label>Metabolic age</label>
          <input type="number" id="sc-metage" value="${entry.metabolicAge || ''}" placeholder="e.g. 28">
        </div>
        <div class="form-row">
          <label>Degree of obesity (%)</label>
          <input type="number" id="sc-obesity" value="${entry.degreeOfObesity || ''}" placeholder="e.g. 112.5" step="0.1">
        </div>
      </div>
      <div class="form-row" style="margin-top:4px">
        <label>Notes</label>
        <textarea id="sc-notes" placeholder="e.g. Measured morning, fasted, after gym">${entry.notes || ''}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="save-scale-btn">Save &amp; interpret</button>
      </div>
    </div>`;

    /* ── Interpretation ─────────────────────────────────── */
    if (interpretation) {
      html += `<div class="section-label">Interpretation</div>`;

      html += `<div class="summary-block">${interpretation.summary}</div>`;

      html += `<div class="card">`;

      if (interpretation.improved.length) {
        html += `<div class="interp-section">
          <div class="interp-title">What improved</div>
          <div class="interp-list">
            ${interpretation.improved.map(i => `<div class="interp-item"><div class="interp-dot dot-good"></div>${i}</div>`).join('')}
          </div>
        </div>`;
      }
      if (interpretation.worsened.length) {
        html += `<div class="interp-section">
          <div class="interp-title">What worsened</div>
          <div class="interp-list">
            ${interpretation.worsened.map(i => `<div class="interp-item"><div class="interp-dot dot-warn"></div>${i}</div>`).join('')}
          </div>
        </div>`;
      }
      if (interpretation.causes.length) {
        html += `<div class="interp-section">
          <div class="interp-title">Likely context</div>
          <div class="interp-list">
            ${interpretation.causes.map(c => `<div class="interp-item"><div class="interp-dot dot-neutral"></div>${c}</div>`).join('')}
          </div>
        </div>`;
      }
      if (interpretation.actions.length) {
        html += `<div class="interp-section">
          <div class="interp-title">Next 24–72 hours</div>
          <div class="interp-list">
            ${interpretation.actions.map(a => `<div class="interp-item"><div class="interp-dot" style="background:var(--gold)"></div>${a}</div>`).join('')}
          </div>
        </div>`;
      }
      html += `<div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-soft)">
        <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)">Confidence</div>
        <span class="chip ${interpretation.confidence === 'high' ? 'good' : interpretation.confidence === 'medium' ? 'neutral' : ''}">${interpretation.confidence}</span>
      </div>`;
      html += `</div>`;

      /* ── Compare table ──────────────────────────────── */
      if (prevEntry) {
        html += `<div class="section-label">vs previous scan (${Storage.formatDisplayDate(prevEntry.date)})</div>
        <table class="compare-table">
          <thead><tr><th>Metric</th><th>Previous</th><th>Now</th><th>Change</th></tr></thead>
          <tbody>
            ${[
              ['Weight kg', prevEntry.weight, entry.weight, -1],
              ['Body fat %', prevEntry.bodyFatPercent, entry.bodyFatPercent, -1],
              ['Muscle mass kg', prevEntry.muscleMass, entry.muscleMass, 1],
              ['TBW %', prevEntry.totalBodyWaterPercent, entry.totalBodyWaterPercent, 1],
              ['Visceral fat', prevEntry.visceralFat, entry.visceralFat, -1],
              ['Metabolic age', prevEntry.metabolicAge, entry.metabolicAge, -1],
              ['BMR kcal', prevEntry.bmr, entry.bmr, 1],
            ].filter(r => r[1] != null && r[2] != null).map(r => {
              const diff = parseFloat((r[2] - r[1]).toFixed(2));
              const good = diff * r[3] > 0;
              const bad = diff * r[3] < 0;
              return `<tr>
                <td>${r[0]}</td>
                <td>${r[1]}</td>
                <td class="${good ? 'val-good' : bad ? 'val-warn' : ''}">${r[2]}</td>
                <td class="${good ? 'val-good' : bad ? 'val-warn' : 'muted'}">${diff > 0 ? '+' : ''}${diff}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
      }
    }

    /* ── Scale history ──────────────────────────────────── */
    if (allScaleEntries.length > 0) {
      html += `<div class="section-label">Scan history</div><div class="card">`;
      allScaleEntries.slice(0, 8).forEach((s, i) => {
        const prevS = allScaleEntries[i + 1];
        const diff = prevS && s.weight && prevS.weight ? s.weight - prevS.weight : null;
        const trendClass = diff == null ? '' : diff < -0.1 ? 'trend-down' : diff > 0.1 ? 'trend-up' : 'trend-same';
        const trendSymbol = diff == null ? '' : diff < -0.1 ? '↓' : diff > 0.1 ? '↑' : '→';
        html += `<div class="scale-row">
          <div class="scale-date">${Storage.formatDay(s.date)}</div>
          <div class="scale-weight">${s.weight ? s.weight + 'kg' : '—'}</div>
          <div class="scale-detail">${[
            s.bodyFatPercent ? s.bodyFatPercent + '% fat' : '',
            s.muscleMass ? s.muscleMass + 'kg muscle' : '',
            s.totalBodyWaterPercent ? s.totalBodyWaterPercent + '% TBW' : ''
          ].filter(Boolean).join(' · ')}</div>
          <div class="scale-trend ${trendClass}">${trendSymbol}${diff != null ? ' ' + Math.abs(diff).toFixed(1) : ''}</div>
        </div>`;
      });
      html += `</div>`;
    }

    el.innerHTML = html;
  }

  /* ─── INSIGHTS VIEW ───────────────────────────────────── */
  function renderInsights(el) {
    const days = Storage.getRecentDays(30);
    const scaleEntries = Storage.getRecentScaleEntries(15);
    const insights = Engine.generateInsights(days, scaleEntries);

    const cats = [
      { id: 'all', label: 'All' },
      { id: 'nutrition', label: 'Nutrition' },
      { id: 'hydration', label: 'Hydration' },
      { id: 'movement', label: 'Movement' },
      { id: 'hormones', label: 'Hormones' },
      { id: 'body-comp', label: 'Body' },
      { id: 'gut', label: 'Gut' },
      { id: 'sleep', label: 'Sleep' },
    ];

    let html = `
    <div class="view-title">Insights</div>
    <div class="view-subtitle">Patterns from your data</div>

    <div class="tabs" id="insight-tabs">
      ${cats.map(c => `<button class="tab-btn ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('')}
    </div>

    <div id="insight-cards">`;

    const filtered = insights;
    if (filtered.length === 0) {
      html += `<div class="no-data-card">
        <div class="no-data-title">Building patterns</div>
        <div class="no-data-body">Log consistently for 5+ days and this section will begin to show meaningful insights about your body.</div>
      </div>`;
    } else {
      filtered.forEach(ins => {
        html += `<div class="insight-card confidence-${ins.confidence}" data-category="${ins.category}">
          <div class="insight-header">
            <div class="insight-title">${ins.title}</div>
            <span class="confidence-badge">${ins.confidence === 'high' ? 'High confidence' : ins.confidence === 'medium' ? 'Possible pattern' : 'Worth watching'}</span>
          </div>
          <div class="insight-noticed">${ins.noticed}</div>
          <div class="insight-why">${ins.why}</div>
          <div class="insight-action">${ins.action}</div>
        </div>`;
      });
    }

    html += `</div>`;

    /* ── Data summary ───────────────────────────────────── */
    const loggedDays = days.filter(d => !d._empty).length;
    html += `<div class="card" style="margin-top:12px;text-align:center">
      <div style="font-family:var(--font-serif);font-size:28px;color:var(--ivory)">${loggedDays}</div>
      <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)">days logged (last 30)</div>
    </div>`;

    el.innerHTML = html;
  }

  /* ─── WEEK VIEW ───────────────────────────────────────── */
  function renderWeek(el) {
    const weekStart = Storage.getWeekStart(weekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekDays = Storage.getWeekDays(weekStart);
    const scaleEntries = Storage.getRecentScaleEntries(20);
    const report = Engine.generateWeeklyReport(weekDays, scaleEntries);
    const settings = Storage.getSettings();

    const weekLabel = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      ' – ' + weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const weekClasses = {
      'fat-loss': 'week-fat-loss',
      'maintenance': 'week-maintenance',
      'water-retention': 'week-water-retention',
      'recovery': 'week-recovery',
      'inconsistent': 'week-inconsistent'
    };

    let html = `
    <div class="view-title">Weekly Report</div>
    <div class="view-subtitle">${weekLabel}</div>

    <div class="week-selector">
      <button class="week-nav" id="week-prev">‹</button>
      <div class="week-label">${weekLabel}</div>
      <button class="week-nav" id="week-next" ${weekOffset === 0 ? 'disabled style="opacity:.4"' : ''}>›</button>
    </div>

    <span class="week-class-badge ${weekClasses[report.weekClassification] || 'week-inconsistent'}">${report.weekClassLabel}</span>`;

    /* ── Average stats ────────────────────────────────── */
    html += `<div class="week-stats">
      ${[
        ['Calories', report.avgCalories ? report.avgCalories + ' kcal' : '—'],
        ['Protein', report.avgProtein ? report.avgProtein + 'g' : '—'],
        ['Water', report.avgWater ? report.avgWater + 'L' : '—'],
        ['Steps', report.avgSteps ? (report.avgSteps >= 1000 ? Math.round(report.avgSteps/100)/10 + 'k' : report.avgSteps) : '—'],
        ['Mood', report.avgMood ? report.avgMood + '/10' : '—'],
        ['Sleep', report.avgSleep ? report.avgSleep + 'h' : '—'],
        ['Workouts', report.workoutsCompleted],
        ['Days logged', report.daysLogged + '/7'],
      ].map(([label, val]) => `<div class="week-stat">
        <div class="week-stat-val">${val}</div>
        <div class="week-stat-label">${label}</div>
      </div>`).join('')}
    </div>`;

    /* ── Weight trend ─────────────────────────────────── */
    if (report.weightChange != null) {
      const wColor = report.weightChange < -0.2 ? 'var(--sage)' : report.weightChange > 0.3 ? 'var(--amber)' : 'var(--text-3)';
      html += `<div class="card-sm" style="margin-bottom:16px;display:flex;align-items:center;gap:16px">
        <div>
          <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">Weight change this week</div>
          <div style="font-family:var(--font-serif);font-size:24px;color:${wColor}">${report.weightChange > 0 ? '+' : ''}${report.weightChange}kg</div>
        </div>
        ${report.fatTrend != null ? `<div>
          <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">Fat %</div>
          <div style="font-family:var(--font-serif);font-size:24px;color:${report.fatTrend < 0 ? 'var(--sage)' : 'var(--amber)'}">${report.fatTrend > 0 ? '+' : ''}${report.fatTrend}%</div>
        </div>` : ''}
        ${report.muscleTrend != null ? `<div>
          <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">Muscle</div>
          <div style="font-family:var(--font-serif);font-size:24px;color:${report.muscleTrend >= 0 ? 'var(--sage)' : 'var(--amber)'}">${report.muscleTrend > 0 ? '+' : ''}${report.muscleTrend}kg</div>
        </div>` : ''}
      </div>`;
    }

    /* ── Recommendation ─────────────────────────────────── */
    html += `<div class="summary-block">${report.recommendation}</div>`;

    /* ── Wins and leaks ─────────────────────────────────── */
    html += `<div class="card" style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--sage);margin-bottom:8px">Biggest win</div>
          <div style="font-size:13px;color:var(--ivory-muted);line-height:1.6">${report.biggestWin}</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber);margin-bottom:8px">Biggest opportunity</div>
          <div style="font-size:13px;color:var(--ivory-muted);line-height:1.6">${report.biggestLeak}</div>
        </div>
      </div>
      ${report.nextFocus ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-soft)">
        <div style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-dim);margin-bottom:8px">Next week's focus</div>
        <div style="font-size:13px;color:var(--gold-light);line-height:1.6">${report.nextFocus}</div>
      </div>` : ''}
    </div>`;

    /* ── Day breakdown ──────────────────────────────────── */
    html += `<div class="section-label">Day breakdown</div><div class="card">`;
    weekDays.forEach(d => {
      const isEmpty = d._empty;
      const score = isEmpty ? 0 : Storage.calcGlowScore(d, settings);
      const parts = [];
      if (!isEmpty) {
        if (d.calories) parts.push(d.calories + ' kcal');
        if (d.protein) parts.push(d.protein + 'g prot');
        if (d.water) parts.push(d.water + 'L');
        if (d.workoutType && d.workoutType !== 'rest') parts.push(d.workoutType);
      }
      const isBest = report.bestDay && report.bestDay.date === d.date;
      const isHard = report.hardestDay && report.hardestDay.date === d.date && !isEmpty;
      html += `<div class="day-row ${isBest ? 'day-best' : isHard ? 'day-hard' : ''}">
        <div class="day-row-date">${Storage.formatDay(d.date)}</div>
        <div class="day-row-score">${isEmpty ? '—' : score}</div>
        <div class="day-row-detail">${isEmpty ? '<span style="color:var(--text-4)">Not logged</span>' : parts.join(' · ') || 'Partial log'}</div>
        ${isBest ? '<span class="chip good" style="font-size:9px">Best</span>' : ''}
        ${isHard && !isBest ? '<span class="chip warn" style="font-size:9px">Low</span>' : ''}
      </div>`;
    });
    html += `</div>`;

    /* ── Patterns ───────────────────────────────────────── */
    if (report.daysLogged >= 3) {
      html += `<div class="section-label">Weekly patterns</div><div class="card">`;
      if (report.gutPattern) {
        const gutColor = report.gutPattern === 'clear' ? 'var(--sage)' : report.gutPattern === 'occasional' ? 'var(--amber)' : 'var(--red-soft)';
        html += `<div class="progress-row"><div class="progress-label">Gut health</div><div class="progress-track"><div class="progress-fill" style="width:${report.gutPattern === 'clear' ? 100 : report.gutPattern === 'occasional' ? 50 : 20}%;background:${gutColor}"></div></div><div class="progress-val" style="color:${gutColor}">${report.gutPattern}</div></div>`;
      }
      if (report.skinPattern) {
        const skinColor = report.skinPattern === 'clear' ? 'var(--sage)' : report.skinPattern === 'occasional' ? 'var(--amber)' : 'var(--red-soft)';
        html += `<div class="progress-row"><div class="progress-label">Skin</div><div class="progress-track"><div class="progress-fill" style="width:${report.skinPattern === 'clear' ? 100 : report.skinPattern === 'occasional' ? 50 : 20}%;background:${skinColor}"></div></div><div class="progress-val" style="color:${skinColor}">${report.skinPattern}</div></div>`;
      }
      if (report.avgProtein) {
        const protPct = Math.min(100, Math.round(report.avgProtein / settings.proteinTarget * 100));
        html += `<div class="progress-row"><div class="progress-label">Protein avg</div><div class="progress-track"><div class="progress-fill" style="width:${protPct}%"></div></div><div class="progress-val">${protPct}%</div></div>`;
      }
      if (report.avgWater) {
        const waterPct = Math.min(100, Math.round(report.avgWater / settings.waterTarget * 100));
        html += `<div class="progress-row"><div class="progress-label">Hydration avg</div><div class="progress-track"><div class="progress-fill" style="width:${waterPct}%"></div></div><div class="progress-val">${waterPct}%</div></div>`;
      }
      html += `</div>`;
    }

    el.innerHTML = html;
  }

  /* ─── EVENT BINDING ───────────────────────────────────── */
  function bindViewEvents() {
    const el = document.getElementById('main-content');

    /* ── Date nav ─────────────────────────────────────── */
    const logPrev = document.getElementById('log-prev');
    const logNext = document.getElementById('log-next');
    const logInput = document.getElementById('log-date-input');
    if (logPrev) logPrev.addEventListener('click', () => { logDate = offsetDate(logDate, -1); renderLog(el); bindViewEvents(); });
    if (logNext) logNext.addEventListener('click', () => { if (logDate < Storage.today()) { logDate = offsetDate(logDate, 1); renderLog(el); bindViewEvents(); } });
    if (logInput) logInput.addEventListener('change', e => { logDate = e.target.value; renderLog(el); bindViewEvents(); });

    const scalePrev = document.getElementById('scale-prev');
    const scaleNext = document.getElementById('scale-next');
    const scaleInput = document.getElementById('scale-date-input');
    if (scalePrev) scalePrev.addEventListener('click', () => { scaleDate = offsetDate(scaleDate, -1); renderScale(el); bindViewEvents(); });
    if (scaleNext) scaleNext.addEventListener('click', () => { if (scaleDate < Storage.today()) { scaleDate = offsetDate(scaleDate, 1); renderScale(el); bindViewEvents(); } });
    if (scaleInput) scaleInput.addEventListener('change', e => { scaleDate = e.target.value; renderScale(el); bindViewEvents(); });

    const wPrev = document.getElementById('week-prev');
    const wNext = document.getElementById('week-next');
    if (wPrev) wPrev.addEventListener('click', () => { weekOffset--; renderWeek(el); bindViewEvents(); });
    if (wNext) wNext.addEventListener('click', () => { if (weekOffset < 0) { weekOffset++; renderWeek(el); bindViewEvents(); } });

    /* ── Sliders ──────────────────────────────────────── */
    ['mood','energy','stress'].forEach(id => {
      const slider = document.getElementById(id);
      const val = document.getElementById(id + '-val');
      if (slider && val) {
        slider.addEventListener('input', () => { val.textContent = slider.value; });
      }
    });

    /* ── Meal add ─────────────────────────────────────── */
    let selectedMealType = 'lunch';
    const mealTypeGrid = document.getElementById('meal-type-grid');
    if (mealTypeGrid) {
      mealTypeGrid.querySelectorAll('.check-item').forEach(item => {
        item.addEventListener('click', () => {
          mealTypeGrid.querySelectorAll('.check-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedMealType = item.dataset.mealType;
        });
      });
    }
    const mealAddBtn = document.getElementById('meal-add-btn');
    if (mealAddBtn) {
      mealAddBtn.addEventListener('click', () => {
        const name = document.getElementById('meal-name').value.trim();
        const cals = parseInt(document.getElementById('meal-cals').value) || 0;
        const prot = parseInt(document.getElementById('meal-prot').value) || 0;
        if (!name) { showToast('Enter a meal name'); return; }
        mealList.push({ name, calories: cals, protein: prot, mealType: selectedMealType });
        document.getElementById('meal-name').value = '';
        document.getElementById('meal-cals').value = '';
        document.getElementById('meal-prot').value = '';
        renderMealList();
      });
    }

    /* ── Meal remove ──────────────────────────────────── */
    const mealListEl = document.getElementById('meal-list');
    if (mealListEl) {
      mealListEl.addEventListener('click', e => {
        const btn = e.target.closest('.meal-remove');
        if (btn) {
          const idx = parseInt(btn.dataset.mealIdx);
          mealList.splice(idx, 1);
          renderMealList();
        }
      });
    }

    /* ── Water quick buttons ──────────────────────────── */
    document.querySelectorAll('.water-quick').forEach(btn => {
      btn.addEventListener('click', () => {
        const waterInput = document.getElementById('water');
        if (waterInput) waterInput.value = btn.dataset.val;
        document.querySelectorAll('.water-quick').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    /* ── Single-select check-items ────────────────────── */
    [
      { id: 'workout-type', attr: 'data-workout' },
      { id: 'workout-intensity', attr: 'data-intensity' },
      { id: 'gut-severity', attr: 'data-sev' },
      { id: 'cycle-phase', attr: 'data-phase' }
    ].forEach(({ id, attr }) => {
      const grid = document.getElementById(id);
      if (!grid) return;
      grid.querySelectorAll('.check-item').forEach(item => {
        item.addEventListener('click', () => {
          grid.querySelectorAll('.check-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
        });
      });
    });

    /* ── Multi-select check-items ─────────────────────── */
    ['gut-symptoms', 'skin-symptoms', 'supplements', 'cycle-flags', 'food-flags'].forEach(id => {
      const grid = document.getElementById(id);
      if (!grid) return;
      grid.querySelectorAll('.check-item').forEach(item => {
        item.addEventListener('click', () => {
          item.classList.toggle('selected');
        });
      });
    });

    /* ── Save log ─────────────────────────────────────── */
    const saveLogBtn = document.getElementById('save-log-btn');
    if (saveLogBtn) {
      saveLogBtn.addEventListener('click', () => saveLog());
    }

    /* ── Save scale ───────────────────────────────────── */
    const saveScaleBtn = document.getElementById('save-scale-btn');
    if (saveScaleBtn) {
      saveScaleBtn.addEventListener('click', () => saveScaleEntry());
    }

    /* ── Insight tab filtering ────────────────────────── */
    const insightTabs = document.getElementById('insight-tabs');
    if (insightTabs) {
      insightTabs.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          insightTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.dataset.cat;
          document.querySelectorAll('#insight-cards .insight-card').forEach(card => {
            card.style.display = cat === 'all' || card.dataset.category === cat ? '' : 'none';
          });
        });
      });
    }
  }

  /* ── Meal list re-render (without full view refresh) ── */
  function renderMealList() {
    const container = document.getElementById('meal-list');
    if (!container) return;
    const totalCal = mealList.reduce((s, m) => s + (m.calories || 0), 0);
    const totalProt = mealList.reduce((s, m) => s + (m.protein || 0), 0);

    container.innerHTML = mealList.length ? mealList.map((m, i) => `
      <div class="meal-item">
        <div class="meal-name">${m.name} <span style="color:var(--text-4);font-size:11px;margin-left:4px">${m.mealType || ''}</span></div>
        <div class="meal-cals">${m.calories ? m.calories + ' kcal' : ''}</div>
        <div class="meal-prot">${m.protein ? m.protein + 'g prot' : ''}</div>
        <button class="meal-remove" data-meal-idx="${i}">×</button>
      </div>`).join('') : '<div style="font-size:12px;color:var(--text-4);padding:8px 0">No meals logged yet</div>';

    const mealListEl = document.getElementById('meal-list');
    if (mealListEl) {
      mealListEl.addEventListener('click', e => {
        const btn = e.target.closest('.meal-remove');
        if (btn) {
          const idx = parseInt(btn.dataset.mealIdx);
          mealList.splice(idx, 1);
          renderMealList();
        }
      });
    }

    const calDisplay = document.querySelector('.metrics-grid .metric-value');
    const totals = document.querySelectorAll('.card-sm .metric-value, .card-sm > div:first-child');
    totals.forEach((el, i) => {
      if (i === 0) el.textContent = totalCal || '—';
      if (i === 2) el.textContent = (totalProt || '—') + (totalProt ? 'g' : '');
    });
  }

  /* ─── SAVE LOG ────────────────────────────────────────── */
  function saveLog() {
    const totalCal = mealList.reduce((s, m) => s + (m.calories || 0), 0);
    const totalProt = mealList.reduce((s, m) => s + (m.protein || 0), 0);

    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const numVal = id => { const v = parseFloat(val(id)); return isNaN(v) ? null : v; };
    const intVal = id => { const v = parseInt(val(id)); return isNaN(v) ? null : v; };

    const selectedVals = (gridId, attr) => {
      const grid = document.getElementById(gridId);
      if (!grid) return [];
      return [...grid.querySelectorAll('.check-item.selected')].map(el => el.getAttribute(attr)).filter(Boolean);
    };
    const singleVal = (gridId, attr) => {
      const grid = document.getElementById(gridId);
      if (!grid) return null;
      const sel = grid.querySelector('.check-item.selected');
      return sel ? sel.getAttribute(attr) : null;
    };

    const gutSyms = selectedVals('gut-symptoms', 'data-gut').filter(v => v !== 'none');
    const gutSev = singleVal('gut-severity', 'data-sev') || 'none';
    const skinSyms = selectedVals('skin-symptoms', 'data-skin');
    const workoutType = singleVal('workout-type', 'data-workout');
    const workoutIntensity = singleVal('workout-intensity', 'data-intensity');
    const cyclePhase = singleVal('cycle-phase', 'data-phase') || 'none';
    const cycleFlags = selectedVals('cycle-flags', 'data-cflag');
    const supplements = selectedVals('supplements', 'data-supp');
    const foodFlags = selectedVals('food-flags', 'data-flag');

    const data = {
      meals: mealList,
      calories: totalCal || (intVal('calories') || null),
      protein: totalProt || null,
      water: numVal('water'),
      electrolytes: val('electrolytes') || null,
      coffee: intVal('coffee'),
      steps: intVal('steps'),
      workoutType: workoutType,
      workoutIntensity: workoutIntensity,
      workoutDuration: intVal('workout-duration'),
      mood: intVal('mood'),
      energy: intVal('energy'),
      stress: intVal('stress'),
      gutSymptoms: gutSyms,
      gutSeverity: gutSev,
      skinSymptoms: skinSyms,
      sleep: numVal('sleep'),
      sleepQuality: intVal('sleep-quality'),
      cyclePhase: cyclePhase,
      cycleDay: intVal('cycle-day'),
      cyclePMS: cycleFlags.includes('pms'),
      cyclePeriod: cycleFlags.includes('period'),
      weight: numVal('daily-weight'),
      supplements: supplements,
      foodFlags: foodFlags,
      notes: val('day-notes')
    };

    Storage.saveDaily(logDate, data);
    showToast('Log saved');
    updateHeader();

    if (logDate === Storage.today()) {
      setTimeout(() => navigate('today'), 600);
    }
  }

  /* ─── SAVE SCALE ──────────────────────────────────────── */
  function saveScaleEntry() {
    const numVal = id => { const el = document.getElementById(id); if (!el || !el.value) return null; const v = parseFloat(el.value); return isNaN(v) ? null : v; };
    const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    const data = {
      weight: numVal('sc-weight'),
      bodyFatPercent: numVal('sc-fat'),
      fatMass: numVal('sc-fatmass'),
      muscleMass: numVal('sc-muscle'),
      totalBodyWaterPercent: numVal('sc-tbw'),
      bmi: numVal('sc-bmi'),
      bmr: numVal('sc-bmr'),
      visceralFat: numVal('sc-visceral'),
      metabolicAge: numVal('sc-metage'),
      degreeOfObesity: numVal('sc-obesity'),
      notes: val('sc-notes')
    };

    if (!data.weight) { showToast('Enter at least a weight'); return; }

    Storage.saveScale(scaleDate, data);
    showToast('Scale data saved');
    renderScale(document.getElementById('main-content'));
    bindViewEvents();
  }

  /* ─── HELPERS ─────────────────────────────────────────── */
  function offsetDate(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return Storage.fmt(d);
  }
  function getPrevDate(dateStr) {
    return offsetDate(dateStr, -1);
  }

  /* ─── INIT ────────────────────────────────────────────── */
  function init() {
    /* Nav clicks */
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });

    /* Initial render */
    navigate('today');
  }

  return { init, nav: navigate };
})();

/* ─── BOOT ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());

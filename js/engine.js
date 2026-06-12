/* ─── INTELLIGENCE ENGINE ────────────────────────────────── */

const Engine = (() => {

  /* ─────────────────────────────────────────────────────── */
  /* ADAPTIVE GUIDANCE                                       */
  /* ─────────────────────────────────────────────────────── */
  function getAdaptiveGuidance(recentDays, todayEntry, settings) {
    const s = settings || Storage.getSettings();
    const guidance = { priorities: [], warnings: [], adjustments: [] };

    const today = todayEntry || {};
    const yesterday = recentDays.find(d => d.date !== Storage.today()) || null;
    const last3 = recentDays.slice(0, 3);
    const last7 = recentDays.slice(0, 7);

    /* ── Protein check ──────────────────────────────────── */
    const proteinLowDays = last3.filter(d => d.protein && d.protein < s.proteinTarget * 0.8).length;
    if (proteinLowDays >= 2) {
      guidance.priorities.push('Protein has been low for ' + proteinLowDays + ' days. Prioritise a protein-first meal today.');
      guidance.warnings.push('Low protein days are linked to increased cravings later.');
    }
    if (today.protein && today.protein < s.proteinTarget * 0.5) {
      guidance.priorities.push('Protein is low today. Add eggs, chicken, Greek yoghurt or cottage cheese.');
    }

    /* ── Hydration check ────────────────────────────────── */
    const waterLowDays = last3.filter(d => d.water && d.water < s.waterTarget * 0.8).length;
    if (waterLowDays >= 2) {
      guidance.priorities.push('Hydration has been below target for ' + waterLowDays + ' days. Aim for ' + s.waterTarget + 'L today.');
    }
    if (yesterday && yesterday.water && yesterday.water < 1.5) {
      guidance.warnings.push('You drank under 1.5L yesterday. Scale weight may be higher from water retention, not fat.');
    }

    /* ── Gut symptoms ───────────────────────────────────── */
    if (today.gutSeverity && today.gutSeverity !== 'none') {
      guidance.adjustments.push('Gut symptoms logged. Stick to cooked, simple foods: rice, potato, eggs, chicken, soup.');
      guidance.adjustments.push('Avoid raw salad, dairy and high-fibre foods until symptoms settle.');
      guidance.adjustments.push('Increase water and add electrolytes if needed.');
    }
    const recentGut = last3.filter(d => d.gutSeverity && d.gutSeverity !== 'none' && d.gutSeverity !== undefined).length;
    if (recentGut >= 2 && (!today.gutSeverity || today.gutSeverity === 'none')) {
      guidance.adjustments.push('Gut has been unsettled recently. Keep meals simple today.');
    }

    /* ── Calories check ─────────────────────────────────── */
    const calHighDays = last3.filter(d => d.calories && d.calories > s.calorieTarget * 1.2).length;
    if (calHighDays === 1 && yesterday && yesterday.calories > s.calorieTarget * 1.2) {
      guidance.adjustments.push('Calories were higher yesterday. No need to panic — just aim for a steady, protein-led day today.');
    }
    if (calHighDays >= 3) {
      const calHighAll = last7.filter(d => d.calories && d.calories > s.calorieTarget * 1.15).length;
      if (calHighAll >= 5) {
        guidance.warnings.push('Calories have been consistently above target this week. Consider a gentle 3-day reset with simple, high-protein meals.');
      }
    }

    /* ── Cycle context ──────────────────────────────────── */
    if (today.cyclePMS) {
      guidance.warnings.push('PMS logged. Water retention and cravings are expected. Do not compare to non-PMS weigh-ins.');
      guidance.adjustments.push('Aim for maintenance today. Focus on protein, hydration and gentle movement.');
    }
    if (today.cyclePeriod) {
      guidance.warnings.push('Period logged. Scale weight fluctuates significantly during menstruation — avoid reading too much into it.');
      guidance.adjustments.push('Iron-rich foods and extra hydration are helpful today.');
    }
    if (today.cyclePhase === 'luteal') {
      guidance.adjustments.push('Luteal phase — expect some water retention and lower energy. Gentle movement is ideal.');
    }

    /* ── Mood and energy ────────────────────────────────── */
    if (today.mood && today.mood <= 4) {
      guidance.priorities.push('Low mood logged. Focus on the minimum effective day: protein, water, a walk and an early night.');
    }
    if (today.energy && today.energy <= 3) {
      guidance.adjustments.push('Energy is low. Avoid aggressive calorie cutting today. Fuel your body consistently.');
    }

    /* ── Sleep check ────────────────────────────────────── */
    const sleepLow = last3.filter(d => d.sleep && d.sleep < 6.5).length;
    if (sleepLow >= 2) {
      guidance.warnings.push('Sleep has been low recently. This can elevate cortisol and affect weight, cravings and mood.');
      guidance.adjustments.push('Prioritise an earlier bedtime tonight.');
    }

    /* ── Post-workout ───────────────────────────────────── */
    if (today.workoutIntensity === 'hard') {
      guidance.adjustments.push('Hard workout logged. Increase water and electrolytes. Do not under-eat after intense movement.');
      if (s.stepsTarget && today.steps > s.stepsTarget * 1.5) {
        guidance.adjustments.push('High step count today — extra carbohydrates and protein will support recovery.');
      }
    }
    if (today.workoutType === 'netball') {
      guidance.adjustments.push('Netball day. Extra carbohydrates and electrolytes before and after are recommended.');
    }

    /* ── Smart scale context ────────────────────────────── */
    const lastScale = Storage.getRecentScaleEntries(1)[0];
    if (lastScale && lastScale.totalBodyWaterPercent && lastScale.totalBodyWaterPercent < 50) {
      guidance.warnings.push('Last smart scale reading showed low TBW%. Body fat % may read higher than it really is. Prioritise hydration.');
    }

    return guidance;
  }

  /* ─────────────────────────────────────────────────────── */
  /* INSIGHTS ENGINE                                         */
  /* ─────────────────────────────────────────────────────── */
  function generateInsights(days, scaleEntries) {
    const insights = [];
    const allDays = days.filter(d => !d._empty);

    if (allDays.length < 3) {
      insights.push({
        title: 'Building your intelligence',
        noticed: 'Log your data for a few more days and this section will begin to show patterns.',
        why: 'Reliable insights need at least 5–7 days of data.',
        action: 'Log food, water, sleep and mood each day. Even partial logs help.',
        confidence: 'low',
        category: 'setup'
      });
      return insights;
    }

    /* ── Protein–craving / mood pattern ─────────────────── */
    const lowProtDays = allDays.filter(d => d.protein && d.protein < 90 && d.mood);
    const highProtDays = allDays.filter(d => d.protein && d.protein >= 110 && d.mood);
    if (lowProtDays.length >= 3 && highProtDays.length >= 3) {
      const avgMoodLowProt = Storage.avg(lowProtDays.map(d => d.mood));
      const avgMoodHighProt = Storage.avg(highProtDays.map(d => d.mood));
      if (avgMoodLowProt && avgMoodHighProt && avgMoodHighProt - avgMoodLowProt >= 1.5) {
        insights.push({
          title: 'Protein and mood may be linked',
          noticed: `On lower-protein days, mood averages ${avgMoodLowProt.toFixed(1)}/10. On higher-protein days, it averages ${avgMoodHighProt.toFixed(1)}/10.`,
          why: 'Protein supports serotonin and dopamine production. Low intake may affect how you feel.',
          action: 'On tired or low-mood days, front-load protein at your first meal.',
          confidence: allDays.length >= 10 ? 'medium' : 'low',
          category: 'nutrition'
        });
      }
    }

    /* ── Protein consistently low ───────────────────────── */
    const protVals = allDays.filter(d => d.protein).map(d => d.protein);
    const avgProt = Storage.avg(protVals);
    const settings = Storage.getSettings();
    if (avgProt && avgProt < settings.proteinTarget * 0.8 && protVals.length >= 4) {
      insights.push({
        title: 'Protein tracking below target',
        noticed: `Average protein over ${protVals.length} logged days is ${Math.round(avgProt)}g — below the ${settings.proteinTarget}g target.`,
        why: 'Consistent low protein makes muscle retention harder and can increase cravings.',
        action: `Add one extra protein source per day: Greek yoghurt, eggs, chicken or a protein shake.`,
        confidence: allDays.length >= 7 ? 'medium' : 'low',
        category: 'nutrition'
      });
    }

    /* ── Hydration → next-day weight ────────────────────── */
    if (scaleEntries && scaleEntries.length >= 3) {
      let lowWaterHighWeight = 0; let checks = 0;
      for (let i = 0; i < allDays.length - 1; i++) {
        const d = allDays[i];
        const nextScale = scaleEntries.find(s => Storage.daysBetween(d.date, s.date) === 1);
        const prevScale = scaleEntries.find(s => s.date === d.date);
        if (d.water && nextScale && prevScale && prevScale.weight) {
          checks++;
          if (d.water < 2 && nextScale.weight > prevScale.weight + 0.3) lowWaterHighWeight++;
        }
      }
      if (checks >= 3 && lowWaterHighWeight / checks >= 0.5) {
        insights.push({
          title: 'Scale weight rises when water is low',
          noticed: `${Math.round(lowWaterHighWeight / checks * 100)}% of low-water days are followed by a higher scale reading the next day.`,
          why: 'Dehydration causes the body to retain fluid. The scale rises — but this is not fat gain.',
          action: 'Prioritise 2.5–3L of water before reacting to a higher scale reading.',
          confidence: checks >= 6 ? 'high' : 'medium',
          category: 'hydration'
        });
      }
    }

    /* ── Hydration and TBW ──────────────────────────────── */
    if (scaleEntries && scaleEntries.length >= 3) {
      const goodWaterScales = scaleEntries.filter(s => {
        const dayBefore = allDays.find(d => Storage.daysBetween(d.date, s.date) === 1);
        return dayBefore && dayBefore.water && dayBefore.water >= 2.5 && s.totalBodyWaterPercent;
      });
      const lowWaterScales = scaleEntries.filter(s => {
        const dayBefore = allDays.find(d => Storage.daysBetween(d.date, s.date) === 1);
        return dayBefore && dayBefore.water && dayBefore.water < 1.8 && s.totalBodyWaterPercent;
      });
      if (goodWaterScales.length >= 2 && lowWaterScales.length >= 2) {
        const avgTbwGood = Storage.avg(goodWaterScales.map(s => s.totalBodyWaterPercent));
        const avgTbwLow = Storage.avg(lowWaterScales.map(s => s.totalBodyWaterPercent));
        if (avgTbwGood && avgTbwLow && avgTbwGood - avgTbwLow >= 1.5) {
          insights.push({
            title: 'TBW improves with better hydration',
            noticed: `TBW% averages ${avgTbwGood.toFixed(1)}% after well-hydrated days and ${avgTbwLow.toFixed(1)}% after lower-water days.`,
            why: 'Higher TBW means the scale reads body fat more accurately. Dehydration inflates fat % readings.',
            action: 'Drink at least 2.5L before a smart scale weigh-in for more accurate results.',
            confidence: 'medium',
            category: 'hydration'
          });
        }
      }
    }

    /* ── Gut symptoms and food flags ────────────────────── */
    const gutDays = allDays.filter(d => d.gutSeverity && d.gutSeverity !== 'none');
    if (gutDays.length >= 2) {
      const highSodiumGut = gutDays.filter(d => d.foodFlags && d.foodFlags.includes('highSodium')).length;
      const takeawayGut = gutDays.filter(d => d.foodFlags && d.foodFlags.includes('takeaway')).length;
      const dairyGut = gutDays.filter(d => d.foodFlags && d.foodFlags.includes('dairy')).length;

      if (highSodiumGut / gutDays.length >= 0.5 && highSodiumGut >= 2) {
        insights.push({
          title: 'Gut symptoms after higher-sodium meals',
          noticed: `${highSodiumGut} out of ${gutDays.length} gut symptom days followed high-sodium meals.`,
          why: 'High sodium can trigger water retention and gut irritation.',
          action: 'Use cooked, lower-sodium meals for 24 hours after symptoms.',
          confidence: gutDays.length >= 5 ? 'medium' : 'low',
          category: 'gut'
        });
      }
      if (takeawayGut / gutDays.length >= 0.5 && takeawayGut >= 2) {
        insights.push({
          title: 'Possible pattern with takeaway meals',
          noticed: `${takeawayGut} out of ${gutDays.length} gut symptom days followed a takeaway or rich sauce meal.`,
          why: 'High-fat, high-sodium restaurant food can affect digestion and weight the following day.',
          action: 'Follow takeaway meals with a simple, home-cooked day.',
          confidence: gutDays.length >= 5 ? 'medium' : 'low',
          category: 'gut'
        });
      }
      if (dairyGut / gutDays.length >= 0.5 && dairyGut >= 2) {
        insights.push({
          title: 'Worth watching: dairy and gut symptoms',
          noticed: `Dairy was logged on ${dairyGut} of ${gutDays.length} days with gut symptoms.`,
          why: 'Dairy sensitivity can cause bloating, particularly in the luteal phase.',
          action: 'Try reducing dairy for a few days after gut symptoms to see if it helps.',
          confidence: 'low',
          category: 'gut'
        });
      }
    }

    /* ── Steps and mood ─────────────────────────────────── */
    const highStepDays = allDays.filter(d => d.steps && d.steps >= 8000 && d.mood);
    const lowStepDays = allDays.filter(d => d.steps && d.steps < 5000 && d.mood);
    if (highStepDays.length >= 3 && lowStepDays.length >= 3) {
      const moodHigh = Storage.avg(highStepDays.map(d => d.mood));
      const moodLow = Storage.avg(lowStepDays.map(d => d.mood));
      if (moodHigh && moodLow && moodHigh - moodLow >= 1.2) {
        insights.push({
          title: 'Movement and mood trend together',
          noticed: `Mood averages ${moodHigh.toFixed(1)}/10 on higher-step days and ${moodLow.toFixed(1)}/10 on lower-step days.`,
          why: 'Walking and light movement reliably lift mood through endorphins and reduced cortisol.',
          action: 'Even a 20-minute walk on low-mood days may shift things.',
          confidence: allDays.length >= 10 ? 'medium' : 'low',
          category: 'movement'
        });
      }
    }

    /* ── Post-workout weight retention ──────────────────── */
    if (scaleEntries && scaleEntries.length >= 3) {
      let hardWorkoutWeightUp = 0; let hardWorkoutChecks = 0;
      for (const d of allDays) {
        if (d.workoutIntensity !== 'hard') continue;
        const scaleNext = scaleEntries.find(s => Storage.daysBetween(d.date, s.date) === 1);
        const scaleSame = scaleEntries.find(s => s.date === d.date);
        if (scaleNext && scaleSame) {
          hardWorkoutChecks++;
          if (scaleNext.weight > scaleSame.weight + 0.4) hardWorkoutWeightUp++;
        }
      }
      if (hardWorkoutChecks >= 3 && hardWorkoutWeightUp / hardWorkoutChecks >= 0.5) {
        insights.push({
          title: 'Hard workouts often show as scale gain',
          noticed: `After ${hardWorkoutChecks} hard sessions, scale weight was higher the next day ${Math.round(hardWorkoutWeightUp / hardWorkoutChecks * 100)}% of the time.`,
          why: 'Intense exercise causes inflammation and fluid shifts — this is not fat. It usually resolves in 24–48 hours.',
          action: 'Do not cut calories after a hard session. Increase water and prioritise protein and sleep.',
          confidence: hardWorkoutChecks >= 5 ? 'high' : 'medium',
          category: 'movement'
        });
      }
    }

    /* ── Cycle and weight retention ─────────────────────── */
    const pmsDays = allDays.filter(d => d.cyclePMS);
    if (pmsDays.length >= 2 && scaleEntries && scaleEntries.length >= 3) {
      const pmsScaleDays = pmsDays.filter(d => scaleEntries.find(s => s.date === d.date));
      const nonPmsScaleDays = allDays.filter(d => !d.cyclePMS && !d.cyclePeriod && scaleEntries.find(s => s.date === d.date));
      if (pmsScaleDays.length >= 2 && nonPmsScaleDays.length >= 4) {
        const avgWeightPMS = Storage.avg(pmsScaleDays.map(d => {
          const s = scaleEntries.find(se => se.date === d.date);
          return s ? s.weight : null;
        }));
        const avgWeightNormal = Storage.avg(nonPmsScaleDays.map(d => {
          const s = scaleEntries.find(se => se.date === d.date);
          return s ? s.weight : null;
        }));
        if (avgWeightPMS && avgWeightNormal && avgWeightPMS - avgWeightNormal >= 0.5) {
          insights.push({
            title: 'Weight is likely higher in luteal/PMS phase',
            noticed: `Scale weight during PMS averages ${avgWeightPMS.toFixed(1)}kg vs ${avgWeightNormal.toFixed(1)}kg on other days.`,
            why: 'Progesterone causes fluid retention in the luteal phase. This is hormonal, not fat gain.',
            action: 'Do not react to scale increases during PMS. Compare weight at the same cycle phase instead.',
            confidence: pmsScaleDays.length >= 4 ? 'high' : 'medium',
            category: 'hormones'
          });
        }
      }
    }

    /* ── Sleep and mood ─────────────────────────────────── */
    const poorSleepDays = allDays.filter(d => d.sleep && d.sleep < 6.5 && d.mood);
    const goodSleepDays = allDays.filter(d => d.sleep && d.sleep >= 7.5 && d.mood);
    if (poorSleepDays.length >= 3 && goodSleepDays.length >= 3) {
      const moodPoor = Storage.avg(poorSleepDays.map(d => d.mood));
      const moodGood = Storage.avg(goodSleepDays.map(d => d.mood));
      if (moodPoor && moodGood && moodGood - moodPoor >= 1.5) {
        insights.push({
          title: 'Sleep and mood are closely linked',
          noticed: `Mood averages ${moodGood.toFixed(1)}/10 after 7.5h+ sleep and ${moodPoor.toFixed(1)}/10 after under 6.5h.`,
          why: 'Sleep affects cortisol, ghrelin and emotional regulation — all of which influence cravings and mood.',
          action: 'Protect sleep as a non-negotiable. Even one better night shifts the next day significantly.',
          confidence: allDays.length >= 10 ? 'high' : 'medium',
          category: 'sleep'
        });
      }
    }

    /* ── Body composition trend ─────────────────────────── */
    if (scaleEntries && scaleEntries.length >= 3) {
      const fatVals = scaleEntries.filter(s => s.bodyFatPercent).map(s => ({ date: s.date, val: s.bodyFatPercent }));
      const muscleVals = scaleEntries.filter(s => s.muscleMass).map(s => ({ date: s.date, val: s.muscleMass }));
      if (fatVals.length >= 3) {
        const fatTrend = fatVals[0].val - fatVals[fatVals.length - 1].val;
        if (fatTrend >= 0.5) {
          insights.push({
            title: 'Body fat percentage trending down',
            noticed: `Fat % has decreased from ${fatVals[fatVals.length-1].val.toFixed(1)}% to ${fatVals[0].val.toFixed(1)}% over ${fatVals.length} readings.`,
            why: 'This suggests a meaningful shift in body composition, not just weight fluctuation.',
            action: 'Keep protein high and maintain the current pattern. Trend is more important than one reading.',
            confidence: fatVals.length >= 5 ? 'high' : 'medium',
            category: 'body-comp'
          });
        }
        if (fatTrend <= -0.8) {
          insights.push({
            title: 'Body fat percentage has increased',
            noticed: `Fat % has moved from ${fatVals[fatVals.length-1].val.toFixed(1)}% to ${fatVals[0].val.toFixed(1)}% over ${fatVals.length} readings.`,
            why: 'This may reflect a calorie surplus, low protein, or reduced activity. Worth watching.',
            action: 'Review protein intake and calorie balance over the last 2–3 weeks before making changes.',
            confidence: fatVals.length >= 5 ? 'medium' : 'low',
            category: 'body-comp'
          });
        }
      }
      if (muscleVals.length >= 3) {
        const muscleTrend = muscleVals[0].val - muscleVals[muscleVals.length - 1].val;
        if (muscleTrend <= -0.5) {
          insights.push({
            title: 'Muscle mass may be declining',
            noticed: `Muscle mass has decreased from ${muscleVals[muscleVals.length-1].val.toFixed(1)}kg to ${muscleVals[0].val.toFixed(1)}kg.`,
            why: 'Muscle loss can occur with insufficient protein or aggressive calorie restriction.',
            action: 'Increase protein to at least ' + Storage.getSettings().proteinTarget + 'g and include resistance training 2–3x per week.',
            confidence: muscleVals.length >= 5 ? 'medium' : 'low',
            category: 'body-comp'
          });
        }
      }
    }

    /* ── Calories and skin ──────────────────────────────── */
    const skinDays = allDays.filter(d => d.skinSymptoms && d.skinSymptoms.length && !d.skinSymptoms.includes('clear'));
    const dairyBeforeSkin = skinDays.filter(d => {
      const prev = allDays.find(p => Storage.daysBetween(p.date, d.date) === 1);
      return prev && prev.foodFlags && prev.foodFlags.includes('dairy');
    });
    if (skinDays.length >= 3 && dairyBeforeSkin.length >= 2 && dairyBeforeSkin.length / skinDays.length >= 0.5) {
      insights.push({
        title: 'Possible pattern: dairy before skin flare-ups',
        noticed: `Dairy was logged the day before ${dairyBeforeSkin.length} of ${skinDays.length} skin symptom days.`,
        why: 'Dairy can trigger hormonal responses that affect skin in some people.',
        action: 'Try a 2-week dairy-reduced period and compare skin symptoms.',
        confidence: 'low',
        category: 'skin'
      });
    }

    /* ── Consistent logging recognition ─────────────────── */
    if (allDays.length >= 7) {
      insights.push({
        title: 'Consistency is building your intelligence',
        noticed: `${allDays.length} days of data logged. Patterns are becoming clearer.`,
        why: 'More consistent logging means more reliable insights and better adaptive guidance.',
        action: 'Keep logging even on imperfect days. Partial data is better than no data.',
        confidence: 'high',
        category: 'setup'
      });
    }

    return insights.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.confidence] - order[b.confidence];
    });
  }

  /* ─────────────────────────────────────────────────────── */
  /* SMART SCALE INTERPRETATION                              */
  /* ─────────────────────────────────────────────────────── */
  function interpretSmartScale(entry, prevEntry, contextDay, settings) {
    const result = {
      improved: [], worsened: [], causes: [], actions: [], summary: '',
      confidence: 'low'
    };
    const s = settings || Storage.getSettings();

    if (!entry) return result;

    /* ── Compare to previous ────────────────────────────── */
    if (prevEntry) {
      const wDiff = entry.weight - prevEntry.weight;
      const fatDiff = (entry.bodyFatPercent || 0) - (prevEntry.bodyFatPercent || 0);
      const muscleDiff = (entry.muscleMass || 0) - (prevEntry.muscleMass || 0);
      const tbwDiff = (entry.totalBodyWaterPercent || 0) - (prevEntry.totalBodyWaterPercent || 0);
      const viscDiff = (entry.visceralFat || 0) - (prevEntry.visceralFat || 0);
      const metAgeDiff = (entry.metabolicAge || 0) - (prevEntry.metabolicAge || 0);

      if (wDiff < -0.2) result.improved.push(`Weight down ${Math.abs(wDiff).toFixed(1)}kg`);
      else if (wDiff > 0.3) result.worsened.push(`Weight up ${wDiff.toFixed(1)}kg`);
      else result.improved.push('Weight stable');

      if (entry.bodyFatPercent) {
        if (fatDiff < -0.3) result.improved.push(`Body fat % down ${Math.abs(fatDiff).toFixed(1)}%`);
        else if (fatDiff > 0.3) result.worsened.push(`Body fat % up ${fatDiff.toFixed(1)}%`);
        else result.improved.push('Body fat % stable');
      }

      if (entry.muscleMass) {
        if (muscleDiff > 0.2) result.improved.push(`Muscle mass up ${muscleDiff.toFixed(1)}kg`);
        else if (muscleDiff < -0.3) result.worsened.push(`Muscle mass down ${Math.abs(muscleDiff).toFixed(1)}kg`);
        else result.improved.push('Muscle mass stable');
      }

      if (entry.totalBodyWaterPercent) {
        if (tbwDiff > 0.5) result.improved.push(`TBW% up ${tbwDiff.toFixed(1)}%`);
        else if (tbwDiff < -1) result.worsened.push(`TBW% down ${Math.abs(tbwDiff).toFixed(1)}% — reading less accurate`);
      }

      if (entry.visceralFat) {
        if (viscDiff < -1) result.improved.push('Visceral fat improved');
        else if (viscDiff > 1) result.worsened.push('Visceral fat slightly higher');
        else result.improved.push('Visceral fat stable');
      }

      if (entry.metabolicAge) {
        if (metAgeDiff < -1) result.improved.push(`Metabolic age down ${Math.abs(metAgeDiff)}yr`);
        else if (metAgeDiff > 1) result.worsened.push(`Metabolic age up ${metAgeDiff}yr`);
      }

      result.confidence = 'medium';
    } else {
      result.improved.push('First scan recorded — baseline established');
      result.confidence = 'low';
    }

    /* ── Identify likely causes ─────────────────────────── */
    let isHydrationIssue = false;
    if (contextDay) {
      const yesterday = contextDay;
      if (yesterday.water && yesterday.water < 1.8) {
        result.causes.push('Low hydration yesterday may be inflating the scale');
        isHydrationIssue = true;
      }
      if (yesterday.foodFlags && yesterday.foodFlags.includes('highSodium')) {
        result.causes.push('High-sodium meal yesterday likely causing temporary water retention');
        isHydrationIssue = true;
      }
      if (yesterday.foodFlags && yesterday.foodFlags.includes('alcohol')) {
        result.causes.push('Alcohol yesterday can cause dehydration and next-day water retention');
        isHydrationIssue = true;
      }
      if (yesterday.workoutIntensity === 'hard') {
        result.causes.push('Hard workout yesterday — muscles retain water during repair');
      }
      if (yesterday.sleep && yesterday.sleep < 6) {
        result.causes.push('Low sleep yesterday elevates cortisol, which increases water retention');
      }
      if (yesterday.cyclePMS || yesterday.cyclePeriod) {
        result.causes.push('Hormonal phase — progesterone causes natural fluid retention');
        isHydrationIssue = true;
      }
    }

    if (entry.totalBodyWaterPercent && entry.totalBodyWaterPercent < 50) {
      if (!isHydrationIssue) result.causes.push('Low TBW% suggests dehydration — body fat reading may be artificially higher');
      isHydrationIssue = true;
    }

    if (result.causes.length === 0) {
      if (prevEntry && entry.weight > prevEntry.weight + 0.3) {
        result.causes.push('No clear single cause identified — may reflect a genuine trend or multiple small factors');
      } else {
        result.causes.push('No significant factors identified');
      }
    }

    /* ── Actions ────────────────────────────────────────── */
    if (isHydrationIssue) {
      result.actions.push('Prioritise 2.5–3L water today');
      result.actions.push('Add electrolytes if you have them');
    }
    if (entry.muscleMass && prevEntry && entry.muscleMass < prevEntry.muscleMass - 0.3) {
      result.actions.push('Muscle mass is slightly down — prioritise protein today (' + s.proteinTarget + 'g target)');
      result.actions.push('Add a resistance session this week if not already planned');
    }
    if (entry.totalBodyWaterPercent && entry.totalBodyWaterPercent < 50) {
      result.actions.push('Reweigh tomorrow morning after drinking 2.5L+ today for a more accurate reading');
    }
    if (contextDay && contextDay.gutSeverity && contextDay.gutSeverity !== 'none') {
      result.actions.push('Keep meals simple today: chicken, rice, eggs, cooked vegetables');
    } else {
      result.actions.push('Protein-led meals today');
    }
    if (contextDay && (contextDay.cyclePMS || contextDay.cyclePeriod)) {
      result.actions.push('No aggressive calorie restriction — aim for maintenance today');
    }
    if (result.actions.length < 2) result.actions.push('Keep protein and water consistent — trend matters more than one reading');

    /* ── Summary sentence ───────────────────────────────── */
    if (prevEntry) {
      const wDiff = entry.weight - prevEntry.weight;
      const tbwLow = entry.totalBodyWaterPercent && entry.totalBodyWaterPercent < 51;
      const hasContextCause = result.causes.length > 0 && result.causes[0] !== 'No significant factors identified';

      if (wDiff > 0.3 && (isHydrationIssue || tbwLow)) {
        result.summary = `Weight is up ${wDiff.toFixed(1)}kg, but ${isHydrationIssue ? 'hydration context and ' : ''}TBW is low${contextDay && contextDay.water < 2 ? ' — you drank under 2L yesterday' : ''}. This looks more like fluid fluctuation than fat gain. Focus on water and consistent meals today.`;
      } else if (wDiff < -0.2) {
        result.summary = `Weight is down ${Math.abs(wDiff).toFixed(1)}kg. ${entry.bodyFatPercent && prevEntry.bodyFatPercent && entry.bodyFatPercent < prevEntry.bodyFatPercent ? 'Body fat % also moved in the right direction. ' : ''}Keep doing what you\'re doing.`;
      } else if (Math.abs(wDiff) <= 0.2) {
        result.summary = `Weight is stable. ${entry.muscleMass && prevEntry.muscleMass && Math.abs(entry.muscleMass - prevEntry.muscleMass) < 0.2 ? 'Muscle mass is holding. ' : ''}Consistency is the goal — this is a good sign.`;
      } else {
        result.summary = `Weight is up ${wDiff.toFixed(1)}kg. ${hasContextCause ? result.causes[0] + '. ' : ''}Review the context below and aim for a steady, protein-led day.`;
      }

      if (contextDay && (contextDay.cyclePMS || contextDay.cyclePeriod)) {
        result.summary += ' Note: hormonal phase context applies — do not compare this reading to non-cycle-day readings.';
      }
    } else {
      result.summary = 'Baseline recorded. Log consistently and the app will begin to interpret changes in context.';
    }

    return result;
  }

  /* ─────────────────────────────────────────────────────── */
  /* WEEKLY REPORT                                           */
  /* ─────────────────────────────────────────────────────── */
  function generateWeeklyReport(weekDays, scaleEntries) {
    const logged = weekDays.filter(d => !d._empty);
    const s = Storage.getSettings();

    const report = {
      daysLogged: logged.length,
      avgCalories: null, avgProtein: null, avgWater: null, avgSteps: null,
      avgMood: null, avgSleep: null, avgEnergy: null,
      workoutsCompleted: 0, bestDay: null, hardestDay: null,
      weightChange: null, fatTrend: null, muscleTrend: null, tbwTrend: null,
      gutPattern: null, skinPattern: null, moodPattern: null,
      weekClassification: 'inconsistent',
      weekClassLabel: 'Inconsistent data',
      biggestWin: '', biggestLeak: '', nextFocus: '', recommendation: ''
    };

    if (logged.length === 0) {
      report.recommendation = 'No data logged this week.';
      return report;
    }

    /* ── Averages ───────────────────────────────────────── */
    report.avgCalories = Math.round(Storage.avg(logged.filter(d => d.calories).map(d => d.calories)));
    report.avgProtein  = Math.round(Storage.avg(logged.filter(d => d.protein).map(d => d.protein)));
    report.avgWater    = parseFloat((Storage.avg(logged.filter(d => d.water).map(d => d.water)) || 0).toFixed(1));
    report.avgSteps    = Math.round(Storage.avg(logged.filter(d => d.steps).map(d => d.steps)));
    report.avgMood     = parseFloat((Storage.avg(logged.filter(d => d.mood).map(d => d.mood)) || 0).toFixed(1));
    report.avgSleep    = parseFloat((Storage.avg(logged.filter(d => d.sleep).map(d => d.sleep)) || 0).toFixed(1));
    report.avgEnergy   = parseFloat((Storage.avg(logged.filter(d => d.energy).map(d => d.energy)) || 0).toFixed(1));
    report.workoutsCompleted = logged.filter(d => d.workoutType && d.workoutType !== 'rest').length;

    /* ── Patterns ───────────────────────────────────────── */
    const gutDaysW = logged.filter(d => d.gutSeverity && d.gutSeverity !== 'none').length;
    if (gutDaysW === 0) report.gutPattern = 'clear';
    else if (gutDaysW <= 2) report.gutPattern = 'occasional';
    else report.gutPattern = 'recurring';

    const skinDaysW = logged.filter(d => d.skinSymptoms && !d.skinSymptoms.includes('clear') && d.skinSymptoms.length).length;
    report.skinPattern = skinDaysW === 0 ? 'clear' : skinDaysW <= 2 ? 'occasional' : 'recurring';

    /* ── Best and hardest day ───────────────────────────── */
    const scored = logged.map(d => ({ ...d, score: Storage.calcGlowScore(d, s) }));
    scored.sort((a, b) => b.score - a.score);
    report.bestDay = scored[0] || null;
    report.hardestDay = scored[scored.length - 1] || null;

    /* ── Scale trend ────────────────────────────────────── */
    const weekScales = scaleEntries.filter(s => {
      const d = new Date(s.date + 'T12:00:00');
      const start = new Date(weekDays[0].date + 'T12:00:00');
      const end = new Date(weekDays[weekDays.length - 1].date + 'T12:00:00');
      return d >= start && d <= end;
    });
    if (weekScales.length >= 2) {
      weekScales.sort((a, b) => a.date.localeCompare(b.date));
      const first = weekScales[0]; const last = weekScales[weekScales.length - 1];
      if (first.weight && last.weight) report.weightChange = parseFloat((last.weight - first.weight).toFixed(1));
      if (first.bodyFatPercent && last.bodyFatPercent) report.fatTrend = parseFloat((last.bodyFatPercent - first.bodyFatPercent).toFixed(1));
      if (first.muscleMass && last.muscleMass) report.muscleTrend = parseFloat((last.muscleMass - first.muscleMass).toFixed(1));
      if (first.totalBodyWaterPercent && last.totalBodyWaterPercent) report.tbwTrend = parseFloat((last.totalBodyWaterPercent - first.totalBodyWaterPercent).toFixed(1));
    }

    /* ── Week classification ────────────────────────────── */
    const pmsDaysW = logged.filter(d => d.cyclePMS || d.cyclePeriod).length;
    const avgCalRatio = report.avgCalories ? report.avgCalories / s.calorieTarget : null;

    if (pmsDaysW >= 3 && report.weightChange > 0.5) {
      report.weekClassification = 'water-retention';
      report.weekClassLabel = 'Water retention week';
    } else if (report.workoutsCompleted <= 1 && report.avgEnergy < 5) {
      report.weekClassification = 'recovery';
      report.weekClassLabel = 'Recovery week';
    } else if (avgCalRatio && avgCalRatio >= 0.85 && avgCalRatio <= 1.1 && report.avgProtein >= s.proteinTarget * 0.85) {
      if (report.fatTrend && report.fatTrend < -0.2) {
        report.weekClassification = 'fat-loss';
        report.weekClassLabel = 'Fat loss week';
      } else {
        report.weekClassification = 'maintenance';
        report.weekClassLabel = 'Maintenance week';
      }
    } else if (logged.length < 4) {
      report.weekClassification = 'inconsistent';
      report.weekClassLabel = 'Inconsistent data';
    } else {
      report.weekClassification = 'maintenance';
      report.weekClassLabel = 'Maintenance week';
    }

    /* ── Wins and leaks ─────────────────────────────────── */
    const wins = [];
    const leaks = [];

    if (report.avgProtein && report.avgProtein >= s.proteinTarget * 0.9) wins.push('Protein was consistently on target');
    else if (report.avgProtein && report.avgProtein < s.proteinTarget * 0.7) leaks.push('Protein consistently below target');

    if (report.avgWater && report.avgWater >= s.waterTarget * 0.9) wins.push('Hydration was on point');
    else if (report.avgWater && report.avgWater < s.waterTarget * 0.7) leaks.push('Hydration was low most days');

    if (report.workoutsCompleted >= 3) wins.push(`${report.workoutsCompleted} workouts completed`);
    else if (report.workoutsCompleted === 0) leaks.push('No movement logged this week');

    if (report.avgSleep && report.avgSleep >= 7.5) wins.push('Sleep was solid');
    else if (report.avgSleep && report.avgSleep < 6.5) leaks.push('Sleep was below 7 hours on average');

    if (report.avgMood && report.avgMood >= 7) wins.push('Mood was high this week');

    report.biggestWin = wins[0] || 'At least some data was logged this week';
    report.biggestLeak = leaks[0] || 'No obvious weak points this week';

    /* ── Next week focus ────────────────────────────────── */
    const focuses = [];
    if (leaks.some(l => l.includes('Protein'))) focuses.push('Protein at every meal — aim for ' + s.proteinTarget + 'g daily');
    if (leaks.some(l => l.includes('Hydration'))) focuses.push('Water above ' + s.waterTarget + 'L before reacting to the scale');
    if (leaks.some(l => l.includes('movement'))) focuses.push('Two movement sessions minimum next week');
    if (leaks.some(l => l.includes('Sleep'))) focuses.push('Protect 7–8 hours sleep — earlier bedtime');
    report.nextFocus = focuses.slice(0, 2).join('. ') || 'Keep the pattern going.';

    /* ── Recommendation ─────────────────────────────────── */
    if (report.weekClassification === 'water-retention') {
      report.recommendation = `This looks like a water-retention week, not a failed fat-loss week. Calories were ${avgCalRatio && avgCalRatio <= 1.1 ? 'mostly controlled' : 'higher'}, but hormonal context likely distorted the scale. Next week: protein earlier, water above ${s.waterTarget}L, and two strength sessions.`;
    } else if (report.weekClassification === 'fat-loss') {
      report.recommendation = `Good week. Calories were controlled, protein was solid and body fat moved in the right direction. Keep the pattern — one week is a signal, two weeks is a trend.`;
    } else if (report.weekClassification === 'recovery') {
      report.recommendation = `Low energy and limited movement this week. That is fine — the body needs rest cycles. Next week, aim for two gentle workouts and refocus on protein and sleep.`;
    } else if (report.weekClassification === 'maintenance') {
      report.recommendation = `A steady maintenance week. No dramatic change in either direction. ${report.biggestWin ? report.biggestWin + '. ' : ''}${report.biggestLeak ? 'Biggest opportunity: ' + report.biggestLeak + '.' : ''}`;
    } else {
      report.recommendation = `Data was incomplete this week, so insights are limited. Even partial logging helps — try to hit at least 5 days next week.`;
    }

    return report;
  }

  return {
    getAdaptiveGuidance,
    generateInsights,
    interpretSmartScale,
    generateWeeklyReport
  };
})();

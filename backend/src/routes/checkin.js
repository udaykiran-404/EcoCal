const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /checkin/today
 * Returns check-in status and data for today.
 */
router.get('/today', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  // Get date in local format (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const checkin = await db('daily_logs')
      .where({ user_id: userId, log_date: todayStr })
      .first();

    return res.json({
      checkinDoneToday: !!checkin,
      checkin: checkin || null
    });
  } catch (error) {
    console.error('Error fetching today checkin status:', error);
    return res.status(500).json({ error: 'Failed to retrieve checkin status.' });
  }
});

/**
 * POST /checkin
 * Saves today's checkin response, computes the delta CO2 based on yes/no modifiers.
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const {
    log_date,
    travelled_more,
    ate_more_meat,
    bought_something,
    higher_electricity,
    is_typical_day
  } = req.body;

  const targetDate = log_date || new Date().toISOString().split('T')[0];

  try {
    // 1. Fetch user baseline to calculate deltas
    const baseline = await db('baseline_profile').where({ user_id: userId }).first();
    if (!baseline) {
      return res.status(400).json({ error: 'Please complete onboarding before logging daily check-ins.' });
    }

    // Proportional breakdown calculations (same as dashboard.js)
    const gridFactor = 0.71;
    let monthlyKwh = baseline.housing_type === 'apartment' ? 100 : 180;
    monthlyKwh += (baseline.household_size - 1) * 20;
    monthlyKwh += (baseline.ac_count || 0) * 60;
    const appliances = JSON.parse(baseline.appliances || '{}');
    if (appliances.geyser) monthlyKwh += 40;
    if (appliances.fridge) monthlyKwh += 30;
    if (appliances.washing_machine) monthlyKwh += 15;
    if (appliances.microwave) monthlyKwh += 10;
    const dailyElecBase = (monthlyKwh * gridFactor) / 30.0;

    let dailyFoodBase = 81.0 / 30.0;
    if (baseline.diet_type === 'vegan') dailyFoodBase = 54.0 / 30.0;
    else if (baseline.diet_type === 'eggetarian') dailyFoodBase = 108.0 / 30.0;
    else if (baseline.diet_type === 'non-vegetarian') {
      const meals = Math.min(90, Math.round(baseline.nonveg_meals_per_week * 4.33));
      dailyFoodBase = ((meals * 2.5) + ((90 - meals) * 0.9)) / 30.0;
    }

    let transportFactor = 0.025;
    if (baseline.commute_mode === 'car') transportFactor = 0.14;
    else if (baseline.commute_mode === 'two-wheeler') transportFactor = 0.04;
    else if (baseline.commute_mode === 'walk') transportFactor = 0.0;
    else if (baseline.commute_mode === 'mixed') transportFactor = 0.06;
    const dailyTransportBase = (parseFloat(baseline.commute_distance_km) || 0) * 22 * transportFactor / 30.0;

    const dailyShoppingBase = 4.0 / 30.0;

    // 2. Compute carbon deltas from modifications
    let delta = 0.0;

    if (!is_typical_day) {
      if (travelled_more) {
        // Commuted extra: +50% transport emissions
        delta += dailyTransportBase * 0.5;
      }
      if (ate_more_meat) {
        // Ate extra meat: +40% food emissions
        delta += dailyFoodBase * 0.4;
      }
      if (higher_electricity) {
        // Longer AC runtime: +30% electricity emissions
        delta += dailyElecBase * 0.3;
      }
      if (bought_something) {
        // Purchased items: +50% shopping emissions
        delta += dailyShoppingBase * 0.5;
      }
    }

    const checkinRecord = {
      user_id: userId,
      log_date: targetDate,
      travelled_more: !!travelled_more,
      ate_more_meat: !!ate_more_meat,
      bought_something: !!bought_something,
      higher_electricity: !!higher_electricity,
      is_typical_day: !!is_typical_day,
      computed_delta_co2_kg: parseFloat(delta.toFixed(2)),
      created_at: new Date()
    };

    // 3. Upsert into daily_logs
    const existing = await db('daily_logs')
      .where({ user_id: userId, log_date: targetDate })
      .first();

    let recordId;
    if (existing) {
      await db('daily_logs')
        .where({ user_id: userId, log_date: targetDate })
        .update(checkinRecord);
      recordId = existing.id;
    } else {
      const crypto = require('crypto');
      recordId = crypto.randomUUID();
      await db('daily_logs').insert({
        id: recordId,
        ...checkinRecord
      });
    }

    return res.json({
      message: 'Daily check-in logged successfully.',
      checkinId: recordId,
      computedDeltaCo2Kg: checkinRecord.computed_delta_co2_kg
    });

  } catch (error) {
    console.error('Error logging daily check-in:', error);
    return res.status(500).json({ error: 'Failed to save daily check-in logs.' });
  }
});

module.exports = router;

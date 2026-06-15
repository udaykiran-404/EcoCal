const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { convertCo2 } = require('../services/carbonService');

/**
 * GET /dashboard
 * Returns the aggregated statistics, grade, category breakdown, today's status, and forecast.
 */
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Fetch baseline profile
    const baseline = await db('baseline_profile').where({ user_id: userId }).first();
    if (!baseline) {
      return res.json({
        hasProfile: false,
        message: 'No baseline profile found. Redirect to onboarding.'
      });
    }

    // 2. Parse category baselines (monthly)
    const baseCo2Monthly = parseFloat(baseline.baseline_co2_kg_monthly);
    
    // Proportional breakdown from onboarding
    const dietType = baseline.diet_type;
    const commuteMode = baseline.commute_mode;
    const commuteDist = parseFloat(baseline.commute_distance_km) || 0;
    
    // Recompute breakdown
    const gridFactor = 0.71;
    const lpgFactor = 42.5;
    const domesticFactor = 250;
    const internationalFactor = 1100;

    // Electricity baseline
    let monthlyKwh = baseline.housing_type === 'apartment' ? 100 : 180;
    monthlyKwh += (baseline.household_size - 1) * 20;
    monthlyKwh += (baseline.ac_count || 0) * 60;
    const appliances = JSON.parse(baseline.appliances || '{}');
    if (appliances.geyser) monthlyKwh += 40;
    if (appliances.fridge) monthlyKwh += 30;
    if (appliances.washing_machine) monthlyKwh += 15;
    if (appliances.microwave) monthlyKwh += 10;
    const baseElec = monthlyKwh * gridFactor;

    // Diet baseline
    let baseFood = 81.0; // veg medium default
    if (dietType === 'vegan') baseFood = 54.0;
    else if (dietType === 'eggetarian') baseFood = 108.0;
    else if (dietType === 'non-vegetarian') {
      const meals = Math.min(90, Math.round(baseline.nonveg_meals_per_week * 4.33));
      baseFood = (meals * 2.5) + ((90 - meals) * 0.9);
    }

    // Commute baseline
    let transportFactor = 0.025; // public
    if (commuteMode === 'car') transportFactor = 0.14;
    else if (commuteMode === 'two-wheeler') transportFactor = 0.04;
    else if (commuteMode === 'walk') transportFactor = 0.0;
    else if (commuteMode === 'mixed') transportFactor = 0.06;
    const baseTransport = commuteDist * 22 * transportFactor;

    // LPG, Flights, Shopping baseline
    const baseLpg = baseline.lpg_cylinders_per_month * lpgFactor;
    const baseFlights = ((baseline.domestic_flights_per_year * domesticFactor) + (baseline.international_flights_per_year * internationalFactor)) / 12.0;
    const baseShopping = 4.0; // standard default

    const breakdown = {
      electricity: baseElec,
      food: baseFood,
      transport: baseTransport,
      lpg: baseLpg,
      flights: baseFlights,
      shopping: baseShopping
    };

    // 3. Calculate Days in Current Month and Elapsed Days
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate(); // 1-indexed

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = currentDay;

    // Format start and end date strings for current month queries
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    const endOfMonth = new Date(currentYear, currentMonth, daysInMonth).toISOString().split('T')[0];

    // 4. Fetch Actuals from database for current month
    const dailyLogs = await db('daily_logs')
      .where({ user_id: userId })
      .andWhere('log_date', '>=', startOfMonth)
      .andWhere('log_date', '<=', endOfMonth);

    const captures = await db('captures')
      .where({ user_id: userId })
      .andWhere('captured_at', '>=', startOfMonth + 'T00:00:00.000Z')
      .andWhere('captured_at', '<=', endOfMonth + 'T23:59:59.999Z');

    // Create a maps for quick lookup of check-in and overrides
    const logMap = new Map();
    dailyLogs.forEach(log => {
      // log_date might be Date object or string depending on sqlite driver
      const dateStr = new Date(log.log_date).toISOString().split('T')[0];
      logMap.set(dateStr, log);
    });

    const capturesMap = new Map();
    captures.forEach(c => {
      const dateStr = new Date(c.captured_at).toISOString().split('T')[0];
      if (!capturesMap.has(dateStr)) {
        capturesMap.set(dateStr, []);
      }
      capturesMap.get(dateStr).push(c);
    });

    // 5. Daily emissions aggregator (Day 1 to Days Elapsed)
    let actualCo2SoFar = 0.0;
    
    // We break down the actual values for chart display
    const actualBreakdown = {
      electricity: 0,
      food: 0,
      transport: 0,
      lpg: 0,
      flights: 0,
      shopping: 0
    };

    // Calculate baseline proportional to elapsed days
    const dailyBase = {
      electricity: baseElec / 30,
      food: baseFood / 30,
      transport: baseTransport / 30,
      lpg: baseLpg / 30,
      flights: baseFlights / 30,
      shopping: baseShopping / 30
    };

    for (let day = 1; day <= daysElapsed; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const checkin = logMap.get(dateStr);
      const dayCaptures = capturesMap.get(dateStr) || [];

      // Check capture overrides per category
      const foodCapture = dayCaptures.find(c => c.capture_type === 'food');
      const electricityCapture = dayCaptures.find(c => c.capture_type === 'electricity_bill');
      const receiptCapture = dayCaptures.find(c => c.capture_type === 'receipt');

      // Electricity
      if (electricityCapture) {
        actualBreakdown.electricity += parseFloat(electricityCapture.estimated_co2_kg);
      } else {
        // Apply check-in modifier or use baseline
        let modifier = 1.0;
        if (checkin && checkin.higher_electricity) modifier = 1.3;
        actualBreakdown.electricity += dailyBase.electricity * modifier;
      }

      // Food
      if (foodCapture) {
        actualBreakdown.food += parseFloat(foodCapture.estimated_co2_kg);
      } else {
        let modifier = 1.0;
        if (checkin && checkin.ate_more_meat) modifier = 1.4;
        actualBreakdown.food += dailyBase.food * modifier;
      }

      // Transport (commuting)
      // Captures don't directly override commute in v1, only daily checkin delta
      let transportMod = 1.0;
      if (checkin && checkin.travelled_more) transportMod = 1.5;
      actualBreakdown.transport += dailyBase.transport * transportMod;

      // Shopping / Receipts
      if (receiptCapture) {
        actualBreakdown.shopping += parseFloat(receiptCapture.estimated_co2_kg);
      } else {
        let modifier = 1.0;
        if (checkin && checkin.bought_something) modifier = 1.5;
        actualBreakdown.shopping += dailyBase.shopping * modifier;
      }

      // LPG & Flights (use daily baseline proportional)
      actualBreakdown.lpg += dailyBase.lpg;
      actualBreakdown.flights += dailyBase.flights;
    }

    // Sum total actuals so far
    actualCo2SoFar = 
      actualBreakdown.electricity + 
      actualBreakdown.food + 
      actualBreakdown.transport + 
      actualBreakdown.shopping + 
      actualBreakdown.lpg + 
      actualBreakdown.flights;

    // 6. Calculate Carbon Grade
    const baselineElapsed = (baseCo2Monthly / 30) * daysElapsed;
    const ratio = baselineElapsed > 0 ? (actualCo2SoFar / baselineElapsed) : 1.0;
    
    let grade = 'B+';
    let contextPhrase = 'Better than 60% of similar households';
    
    if (ratio <= 0.80) {
      grade = 'A';
      contextPhrase = 'Exceptional! 20% lower than similar households';
    } else if (ratio <= 0.95) {
      grade = 'B+';
      contextPhrase = 'Great! Better than 60% of similar households';
    } else if (ratio <= 1.05) {
      grade = 'B';
      contextPhrase = 'On track. Average emissions for similar households';
    } else if (ratio <= 1.20) {
      grade = 'C';
      contextPhrase = '15% higher than similar households. Focus on transport & energy.';
    } else {
      grade = 'D';
      contextPhrase = 'Action needed. Emitting far more than baseline.';
    }

    // 7. Check if today's check-in has been completed
    const todayStr = now.toISOString().split('T')[0];
    const todayCheckin = logMap.get(todayStr);
    const checkinDoneToday = !!todayCheckin;

    // 8. Forecast projections (Section 5.8)
    // X = actuals so far / daysElapsed * daysInMonth
    const forecastX = (actualCo2SoFar / daysElapsed) * daysInMonth;
    
    // Find the user's top emission categories to suggest reduction Y
    const highestCategory = Object.keys(breakdown).reduce((a, b) => breakdown[a] > breakdown[b] ? a : b);
    let reductionPercentage = 0.10; // default 10%
    let recommendationText = 'reduce AC runtime';
    
    if (highestCategory === 'transport') {
      reductionPercentage = 0.15; // 15% reduction for switching to transit
      recommendationText = 'switching 2 commutes to public transit';
    } else if (highestCategory === 'food') {
      reductionPercentage = 0.12;
      recommendationText = 'having 2 meat-free days per week';
    } else if (highestCategory === 'electricity') {
      reductionPercentage = 0.10;
      recommendationText = 'reducing AC usage by 1 hour daily';
    }

    const forecastY = forecastX * (1 - reductionPercentage);

    // Get equivalents for displays
    const actualEquivalents = await convertCo2(actualCo2SoFar, 'all', highestCategory);
    
    // Sparkline mock trend data (last 7 days of actuals vs baseline daily average)
    const sparkline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const check = logMap.get(dStr);
      let dayTotal = (baseCo2Monthly / 30);
      if (check) {
        // adjust by average modifier weight if check-in exists
        let weight = 1.0;
        if (check.travelled_more) weight += 0.1;
        if (check.ate_more_meat) weight += 0.1;
        if (check.higher_electricity) weight += 0.1;
        dayTotal = dayTotal * weight;
      }
      sparkline.push(parseFloat(dayTotal.toFixed(1)));
    }

    // 9. Monthly Electricity Bill Prompt Check
    const latestBill = await db('captures')
      .where({ user_id: userId, capture_type: 'electricity_bill' })
      .orderBy('captured_at', 'desc')
      .first();

    let showElectricityPrompt = true;
    let daysSinceLastBill = null;

    if (latestBill) {
      const lastUploadDate = new Date(latestBill.captured_at);
      const diffTime = Math.abs(now.getTime() - lastUploadDate.getTime());
      daysSinceLastBill = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      showElectricityPrompt = daysSinceLastBill >= 30;
    }

    return res.json({
      hasProfile: true,
      grade,
      contextPhrase,
      monthlyTotalCo2Kg: parseFloat(actualCo2SoFar.toFixed(1)),
      monthlyBaselineCo2Kg: baseCo2Monthly,
      treesEquivalent: actualEquivalents.trees,
      moneyEquivalent: actualEquivalents.money,
      petrolEquivalent: actualEquivalents.petrol,
      categoryBreakdown: {
        Transport: parseFloat(actualBreakdown.transport.toFixed(1)),
        Food: parseFloat(actualBreakdown.food.toFixed(1)),
        Electricity: parseFloat(actualBreakdown.electricity.toFixed(1)),
        Shopping: parseFloat(actualBreakdown.shopping.toFixed(1)),
        LPG: parseFloat(actualBreakdown.lpg.toFixed(1)),
        Flights: parseFloat(actualBreakdown.flights.toFixed(1))
      },
      checkinDoneToday,
      showElectricityPrompt,
      daysSinceLastBill,
      forecast: {
        currentTrajectory: parseFloat(forecastX.toFixed(1)),
        targetTrajectory: parseFloat(forecastY.toFixed(1)),
        recommendation: `Following our suggestion (${recommendationText}) could reduce emissions by ${Math.round(reductionPercentage * 100)}% this month.`
      },
      sparkline
    });

  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    return res.status(500).json({ error: 'Failed to retrieve dashboard statistics.' });
  }
});

module.exports = router;

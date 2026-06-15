const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { calculateOnboardingBaseline, convertCo2 } = require('../services/carbonService');

/**
 * POST /onboarding
 * Receives the onboarding survey responses, computes baseline footprint, and saves to database.
 */
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.userId;
  const {
    housing_type,
    household_size,
    ac_count,
    diet_type,
    nonveg_meals_per_week,
    commute_mode,
    commute_distance_km,
    appliances,
    lpg_cylinders_per_month,
    domestic_flights_per_year,
    international_flights_per_year
  } = req.body;

  const profile = {
    housing_type: housing_type || 'apartment',
    household_size: parseInt(household_size) || 1,
    ac_count: parseInt(ac_count) || 0,
    diet_type: diet_type || 'vegetarian',
    nonveg_meals_per_week: parseInt(nonveg_meals_per_week) || 0,
    commute_mode: commute_mode || 'public',
    commute_distance_km: parseFloat(commute_distance_km) || 0.0,
    appliances: typeof appliances === 'object' ? JSON.stringify(appliances) : appliances || '{}',
    lpg_cylinders_per_month: parseFloat(lpg_cylinders_per_month) || 1.0,
    domestic_flights_per_year: parseInt(domestic_flights_per_year) || 0,
    international_flights_per_year: parseInt(international_flights_per_year) || 0
  };

  try {
    // 1. Calculate baseline footprint
    const baselineResults = await calculateOnboardingBaseline(profile);

    // 2. Prepare database record
    const dbRecord = {
      user_id: userId,
      housing_type: profile.housing_type,
      household_size: profile.household_size,
      ac_count: profile.ac_count,
      diet_type: profile.diet_type,
      nonveg_meals_per_week: profile.nonveg_meals_per_week,
      commute_mode: profile.commute_mode,
      commute_distance_km: profile.commute_distance_km,
      appliances: profile.appliances,
      lpg_cylinders_per_month: profile.lpg_cylinders_per_month,
      domestic_flights_per_year: profile.domestic_flights_per_year,
      international_flights_per_year: profile.international_flights_per_year,
      baseline_co2_kg_monthly: baselineResults.total,
      created_at: new Date()
    };

    // 3. Insert or update in database
    const existing = await db('baseline_profile').where({ user_id: userId }).first();
    if (existing) {
      await db('baseline_profile').where({ user_id: userId }).update(dbRecord);
    } else {
      await db('baseline_profile').insert(dbRecord);
    }

    // 4. Convert to relatable tree equivalents
    const equivalents = await convertCo2(baselineResults.total * 12, 'all'); // Annual equivalent

    return res.json({
      message: 'Baseline profile successfully saved.',
      baselineMonthlyCo2Kg: baselineResults.total,
      breakdown: baselineResults.breakdown,
      annualTreesEquivalent: equivalents.trees, // e.g., how many trees needed to absorb this footprint annually
      petrolLitresEquivalent: equivalents.petrol
    });

  } catch (error) {
    console.error('Error during onboarding calculation/save:', error);
    return res.status(500).json({ error: 'Failed to process onboarding baseline calculation.' });
  }
});

module.exports = router;

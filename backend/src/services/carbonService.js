const db = require('../config/db');

// Cache for emission factors to prevent excessive database hits
let factorCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Dynamically resolves and returns all emission factors.
 * Refreshes from the database if cache has expired or is empty.
 */
async function getFactors() {
  const now = Date.now();
  if (factorCache && cacheTimestamp && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return factorCache;
  }

  const factorsList = await db('emission_factors').select('key', 'value');
  const factors = {};
  factorsList.forEach(item => {
    factors[item.key] = parseFloat(item.value);
  });

  factorCache = factors;
  cacheTimestamp = now;
  return factors;
}

/**
 * Clears the emission factors cache, forcing a reload on the next query.
 */
function clearCache() {
  factorCache = null;
  cacheTimestamp = null;
}

/**
 * Translates raw kg CO2 into human-relatable equivalents
 * @param {number} kg - The raw CO2 weight in kilograms
 * @param {string} type - 'trees' | 'petrol' | 'money' | 'all'
 * @param {string} category - For category-specific money savings, optional
 */
async function convertCo2(kg, type = 'all', category = null) {
  const factors = await getFactors();
  
  const treeFactor = factors['co2_per_tree_year'] || 21.0;
  const petrolFactor = factors['co2_per_litre_petrol'] || 2.3;
  const electricityTariff = factors['money_saved_per_kwh_inr'] || 8.0;
  const gridFactor = factors['electricity_grid_avg_india'] || 0.71;

  // 1 tree absorbs ~21kg CO2/year. Therefore, CO2 emitted is equivalent to N trees worth of absorption for 1 year.
  const trees = kg / treeFactor;
  // 1 litre of petrol emissions is ~2.3kg CO2.
  const petrol = kg / petrolFactor;
  
  // Money calculations are category-specific where possible
  let money = 0;
  if (category === 'electricity' || category === 'Electricity') {
    // 1 kWh consumed is ~0.71 kg CO2. Money saved = (kg / 0.71) * ₹8 tariff
    money = (kg / gridFactor) * electricityTariff;
  } else if (category === 'transport' || category === 'Transport') {
    // For transport, estimate savings based on average fuel cost.
    // 1 L petrol ≈ 2.3 kg CO2 ≈ ₹100. Money saved = litres of petrol equivalent * 100.
    money = petrol * 100;
  } else {
    // Generic fallback: Blend of power and fuel savings
    money = (kg / gridFactor) * electricityTariff * 0.5 + petrol * 100 * 0.5;
  }

  const result = {
    kg: parseFloat(kg.toFixed(2)),
    trees: parseFloat(trees.toFixed(1)),
    petrol: parseFloat(petrol.toFixed(1)),
    money: Math.round(money)
  };

  if (type === 'all') return result;
  return result[type];
}

/**
 * Computes baseline monthly footprint from onboarding questionnaire
 */
async function calculateOnboardingBaseline(profile) {
  const factors = await getFactors();

  // 1. Electricity / Housing & Appliances
  let monthlyKwh = 0;
  if (profile.housing_type === 'apartment') {
    monthlyKwh += 100;
  } else {
    monthlyKwh += 180; // independent house
  }
  
  // Add per household size
  const hhSize = profile.household_size || 1;
  monthlyKwh += (hhSize - 1) * 20;

  // AC ownership
  const acCount = profile.ac_count || 0;
  monthlyKwh += acCount * 60;

  // Appliances checklist
  const appliances = typeof profile.appliances === 'string'
    ? JSON.parse(profile.appliances)
    : (profile.appliances || {});
  
  if (appliances.geyser) monthlyKwh += 40;
  if (appliances.fridge) monthlyKwh += 30;
  if (appliances.washing_machine) monthlyKwh += 15;
  if (appliances.microwave) monthlyKwh += 10;

  const gridFactor = factors['electricity_grid_avg_india'] || 0.71;
  const electricityBaseline = monthlyKwh * gridFactor;

  // 2. Diet
  // Standard assumption: 90 meals per month (3 meals * 30 days)
  let dietBaseline = 0;
  const dietType = profile.diet_type || 'vegetarian';
  
  if (dietType === 'vegan') {
    const factor = factors['food_vegan_medium'] || 0.6;
    dietBaseline = 90 * factor;
  } else if (dietType === 'vegetarian') {
    const factor = factors['food_vegetarian_medium'] || 0.9;
    dietBaseline = 90 * factor;
  } else if (dietType === 'eggetarian') {
    const factor = factors['food_eggetarian_medium'] || 1.2;
    dietBaseline = 90 * factor;
  } else if (dietType === 'non-vegetarian') {
    const nonvegMealsPerWeek = profile.nonveg_meals_per_week || 2;
    // Monthly non-veg meals (avg 4.33 weeks per month)
    const monthlyNonvegMeals = Math.min(90, Math.round(nonvegMealsPerWeek * 4.33));
    const monthlyVegMeals = 90 - monthlyNonvegMeals;
    
    const nonvegFactor = factors['food_nonveg_medium'] || 2.5;
    const vegFactor = factors['food_vegetarian_medium'] || 0.9;
    
    dietBaseline = (monthlyNonvegMeals * nonvegFactor) + (monthlyVegMeals * vegFactor);
  }

  // 3. Commute
  // Commute distance km per day. Assume 22 commuting days per month
  let commuteBaseline = 0;
  const mode = profile.commute_mode || 'public';
  const dailyDist = parseFloat(profile.commute_distance_km) || 0;
  const monthlyDist = dailyDist * 22;

  let modeKey = 'transport_public_per_km';
  if (mode === 'car') modeKey = 'transport_car_per_km';
  else if (mode === 'two-wheeler') modeKey = 'transport_two_wheeler_per_km';
  else if (mode === 'walk') modeKey = 'transport_walk_per_km';
  else if (mode === 'mixed') modeKey = 'transport_mixed_per_km';

  const transportFactor = factors[modeKey] || 0.025;
  commuteBaseline = monthlyDist * transportFactor;

  // 4. LPG cylinders
  const lpgCylinders = parseFloat(profile.lpg_cylinders_per_month) || 1.0;
  const lpgFactor = factors['lpg_per_cylinder'] || 42.5;
  const lpgBaseline = lpgCylinders * lpgFactor;

  // 5. Air Travel (divided by 12 to get monthly estimate)
  const domesticFlights = parseInt(profile.domestic_flights_per_year) || 0;
  const internationalFlights = parseInt(profile.international_flights_per_year) || 0;
  
  const domesticFactor = factors['flight_domestic'] || 250.0;
  const internationalFactor = factors['flight_international'] || 1100.0;
  
  const flightsBaseline = ((domesticFlights * domesticFactor) + (internationalFlights * internationalFactor)) / 12.0;

  // Shopping Baseline (default estimate - not explicitly surveyed during onboarding, assume standard baseline)
  // Let's assume standard default shopping of ₹2000 per month
  const shoppingBaseline = 20 * (factors['shopping_other_per_100inr'] || 0.2);

  const totalBaseline = electricityBaseline + dietBaseline + commuteBaseline + lpgBaseline + flightsBaseline + shoppingBaseline;

  return {
    breakdown: {
      electricity: parseFloat(electricityBaseline.toFixed(2)),
      food: parseFloat(dietBaseline.toFixed(2)),
      transport: parseFloat(commuteBaseline.toFixed(2)),
      lpg: parseFloat(lpgBaseline.toFixed(2)),
      flights: parseFloat(flightsBaseline.toFixed(2)),
      shopping: parseFloat(shoppingBaseline.toFixed(2))
    },
    total: parseFloat(totalBaseline.toFixed(2))
  };
}

module.exports = {
  getFactors,
  clearCache,
  convertCo2,
  calculateOnboardingBaseline
};

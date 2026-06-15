exports.seed = async function(knex) {
  // Deletes ALL existing entries in the factors table
  await knex('emission_factors').del();

  await knex('emission_factors').insert([
    // Food emission factors (kg CO2 per meal)
    { key: 'food_vegetarian_small', value: 0.6, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_vegetarian_medium', value: 0.9, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_vegetarian_large', value: 1.3, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    
    { key: 'food_nonveg_small', value: 1.8, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_nonveg_medium', value: 2.5, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_nonveg_large', value: 3.5, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    
    { key: 'food_vegan_small', value: 0.4, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_vegan_medium', value: 0.6, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_vegan_large', value: 0.9, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    
    { key: 'food_eggetarian_small', value: 0.8, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_eggetarian_medium', value: 1.2, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },
    { key: 'food_eggetarian_large', value: 1.7, unit: 'kg_co2_per_meal', source: 'India GHG Program Estimate' },

    // Grid Average Electricity factor (kg CO2 per kWh)
    { key: 'electricity_grid_avg_india', value: 0.71, unit: 'kg_co2_per_kwh', source: 'CEA CO2 Baseline Database v19' },

    // LPG Cylinders factor (kg CO2 per cylinder - standard domestic size 14.2 kg)
    { key: 'lpg_per_cylinder', value: 42.5, unit: 'kg_co2_per_cylinder', source: 'Standard domestic LPG carbon value' },

    // Travel (flights) factor (kg CO2 per flight)
    { key: 'flight_domestic', value: 250.0, unit: 'kg_co2_per_flight', source: 'ICAO Carbon Emissions Calculator' },
    { key: 'flight_international', value: 1100.0, unit: 'kg_co2_per_flight', source: 'ICAO Carbon Emissions Calculator' },

    // Local commuting factors (kg CO2 per km)
    { key: 'transport_car_per_km', value: 0.14, unit: 'kg_co2_per_km', source: 'MoRTH Indian vehicular average' },
    { key: 'transport_two_wheeler_per_km', value: 0.04, unit: 'kg_co2_per_km', source: 'MoRTH Indian vehicular average' },
    { key: 'transport_public_per_km', value: 0.025, unit: 'kg_co2_per_km', source: 'Public bus/metro average emissions' },
    { key: 'transport_walk_per_km', value: 0.0, unit: 'kg_co2_per_km', source: 'Zero emissions' },
    { key: 'transport_mixed_per_km', value: 0.06, unit: 'kg_co2_per_km', source: 'Weighted average of public, car, and two-wheeler' },

    // Retail Shopping factors (kg CO2 per INR spent, scaled per 100 INR)
    { key: 'shopping_groceries_veg_per_100inr', value: 0.10, unit: 'kg_co2_per_100inr', source: 'Estimated product lifecycle carbon' },
    { key: 'shopping_groceries_packaged_per_100inr', value: 0.20, unit: 'kg_co2_per_100inr', source: 'Estimated product lifecycle carbon' },
    { key: 'shopping_clothing_per_100inr', value: 0.50, unit: 'kg_co2_per_100inr', source: 'Fast fashion lifecycle analysis' },
    { key: 'shopping_electronics_per_100inr', value: 0.40, unit: 'kg_co2_per_100inr', source: 'Device manufacture lifecycle analysis' },
    { key: 'shopping_household_per_100inr', value: 0.30, unit: 'kg_co2_per_100inr', source: 'Consumer goods lifecycle analysis' },
    { key: 'shopping_other_per_100inr', value: 0.20, unit: 'kg_co2_per_100inr', source: 'Generic average lifecycle factor' },

    // Conversions equivalents constants
    { key: 'co2_per_tree_year', value: 21.0, unit: 'kg_co2_absorbed_per_year', source: 'IPCC standard tree sequestration' },
    { key: 'co2_per_litre_petrol', value: 2.3, unit: 'kg_co2_per_litre', source: 'Standard petrol combustion emissions' },
    { key: 'money_saved_per_kwh_inr', value: 8.0, unit: 'inr_saved_per_kwh', source: 'Average domestic electricity tariff' }
  ]);
};

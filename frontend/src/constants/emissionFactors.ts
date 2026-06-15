export const EMISSION_FACTORS: Record<string, number> = {
  // Food emission factors (kg CO2 per meal)
  'food_vegetarian_small': 0.6,
  'food_vegetarian_medium': 0.9,
  'food_vegetarian_large': 1.3,
  
  'food_nonveg_small': 1.8,
  'food_nonveg_medium': 2.5,
  'food_nonveg_large': 3.5,
  
  'food_vegan_small': 0.4,
  'food_vegan_medium': 0.6,
  'food_vegan_large': 0.9,
  
  'food_eggetarian_small': 0.8,
  'food_eggetarian_medium': 1.2,
  'food_eggetarian_large': 1.7,

  // Grid Average Electricity factor (kg CO2 per kWh)
  'electricity_grid_avg_india': 0.71,

  // LPG Cylinders factor (kg CO2 per cylinder - standard domestic size 14.2 kg)
  'lpg_per_cylinder': 42.5,

  // Travel (flights) factor (kg CO2 per flight)
  'flight_domestic': 250.0,
  'flight_international': 1100.0,

  // Local commuting factors (kg CO2 per km)
  'transport_car_per_km': 0.14,
  'transport_two_wheeler_per_km': 0.04,
  'transport_public_per_km': 0.025,
  'transport_walk_per_km': 0.0,
  'transport_mixed_per_km': 0.06,

  // Retail Shopping factors (kg CO2 per INR spent, scaled per 100 INR)
  'shopping_groceries_veg_per_100inr': 0.10,
  'shopping_groceries_packaged_per_100inr': 0.20,
  'shopping_clothing_per_100inr': 0.50,
  'shopping_electronics_per_100inr': 0.40,
  'shopping_household_per_100inr': 0.30,
  'shopping_other_per_100inr': 0.20,

  // Conversions equivalents constants
  'co2_per_tree_year': 21.0,
  'co2_per_litre_petrol': 2.3,
  'money_saved_per_kwh_inr': 8.0
};

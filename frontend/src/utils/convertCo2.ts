/**
 * Translates raw kg CO2 into human-relatable equivalents
 * Match the backend constants:
 * - 1 tree absorbs ≈ 21 kg CO2/year -> trees_equivalent = co2_kg / 21
 * - 1 litre petrol ≈ 2.3 kg CO2 -> fuel_litres_equivalent = co2_kg / 2.3
 * - 1 kWh saved ≈ ₹8.0 saved
 */
export interface Co2Equivalents {
  kg: number;
  trees: number;
  petrol: number;
  money: number;
}

export function convertCo2(kg: number, category: string | null = null): Co2Equivalents {
  const treeFactor = 21.0;
  const petrolFactor = 2.3;
  const electricityTariff = 8.0;
  const gridFactor = 0.71;

  const trees = kg / treeFactor;
  const petrol = kg / petrolFactor;

  let money = 0;
  if (category === 'electricity' || category === 'Electricity') {
    money = (kg / gridFactor) * electricityTariff;
  } else if (category === 'transport' || category === 'Transport') {
    money = petrol * 100; // Estimated fuel savings (approx Rs 100/litre)
  } else {
    money = (kg / gridFactor) * electricityTariff * 0.5 + petrol * 100 * 0.5;
  }

  return {
    kg: parseFloat(kg.toFixed(1)),
    trees: parseFloat(trees.toFixed(1)),
    petrol: parseFloat(petrol.toFixed(1)),
    money: Math.round(money),
  };
}

export function formatCo2Equivalent(kg: number, type: 'trees' | 'petrol' | 'money'): string {
  const equivalents = convertCo2(kg);
  switch (type) {
    case 'trees':
      return `≈ ${equivalents.trees} trees absorption / yr`;
    case 'petrol':
      return `≈ ${equivalents.petrol} litres of petrol`;
    case 'money':
      return `≈ ₹${equivalents.money.toLocaleString('en-IN')} saved`;
    default:
      return `${kg.toFixed(1)} kg CO₂`;
  }
}

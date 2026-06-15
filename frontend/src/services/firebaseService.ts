import { db } from '../config/firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc
} from 'firebase/firestore';
import { EMISSION_FACTORS } from '../constants/emissionFactors';
import { groqService } from './groqService';

// --- Interface Definitions ---
export interface BaselineProfile {
  housing_type: 'apartment' | 'independent';
  household_size: number;
  ac_count: number;
  diet_type: 'vegan' | 'vegetarian' | 'eggetarian' | 'non-vegetarian';
  nonveg_meals_per_week: number;
  commute_mode: 'walk' | 'two-wheeler' | 'car' | 'public' | 'mixed';
  commute_distance_km: number;
  appliances: {
    ac?: boolean;
    fridge?: boolean;
    washing_machine?: boolean;
    geyser?: boolean;
    microwave?: boolean;
  };
  lpg_cylinders_per_month: number;
  domestic_flights_per_year: number;
  international_flights_per_year: number;
  custom_housing?: string;
  custom_diet?: string;
  custom_commute?: string;
  custom_appliances?: string;
  custom_lpg?: string;
  custom_flights?: string;
  baseline_co2_kg_monthly?: number;
  created_at?: string;
}

export interface CheckinData {
  log_date?: string; // YYYY-MM-DD
  travelled_more: boolean;
  ate_more_meat: boolean;
  bought_something: boolean;
  higher_electricity: boolean;
  is_typical_day: boolean;
  custom_notes?: string;
}

export interface CaptureRecord {
  id: string;
  user_id: string;
  capture_type: 'food' | 'electricity_bill' | 'receipt';
  image_url: string;
  ai_raw_response: string;
  confirmed_data: string | null;
  was_manual_fallback: boolean;
  estimated_co2_kg: number;
  captured_at: string;
}

// --- Helper Carbon Calculation Utilities ---
export function convertCo2(kg: number, category: string | null = null) {
  const treeFactor = EMISSION_FACTORS['co2_per_tree_year'] || 21.0;
  const petrolFactor = EMISSION_FACTORS['co2_per_litre_petrol'] || 2.3;
  const electricityTariff = EMISSION_FACTORS['money_saved_per_kwh_inr'] || 8.0;
  const gridFactor = EMISSION_FACTORS['electricity_grid_avg_india'] || 0.71;

  const trees = kg / treeFactor;
  const petrol = kg / petrolFactor;

  let money = 0;
  if (category === 'electricity' || category === 'Electricity') {
    money = (kg / gridFactor) * electricityTariff;
  } else if (category === 'transport' || category === 'Transport') {
    money = petrol * 100;
  } else {
    money = (kg / gridFactor) * electricityTariff * 0.5 + petrol * 100 * 0.5;
  }

  return {
    kg: parseFloat(kg.toFixed(1)),
    trees: parseFloat(trees.toFixed(1)),
    petrol: parseFloat(petrol.toFixed(1)),
    money: Math.round(money)
  };
}

export function calculateOnboardingBaseline(profile: BaselineProfile) {
  // 1. Electricity / Housing & Appliances
  let monthlyKwh = profile.housing_type === 'apartment' ? 100 : 180;
  monthlyKwh += (profile.household_size - 1) * 20;
  monthlyKwh += (profile.ac_count || 0) * 60;

  const apps = profile.appliances || {};
  if (apps.geyser) monthlyKwh += 40;
  if (apps.fridge) monthlyKwh += 30;
  if (apps.washing_machine) monthlyKwh += 15;
  if (apps.microwave) monthlyKwh += 10;

  const gridFactor = EMISSION_FACTORS['electricity_grid_avg_india'] || 0.71;
  const electricityBaseline = monthlyKwh * gridFactor;

  // 2. Diet
  let dietBaseline = 0;
  const dietType = profile.diet_type || 'vegetarian';
  
  if (dietType === 'vegan') {
    dietBaseline = 90 * (EMISSION_FACTORS['food_vegan_medium'] || 0.6);
  } else if (dietType === 'vegetarian') {
    dietBaseline = 90 * (EMISSION_FACTORS['food_vegetarian_medium'] || 0.9);
  } else if (dietType === 'eggetarian') {
    dietBaseline = 90 * (EMISSION_FACTORS['food_eggetarian_medium'] || 1.2);
  } else if (dietType === 'non-vegetarian') {
    const nonvegMealsPerWeek = profile.nonveg_meals_per_week || 2;
    const monthlyNonvegMeals = Math.min(90, Math.round(nonvegMealsPerWeek * 4.33));
    const monthlyVegMeals = 90 - monthlyNonvegMeals;
    
    dietBaseline = (monthlyNonvegMeals * (EMISSION_FACTORS['food_nonveg_medium'] || 2.5)) + 
                   (monthlyVegMeals * (EMISSION_FACTORS['food_vegetarian_medium'] || 0.9));
  }

  // 3. Commute
  const mode = profile.commute_mode || 'public';
  const dailyDist = profile.commute_distance_km || 0;
  const monthlyDist = dailyDist * 22;

  let modeKey = 'transport_public_per_km';
  if (mode === 'car') modeKey = 'transport_car_per_km';
  else if (mode === 'two-wheeler') modeKey = 'transport_two_wheeler_per_km';
  else if (mode === 'walk') modeKey = 'transport_walk_per_km';
  else if (mode === 'mixed') modeKey = 'transport_mixed_per_km';

  const transportFactor = EMISSION_FACTORS[modeKey] || 0.025;
  const commuteBaseline = monthlyDist * transportFactor;

  // 4. LPG cylinders
  const lpgCylinders = profile.lpg_cylinders_per_month || 1.0;
  const lpgFactor = EMISSION_FACTORS['lpg_per_cylinder'] || 42.5;
  const lpgBaseline = lpgCylinders * lpgFactor;

  // 5. Air Travel
  const domesticFlights = profile.domestic_flights_per_year || 0;
  const internationalFlights = profile.international_flights_per_year || 0;
  
  const domesticFactor = EMISSION_FACTORS['flight_domestic'] || 250.0;
  const internationalFactor = EMISSION_FACTORS['flight_international'] || 1100.0;
  
  const flightsBaseline = ((domesticFlights * domesticFactor) + (internationalFlights * internationalFactor)) / 12.0;

  // Shopping Baseline
  const shoppingBaseline = 20 * (EMISSION_FACTORS['shopping_other_per_100inr'] || 0.2);

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

// --- Firebase Service Implementation ---
export const firebaseService = {
  // Onboarding Profile Actions
  async saveOnboardingProfile(userId: string, profile: BaselineProfile) {
    const baselineResults = calculateOnboardingBaseline(profile);
    const dbRecord = {
      ...profile,
      baseline_co2_kg_monthly: baselineResults.total,
      created_at: profile.created_at || new Date().toISOString()
    };

    // Save in baseline_profiles document
    await setDoc(doc(db, 'baseline_profiles', userId), dbRecord);

    // Save defaults or update users collection metadata
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      await updateDoc(userDocRef, {
        hasProfile: true,
        baselineMonthlyCo2Kg: baselineResults.total
      });
    } else {
      await setDoc(userDocRef, {
        userId,
        hasProfile: true,
        baselineMonthlyCo2Kg: baselineResults.total,
        ecoPoints: 100, // starting points
        streak: 0,
        name: 'User',
        email: ''
      });
    }

    const annualEquivalents = convertCo2(baselineResults.total * 12);

    return {
      baselineMonthlyCo2Kg: baselineResults.total,
      breakdown: baselineResults.breakdown,
      annualTreesEquivalent: annualEquivalents.trees,
      petrolLitresEquivalent: annualEquivalents.petrol
    };
  },

  async getOnboardingProfile(userId: string): Promise<BaselineProfile | null> {
    const docSnap = await getDoc(doc(db, 'baseline_profiles', userId));
    if (docSnap.exists()) {
      return docSnap.data() as BaselineProfile;
    }
    return null;
  },

  // Daily Check-in Actions
  async saveDailyCheckin(userId: string, checkinData: CheckinData) {
    const targetDate = checkinData.log_date || new Date().toISOString().split('T')[0];
    
    // 1. Fetch user baseline to calculate deltas
    const profile = await this.getOnboardingProfile(userId);
    if (!profile) {
      throw new Error('Please complete onboarding before logging daily check-ins.');
    }

    const baselineResults = calculateOnboardingBaseline(profile);
    const dailyElecBase = baselineResults.breakdown.electricity / 30.0;
    const dailyFoodBase = baselineResults.breakdown.food / 30.0;
    const dailyTransportBase = baselineResults.breakdown.transport / 30.0;
    const dailyShoppingBase = baselineResults.breakdown.shopping / 30.0;

    let delta = 0.0;

    if (!checkinData.is_typical_day) {
      if (checkinData.travelled_more) {
        delta += dailyTransportBase * 0.5;
      }
      if (checkinData.ate_more_meat) {
        delta += dailyFoodBase * 0.4;
      }
      if (checkinData.higher_electricity) {
        delta += dailyElecBase * 0.3;
      }
      if (checkinData.bought_something) {
        delta += dailyShoppingBase * 0.5;
      }
    }

    const logId = `${userId}_${targetDate}`;
    const checkinRecord = {
      user_id: userId,
      log_date: targetDate,
      travelled_more: checkinData.travelled_more,
      ate_more_meat: checkinData.ate_more_meat,
      bought_something: checkinData.bought_something,
      higher_electricity: checkinData.higher_electricity,
      is_typical_day: checkinData.is_typical_day,
      computed_delta_co2_kg: parseFloat(delta.toFixed(2)),
      custom_notes: checkinData.custom_notes || '',
      created_at: new Date().toISOString()
    };

    // Save to Firestore daily_logs
    await setDoc(doc(db, 'daily_logs', logId), checkinRecord);

    // Update streak & ecoPoints in users collection
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentStreak = userData.streak || 0;
      const currentPoints = userData.ecoPoints || 0;
      
      // Calculate points earned (50 for check in, plus 20 bonus for no extra carbon)
      let pointsEarned = 50;
      if (delta <= 0) {
        pointsEarned += 20;
      }

      await updateDoc(userDocRef, {
        streak: currentStreak + 1,
        ecoPoints: currentPoints + pointsEarned
      });
    }

    return {
      checkinId: logId,
      computedDeltaCo2Kg: checkinRecord.computed_delta_co2_kg
    };
  },

  async getTodayCheckinStatus(userId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const logId = `${userId}_${todayStr}`;
    const docSnap = await getDoc(doc(db, 'daily_logs', logId));
    if (docSnap.exists()) {
      return {
        checkinDoneToday: true,
        checkin: docSnap.data()
      };
    }
    return {
      checkinDoneToday: false,
      checkin: null
    };
  },

  // AI Vision Scans / Capture Actions
  async uploadCaptureDraft(userId: string, captureType: 'food' | 'electricity_bill' | 'receipt', image: string) {
    // Call the Groq Vision Service to analyze the photo
    const { draftData, unreadable } = await groqService.extractImageDetails(image, captureType);

    const captureId = Math.random().toString(36).substring(2, 15);
    const mockImageUrl = image.startsWith('http') ? image : `https://mockstorage.ecopilot.com/captures/${captureId}.jpg`;

    const captureRecord = {
      id: captureId,
      user_id: userId,
      capture_type: captureType,
      image_url: mockImageUrl,
      ai_raw_response: JSON.stringify(draftData),
      confirmed_data: null,
      was_manual_fallback: false,
      estimated_co2_kg: 0.00,
      captured_at: new Date().toISOString()
    };

    // Store draft capture in Firestore
    await setDoc(doc(db, 'captures', captureId), captureRecord);

    // Save in audit logs
    const auditId = Math.random().toString(36).substring(2, 15);
    await setDoc(doc(db, 'capture_logs', auditId), {
      id: auditId,
      user_id: userId,
      capture_type: captureType,
      image_url: mockImageUrl,
      ai_raw_response: JSON.stringify(draftData),
      created_at: new Date().toISOString()
    });

    return {
      captureId,
      captureType,
      draftData,
      unreadable: !!unreadable
    };
  },

  async confirmCapture(userId: string, captureId: string, confirmedData: any, wasManualFallback = false) {
    const captureDocRef = doc(db, 'captures', captureId);
    const docSnap = await getDoc(captureDocRef);
    if (!docSnap.exists()) {
      throw new Error('Capture record not found.');
    }

    const capture = docSnap.data() as CaptureRecord;
    let calculatedCo2 = 0.0;
    const captureType = capture.capture_type;

    if (confirmedData.is_totally_manual) {
      const name = confirmedData.item_name || '';
      const qty = parseFloat(confirmedData.quantity) || 0;
      const category = confirmedData.category_unit || 'other';

      if (category === 'electricity' || category === 'kWh') {
        const gridFactor = EMISSION_FACTORS['electricity_grid_avg_india'] || 0.71;
        calculatedCo2 = qty * gridFactor;
      } else if (category === 'fuel' || category === 'litres') {
        const co2PerLitre = EMISSION_FACTORS['co2_per_litre_petrol'] || 2.3;
        calculatedCo2 = qty * co2PerLitre;
      } else if (category === 'transport' || category === 'km') {
        const factor = EMISSION_FACTORS['transport_mixed_per_km'] || 0.12;
        calculatedCo2 = qty * factor;
      } else if (category === 'shopping' || category === 'inr') {
        const factor = EMISSION_FACTORS['shopping_other_per_100inr'] || 0.20;
        calculatedCo2 = (qty / 100.0) * factor;
      } else {
        calculatedCo2 = await groqService.estimateGeneralEmissions(name, qty, category);
      }
    } else if (captureType === 'food') {
      if (confirmedData.custom_description) {
        calculatedCo2 = await groqService.estimateEmissionsFromText(
          confirmedData.custom_description,
          confirmedData.portion_size
        );
      } else {
        const cat = confirmedData.meal_category;
        const portion = confirmedData.portion_size;
        const factorKey = `food_${cat === 'eggetarian' ? 'eggetarian' : cat}_${portion}`;
        const factor = EMISSION_FACTORS[factorKey] || EMISSION_FACTORS['food_vegetarian_medium'] || 0.9;
        calculatedCo2 = factor;
      }
    } else if (captureType === 'electricity_bill') {
      const units = parseFloat(confirmedData.units_consumed_kwh) || 0;
      const days = parseInt(confirmedData.billing_period_days) || 30;
      const gridFactor = EMISSION_FACTORS['electricity_grid_avg_india'] || 0.71;
      calculatedCo2 = (units / days) * 30 * gridFactor;
    } else if (captureType === 'receipt') {
      if (confirmedData.custom_description) {
        const amt = parseFloat(confirmedData.amount_spent) || 0;
        calculatedCo2 = await groqService.estimateReceiptEmissionsFromText(
          confirmedData.custom_description,
          confirmedData.category || 'other',
          amt
        );
      } else {
        const items = confirmedData.items || [];
        if (items.length > 0) {
          items.forEach((item: any) => {
            const cat = item.category;
            const amt = parseFloat(item.amount) || 0;
            const factorKey = `shopping_${cat}_per_100inr`;
            const factor = EMISSION_FACTORS[factorKey] || EMISSION_FACTORS['shopping_other_per_100inr'] || 0.20;
            calculatedCo2 += (amt / 100.0) * factor;
          });
        } else {
          const cat = confirmedData.category || 'other';
          const amt = parseFloat(confirmedData.amount_spent) || 0;
          const factorKey = `shopping_${cat}_per_100inr`;
          const factor = EMISSION_FACTORS[factorKey] || EMISSION_FACTORS['shopping_other_per_100inr'] || 0.20;
          calculatedCo2 = (amt / 100.0) * factor;
        }
      }
    }

    const finalCo2 = parseFloat(calculatedCo2.toFixed(1));

    await updateDoc(captureDocRef, {
      confirmed_data: JSON.stringify(confirmedData),
      was_manual_fallback: !!wasManualFallback,
      estimated_co2_kg: finalCo2
    });

    // Award EcoPoints for scanning/logging
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const currentPoints = userSnap.data().ecoPoints || 0;
      await updateDoc(userDocRef, {
        ecoPoints: currentPoints + 100 // 100 points reward for precise scans
      });
    }

    const equivalents = convertCo2(finalCo2, captureType === 'electricity_bill' ? 'electricity' : captureType === 'food' ? 'food' : 'shopping');

    return {
      estimatedCo2Kg: finalCo2,
      treesEquivalent: equivalents.trees,
      petrolEquivalent: equivalents.petrol,
      moneyEquivalent: equivalents.money
    };
  },

  // Dashboard Aggregates Action
  async fetchDashboard(userId: string) {
    const profile = await this.getOnboardingProfile(userId);
    if (!profile) {
      return { hasProfile: false };
    }

    const baseCo2Monthly = profile.baseline_co2_kg_monthly || 0;
    const baselineResults = calculateOnboardingBaseline(profile);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = Math.max(1, currentDay);

    const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Get daily logs for current month (in-memory date filter to avoid requiring composite indexes)
    const logsQuery = query(
      collection(db, 'daily_logs'),
      where('user_id', '==', userId)
    );
    const logsSnap = await getDocs(logsQuery);
    const logMap = new Map();
    logsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.log_date >= startOfMonth && data.log_date <= endOfMonth) {
        logMap.set(data.log_date, data);
      }
    });

    // Get captures for current month (in-memory date filter to avoid requiring composite indexes)
    const capturesQuery = query(
      collection(db, 'captures'),
      where('user_id', '==', userId)
    );
    const capturesSnap = await getDocs(capturesQuery);
    const capturesMap = new Map<string, any[]>();
    capturesSnap.forEach(docSnap => {
      const c = docSnap.data();
      if (c.captured_at >= startOfMonth + 'T00:00:00.000Z' && c.captured_at <= endOfMonth + 'T23:59:59.999Z') {
        const dateStr = c.captured_at.split('T')[0];
        if (!capturesMap.has(dateStr)) {
          capturesMap.set(dateStr, []);
        }
        capturesMap.get(dateStr)!.push(c);
      }
    });

    let actualCo2SoFar = 0.0;
    const actualBreakdown = {
      electricity: 0,
      food: 0,
      transport: 0,
      lpg: 0,
      flights: 0,
      shopping: 0
    };

    const dailyBase = {
      electricity: baselineResults.breakdown.electricity / 30,
      food: baselineResults.breakdown.food / 30,
      transport: baselineResults.breakdown.transport / 30,
      lpg: baselineResults.breakdown.lpg / 30,
      flights: baselineResults.breakdown.flights / 30,
      shopping: baselineResults.breakdown.shopping / 30
    };

    for (let day = 1; day <= daysElapsed; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const checkin = logMap.get(dateStr);
      const dayCaptures = capturesMap.get(dateStr) || [];

      const foodCapture = dayCaptures.find(c => c.capture_type === 'food');
      const electricityCapture = dayCaptures.find(c => c.capture_type === 'electricity_bill');
      const receiptCapture = dayCaptures.find(c => c.capture_type === 'receipt');

      // Electricity
      if (electricityCapture) {
        actualBreakdown.electricity += parseFloat(electricityCapture.estimated_co2_kg || 0);
      } else {
        let modifier = 1.0;
        if (checkin && checkin.higher_electricity) modifier = 1.3;
        actualBreakdown.electricity += dailyBase.electricity * modifier;
      }

      // Food
      if (foodCapture) {
        actualBreakdown.food += parseFloat(foodCapture.estimated_co2_kg || 0);
      } else if (checkin && (checkin.breakfast_meal || checkin.lunch_meal || checkin.dinner_meal)) {
        let foodSum = 0;
        const mealFactors = { vegan: 0.2, vegetarian: 0.3, eggetarian: 0.4, 'non-vegetarian': 0.83 };
        if (checkin.breakfast_meal) foodSum += mealFactors[checkin.breakfast_meal as keyof typeof mealFactors] || 0.3;
        if (checkin.lunch_meal) foodSum += mealFactors[checkin.lunch_meal as keyof typeof mealFactors] || 0.3;
        if (checkin.dinner_meal) foodSum += mealFactors[checkin.dinner_meal as keyof typeof mealFactors] || 0.3;
        actualBreakdown.food += foodSum;
      } else {
        let modifier = 1.0;
        if (checkin && checkin.ate_more_meat) modifier = 1.4;
        actualBreakdown.food += dailyBase.food * modifier;
      }

      // Transport
      if (checkin && checkin.travel_km !== undefined && checkin.travel_km !== null) {
        let transportFactor = 0.025; // public
        if (profile.commute_mode === 'car') transportFactor = 0.14;
        else if (profile.commute_mode === 'two-wheeler') transportFactor = 0.04;
        else if (profile.commute_mode === 'walk') transportFactor = 0.0;
        else if (profile.commute_mode === 'mixed') transportFactor = 0.06;
        actualBreakdown.transport += checkin.travel_km * transportFactor;
      } else {
        let transportMod = 1.0;
        if (checkin && checkin.travelled_more) transportMod = 1.5;
        actualBreakdown.transport += dailyBase.transport * transportMod;
      }

      // Shopping / Receipts
      if (receiptCapture) {
        actualBreakdown.shopping += parseFloat(receiptCapture.estimated_co2_kg || 0);
      } else if (checkin && checkin.shopping_amount !== undefined && checkin.shopping_amount !== null) {
        actualBreakdown.shopping += (checkin.shopping_amount / 100) * 0.20;
      } else {
        let modifier = 1.0;
        if (checkin && checkin.bought_something) modifier = 1.5;
        actualBreakdown.shopping += dailyBase.shopping * modifier;
      }

      // LPG & Flights
      actualBreakdown.lpg += dailyBase.lpg;
      actualBreakdown.flights += dailyBase.flights;
    }

    actualCo2SoFar = 
      actualBreakdown.electricity + 
      actualBreakdown.food + 
      actualBreakdown.transport + 
      actualBreakdown.shopping + 
      actualBreakdown.lpg + 
      actualBreakdown.flights;

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

    const todayStr = now.toISOString().split('T')[0];
    const todayCheckin = logMap.get(todayStr);
    const checkinDoneToday = !!todayCheckin && todayCheckin.status === 'concluded';

    const forecastX = (actualCo2SoFar / daysElapsed) * daysInMonth;
    const highestCategory = Object.keys(baselineResults.breakdown).reduce((a, b) => 
      baselineResults.breakdown[a as keyof typeof baselineResults.breakdown] > baselineResults.breakdown[b as keyof typeof baselineResults.breakdown] ? a : b
    );

    let reductionPercentage = 0.10;
    let recommendationText = 'reduce AC runtime';
    if (highestCategory === 'transport') {
      reductionPercentage = 0.15;
      recommendationText = 'switching 2 commutes to public transit';
    } else if (highestCategory === 'food') {
      reductionPercentage = 0.12;
      recommendationText = 'having 2 meat-free days per week';
    } else if (highestCategory === 'electricity') {
      reductionPercentage = 0.10;
      recommendationText = 'reducing AC usage by 1 hour daily';
    }

    const forecastY = forecastX * (1 - reductionPercentage);
    const equivalents = convertCo2(actualCo2SoFar, highestCategory);

    // Sparkline trend (last 7 days of actuals vs baseline daily average)
    const sparkline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const check = logMap.get(dStr);
      let dayTotal = (baseCo2Monthly / 30);
      if (check) {
        let weight = 1.0;
        if (check.travelled_more) weight += 0.1;
        if (check.ate_more_meat) weight += 0.1;
        if (check.higher_electricity) weight += 0.1;
        dayTotal = dayTotal * weight;
      }
      sparkline.push(parseFloat(dayTotal.toFixed(1)));
    }

    // Capture alerts & prompts
    // Fetch latest bill capture
    let showElectricityPrompt = true;
    let daysSinceLastBill = null;
    try {
      const capQuery = query(
        collection(db, 'captures'),
        where('user_id', '==', userId),
        where('capture_type', '==', 'electricity_bill')
      );
      const caps = await getDocs(capQuery);
      if (!caps.empty) {
        const sortedDocs = caps.docs.map(d => d.data() as CaptureRecord)
          .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
        const latestBill = sortedDocs[0];
        const lastUploadDate = new Date(latestBill.captured_at);
        const diffTime = Math.abs(now.getTime() - lastUploadDate.getTime());
        daysSinceLastBill = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        showElectricityPrompt = daysSinceLastBill >= 30;
      }
    } catch (err) {
      console.warn('[FirebaseService] Could not parse latest bills:', err);
    }

    // Load points & streak directly from user doc
    const userDocRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userDocRef);
    let ecoPoints = 100;
    let streak = 0;
    if (userSnap.exists()) {
      const ud = userSnap.data();
      ecoPoints = ud.ecoPoints || 0;
      streak = ud.streak || 0;
    }

    return {
      hasProfile: true,
      grade,
      contextPhrase,
      monthlyTotalCo2Kg: parseFloat(actualCo2SoFar.toFixed(1)),
      monthlyBaselineCo2Kg: parseFloat(baseCo2Monthly.toFixed(1)),
      treesEquivalent: equivalents.trees,
      moneyEquivalent: equivalents.money,
      petrolEquivalent: equivalents.petrol,
      ecoPoints,
      streak,
      categoryBreakdown: {
        Transport: parseFloat(actualBreakdown.transport.toFixed(1)),
        Food: parseFloat(actualBreakdown.food.toFixed(1)),
        Electricity: parseFloat(actualBreakdown.electricity.toFixed(1)),
        Shopping: parseFloat(actualBreakdown.shopping.toFixed(1)),
        LPG: parseFloat(actualBreakdown.lpg.toFixed(1)),
        Flights: parseFloat(actualBreakdown.flights.toFixed(1))
      },
      todayLog: todayCheckin || null,
      checkinDoneToday,
      showElectricityPrompt,
      daysSinceLastBill,
      forecast: {
        currentTrajectory: parseFloat(forecastX.toFixed(1)),
        targetTrajectory: parseFloat(forecastY.toFixed(1)),
        recommendation: `Following our suggestion (${recommendationText}) could reduce emissions by ${Math.round(reductionPercentage * 100)}% this month.`
      },
      sparkline
    };
  },

  // Goals & Daily Challenges Actions
  async getGoals(userId: string) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return [];
      }
      const userData = userSnap.data();
      const rawGoals: any[] = userData.goals || [];
      const goalsList: any[] = [];
      
      for (const goal of rawGoals) {
        let computedProgress = goal.progress || [];
        
        if (goal.goal_type === 'no_meat_monday') {
          // Find all Mondays between started_at and ends_at
          const start = new Date(goal.started_at);
          const end = new Date(goal.ends_at);
          const today = new Date();
          const limit = today < end ? today : end;
          
          // Query daily logs
          const logsQuery = query(collection(db, 'daily_logs'), where('user_id', '==', userId));
          const logsSnap = await getDocs(logsQuery);
          const logsMap = new Map();
          logsSnap.forEach(l => {
            logsMap.set(l.data().log_date, l.data());
          });
          
          const generatedProgress = [];
          let curr = new Date(start);
          while (curr <= limit) {
            if (curr.getDay() === 1) { // Monday
              const dateStr = curr.toISOString().split('T')[0];
              const checkin = logsMap.get(dateStr);
              // Monday is completed if check-in was logged and ate_more_meat is false, OR if no check-in exists (defaulting to typical day)
              const completed = checkin ? !checkin.ate_more_meat : true;
              generatedProgress.push({
                log_date: dateStr,
                completed
              });
            }
            curr.setDate(curr.getDate() + 1);
          }
          computedProgress = generatedProgress;
        } else if (goal.goal_type === 'footprint_reduce_10') {
          // Auto-tracked monthly goal. Check if forecast is 10% lower.
          const dashboard = await this.fetchDashboard(userId);
          let completed = false;
          if (dashboard && dashboard.forecast) {
            const ratio = dashboard.forecast.currentTrajectory / dashboard.monthlyBaselineCo2Kg;
            completed = ratio <= 0.90;
          }
          computedProgress = [{
            log_date: new Date().toISOString().split('T')[0],
            completed
          }];
        }
        
        goalsList.push({
          ...goal,
          progress: computedProgress
        });
      }
      
      return goalsList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    } catch (err) {
      console.error('[FirebaseService] Error in getGoals:', err);
      return [];
    }
  },
  
  async startGoal(userId: string, goalType: string) {
    try {
      const today = new Date();
      const startedAt = today.toISOString().split('T')[0];
      const durationDays = (goalType === 'walk_cycle_5km' || goalType === 'plastic_free_week') ? 7 : 30;
      const endOffset = new Date();
      endOffset.setDate(today.getDate() + durationDays);
      const endsAt = endOffset.toISOString().split('T')[0];
      
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error('User record not found.');
      }
      const userData = userSnap.data();
      const currentGoals: any[] = userData.goals || [];
      
      // Prevent starting the same goal if it is already active
      const activeGoal = currentGoals.find(g => g.goal_type === goalType && g.status === 'active');
      if (activeGoal) {
        throw new Error('This challenge is already active.');
      }

      const goalId = Math.random().toString(36).substring(2, 15);
      const newGoal = {
        id: goalId,
        user_id: userId,
        goal_type: goalType,
        started_at: startedAt,
        ends_at: endsAt,
        status: 'active',
        created_at: new Date().toISOString(),
        progress: []
      };
      
      const updatedGoals = [...currentGoals, newGoal];
      await updateDoc(userRef, { goals: updatedGoals });
      
      return {
        message: 'Goal started successfully.',
        goal: newGoal
      };
    } catch (err) {
      console.error('[FirebaseService] Error in startGoal:', err);
      throw err;
    }
  },
  
  async updateGoalProgress(userId: string, goalId: string, logDate: string, completed: boolean) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error('User record not found.');
      }
      const userData = userSnap.data();
      const currentGoals: any[] = userData.goals || [];
      
      const goalIndex = currentGoals.findIndex(g => g.id === goalId);
      if (goalIndex === -1) {
        throw new Error('Goal not found.');
      }
      
      const goal = currentGoals[goalIndex];
      const progressList: any[] = goal.progress || [];
      const progressIndex = progressList.findIndex(p => p.log_date === logDate);
      
      if (progressIndex !== -1) {
        progressList[progressIndex].completed = completed;
      } else {
        progressList.push({
          log_date: logDate,
          completed
        });
      }
      
      goal.progress = progressList;
      currentGoals[goalIndex] = goal;
      
      await updateDoc(userRef, { goals: currentGoals });
      
      return {
        message: 'Goal progress logged successfully.',
        goalId,
        log_date: logDate,
        completed
      };
    } catch (err) {
      console.error('[FirebaseService] Error in updateGoalProgress:', err);
      throw err;
    }
  },

  async getEmissionsHistory(userId: string) {
    try {
      // Fetch recent daily logs
      const logsQ = query(collection(db, 'daily_logs'), where('user_id', '==', userId));
      const logsSnap = await getDocs(logsQ);
      const historyList: any[] = [];

      logsSnap.forEach(docSnap => {
        const log = docSnap.data();
        historyList.push({
          id: docSnap.id,
          date: log.log_date,
          type: 'checkin',
          title: 'Daily Check-in 📅',
          description: log.is_typical_day ? 'Typical day (no extra emissions)' : 'Logged daily deltas',
          co2: parseFloat(log.computed_delta_co2_kg || 0)
        });
      });

      // Fetch recent captures
      const capsQ = query(collection(db, 'captures'), where('user_id', '==', userId));
      const capsSnap = await getDocs(capsQ);

      capsSnap.forEach(docSnap => {
        const cap = docSnap.data();
        let desc = '';
        if (cap.capture_type === 'food') {
          const conf = cap.confirmed_data ? JSON.parse(cap.confirmed_data) : null;
          desc = conf ? `Meal: ${conf.meal_category} (${conf.portion_size})` : 'Food photo parsed';
        } else if (cap.capture_type === 'electricity_bill') {
          const conf = cap.confirmed_data ? JSON.parse(cap.confirmed_data) : null;
          desc = conf ? `Electricity bill: ${conf.units_consumed_kwh} kWh over ${conf.billing_period_days} days` : 'Power bill scan';
        } else if (cap.capture_type === 'receipt') {
          const conf = cap.confirmed_data ? JSON.parse(cap.confirmed_data) : null;
          desc = conf ? `Receipt spent: ₹${conf.total_amount || conf.amount_spent}` : 'Shopping receipt scan';
        }

        historyList.push({
          id: docSnap.id,
          date: cap.captured_at.split('T')[0],
          type: `capture_${cap.capture_type}`,
          title: cap.capture_type === 'food' ? 'Food Log 🍗' : cap.capture_type === 'electricity_bill' ? 'Electricity Scan ⚡' : 'Receipt Scan 🛒',
          description: desc,
          co2: parseFloat(cap.estimated_co2_kg || 0)
        });
      });

      // Sort by date desc
      return historyList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
    } catch (err) {
      console.error('[FirebaseService] Error in getEmissionsHistory:', err);
      return [];
    }
  },

  async saveDailyActivity(userId: string, date: string, activityType: 'breakfast' | 'lunch' | 'dinner' | 'travel' | 'shopping', value: any) {
    try {
      const logId = `${userId}_${date}`;
      const logDocRef = doc(db, 'daily_logs', logId);
      const logSnap = await getDoc(logDocRef);
      
      let currentLog: any = {
        user_id: userId,
        log_date: date,
        breakfast_meal: null,
        lunch_meal: null,
        dinner_meal: null,
        travel_km: null,
        shopping_amount: null,
        status: 'in_progress',
        created_at: new Date().toISOString()
      };
      
      if (logSnap.exists()) {
        currentLog = logSnap.data();
      }
      
      if (activityType === 'breakfast') currentLog.breakfast_meal = value;
      else if (activityType === 'lunch') currentLog.lunch_meal = value;
      else if (activityType === 'dinner') currentLog.dinner_meal = value;
      else if (activityType === 'travel') currentLog.travel_km = parseFloat(value) || 0;
      else if (activityType === 'shopping') currentLog.shopping_amount = parseFloat(value) || 0;
      
      currentLog.is_typical_day = false;
      
      const profile = await this.getOnboardingProfile(userId);
      if (profile) {
        const baselineResults = calculateOnboardingBaseline(profile);
        const dailyBase = {
          food: baselineResults.breakdown.food / 30,
          transport: baselineResults.breakdown.transport / 30,
          shopping: baselineResults.breakdown.shopping / 30
        };
        
        let foodSum = 0;
        const mealFactors = { vegan: 0.2, vegetarian: 0.3, eggetarian: 0.4, 'non-vegetarian': 0.83 };
        if (currentLog.breakfast_meal) foodSum += mealFactors[currentLog.breakfast_meal as keyof typeof mealFactors] || 0.3;
        if (currentLog.lunch_meal) foodSum += mealFactors[currentLog.lunch_meal as keyof typeof mealFactors] || 0.3;
        if (currentLog.dinner_meal) foodSum += mealFactors[currentLog.dinner_meal as keyof typeof mealFactors] || 0.3;
        
        let transportSum = 0;
        if (currentLog.travel_km !== null) {
          let transportFactor = 0.025; // public
          if (profile.commute_mode === 'car') transportFactor = 0.14;
          else if (profile.commute_mode === 'two-wheeler') transportFactor = 0.04;
          else if (profile.commute_mode === 'walk') transportFactor = 0.0;
          else if (profile.commute_mode === 'mixed') transportFactor = 0.06;
          transportSum = currentLog.travel_km * transportFactor;
        }
        
        let shoppingSum = 0;
        if (currentLog.shopping_amount !== null) {
          shoppingSum = (currentLog.shopping_amount / 100) * 0.20;
        }
        
        const actualEmissions = foodSum + transportSum + shoppingSum;
        const baselineEmissionsForCats = dailyBase.food + dailyBase.transport + dailyBase.shopping;
        currentLog.computed_delta_co2_kg = parseFloat((actualEmissions - baselineEmissionsForCats).toFixed(2));
      }
      
      await setDoc(logDocRef, currentLog);
      return currentLog;
    } catch (err) {
      console.error('[FirebaseService] Error in saveDailyActivity:', err);
      throw err;
    }
  },
  
  async concludeDailyLog(userId: string, date: string) {
    try {
      const logId = `${userId}_${date}`;
      const logDocRef = doc(db, 'daily_logs', logId);
      const logSnap = await getDoc(logDocRef);
      
      let currentLog: any = {
        user_id: userId,
        log_date: date,
        breakfast_meal: null,
        lunch_meal: null,
        dinner_meal: null,
        travel_km: null,
        shopping_amount: null,
        status: 'concluded',
        created_at: new Date().toISOString()
      };
      
      if (logSnap.exists()) {
        currentLog = logSnap.data();
      }
      
      currentLog.status = 'concluded';
      await setDoc(logDocRef, currentLog);
      
      // Award +50 points bonus
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const ud = userSnap.data();
        const currentPoints = ud.ecoPoints || 0;
        await updateDoc(userRef, { ecoPoints: currentPoints + 50 });
      }
      
      return { status: 'concluded', co2Delta: currentLog.computed_delta_co2_kg || 0 };
    } catch (err) {
      console.error('[FirebaseService] Error in concludeDailyLog:', err);
      throw err;
    }
  },
  
  async getMonthlyCalendarData(userId: string, monthStr: string) {
    try {
      const logsQ = query(collection(db, 'daily_logs'), where('user_id', '==', userId));
      const snap = await getDocs(logsQ);
      
      const calendarData: Record<string, { 
        status: string; 
        co2: number; 
        ratio: number;
        breakfast_meal?: string | null;
        lunch_meal?: string | null;
        dinner_meal?: string | null;
        travel_km?: number | null;
        shopping_amount?: number | null;
      }> = {};
      
      snap.forEach(docSnap => {
        const log = docSnap.data();
        if (log.log_date && log.log_date.startsWith(monthStr)) {
          calendarData[log.log_date] = {
            status: log.status || 'in_progress',
            co2: parseFloat(log.computed_delta_co2_kg || 0),
            ratio: (log.computed_delta_co2_kg || 0) <= 0 ? 0.7 : 1.2,
            breakfast_meal: log.breakfast_meal || null,
            lunch_meal: log.lunch_meal || null,
            dinner_meal: log.dinner_meal || null,
            travel_km: log.travel_km !== undefined ? log.travel_km : null,
            shopping_amount: log.shopping_amount !== undefined ? log.shopping_amount : null
          };
        }
      });
      
      return calendarData;
    } catch (err) {
      console.error('[FirebaseService] Error in getMonthlyCalendarData:', err);
      return {};
    }
  }
};



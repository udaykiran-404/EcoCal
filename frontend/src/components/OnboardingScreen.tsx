import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';

export default function OnboardingScreen() {
  const { submitOnboarding, completeOnboarding } = useApp();
  const theme = useTheme();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Form State
  const [housingType, setHousingType] = useState<'apartment' | 'independent'>('apartment');
  const [householdSize, setHouseholdSize] = useState('2');
  const [acCount, setAcCount] = useState('1');
  const [customHousing, setCustomHousing] = useState('');
  
  const [dietType, setDietType] = useState<'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian'>('vegetarian');
  const [nonvegMeals, setNonvegMeals] = useState('3');
  const [customDiet, setCustomDiet] = useState('');

  const [commuteMode, setCommuteMode] = useState<'walk' | 'two-wheeler' | 'car' | 'public' | 'mixed'>('public');
  const [commuteDistance, setCommuteDistance] = useState('10');
  const [customCommute, setCustomCommute] = useState('');

  const [appliances, setAppliances] = useState({
    ac: true,
    fridge: true,
    washing_machine: true,
    geyser: false,
    microwave: false,
  });
  const [customAppliances, setCustomAppliances] = useState('');

  const [lpgCylinders, setLpgCylinders] = useState('1');
  const [lpgNotSure, setLpgNotSure] = useState(false);
  const [customLpg, setCustomLpg] = useState('');

  const [domesticFlights, setDomesticFlights] = useState('0');
  const [internationalFlights, setInternationalFlights] = useState('0');
  const [customFlights, setCustomFlights] = useState('');

  const toggleAppliance = (key: keyof typeof appliances) => {
    setAppliances(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleNext = () => {
    if (step < 6) {
      setStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Calculate automated default for LPG if not sure
      let finalLpg = parseFloat(lpgCylinders);
      if (lpgNotSure) {
        const hh = parseInt(householdSize) || 2;
        finalLpg = hh <= 2 ? 0.6 : hh <= 4 ? 1.0 : 1.5;
      }

      // Sync AC state with acCount
      const finalAppliances = {
        ...appliances,
        ac: parseInt(acCount) > 0
      };

      const payload = {
        housing_type: housingType,
        household_size: parseInt(householdSize) || 1,
        ac_count: parseInt(acCount) || 0,
        diet_type: dietType,
        nonveg_meals_per_week: dietType === 'non-vegetarian' ? (parseInt(nonvegMeals) || 0) : 0,
        commute_mode: commuteMode,
        commute_distance_km: parseFloat(commuteDistance) || 0,
        appliances: finalAppliances,
        lpg_cylinders_per_month: finalLpg,
        domestic_flights_per_year: parseInt(domesticFlights) || 0,
        international_flights_per_year: parseInt(internationalFlights) || 0,
        custom_housing: customHousing.trim(),
        custom_diet: customDiet.trim(),
        custom_commute: customCommute.trim(),
        custom_appliances: customAppliances.trim(),
        custom_lpg: customLpg.trim(),
        custom_flights: customFlights.trim()
      };

      const res = await submitOnboarding(payload);
      setResult(res);
      setStep(7); // Show celebration screen
    } catch (error) {
      console.error('Onboarding submission error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => {
    if (step > 6) return null;
    return (
      <View style={styles.indicatorContainer}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View
            key={i}
            style={[
              styles.indicatorDot,
              { backgroundColor: theme.backgroundSelected },
              i === step && styles.indicatorDotActive,
              i < step && styles.indicatorDotPassed,
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {renderStepIndicator()}

      {step === 1 && (
        <View style={styles.stepContent}>
          <ThemedText type="subtitle" style={styles.stepTitle}>🏡 Tell us about your home</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
            We use this to estimate your standard household utility emissions.
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Housing Type</ThemedText>
            <View style={styles.cardRow}>
              <Pressable
                style={[
                  styles.cardButton, 
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                  housingType === 'apartment' && styles.cardActive
                ]}
                onPress={() => setHousingType('apartment')}
              >
                <ThemedText style={styles.cardIcon}>🏢</ThemedText>
                <ThemedText type="smallBold">Apartment</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.cardButton, 
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                  housingType === 'independent' && styles.cardActive
                ]}
                onPress={() => setHousingType('independent')}
              >
                <ThemedText style={styles.cardIcon}>🏡</ThemedText>
                <ThemedText type="smallBold">Independent House</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Number of family members living with you</ThemedText>
            <View style={styles.selectorRow}>
              {['1', '2', '3', '4', '5+'].map(num => (
                <Pressable
                  key={num}
                  style={[
                    styles.numButton, 
                    { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                    householdSize === num && styles.numActive
                  ]}
                  onPress={() => setHouseholdSize(num)}
                >
                  <ThemedText style={[styles.numText, { color: theme.textSecondary }, householdSize === num && styles.numTextActive]}>{num}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">How many Air Conditioners (ACs) do you own?</ThemedText>
            <View style={styles.selectorRow}>
              {['0', '1', '2', '3', '4+'].map(num => (
                <Pressable
                  key={num}
                  style={[
                    styles.numButton, 
                    { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                    acCount === num && styles.numActive
                  ]}
                  onPress={() => setAcCount(num)}
                >
                  <ThemedText style={[styles.numText, { color: theme.textSecondary }, acCount === num && styles.numTextActive]}>{num}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Or describe your custom housing (optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. Independent villa with solar panels"
              placeholderTextColor="#999"
              value={customHousing}
              onChangeText={setCustomHousing}
            />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContent}>
          <ThemedText type="subtitle" style={styles.stepTitle}>🍽️ What is your dietary preference?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
            Food systems contribute up to 30% of global emissions.
          </ThemedText>

          <View style={styles.cardGrid}>
            {[
              { id: 'vegetarian', label: 'Vegetarian', icon: '🥦' },
              { id: 'non-vegetarian', label: 'Non-Vegetarian', icon: '🍗' },
              { id: 'vegan', label: 'Vegan', icon: '🌱' },
              { id: 'eggetarian', label: 'Eggetarian', icon: '🍳' },
            ].map(item => (
              <Pressable
                key={item.id}
                style={[
                  styles.gridCard, 
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                  dietType === item.id && styles.cardActive
                ]}
                onPress={() => setDietType(item.id as any)}
              >
                <ThemedText style={styles.cardIcon}>{item.icon}</ThemedText>
                <ThemedText type="smallBold">{item.label}</ThemedText>
              </Pressable>
            ))}
          </View>

          {dietType === 'non-vegetarian' && (
            <View style={styles.inputGroup}>
              <ThemedText type="smallBold">How many non-veg meals per week on average?</ThemedText>
              <View style={styles.selectorRow}>
                {['1-2', '3-4', '5-7', '8+'].map((range, idx) => {
                  const values = ['2', '4', '6', '10'];
                  const isSel = nonvegMeals === values[idx];
                  return (
                    <Pressable
                      key={range}
                      style={[
                        styles.numButton, 
                        { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                        isSel && styles.numActive
                      ]}
                      onPress={() => setNonvegMeals(values[idx])}
                    >
                      <ThemedText style={[styles.numText, { color: isSel ? '#2e7d32' : theme.textSecondary }, isSel && styles.numTextActive]}>{range}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Or describe your custom diet (optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. Vegetarian weekdays, non-veg on weekends"
              placeholderTextColor="#999"
              value={customDiet}
              onChangeText={setCustomDiet}
            />
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContent}>
          <ThemedText type="subtitle" style={styles.stepTitle}>🚗 How do you commute daily?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
            Select your primary mode of transportation and approximate distance.
          </ThemedText>

          <View style={styles.cardGrid}>
            {[
              { id: 'walk', label: 'Walk / Cycle', icon: '🚶' },
              { id: 'two-wheeler', label: 'Two-Wheeler', icon: '🛵' },
              { id: 'car', label: 'Car', icon: '🚗' },
              { id: 'public', label: 'Bus / Metro', icon: '🚇' },
              { id: 'mixed', label: 'Mixed / Shared', icon: '🔀' },
            ].map(item => (
              <Pressable
                key={item.id}
                style={[
                  styles.gridCard, 
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                  commuteMode === item.id && styles.cardActive
                ]}
                onPress={() => setCommuteMode(item.id as any)}
              >
                <ThemedText style={styles.cardIcon}>{item.icon}</ThemedText>
                <ThemedText type="smallBold">{item.label}</ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Approximate round-trip daily distance (km)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. 15"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={commuteDistance}
              onChangeText={setCommuteDistance}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Or describe your custom commute (optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. Mixed commute, metro + two-wheeler"
              placeholderTextColor="#999"
              value={customCommute}
              onChangeText={setCustomCommute}
            />
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.stepContent}>
          <ThemedText type="subtitle" style={styles.stepTitle}>🔌 Check your appliances</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
            Select the heavy electrical appliances active in your household.
          </ThemedText>

          <View style={styles.checklistContainer}>
            {[
              { key: 'fridge', label: 'Refrigerator (Double door/Large)', icon: '❄️' },
              { key: 'washing_machine', label: 'Washing Machine', icon: '🧺' },
              { key: 'geyser', label: 'Water Heater / Geyser', icon: '🚿' },
              { key: 'microwave', label: 'Microwave / Oven', icon: '🍲' },
            ].map(item => (
              <Pressable
                key={item.key}
                style={[
                  styles.checkRow,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                  appliances[item.key as keyof typeof appliances] && styles.checkRowActive
                ]}
                onPress={() => toggleAppliance(item.key as any)}
              >
                <ThemedText style={styles.cardIcon}>{item.icon}</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{item.label}</ThemedText>
                </View>
                <View style={[
                  styles.checkbox,
                  appliances[item.key as keyof typeof appliances] && styles.checkboxChecked
                ]} />
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Other appliances not listed (optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. Induction cooktop, dishwasher, air purifier"
              placeholderTextColor="#999"
              value={customAppliances}
              onChangeText={setCustomAppliances}
            />
          </View>
        </View>
      )}

      {step === 5 && (
        <View style={styles.stepContent}>
          <ThemedText type="subtitle" style={styles.stepTitle}>🔥 LPG cylinders usage</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
            Standard domestic LPG cylinders (14.2 kg) used per month.
          </ThemedText>

          {!lpgNotSure ? (
            <View style={styles.inputGroup}>
              <ThemedText type="smallBold">Cylinders per month</ThemedText>
              <View style={styles.selectorRow}>
                {['0.5', '1', '1.5', '2+'].map(num => (
                  <Pressable
                    key={num}
                    style={[
                      styles.numButton, 
                      { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                      lpgCylinders === num && styles.numActive
                    ]}
                    onPress={() => setLpgCylinders(num)}
                  >
                    <ThemedText style={[styles.numText, { color: lpgCylinders === num ? '#2e7d32' : theme.textSecondary }, lpgCylinders === num && styles.numTextActive]}>{num}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={[styles.notSurePlaceholder, { backgroundColor: 'rgba(76, 175, 80, 0.04)', borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                💡 We will estimate this automatically (approx. 0.6 to 1.0 cylinders/month) based on your family size ({householdSize} members).
              </ThemedText>
            </View>
          )}

          <Pressable
            style={[
              styles.checkRow, 
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              lpgNotSure && styles.checkRowActive
            ]}
            onPress={() => setLpgNotSure(!lpgNotSure)}
          >
            <ThemedText style={styles.cardIcon}>🤷‍♂️</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">{"I'm not sure / Don't use LPG"}</ThemedText>
            </View>
            <View style={[styles.checkbox, lpgNotSure && styles.checkboxChecked]} />
          </Pressable>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Other cooking fuel / custom details (optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. Use piped natural gas (PNG) instead of cylinders"
              placeholderTextColor="#999"
              value={customLpg}
              onChangeText={setCustomLpg}
            />
          </View>
        </View>
      )}

      {step === 6 && (
        <View style={styles.stepContent}>
          <ThemedText type="subtitle" style={styles.stepTitle}>✈️ Air travel frequency</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
            Flights taken in the last 12 months (round trips).
          </ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Domestic Flights (India)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. 2"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={domesticFlights}
              onChangeText={setDomesticFlights}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">International Flights</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. 0"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={internationalFlights}
              onChangeText={setInternationalFlights}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText type="smallBold">Other travel / flight details (optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              placeholder="e.g. Mostly travel by trains or electric buses"
              placeholderTextColor="#999"
              value={customFlights}
              onChangeText={setCustomFlights}
            />
          </View>
        </View>
      )}

      {step === 7 && result && (
        <ThemedView style={styles.celebrationCard}>
          <ThemedText style={styles.celebrationEmoji}>🎉</ThemedText>
          <ThemedText type="subtitle" style={styles.celebrationTitle}>Your Baseline is Ready!</ThemedText>
          
          <ThemedView type="backgroundElement" style={styles.scoreContainer}>
            <ThemedText type="smallBold" themeColor="textSecondary">Starting Footprint</ThemedText>
            <ThemedText type="title" style={styles.scoreNumber}>
              {result.baselineMonthlyCo2Kg}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: '#2e7d32' }}>kg CO₂ / month</ThemedText>
          </ThemedView>

          <ThemedText style={[styles.equivalencyText, { color: theme.text }]}>
            That requires about <ThemedText type="smallBold" style={{ color: '#2e7d32', fontSize: 18 }}>{result.annualTreesEquivalent}</ThemedText> mature trees to absorb per year.
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary" style={styles.equivalencyContext}>
            {"We've set this as your start baseline. Don't worry, we'll suggest small, actionable changes to bring this down together!"}
          </ThemedText>
        </ThemedView>
      )}

      {/* Navigation Buttons */}
      <View style={styles.navigationRow}>
        {step > 1 && step < 7 && (
          <Pressable style={[styles.backButton, { borderColor: theme.backgroundSelected }]} onPress={handleBack} disabled={isLoading}>
            <ThemedText type="smallBold" style={[styles.backButtonText, { color: theme.textSecondary }]}>Back</ThemedText>
          </Pressable>
        )}
        
        {step < 7 ? (
          <Pressable
            style={[styles.nextButton, isLoading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText type="smallBold" style={styles.nextButtonText}>
                {step === 6 ? 'Calculate baseline' : 'Next'}
              </ThemedText>
            )}
          </Pressable>
        ) : (
          <Pressable style={styles.goButton} onPress={completeOnboarding}>
            <ThemedText type="smallBold" style={styles.goButtonText}>{"Let's Go!"}</ThemedText>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: Spacing.four,
    paddingBottom: 100,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  indicatorDotActive: {
    backgroundColor: '#2e7d32',
    width: 20,
  },
  indicatorDotPassed: {
    backgroundColor: '#81c784',
  },
  stepContent: {
    gap: Spacing.three,
    flex: 1,
  },
  stepTitle: {
    fontWeight: '700',
    color: '#2e7d32',
    lineHeight: 38,
  },
  stepSubtitle: {
    marginTop: -Spacing.one,
    marginBottom: Spacing.two,
  },
  inputGroup: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  cardButton: {
    flex: 1,
    height: 100,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    gap: Spacing.one,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardActive: {
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  numButton: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  numActive: {
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  numText: {
    fontWeight: '600',
    color: '#555',
  },
  numTextActive: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '47%',
    height: 90,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    gap: Spacing.one,
    marginVertical: Spacing.one,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  checklistContainer: {
    gap: Spacing.three,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: Spacing.three,
    backgroundColor: '#fafafa',
    gap: Spacing.three,
  },
  checkRowActive: {
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
  },
  checkboxChecked: {
    borderColor: '#2e7d32',
    backgroundColor: '#2e7d32',
  },
  notSurePlaceholder: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(76, 175, 80, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.15)',
    marginVertical: Spacing.two,
  },
  celebrationCard: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  celebrationEmoji: {
    fontSize: 50,
  },
  celebrationTitle: {
    fontWeight: '700',
    color: '#2e7d32',
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    width: '100%',
    marginVertical: Spacing.three,
    gap: Spacing.one,
  },
  scoreNumber: {
    fontSize: 54,
    fontWeight: '800',
    color: '#1b5e20',
  },
  equivalencyText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    paddingHorizontal: Spacing.two,
  },
  equivalencyContext: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.one,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.five,
    gap: Spacing.three,
  },
  backButton: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#555',
  },
  nextButton: {
    flex: 2,
    height: 52,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
  },
  goButton: {
    flex: 1,
    height: 52,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goButtonText: {
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
});

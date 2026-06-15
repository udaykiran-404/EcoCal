import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { useApp } from '../context/AppContext';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { convertCo2 } from '../utils/convertCo2';

interface DashboardScreenProps {
  onTriggerCheckin: () => void;
  onNavigateToLog: (type: 'food' | 'electricity_bill' | 'receipt') => void;
}

export default function DashboardScreen({ onTriggerCheckin, onNavigateToLog }: DashboardScreenProps) {
  const { dashboardData, isLoading, fetchDashboard, logout, apiPost } = useApp();
  const [activeEquivalent, setActiveEquivalent] = useState<'trees' | 'petrol' | 'money'>('trees');
  const [localBreakfast, setLocalBreakfast] = useState<string | null>(null);
  const [localLunch, setLocalLunch] = useState<string | null>(null);
  const [localDinner, setLocalDinner] = useState<string | null>(null);
  const [localTravel, setLocalTravel] = useState('');
  const [localShopping, setLocalShopping] = useState('');
  const [isConcluding, setIsConcluding] = useState(false);
  const [activeTravelSaved, setActiveTravelSaved] = useState(false);
  const [activeShoppingSaved, setActiveShoppingSaved] = useState(false);

  const todayLog = dashboardData?.todayLog || {};

  useEffect(() => {
    if (todayLog) {
      setLocalBreakfast(todayLog.breakfast_meal || null);
      setLocalLunch(todayLog.lunch_meal || null);
      setLocalDinner(todayLog.dinner_meal || null);
      if (todayLog.travel_km !== undefined && todayLog.travel_km !== null) {
        setLocalTravel(String(todayLog.travel_km));
        setActiveTravelSaved(true);
      } else {
        setLocalTravel('');
        setActiveTravelSaved(false);
      }
      if (todayLog.shopping_amount !== undefined && todayLog.shopping_amount !== null) {
        setLocalShopping(String(todayLog.shopping_amount));
        setActiveShoppingSaved(true);
      } else {
        setLocalShopping('');
        setActiveShoppingSaved(false);
      }
    }
  }, [dashboardData]);

  const handleLogActivity = (type: string, val: any) => {
    if (type === 'breakfast') setLocalBreakfast(val);
    else if (type === 'lunch') setLocalLunch(val);
    else if (type === 'dinner') setLocalDinner(val);
    else if (type === 'travel') {
      setLocalTravel(String(val));
      setActiveTravelSaved(true);
    } else if (type === 'shopping') {
      setLocalShopping(String(val));
      setActiveShoppingSaved(true);
    }

    // Persist to database in background (fire-and-forget, no spinner or live dashboard reload)
    apiPost('/checkin/activity', { activity_type: type, value: val })
      .catch((err) => console.error('Failed to log activity in background:', err));
  };

  const handleConcludeToday = async () => {
    setIsConcluding(true);
    try {
      const promises = [];
      if (localTravel !== '' && !activeTravelSaved) {
        promises.push(apiPost('/checkin/activity', { activity_type: 'travel', value: localTravel }));
      }
      if (localShopping !== '' && !activeShoppingSaved) {
        promises.push(apiPost('/checkin/activity', { activity_type: 'shopping', value: localShopping }));
      }
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      await apiPost('/checkin/conclude', {});
      await fetchDashboard(); // Refreshes and updates total monthly carbon totals
    } catch (err) {
      console.error('Failed to conclude day:', err);
    } finally {
      setIsConcluding(false);
    }
  };

  if (isLoading || !dashboardData) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <ThemedText style={{ marginTop: Spacing.two }}>Loading carbon metrics...</ThemedText>
      </View>
    );
  }

  const {
    grade,
    contextPhrase,
    monthlyTotalCo2Kg,
    monthlyBaselineCo2Kg,
    categoryBreakdown,
    checkinDoneToday,
    forecast,
    sparkline,
    showElectricityPrompt,
    daysSinceLastBill
  } = dashboardData;

  // Render equivalents based on selector
  const equivalents = convertCo2(monthlyTotalCo2Kg);
  
  const getEquivalentValue = () => {
    switch (activeEquivalent) {
      case 'trees':
        return `${equivalents.trees} trees`;
      case 'petrol':
        return `${equivalents.petrol} Litres`;
      case 'money':
        return `₹${equivalents.money}`;
    }
  };

  const getEquivalentLabel = () => {
    switch (activeEquivalent) {
      case 'trees':
        return 'Absorption equivalent / year';
      case 'petrol':
        return 'Petrol burned equivalent';
      case 'money':
        return 'Approx. household savings';
    }
  };

  // Color mapping based on Carbon Grade
  const getGradeColor = (g: string) => {
    if (g.startsWith('A')) return '#1b5e20'; // Dark Green
    if (g.startsWith('B')) return '#2e7d32'; // Green
    if (g.startsWith('C')) return '#e65100'; // Orange
    return '#b71c1c'; // Red
  };

  // Get max category value for proportional bars
  const categories = Object.keys(categoryBreakdown);
  const maxCategoryValue = Math.max(...Object.values(categoryBreakdown) as number[], 1.0);

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting & Grade */}
      <View style={styles.header}>
        <View style={styles.greetingCol}>
          <ThemedText type="smallBold" themeColor="textSecondary">Welcome back</ThemedText>
          <ThemedText type="subtitle" style={styles.greetingText}>EcoPilot Dashboard</ThemedText>
        </View>
        <Pressable 
          style={[styles.gradeBadge, { backgroundColor: getGradeColor(grade) }]}
        >
          <ThemedText style={styles.gradeLetter}>{grade}</ThemedText>
        </Pressable>
      </View>

      <ThemedView type="backgroundElement" style={styles.contextCard}>
        <ThemedText type="smallBold" style={{ color: getGradeColor(grade) }}>⭐ Current Footprint Grade</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2 }}>{contextPhrase}</ThemedText>
      </ThemedView>

      {/* Hero Carbon Metric & Equivalents */}
      <ThemedView style={styles.heroCard}>
        <View style={styles.co2Header}>
          <ThemedText type="smallBold" style={styles.heroLabel}>Emissions This Month</ThemedText>
          {sparkline && sparkline.length > 0 && (
            <View style={styles.sparklineContainer}>
              {sparkline.map((val: number, idx: number) => {
                const height = Math.min(30, Math.max(5, (val / monthlyBaselineCo2Kg) * 80));
                return (
                  <View 
                    key={idx} 
                    style={[styles.sparkBar, { height }]} 
                  />
                );
              })}
            </View>
          )}
        </View>

        <ThemedText type="title" style={styles.co2Value}>
          {monthlyTotalCo2Kg} <ThemedText type="smallBold" style={{ fontSize: 18 }}>kg CO₂</ThemedText>
        </ThemedText>

        {/* Equivalents Selector Tabs */}
        <View style={styles.equivTabs}>
          {(['trees', 'petrol', 'money'] as const).map(tab => (
            <Pressable
              key={tab}
              style={[styles.equivTab, activeEquivalent === tab && styles.equivTabActive]}
              onPress={() => setActiveEquivalent(tab)}
            >
              <ThemedText 
                type="small"
                style={[
                  styles.equivTabText,
                  activeEquivalent === tab && styles.equivTabTextActive
                ]}
              >
                {tab.toUpperCase()}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.equivDisplay}>
          <ThemedText style={styles.equivEmoji}>
            {activeEquivalent === 'trees' ? '🌳' : activeEquivalent === 'petrol' ? '⛽' : '₹'}
          </ThemedText>
          <View>
            <ThemedText type="subtitle" style={styles.equivValue}>{getEquivalentValue()}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{getEquivalentLabel()}</ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Monthly Bill Reminder Banner */}
      {showElectricityPrompt && (
        <ThemedView style={styles.reminderBanner}>
          <ThemedText style={{ fontSize: 24 }}>⚡</ThemedText>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="smallBold" style={{ color: '#b58900' }}>Electricity Bill Due</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 16 }}>
              {daysSinceLastBill 
                ? `It's been ${daysSinceLastBill} days since your last bill upload. Override your baseline with active units.`
                : 'Upload your first electricity bill to override baseline calculations!'}
            </ThemedText>
          </View>
          <Pressable style={styles.reminderBtn} onPress={() => onNavigateToLog('electricity_bill')}>
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>Upload</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {/* Today Checklist Actions */}
      <ThemedView type="backgroundElement" style={styles.todayCard}>
        <View style={{ width: '100%', gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText type="smallBold">📅 Today's Carbon Logs</ThemedText>
            {checkinDoneToday ? (
              <ThemedView type="backgroundSelected" style={styles.concludedBadge}>
                <ThemedText type="smallBold" style={{ color: '#2e7d32', fontSize: 10 }}>🔒 Finalized</ThemedText>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundSelected" style={styles.concludedBadge}>
                <ThemedText type="smallBold" style={{ color: '#e5a93c', fontSize: 10 }}>⏳ In Progress</ThemedText>
              </ThemedView>
            )}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: -Spacing.one }}>
            Log activities incrementally below throughout the day. Tap Conclude tonight.
          </ThemedText>

          {/* Meals Slots */}
          {(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
            const currentMealVal = meal === 'breakfast' ? localBreakfast : meal === 'lunch' ? localLunch : localDinner;
            const emoji = meal === 'breakfast' ? '🥞' : meal === 'lunch' ? '🍱' : '🍽️';
            
            return (
              <View key={meal} style={styles.slotRow}>
                <ThemedText style={{ fontSize: 13, width: 90, textTransform: 'capitalize' }}>
                  {emoji} {meal}
                </ThemedText>
                
                <View style={styles.choiceGroup}>
                  {[
                    { id: 'vegan', label: 'Vegan' },
                    { id: 'vegetarian', label: 'Veg' },
                    { id: 'eggetarian', label: 'Egg' },
                    { id: 'non-vegetarian', label: 'Meat' }
                  ].map(opt => {
                    const isActive = currentMealVal === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[
                          styles.slotChoiceBtn,
                          isActive && styles.slotChoiceBtnActive,
                          checkinDoneToday && { opacity: 0.6 }
                        ]}
                        disabled={checkinDoneToday}
                        onPress={() => handleLogActivity(meal, opt.id)}
                      >
                        <ThemedText style={[styles.slotChoiceTxt, isActive && styles.slotChoiceTxtActive]}>
                          {opt.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {/* Commute Slot */}
          <View style={styles.slotRow}>
            <ThemedText style={{ fontSize: 13, width: 90 }}>🚗 Commute</ThemedText>
            <View style={{ flex: 1, flexDirection: 'row', gap: Spacing.two }}>
              <TextInput
                style={[styles.slotInput, checkinDoneToday && { opacity: 0.6 }]}
                keyboardType="numeric"
                placeholder="Distance (km)"
                value={localTravel}
                onChangeText={setLocalTravel}
                editable={!checkinDoneToday}
              />
              <Pressable
                style={[styles.slotSaveBtn, checkinDoneToday && { opacity: 0.6 }]}
                disabled={checkinDoneToday}
                onPress={() => handleLogActivity('travel', localTravel)}
              >
                <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {activeTravelSaved ? 'Update' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Shopping Slot */}
          <View style={styles.slotRow}>
            <ThemedText style={{ fontSize: 13, width: 90 }}>🛒 Purchase</ThemedText>
            <View style={{ flex: 1, flexDirection: 'row', gap: Spacing.two }}>
              <TextInput
                style={[styles.slotInput, checkinDoneToday && { opacity: 0.6 }]}
                keyboardType="numeric"
                placeholder="Amount (₹)"
                value={localShopping}
                onChangeText={setLocalShopping}
                editable={!checkinDoneToday}
              />
              <Pressable
                style={[styles.slotSaveBtn, checkinDoneToday && { opacity: 0.6 }]}
                disabled={checkinDoneToday}
                onPress={() => handleLogActivity('shopping', localShopping)}
              >
                <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  {activeShoppingSaved ? 'Update' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Action Conclude Row */}
          {!checkinDoneToday ? (
            <Pressable
              style={({ pressed }) => [
                styles.concludeBtn,
                pressed && { opacity: 0.8 },
                isConcluding && { opacity: 0.6 }
              ]}
              onPress={handleConcludeToday}
              disabled={isConcluding}
            >
              {isConcluding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.concludeBtnTxt}>
                  ✓ Conclude Today's Log (+50 points)
                </ThemedText>
              )}
            </Pressable>
          ) : (
            <View style={styles.concludedBanner}>
              <ThemedText style={{ color: '#1b5e20', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                🎉 Concluded! Today's logs are finalized. Earned +50 EcoPoints!
              </ThemedText>
            </View>
          )}
        </View>
      </ThemedView>

      {/* Forecast comparison strip */}
      {forecast && (
        <ThemedView style={styles.forecastCard}>
          <ThemedText type="smallBold" style={{ color: '#2e7d32' }}>💡 Carbon Forecast</ThemedText>
          <ThemedText type="small" style={{ marginVertical: Spacing.two }}>
            {forecast.recommendation}
          </ThemedText>

          <View style={styles.forecastChart}>
            <View style={styles.forecastBarContainer}>
              <ThemedText type="small" style={styles.forecastBarLabel}>Current Trajectory</ThemedText>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: '100%', backgroundColor: '#c62828' }]} />
              </View>
              <ThemedText type="smallBold">{forecast.currentTrajectory} kg</ThemedText>
            </View>

            <View style={styles.forecastBarContainer}>
              <ThemedText type="small" style={styles.forecastBarLabel}>With Suggested Habits</ThemedText>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${(forecast.targetTrajectory / forecast.currentTrajectory) * 100}%`, backgroundColor: '#2e7d32' }]} />
              </View>
              <ThemedText type="smallBold" style={{ color: '#2e7d32' }}>{forecast.targetTrajectory} kg</ThemedText>
            </View>
          </View>
        </ThemedView>
      )}

      {/* Category Breakdown Horizontal Bar Chart */}
      <ThemedView style={styles.breakdownCard}>
        <View style={styles.breakdownHeader}>
          <ThemedText type="smallBold">📊 Category Breakdown</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">This month</ThemedText>
        </View>

        <View style={styles.chartContainer}>
          {categories.map(category => {
            const val = categoryBreakdown[category] || 0;
            const percentage = (val / maxCategoryValue) * 100;
            
            // Map category names to icons
            let icon = '❓';
            if (category === 'Food') icon = '🍗';
            else if (category === 'Electricity') icon = '⚡';
            else if (category === 'Transport') icon = '🚗';
            else if (category === 'Shopping') icon = '🛒';
            else if (category === 'LPG') icon = '🔥';
            else if (category === 'Flights') icon = '✈️';

            return (
              <View key={category} style={styles.chartRow}>
                <ThemedText style={styles.chartIcon}>{icon}</ThemedText>
                
                <View style={styles.chartBarCol}>
                  <View style={styles.chartLabelRow}>
                    <ThemedText type="smallBold" style={{ fontSize: 13 }}>{category}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
                      {val.toFixed(1)} kg
                    </ThemedText>
                  </View>
                  
                  <View style={styles.chartBarBg}>
                    <View 
                      style={[
                        styles.chartBarFill, 
                        { width: `${percentage}%`, backgroundColor: category === 'Electricity' ? '#fbc02d' : '#2e7d32' }
                      ]} 
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ThemedView>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <ThemedText type="small" style={{ color: '#d32f2f' }}>Sign Out</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  greetingCol: {
    gap: 2,
  },
  greetingText: {
    fontWeight: '700',
  },
  gradeBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  contextCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderLeftWidth: 4,
    borderLeftColor: '#2e7d32',
  },
  heroCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    backgroundColor: 'rgba(76, 175, 80, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  co2Header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  heroLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#555',
  },
  co2Value: {
    fontSize: 38,
    fontWeight: '800',
    color: '#1b5e20',
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 30,
  },
  sparkBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: '#81c784',
  },
  equivTabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 175, 80, 0.15)',
    paddingBottom: Spacing.two,
  },
  equivTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  equivTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2e7d32',
  },
  equivTabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#777',
  },
  equivTabTextActive: {
    color: '#2e7d32',
  },
  equivDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  equivEmoji: {
    fontSize: 32,
  },
  equivValue: {
    fontWeight: '700',
    color: '#2e7d32',
  },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  todayActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  checkinBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  logBtn: {
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#fff',
  },
  forecastCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
  },
  forecastChart: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  forecastBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  forecastBarLabel: {
    width: 110,
    fontSize: 12,
  },
  barBackground: {
    flex: 1,
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  breakdownCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  chartContainer: {
    gap: Spacing.three,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chartIcon: {
    fontSize: 20,
    width: 25,
    textAlign: 'center',
  },
  chartBarCol: {
    flex: 1,
    gap: 4,
  },
  chartLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartBarBg: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  logoutBtn: {
    alignSelf: 'center',
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(251, 192, 45, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 192, 45, 0.25)',
    gap: Spacing.three,
  },
  reminderBtn: {
    backgroundColor: '#e5a93c',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Spacing.two,
  },
  concludedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  choiceGroup: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
    justifyContent: 'flex-end',
  },
  slotChoiceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  slotChoiceBtnActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  slotChoiceTxt: {
    fontSize: 10,
    color: '#666',
  },
  slotChoiceTxtActive: {
    color: '#fff',
    fontWeight: '700',
  },
  slotInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    backgroundColor: '#fff',
  },
  slotSaveBtn: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  concludeBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  concludeBtnTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  concludedBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.25)',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
});

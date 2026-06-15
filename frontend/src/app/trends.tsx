import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { convertCo2 } from '../utils/convertCo2';
import LoginScreen from '@/components/LoginScreen';

interface HistoryItem {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string;
  co2: number;
}

export default function TrendsScreen() {
  const { apiGet, apiPost, dashboardData, isAuthenticated, isLoading } = useApp();
  const theme = useTheme();
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'calendar' | 'logs'>('chart');

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await apiGet('/history');
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [apiGet]);

  useEffect(() => {
    if (isAuthenticated) {
      const t = setTimeout(() => {
        loadHistory();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [dashboardData, isAuthenticated, loadHistory]);

  // --- Calendar states ---
  const [currentMonthYear, setCurrentMonthYear] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Record<string, any>>({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Backfill inputs state
  const [backfillBreakfast, setBackfillBreakfast] = useState<string | null>(null);
  const [backfillLunch, setBackfillLunch] = useState<string | null>(null);
  const [backfillDinner, setBackfillDinner] = useState<string | null>(null);
  const [backfillTravel, setBackfillTravel] = useState('');
  const [backfillShopping, setBackfillShopping] = useState('');
  const [isSavingBackfill, setIsSavingBackfill] = useState(false);

  const loadCalendar = useCallback(async (monthStr: string) => {
    setIsCalendarLoading(true);
    try {
      const data = await apiGet(`/calendar?month=${monthStr}`);
      setCalendarData(data || {});
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setIsCalendarLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    if (activeTab === 'calendar' && isAuthenticated) {
      const monthStr = `${currentMonthYear.getFullYear()}-${String(currentMonthYear.getMonth() + 1).padStart(2, '0')}`;
      const t = setTimeout(() => {
        loadCalendar(monthStr);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [currentMonthYear, activeTab, isAuthenticated, dashboardData, loadCalendar]);

  const handlePrevMonth = () => {
    const d = new Date(currentMonthYear.getFullYear(), currentMonthYear.getMonth() - 1, 1);
    setCurrentMonthYear(d);
  };

  const handleNextMonth = () => {
    const today = new Date();
    if (currentMonthYear.getFullYear() === today.getFullYear() && currentMonthYear.getMonth() === today.getMonth()) {
      return; // prevent going into future months
    }
    const d = new Date(currentMonthYear.getFullYear(), currentMonthYear.getMonth() + 1, 1);
    setCurrentMonthYear(d);
  };

  const isFutureDay = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr > todayStr;
  };

  const handleDayClick = (dateStr: string) => {
    const dayInfo = calendarData[dateStr];
    setSelectedDay(dateStr);
    if (dayInfo) {
      setBackfillBreakfast(dayInfo.breakfast_meal || null);
      setBackfillLunch(dayInfo.lunch_meal || null);
      setBackfillDinner(dayInfo.dinner_meal || null);
      setBackfillTravel(dayInfo.travel_km !== null && dayInfo.travel_km !== undefined ? String(dayInfo.travel_km) : '');
      setBackfillShopping(dayInfo.shopping_amount !== null && dayInfo.shopping_amount !== undefined ? String(dayInfo.shopping_amount) : '');
      setIsEditing(dayInfo.status !== 'concluded');
    } else {
      setBackfillBreakfast(null);
      setBackfillLunch(null);
      setBackfillDinner(null);
      setBackfillTravel('');
      setBackfillShopping('');
      setIsEditing(true);
    }
  };

  const handleCloseModal = () => {
    setSelectedDay(null);
    setIsEditing(false);
  };

  const handleSaveBackfill = async (conclude: boolean) => {
    if (!selectedDay) return;
    setIsSavingBackfill(true);
    try {
      const promises = [
        apiPost('/checkin/activity', { log_date: selectedDay, activity_type: 'breakfast', value: backfillBreakfast }),
        apiPost('/checkin/activity', { log_date: selectedDay, activity_type: 'lunch', value: backfillLunch }),
        apiPost('/checkin/activity', { log_date: selectedDay, activity_type: 'dinner', value: backfillDinner }),
        apiPost('/checkin/activity', { log_date: selectedDay, activity_type: 'travel', value: backfillTravel }),
        apiPost('/checkin/activity', { log_date: selectedDay, activity_type: 'shopping', value: backfillShopping })
      ];
      await Promise.all(promises);

      if (conclude) {
        await apiPost('/checkin/conclude', { log_date: selectedDay });
      }

      // Refresh calendar & dashboard
      const monthStr = `${currentMonthYear.getFullYear()}-${String(currentMonthYear.getMonth() + 1).padStart(2, '0')}`;
      await loadCalendar(monthStr);
      setSelectedDay(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving backfill:', error);
    } finally {
      setIsSavingBackfill(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <ThemedText style={{ marginTop: Spacing.two }}>Connecting...</ThemedText>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <LoginScreen />
      </SafeAreaView>
    );
  }

  if (isLoading || !dashboardData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <ThemedText style={{ marginTop: Spacing.two }}>Loading carbon history...</ThemedText>
      </View>
    );
  }

  const {
    grade,
    contextPhrase,
    monthlyTotalCo2Kg,
    monthlyBaselineCo2Kg,
    categoryBreakdown,
    sparkline
  } = dashboardData;

  const equivalents = convertCo2(monthlyTotalCo2Kg);

  // Sparkline stats
  const maxSparklineVal = sparkline && sparkline.length > 0 ? Math.max(...sparkline, 1.0) : 10.0;

  // Grade color helper
  const getGradeColor = (g: string) => {
    if (g.startsWith('A')) return '#1b5e20';
    if (g.startsWith('B')) return '#2e7d32';
    if (g.startsWith('C')) return '#e65100';
    return '#b71c1c';
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView style={[styles.scrollView]} contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.headerTitle}>📊 Trends & History</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Analyze your historical carbon footprints and audit logged entries.
          </ThemedText>
        </View>

        {/* Grade Summary Gradient Box */}
        <ThemedView style={styles.summaryCard}>
          <View style={styles.gradeHeader}>
            <View>
              <ThemedText type="smallBold" style={styles.summaryLabel}>Footprint Grade</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2, color: 'rgba(0,0,0,0.6)' }}>
                {contextPhrase}
              </ThemedText>
            </View>
            <View style={[styles.gradeCircle, { backgroundColor: getGradeColor(grade) }]}>
              <ThemedText style={styles.gradeText}>{grade}</ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.numbersRow}>
            <View style={styles.numberItem}>
              <ThemedText type="small" themeColor="textSecondary" style={{ color: 'rgba(0,0,0,0.5)' }}>Emitted</ThemedText>
              <ThemedText type="subtitle" style={{ fontWeight: '800', color: '#1b5e20' }}>
                {monthlyTotalCo2Kg} <ThemedText style={{ fontSize: 12 }}>kg</ThemedText>
              </ThemedText>
            </View>
            <View style={styles.numberItem}>
              <ThemedText type="small" themeColor="textSecondary" style={{ color: 'rgba(0,0,0,0.5)' }}>Baseline limit</ThemedText>
              <ThemedText type="subtitle" style={{ fontWeight: '700', color: '#555' }}>
                {monthlyBaselineCo2Kg} <ThemedText style={{ fontSize: 12 }}>kg</ThemedText>
              </ThemedText>
            </View>
            <View style={styles.numberItem}>
              <ThemedText type="small" themeColor="textSecondary" style={{ color: 'rgba(0,0,0,0.5)' }}>Savings</ThemedText>
              <ThemedText type="subtitle" style={{ fontWeight: '800', color: '#2e7d32' }}>
                {Math.max(0, Math.round(monthlyBaselineCo2Kg - monthlyTotalCo2Kg))} <ThemedText style={{ fontSize: 12 }}>kg</ThemedText>
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Equivalency Ribbon */}
        <ThemedView type="backgroundElement" style={styles.equivalentRibbon}>
          <View style={styles.ribbonCol}>
            <ThemedText style={styles.ribbonEmoji}>🌳</ThemedText>
            <ThemedText type="smallBold" style={{ fontSize: 13 }}>{equivalents.trees} Trees</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Yearly absorption</ThemedText>
          </View>
          <View style={styles.ribbonCol}>
            <ThemedText style={styles.ribbonEmoji}>⛽</ThemedText>
            <ThemedText type="smallBold" style={{ fontSize: 13 }}>{equivalents.petrol} Litres</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Petrol combusted</ThemedText>
          </View>
          <View style={styles.ribbonCol}>
            <ThemedText style={styles.ribbonEmoji}>₹</ThemedText>
            <ThemedText type="smallBold" style={{ fontSize: 13 }}>₹{equivalents.money}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Saved (Tariff + Fuel)</ThemedText>
          </View>
        </ThemedView>

        {/* Tab Selector */}
        <View style={[styles.tabContainer, { backgroundColor: theme.backgroundSelected }]}>
          <Pressable 
            style={[styles.tabButton, activeTab === 'chart' && [styles.tabActive, { backgroundColor: theme.background }]]}
            onPress={() => setActiveTab('chart')}
          >
            <ThemedText 
              type="smallBold" 
              style={[styles.tabText, { color: activeTab === 'chart' ? '#2e7d32' : theme.textSecondary }]}
            >
              Analytics Chart
            </ThemedText>
          </Pressable>

          <Pressable 
            style={[styles.tabButton, activeTab === 'calendar' && [styles.tabActive, { backgroundColor: theme.background }]]}
            onPress={() => setActiveTab('calendar')}
          >
            <ThemedText 
              type="smallBold" 
              style={[styles.tabText, { color: activeTab === 'calendar' ? '#2e7d32' : theme.textSecondary }]}
            >
              Calendar Timeline
            </ThemedText>
          </Pressable>
          
          <Pressable 
            style={[styles.tabButton, activeTab === 'logs' && [styles.tabActive, { backgroundColor: theme.background }]]}
            onPress={() => setActiveTab('logs')}
          >
            <ThemedText 
              type="smallBold" 
              style={[styles.tabText, { color: activeTab === 'logs' ? '#2e7d32' : theme.textSecondary }]}
            >
              Audit Logs ({history.length})
            </ThemedText>
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === 'chart' && (
          <View style={styles.tabContent}>
            {/* Custom CSS Bar Chart for Last 7 Days */}
            {sparkline && sparkline.length > 0 && (
              <ThemedView style={styles.chartCard}>
                <ThemedText type="smallBold" style={styles.chartTitle}>📅 Last 7 Days Daily Emissions</ThemedText>
                
                <View style={styles.barChartContainer}>
                  {sparkline.map((val: number, idx: number) => {
                    const barHeight = (val / maxSparklineVal) * 120;
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const today = new Date();
                    today.setDate(today.getDate() - (6 - idx));
                    const dayLabel = dayNames[today.getDay()];

                    return (
                      <View key={idx} style={styles.chartBarCol}>
                        <ThemedText type="smallBold" style={styles.chartBarValue}>{val.toFixed(1)}</ThemedText>
                        <View style={styles.chartBarBg}>
                          <View style={[styles.chartBarFill, { height: Math.max(5, barHeight) }]} />
                        </View>
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>{dayLabel}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </ThemedView>
            )}

            {/* Category Share List */}
            <ThemedView style={styles.chartCard}>
              <ThemedText type="smallBold" style={styles.chartTitle}>📊 Category Share Comparison</ThemedText>
              
              <View style={styles.sharesList}>
                {Object.keys(categoryBreakdown).map(catName => {
                  const actual = categoryBreakdown[catName] || 0;
                  const baselineMap: Record<string, number> = {
                    'Electricity': (monthlyBaselineCo2Kg * 0.25),
                    'Food': (monthlyBaselineCo2Kg * 0.35),
                    'Transport': (monthlyBaselineCo2Kg * 0.20),
                    'Shopping': (monthlyBaselineCo2Kg * 0.05),
                    'LPG': (monthlyBaselineCo2Kg * 0.10),
                    'Flights': (monthlyBaselineCo2Kg * 0.05)
                  };
                  const baseline = baselineMap[catName] || 10;
                  const ratio = actual / baseline;
                  const ratioPct = Math.round((ratio - 1) * 100);

                  let badgeColor = '#2e7d32';
                  let text = 'On Baseline';
                  if (ratio > 1.05) {
                    badgeColor = '#d32f2f';
                    text = `+${ratioPct}% over`;
                  } else if (ratio < 0.95) {
                    badgeColor = '#1b5e20';
                    text = `${ratioPct}% under`;
                  }

                  return (
                    <View key={catName} style={styles.shareRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold">{catName}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                          Actual: {actual.toFixed(1)} kg | Base: {baseline.toFixed(1)} kg
                        </ThemedText>
                      </View>
                      <View style={[styles.shareBadge, { backgroundColor: badgeColor + '1a', borderColor: badgeColor }]}>
                        <ThemedText type="smallBold" style={{ color: badgeColor, fontSize: 11 }}>{text}</ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ThemedView>
          </View>
        )}

        {activeTab === 'calendar' && (
          <View style={styles.tabContent}>
            <ThemedView style={styles.chartCard}>
              <View style={styles.calendarHeader}>
                <Pressable onPress={handlePrevMonth} style={styles.calendarNavBtn}>
                  <ThemedText style={styles.calendarNavTxt}>◀</ThemedText>
                </Pressable>
                <ThemedText type="smallBold" style={styles.calendarMonthTitle}>
                  {currentMonthYear.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </ThemedText>
                <Pressable 
                  onPress={handleNextMonth} 
                  style={[
                    styles.calendarNavBtn, 
                    currentMonthYear.getFullYear() === new Date().getFullYear() && 
                    currentMonthYear.getMonth() === new Date().getMonth() && 
                    { opacity: 0.3 }
                  ]}
                  disabled={currentMonthYear.getFullYear() === new Date().getFullYear() && currentMonthYear.getMonth() === new Date().getMonth()}
                >
                  <ThemedText style={styles.calendarNavTxt}>▶</ThemedText>
                </Pressable>
              </View>

              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7', borderWidth: 1 }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Low</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#fffde7', borderColor: '#fff59d', borderWidth: 1 }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Avg</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ffebee', borderColor: '#ffcdd2', borderWidth: 1 }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>High</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#f5f5f5', borderColor: '#9e9e9e', borderWidth: 1.5, borderStyle: 'dashed' }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>In Progress</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#fafafa', borderColor: '#e0e0e0', borderWidth: 1 }]} />
                  <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Untracked</ThemedText>
                </View>
              </View>

              {isCalendarLoading ? (
                <View style={styles.calendarCenter}>
                  <ActivityIndicator size="small" color="#2e7d32" />
                </View>
              ) : (
                <View style={styles.calendarGrid}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <View key={`header-${idx}`} style={styles.weekdayHeader}>
                      <ThemedText type="smallBold" style={styles.weekdayText}>{day}</ThemedText>
                    </View>
                  ))}
                  {(() => {
                    const year = currentMonthYear.getFullYear();
                    const month = currentMonthYear.getMonth();
                    const firstDayIndex = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const daysArray = [];

                    // Padding days for start of month
                    for (let i = 0; i < firstDayIndex; i++) {
                      daysArray.push({ dateStr: '', dayNum: null });
                    }

                    // Days of the month
                    for (let d = 1; d <= daysInMonth; d++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      daysArray.push({ dateStr, dayNum: d });
                    }

                    return daysArray.map((day, idx) => {
                      if (day.dayNum === null) {
                        return <View key={`empty-${idx}`} style={styles.calendarCellEmpty} />;
                      }

                      const isFuture = isFutureDay(day.dateStr);
                      const dayData = calendarData[day.dateStr];

                      // Styling categories
                      let cellStyle: any = [styles.calendarCell];
                      let textStyle: any = [styles.calendarCellText];

                      if (isFuture) {
                        cellStyle.push(styles.cellFuture);
                        textStyle.push(styles.cellTextFuture);
                      } else if (dayData) {
                        if (dayData.status === 'concluded') {
                          const co2 = dayData.co2;
                          if (co2 <= 0) {
                            cellStyle.push(styles.cellLow);
                            textStyle.push({ color: '#1b5e20' });
                          } else if (co2 <= 3.0) {
                            cellStyle.push(styles.cellMedium);
                            textStyle.push({ color: '#f57f17' });
                          } else {
                            cellStyle.push(styles.cellHigh);
                            textStyle.push({ color: '#c62828' });
                          }
                        } else {
                          cellStyle.push(styles.cellInProgress);
                          textStyle.push({ color: '#616161' });
                        }
                      } else {
                        cellStyle.push(styles.cellUntracked);
                        textStyle.push({ color: '#9e9e9e' });
                      }

                      return (
                        <Pressable
                          key={day.dateStr}
                          style={cellStyle}
                          disabled={isFuture}
                          onPress={() => handleDayClick(day.dateStr)}
                        >
                          <ThemedText style={textStyle}>{day.dayNum}</ThemedText>
                        </Pressable>
                      );
                    });
                  })()}
                </View>
              )}
            </ThemedView>
          </View>
        )}

        {activeTab === 'logs' && (
          <View style={styles.tabContent}>
            {isLoadingHistory ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color="#2e7d32" />
              </View>
            ) : history.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyLogsCard}>
                <ThemedText style={{ fontSize: 32 }}>📁</ThemedText>
                <ThemedText type="smallBold">No audit logs found</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
                  Perform camera overrides or daily check-ins to build your audit logs.
                </ThemedText>
              </ThemedView>
            ) : (
              <View style={styles.logsList}>
                {history.map(item => (
                  <ThemedView key={item.id} style={styles.logItem}>
                    <View style={styles.logItemHeader}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="smallBold">{item.title}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                          Date: {item.date}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold" style={{ color: item.co2 > 0 ? '#b71c1c' : '#2e7d32' }}>
                        {item.co2 > 0 ? `+${item.co2.toFixed(1)}` : '0.0'} kg CO₂
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 2, fontSize: 13 }}>
                      {item.description}
                    </ThemedText>
                  </ThemedView>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {/* Calendar Detail / Backfill Modal Overlay */}
      {selectedDay && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold" style={styles.modalTitle}>
                📅 Log Detail — {new Date(selectedDay).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
              </ThemedText>
              <Pressable onPress={handleCloseModal} style={styles.closeBtn}>
                <ThemedText style={styles.closeBtnTxt}>✕</ThemedText>
              </Pressable>
            </View>

            {isEditing ? (
              <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two, fontSize: 12 }}>
                  {calendarData[selectedDay]?.status === 'concluded' 
                    ? 'Updating concluded activities for this day.' 
                    : 'Log activities for this day and conclude to lock.'}
                </ThemedText>

                {/* Meal Slots */}
                {(['breakfast', 'lunch', 'dinner'] as const).map(meal => {
                  const valMap = {
                    breakfast: backfillBreakfast,
                    lunch: backfillLunch,
                    dinner: backfillDinner
                  };
                  const activeVal = valMap[meal];
                  const setVal = meal === 'breakfast' 
                    ? setBackfillBreakfast 
                    : meal === 'lunch' 
                      ? setBackfillLunch 
                      : setBackfillDinner;
                  const emoji = meal === 'breakfast' ? '🥞' : meal === 'lunch' ? '🍱' : '🍽️';

                  return (
                    <View key={meal} style={styles.modalFormRow}>
                      <ThemedText style={{ fontSize: 13, width: 80, textTransform: 'capitalize' }}>
                        {emoji} {meal}
                      </ThemedText>
                      <View style={styles.modalChoiceGroup}>
                        {[
                          { id: 'vegan', label: 'Vegan' },
                          { id: 'vegetarian', label: 'Veg' },
                          { id: 'eggetarian', label: 'Egg' },
                          { id: 'non-vegetarian', label: 'Meat' }
                        ].map(opt => {
                          const isActive = activeVal === opt.id;
                          return (
                            <Pressable
                              key={opt.id}
                              style={[styles.modalChoiceBtn, isActive && styles.modalChoiceBtnActive]}
                              onPress={() => setVal(opt.id)}
                            >
                              <ThemedText style={[styles.modalChoiceTxt, isActive && styles.modalChoiceTxtActive]}>
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
                <View style={styles.modalFormRow}>
                  <ThemedText style={{ fontSize: 13, width: 80 }}>🚗 Commute</ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    placeholder="Distance (km)"
                    value={backfillTravel}
                    onChangeText={setBackfillTravel}
                  />
                </View>

                {/* Shopping Slot */}
                <View style={styles.modalFormRow}>
                  <ThemedText style={{ fontSize: 13, width: 80 }}>🛒 Purchase</ThemedText>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    placeholder="Amount (₹)"
                    value={backfillShopping}
                    onChangeText={setBackfillShopping}
                  />
                </View>

                {/* Actions inside form */}
                <View style={styles.modalActionsRow}>
                  {calendarData[selectedDay]?.status === 'concluded' ? (
                    <Pressable 
                      style={[styles.modalSaveBtn, isSavingBackfill && { opacity: 0.6 }]} 
                      onPress={() => handleSaveBackfill(false)}
                      disabled={isSavingBackfill}
                    >
                      {isSavingBackfill ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <ThemedText style={styles.modalSaveBtnTxt}>Save Changes</ThemedText>
                      )}
                    </Pressable>
                  ) : (
                    <>
                      <Pressable 
                        style={[styles.modalDraftBtn, isSavingBackfill && { opacity: 0.6 }]} 
                        onPress={() => handleSaveBackfill(false)}
                        disabled={isSavingBackfill}
                      >
                        {isSavingBackfill ? (
                          <ActivityIndicator color="#666" size="small" />
                        ) : (
                          <ThemedText style={styles.modalDraftBtnTxt}>Save Progress</ThemedText>
                        )}
                      </Pressable>
                      <Pressable 
                        style={[styles.modalConcludeBtn, isSavingBackfill && { opacity: 0.6 }]} 
                        onPress={() => handleSaveBackfill(true)}
                        disabled={isSavingBackfill}
                      >
                        {isSavingBackfill ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <ThemedText style={styles.modalConcludeBtnTxt}>✓ Conclude (+50 pts)</ThemedText>
                        )}
                      </Pressable>
                    </>
                  )}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.modalDetails}>
                {/* Concluded display */}
                {(() => {
                  const dayInfo = calendarData[selectedDay];
                  const co2 = dayInfo?.co2 || 0;
                  const getStatusLabel = () => {
                    if (co2 <= 0) return '🟢 Low Carbon Savings';
                    if (co2 <= 3.0) return '🟡 Average Emissions';
                    return '🔴 High Carbon Emissions';
                  };

                  return (
                    <View style={{ gap: Spacing.three, width: '100%' }}>
                      <View style={styles.modalSummaryBox}>
                        <ThemedText type="smallBold" style={{ textTransform: 'uppercase', color: '#777', fontSize: 11 }}>
                          Daily Delta Carbon
                        </ThemedText>
                        <ThemedText type="title" style={{ fontSize: 32, color: co2 <= 0 ? '#2e7d32' : co2 <= 3.0 ? '#f57f17' : '#c62828', fontWeight: '800', marginTop: 4 }}>
                          {co2 > 0 ? `+${co2.toFixed(1)}` : co2.toFixed(1)} kg CO₂
                        </ThemedText>
                        <ThemedText type="smallBold" style={{ fontSize: 13, marginTop: 4, color: '#555' }}>
                          {getStatusLabel()}
                        </ThemedText>
                      </View>

                      <View style={styles.detailList}>
                        <View style={styles.detailItemRow}>
                          <ThemedText style={styles.detailItemLabel}>🥞 Breakfast</ThemedText>
                          <ThemedText type="smallBold" style={styles.detailItemVal}>
                            {dayInfo?.breakfast_meal ? dayInfo.breakfast_meal.replace('-', ' ') : 'Not logged'}
                          </ThemedText>
                        </View>
                        <View style={styles.detailItemRow}>
                          <ThemedText style={styles.detailItemLabel}>🍱 Lunch</ThemedText>
                          <ThemedText type="smallBold" style={styles.detailItemVal}>
                            {dayInfo?.lunch_meal ? dayInfo.lunch_meal.replace('-', ' ') : 'Not logged'}
                          </ThemedText>
                        </View>
                        <View style={styles.detailItemRow}>
                          <ThemedText style={styles.detailItemLabel}>🍽️ Dinner</ThemedText>
                          <ThemedText type="smallBold" style={styles.detailItemVal}>
                            {dayInfo?.dinner_meal ? dayInfo.dinner_meal.replace('-', ' ') : 'Not logged'}
                          </ThemedText>
                        </View>
                        <View style={styles.detailItemRow}>
                          <ThemedText style={styles.detailItemLabel}>🚗 Commute</ThemedText>
                          <ThemedText type="smallBold" style={styles.detailItemVal}>
                            {dayInfo?.travel_km !== null && dayInfo?.travel_km !== undefined ? `${dayInfo.travel_km} km` : 'Not logged'}
                          </ThemedText>
                        </View>
                        <View style={styles.detailItemRow}>
                          <ThemedText style={styles.detailItemLabel}>🛒 Purchase</ThemedText>
                          <ThemedText type="smallBold" style={styles.detailItemVal}>
                            {dayInfo?.shopping_amount !== null && dayInfo?.shopping_amount !== undefined ? `₹${dayInfo.shopping_amount}` : 'Not logged'}
                          </ThemedText>
                        </View>
                      </View>

                      <Pressable 
                        style={styles.modalEditBtn}
                        onPress={() => setIsEditing(true)}
                      >
                        <ThemedText style={styles.modalEditBtnTxt}>✍ Edit This Log</ThemedText>
                      </Pressable>
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  header: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  headerTitle: {
    fontWeight: '800',
    color: '#2e7d32',
  },
  summaryCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#333',
  },
  gradeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    marginVertical: Spacing.three,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberItem: {
    gap: 2,
  },
  equivalentRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.12)',
  },
  ribbonCol: {
    alignItems: 'center',
    gap: 2,
  },
  ribbonEmoji: {
    fontSize: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: Spacing.three,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  tabActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    color: '#666',
  },
  tabContent: {
    gap: Spacing.three,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  chartCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
    gap: Spacing.three,
  },
  chartTitle: {
    color: '#2e7d32',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: Spacing.two,
  },
  chartBarCol: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  chartBarValue: {
    fontSize: 10,
    color: '#2e7d32',
  },
  chartBarBg: {
    width: 20,
    height: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: '#2e7d32',
    borderRadius: 10,
  },
  sharesList: {
    gap: Spacing.two,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shareBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  emptyLogsCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  logsList: {
    gap: Spacing.two,
  },
  logItem: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#eee',
    gap: 2,
  },
  logItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  calendarNavBtn: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  calendarNavTxt: {
    color: '#2e7d32',
    fontSize: 14,
  },
  calendarMonthTitle: {
    fontSize: 16,
    color: '#2e7d32',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.four,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  calendarCenter: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  weekdayHeader: {
    width: '14.28%',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 12,
    color: '#777',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1.0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 2,
  },
  calendarCellEmpty: {
    width: '14.28%',
    aspectRatio: 1.0,
  },
  calendarCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  cellFuture: {
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  cellTextFuture: {
    color: '#ccc',
  },
  cellLow: {
    backgroundColor: '#e8f5e9',
    borderColor: '#a5d6a7',
  },
  cellMedium: {
    backgroundColor: '#fffde7',
    borderColor: '#fff59d',
  },
  cellHigh: {
    backgroundColor: '#ffebee',
    borderColor: '#ffcdd2',
  },
  cellInProgress: {
    backgroundColor: '#f5f5f5',
    borderColor: '#9e9e9e',
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  cellUntracked: {
    backgroundColor: '#fafafa',
    borderColor: '#e0e0e0',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: Spacing.four,
    width: '90%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: Spacing.three,
    marginBottom: Spacing.three,
  },
  modalTitle: {
    color: '#2e7d32',
    fontSize: 15,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnTxt: {
    fontSize: 18,
    color: '#999',
    fontWeight: '700',
  },
  modalForm: {
    maxHeight: 400,
  },
  modalFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  modalChoiceGroup: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalChoiceBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  modalChoiceBtnActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  modalChoiceTxt: {
    fontSize: 10,
    color: '#666',
  },
  modalChoiceTxtActive: {
    color: '#fff',
    fontWeight: '700',
  },
  modalInput: {
    flex: 0.6,
    height: 32,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    backgroundColor: '#fff',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.four,
    paddingTop: Spacing.two,
  },
  modalSaveBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalDraftBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDraftBtnTxt: {
    color: '#666',
    fontWeight: '700',
    fontSize: 13,
  },
  modalConcludeBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConcludeBtnTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalDetails: {
    alignItems: 'center',
  },
  modalSummaryBox: {
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'center',
    width: '100%',
  },
  detailList: {
    gap: Spacing.two,
    width: '100%',
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailItemLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailItemVal: {
    fontSize: 13,
    color: '#333',
    textTransform: 'capitalize',
  },
  modalEditBtn: {
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderWidth: 1,
    borderColor: '#2e7d32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: Spacing.two,
    width: '100%',
  },
  modalEditBtnTxt: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 13,
  },
});

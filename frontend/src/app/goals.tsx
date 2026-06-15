import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import LoginScreen from '@/components/LoginScreen';

interface Goal {
  id: string;
  user_id: string;
  goal_type: 'footprint_reduce_10' | 'no_meat_monday' | 'walk_cycle_5km' | 'plastic_free_week';
  started_at: string;
  ends_at: string;
  status: 'active' | 'completed' | 'failed';
  created_at: string;
  progress: { log_date: string; completed: boolean }[];
}

const AVAILABLE_GOALS = [
  {
    type: 'footprint_reduce_10' as const,
    title: '🌿 10% Carbon Diet',
    description: 'Reduce your total monthly footprint forecast by 10% compared to your onboarding baseline.',
    duration: '30 Days',
    impact: '≈ 15kg CO₂ (saving ₹500 in fuel/power)',
    icon: '📉'
  },
  {
    type: 'no_meat_monday' as const,
    title: '🥦 No Meat Mondays',
    description: 'Eat only vegetarian or vegan meals on Mondays to curb diet-related emissions.',
    duration: '30 Days',
    impact: '≈ 4.5kg CO₂ per Monday (2 trees absorption)',
    icon: '🥗'
  },
  {
    type: 'walk_cycle_5km' as const,
    title: '🚲 Walk or Cycle 5km',
    description: 'Commit to walking or cycling instead of using motorized transport, targeting a total of 5km this week.',
    duration: '7 Days',
    impact: '≈ 1.2kg CO₂ (saving ₹120 in petrol)',
    icon: '🚶'
  },
  {
    type: 'plastic_free_week' as const,
    title: '🛍️ Zero Single-Use Plastic',
    description: 'Go plastic-free for a week! Avoid plastic bags, cups, bottles, and packaging.',
    duration: '7 Days',
    impact: 'Saves local soil degradation & microplastic footprint',
    icon: '❌'
  }
];

export default function GoalsScreen() {
  const { apiGet, apiPost, fetchDashboard, dashboardData, isAuthenticated, isLoading: isAuthLoading } = useApp();
  const theme = useTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'discover'>('active');

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet('/goals');
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    if (isAuthenticated) {
      const t = setTimeout(() => {
        loadGoals();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, loadGoals]);

  if (isAuthLoading) {
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

  const handleStartGoal = async (goalType: string) => {
    setIsActionLoading(goalType);
    try {
      await apiPost('/goals', { goal_type: goalType });
      await loadGoals();
      await fetchDashboard();
      setActiveTab('active');
    } catch (error: any) {
      alert(error.message || 'Failed to start goal.');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleLogManualProgress = async (goalId: string, logDate: string, currentCompletedStatus: boolean) => {
    setIsActionLoading(goalId);
    try {
      await apiPost(`/goals/${goalId}/progress`, {
        log_date: logDate,
        completed: !currentCompletedStatus
      });
      await loadGoals();
      await fetchDashboard();
    } catch (error) {
      console.error('Error logging progress:', error);
    } finally {
      setIsActionLoading(null);
    }
  };

  // Helper to compute progress statistics
  const getGoalProgressStats = (goal: Goal) => {
    const start = new Date(goal.started_at);
    const end = new Date(goal.ends_at);
    const today = new Date();
    
    // Total days in duration
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // Days elapsed
    const elapsedDays = Math.min(
      totalDays,
      Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    );

    if (goal.goal_type === 'walk_cycle_5km') {
      // For walking, progress count is sum of logged items. Let's say each logged item adds 1km
      const completedKm = goal.progress.filter(p => p.completed).length;
      const pct = Math.min(100, (completedKm / 5) * 100);
      return {
        completedText: `${completedKm} / 5 km`,
        percentage: pct,
        daysLeft: Math.max(0, totalDays - elapsedDays),
        description: 'Log 1km of green commute on trips you would normally drive.'
      };
    }

    if (goal.goal_type === 'plastic_free_week') {
      // 7 days challenge, count completed days
      const completedDays = goal.progress.filter(p => p.completed).length;
      const pct = (completedDays / 7) * 100;
      return {
        completedText: `${completedDays} / 7 days`,
        percentage: pct,
        daysLeft: Math.max(0, 7 - elapsedDays),
        description: 'Complete each day without using any single-use plastic.'
      };
    }

    if (goal.goal_type === 'no_meat_monday') {
      // Check count of Mondays completed
      const totalMondays = 4; // roughly 4 Mondays in 30 days
      const completedMondays = goal.progress.filter(p => p.completed).length;
      const pct = (completedMondays / totalMondays) * 100;
      return {
        completedText: `${completedMondays} / ${totalMondays} Mondays`,
        percentage: pct,
        daysLeft: Math.max(0, 30 - elapsedDays),
        description: 'Automatically tracking food logs on Mondays.'
      };
    }

    if (goal.goal_type === 'footprint_reduce_10') {
      // Forecast comparison
      const isMet = goal.progress.some(p => p.completed);
      const targetPercent = dashboardData ? Math.round((dashboardData.monthlyTotalCo2Kg / dashboardData.monthlyBaselineCo2Kg) * 100) : 100;
      return {
        completedText: isMet ? 'Target Met!' : 'In Progress',
        percentage: isMet ? 100 : Math.max(0, Math.min(100, 100 - (targetPercent - 90))),
        daysLeft: Math.max(0, 30 - elapsedDays),
        description: `Baseline: ${dashboardData?.monthlyBaselineCo2Kg || 0}kg. Target: ${Math.round((dashboardData?.monthlyBaselineCo2Kg || 0) * 0.9)}kg.`
      };
    }

    return { completedText: '0/0', percentage: 0, daysLeft: 0, description: '' };
  };

  const activeGoals = goals.filter(g => g.status === 'active');

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: theme.background }]} contentContainerStyle={styles.container}>
      {/* Premium Header Banner */}
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.headerTitle}>🎯 Sustainability Challenges</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
          Complete direct challenges to shrink your footprint and earn EcoPoints.
        </ThemedText>
      </View>

      {/* App Stats Quick Ribbon */}
      {dashboardData && (
        <ThemedView type="backgroundElement" style={styles.statsRibbon}>
          <View style={styles.ribbonItem}>
            <ThemedText style={styles.ribbonEmoji}>🏆</ThemedText>
            <View>
              <ThemedText type="smallBold">{dashboardData.ecoPoints || 100}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>EcoPoints</ThemedText>
            </View>
          </View>
          <View style={styles.ribbonDivider} />
          <View style={styles.ribbonItem}>
            <ThemedText style={styles.ribbonEmoji}>⚡</ThemedText>
            <View>
              <ThemedText type="smallBold">{dashboardData.streak || 0} Days</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 10 }}>Check-in Streak</ThemedText>
            </View>
          </View>
        </ThemedView>
      )}

      {/* Tab Selectors */}
      <View style={[styles.tabContainer, { backgroundColor: theme.backgroundSelected }]}>
        <Pressable 
          style={[styles.tabButton, activeTab === 'active' && [styles.tabActive, { backgroundColor: theme.background }]]}
          onPress={() => setActiveTab('active')}
        >
          <ThemedText 
            type="smallBold" 
            style={[styles.tabText, { color: activeTab === 'active' ? '#2e7d32' : theme.textSecondary }]}
          >
            Active ({activeGoals.length})
          </ThemedText>
        </Pressable>
        
        <Pressable 
          style={[styles.tabButton, activeTab === 'discover' && [styles.tabActive, { backgroundColor: theme.background }]]}
          onPress={() => setActiveTab('discover')}
        >
          <ThemedText 
            type="smallBold" 
            style={[styles.tabText, { color: activeTab === 'discover' ? '#2e7d32' : theme.textSecondary }]}
          >
            Discover New
          </ThemedText>
        </Pressable>
      </View>

      {/* Main Tab Views */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <ThemedText style={{ marginTop: Spacing.two }}>Loading challenges...</ThemedText>
        </View>
      ) : activeTab === 'active' ? (
        <View style={styles.tabContent}>
          {activeGoals.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText style={styles.emptyEmoji}>🍃</ThemedText>
              <ThemedText type="smallBold" style={{ textAlign: 'center' }}>No active challenges</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
                Explore and activate sustainability challenges to reduce your footprint!
              </ThemedText>
              <Pressable style={styles.exploreBtn} onPress={() => setActiveTab('discover')}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Explore Challenges</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            activeGoals.map(goal => {
              const staticGoal = AVAILABLE_GOALS.find(g => g.type === goal.goal_type);
              const stats = getGoalProgressStats(goal);
              
              return (
                <ThemedView key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalCardHeader}>
                    <ThemedText style={styles.goalCardIcon}>{staticGoal?.icon || '🎯'}</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="smallBold" style={styles.goalCardTitle}>{staticGoal?.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                        Ends in {stats.daysLeft} days
                      </ThemedText>
                    </View>
                    <ThemedView type="backgroundSelected" style={styles.badge}>
                      <ThemedText type="smallBold" style={{ fontSize: 11, color: '#2e7d32' }}>
                        {stats.completedText}
                      </ThemedText>
                    </ThemedView>
                  </View>

                  <ThemedText type="small" style={styles.goalCardDesc}>
                    {staticGoal?.description}
                  </ThemedText>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${stats.percentage}%` }]} />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                      {Math.round(stats.percentage)}% completed
                    </ThemedText>
                  </View>

                  {/* Interactive Manual Logger */}
                  {(goal.goal_type === 'walk_cycle_5km' || goal.goal_type === 'plastic_free_week') && (
                    <View style={styles.interactiveBlock}>
                      <ThemedText type="smallBold" style={{ fontSize: 12, color: '#2e7d32' }}>
                        {"Log Today's Challenge Progress"}
                      </ThemedText>
                      
                      {/* We show log check buttons for the current day */}
                      <View style={styles.actionRow}>
                        <Pressable 
                          style={({ pressed }) => [
                            styles.logActionBtn, 
                            pressed && { opacity: 0.7 },
                            isActionLoading === goal.id && { opacity: 0.5 }
                          ]}
                          onPress={() => {
                            const todayStr = new Date().toISOString().split('T')[0];
                            const loggedToday = goal.progress.some(p => p.log_date === todayStr && p.completed);
                            handleLogManualProgress(goal.id, todayStr, loggedToday);
                          }}
                          disabled={isActionLoading === goal.id}
                        >
                          {isActionLoading === goal.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                              {goal.progress.some(p => p.log_date === new Date().toISOString().split('T')[0] && p.completed)
                                ? '✓ Completed Today'
                                : '➕ Mark Today Completed'}
                            </ThemedText>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}
                  
                  {goal.goal_type === 'no_meat_monday' && (
                    <View style={styles.trackerSummary}>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                        🥦 Tracking diet inputs automatically. Each vegetarian Monday counts!
                      </ThemedText>
                    </View>
                  )}

                  {goal.goal_type === 'footprint_reduce_10' && (
                    <View style={styles.trackerSummary}>
                      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                        📉 Automatically calculated against your active monthly emissions forecast.
                      </ThemedText>
                    </View>
                  )}
                </ThemedView>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.tabContent}>
          {AVAILABLE_GOALS.map(goal => {
            const isAlreadyActive = activeGoals.some(ag => ag.goal_type === goal.type);
            
            return (
              <ThemedView key={goal.type} style={styles.discoverCard}>
                <View style={styles.discoverHeader}>
                  <ThemedText style={styles.discoverIcon}>{goal.icon}</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="subtitle" style={styles.discoverTitle}>{goal.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
                      Duration: {goal.duration}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText type="small" style={styles.discoverDesc}>
                  {goal.description}
                </ThemedText>

                <ThemedView type="backgroundElement" style={styles.impactBadge}>
                  <ThemedText type="smallBold" style={{ fontSize: 12, color: '#1b5e20' }}>
                    🌿 Estimated Impact: <ThemedText type="small" style={{ fontSize: 12 }}>{goal.impact}</ThemedText>
                  </ThemedText>
                </ThemedView>

                <Pressable
                  style={({ pressed }) => [
                    styles.startGoalBtn,
                    isAlreadyActive && styles.startGoalBtnActive,
                    pressed && { opacity: 0.8 },
                    isActionLoading === goal.type && { opacity: 0.5 }
                  ]}
                  onPress={() => !isAlreadyActive && handleStartGoal(goal.type)}
                  disabled={isAlreadyActive || isActionLoading === goal.type}
                >
                  {isActionLoading === goal.type ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 13 }}>
                      {isAlreadyActive ? 'Already Active ✓' : 'Activate Challenge'}
                    </ThemedText>
                  )}
                </Pressable>
              </ThemedView>
            );
          })}
        </View>
      )}
    </ScrollView>
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
  headerSubtitle: {
    lineHeight: 20,
  },
  statsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.12)',
  },
  ribbonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  ribbonEmoji: {
    fontSize: 24,
  },
  ribbonDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#ccc',
    opacity: 0.4,
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
  emptyCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: '#eee',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.one,
  },
  exploreBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Spacing.three,
    marginTop: Spacing.three,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  goalCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
    backgroundColor: 'rgba(76, 175, 80, 0.02)',
    gap: Spacing.three,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  goalCardIcon: {
    fontSize: 28,
  },
  goalCardTitle: {
    fontWeight: '700',
  },
  goalCardDesc: {
    lineHeight: 18,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  progressContainer: {
    gap: 6,
    marginVertical: 4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2e7d32',
    borderRadius: 4,
  },
  interactiveBlock: {
    padding: Spacing.three,
    backgroundColor: 'rgba(76, 175, 80, 0.06)',
    borderRadius: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.12)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  logActionBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Spacing.two,
  },
  trackerSummary: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#eee',
  },
  discoverCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: '#eee',
    gap: Spacing.three,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  discoverIcon: {
    fontSize: 32,
  },
  discoverTitle: {
    fontWeight: '700',
  },
  discoverDesc: {
    lineHeight: 18,
  },
  impactBadge: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderLeftWidth: 4,
    borderLeftColor: '#1b5e20',
  },
  startGoalBtn: {
    height: 48,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  startGoalBtnActive: {
    backgroundColor: '#9e9e9e',
  },
});

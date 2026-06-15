import React, { useState } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import LoginScreen from '@/components/LoginScreen';
import OnboardingScreen from '@/components/OnboardingScreen';
import DashboardScreen from '@/components/DashboardScreen';
import DailyCheckinModal from '@/components/DailyCheckinModal'; // Will build in Sprint 3

export default function HomeScreen() {
  const { isAuthenticated, hasProfile, isLoading, dashboardData } = useApp();
  const router = useRouter();
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <ThemedText style={{ marginTop: 10 }}>Connecting to EcoPilot...</ThemedText>
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <LoginScreen />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!hasProfile) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <OnboardingScreen />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <DashboardScreen
          key={dashboardData?.todayLog ? `${dashboardData.todayLog.log_date}_${dashboardData.todayLog.status || 'open'}` : 'empty'}
          onTriggerCheckin={() => setCheckinModalVisible(true)}
          onNavigateToLog={(type) => router.push(`/log?type=${type}`)}
        />
        
        {/* Daily Check-in Modal Sheet */}
        <DailyCheckinModal
          key={checkinModalVisible ? 'open' : 'closed'}
          visible={checkinModalVisible}
          onClose={() => setCheckinModalVisible(false)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

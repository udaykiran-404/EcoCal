import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import CaptureFlow from '@/components/CaptureFlow';
import { ThemedView } from '@/components/themed-view';

export default function LogScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const initialType = (type === 'electricity_bill' || type === 'receipt' || type === 'food') ? type : 'food';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <CaptureFlow initialType={initialType} />
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
});

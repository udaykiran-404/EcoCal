import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, View, Pressable, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { useApp } from '../context/AppContext';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/use-theme';

interface DailyCheckinModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function DailyCheckinModal({ visible, onClose }: DailyCheckinModalProps) {
  const { apiPost, fetchDashboard } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Question States
  const [travelledMore, setTravelledMore] = useState(false);
  const [ateMoreMeat, setAteMoreMeat] = useState(false);
  const [boughtSomething, setBoughtSomething] = useState(false);
  const [higherElectricity, setHigherElectricity] = useState(false);
  const [isTypicalDay, setIsTypicalDay] = useState(true);
  const [customNotes, setCustomNotes] = useState('');

  // Reset states on visible change
  useEffect(() => {
    if (visible) {
      setTravelledMore(false);
      setAteMoreMeat(false);
      setBoughtSomething(false);
      setHigherElectricity(false);
      setIsTypicalDay(true);
      setCustomNotes('');
    }
  }, [visible]);

  // Automatically unset isTypicalDay if any individual yes is checked
  useEffect(() => {
    if (travelledMore || ateMoreMeat || boughtSomething || higherElectricity) {
      setIsTypicalDay(false);
    }
  }, [travelledMore, ateMoreMeat, boughtSomething, higherElectricity]);

  const handleTypicalDaySelect = () => {
    setTravelledMore(false);
    setAteMoreMeat(false);
    setBoughtSomething(false);
    setHigherElectricity(false);
    setIsTypicalDay(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload = {
        log_date: new Date().toISOString().split('T')[0],
        travelled_more: travelledMore,
        ate_more_meat: ateMoreMeat,
        bought_something: boughtSomething,
        higher_electricity: higherElectricity,
        is_typical_day: isTypicalDay,
        custom_notes: customNotes.trim()
      };

      await apiPost('/checkin', payload);
      await fetchDashboard();
      onClose();

      // If they bought something, redirect them to the Log tab for receipt capture
      if (boughtSomething) {
        setTimeout(() => {
          router.push('/log?type=receipt');
        }, 300);
      }
    } catch (error) {
      console.error('Failed to save daily checkin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <ThemedText type="subtitle" style={styles.sheetTitle}>🌱 Daily Smart Check-in</ThemedText>
            <Pressable onPress={onClose} style={styles.closeIcon}>
              <ThemedText type="smallBold" style={{ color: '#999' }}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Typical Day Shortcut Option */}
            <Pressable 
              style={[
                styles.typicalButton, 
                isTypicalDay && styles.typicalButtonActive,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }
              ]}
              onPress={handleTypicalDaySelect}
            >
              <ThemedText style={styles.typicalEmoji}>🌿</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText 
                  type="smallBold" 
                  style={[
                    styles.typicalText, 
                    { color: isTypicalDay ? '#2e7d32' : theme.text }
                  ]}
                >
                  Just a typical day
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                  Answers "No" to all adjustments in a single tap
                </ThemedText>
              </View>
            </Pressable>

            {/* Step-by-Step Questions */}
            <View style={styles.questionsList}>
              {/* Question 1: Travel */}
              <View style={[styles.questionRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={styles.questionMeta}>
                  <ThemedText style={styles.questionEmoji}>🚗</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">Commuted more than usual?</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      E.g. extra driving, long detours
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.toggleGroup, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <Pressable 
                    style={[styles.toggleBtn, !travelledMore && [styles.toggleBtnActive, { backgroundColor: theme.backgroundSelected }]]} 
                    onPress={() => setTravelledMore(false)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, { color: !travelledMore ? theme.text : theme.textSecondary }]}>No</ThemedText>
                  </Pressable>
                  <Pressable 
                    style={[styles.toggleBtn, travelledMore && styles.toggleBtnActiveYes]} 
                    onPress={() => setTravelledMore(true)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, travelledMore && styles.toggleTextActiveYes]}>Yes</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Question 2: Food */}
              <View style={[styles.questionRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={styles.questionMeta}>
                  <ThemedText style={styles.questionEmoji}>🍗</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">Ate more meat than usual?</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      E.g. extra chicken, mutton, or fish
                  </ThemedText>
                  </View>
                </View>
                <View style={[styles.toggleGroup, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <Pressable 
                    style={[styles.toggleBtn, !ateMoreMeat && [styles.toggleBtnActive, { backgroundColor: theme.backgroundSelected }]]} 
                    onPress={() => setAteMoreMeat(false)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, { color: !ateMoreMeat ? theme.text : theme.textSecondary }]}>No</ThemedText>
                  </Pressable>
                  <Pressable 
                    style={[styles.toggleBtn, ateMoreMeat && styles.toggleBtnActiveYes]} 
                    onPress={() => setAteMoreMeat(true)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, ateMoreMeat && styles.toggleTextActiveYes]}>Yes</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Question 3: Shopping */}
              <View style={[styles.questionRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={styles.questionMeta}>
                  <ThemedText style={styles.questionEmoji}>🛒</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">Bought anything today?</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      We will prompt you to capture the receipt
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.toggleGroup, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <Pressable 
                    style={[styles.toggleBtn, !boughtSomething && [styles.toggleBtnActive, { backgroundColor: theme.backgroundSelected }]]} 
                    onPress={() => setBoughtSomething(false)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, { color: !boughtSomething ? theme.text : theme.textSecondary }]}>No</ThemedText>
                  </Pressable>
                  <Pressable 
                    style={[styles.toggleBtn, boughtSomething && styles.toggleBtnActiveYes]} 
                    onPress={() => setBoughtSomething(true)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, boughtSomething && styles.toggleTextActiveYes]}>Yes</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Question 4: Electricity */}
              <View style={[styles.questionRow, { borderBottomColor: theme.backgroundSelected }]}>
                <View style={styles.questionMeta}>
                  <ThemedText style={styles.questionEmoji}>⚡</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">Higher electricity use today?</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                      E.g. AC ran longer, geyser use
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.toggleGroup, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <Pressable 
                    style={[styles.toggleBtn, !higherElectricity && [styles.toggleBtnActive, { backgroundColor: theme.backgroundSelected }]]} 
                    onPress={() => setHigherElectricity(false)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, { color: !higherElectricity ? theme.text : theme.textSecondary }]}>No</ThemedText>
                  </Pressable>
                  <Pressable 
                    style={[styles.toggleBtn, higherElectricity && styles.toggleBtnActiveYes]} 
                    onPress={() => setHigherElectricity(true)}
                  >
                    <ThemedText type="smallBold" style={[styles.toggleText, higherElectricity && styles.toggleTextActiveYes]}>Yes</ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Question 5: Custom entry field */}
              <View style={styles.inputGroup}>
                <ThemedText type="smallBold">Other activities or custom notes today? (optional)</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                  placeholder="e.g. Planted a tree, ran AC all day, did not drive"
                  placeholderTextColor="#999"
                  value={customNotes}
                  onChangeText={setCustomNotes}
                />
              </View>
            </View>
          </ScrollView>

          {/* Action CTAs */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.saveBtn, isLoading && styles.btnDisabled]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Save Daily Logs</ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: Spacing.four,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontWeight: '700',
    color: '#2e7d32',
  },
  closeIcon: {
    padding: 8,
  },
  scrollBody: {
    flexGrow: 0,
    marginVertical: Spacing.one,
  },
  typicalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  typicalButtonActive: {
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  typicalEmoji: {
    fontSize: 24,
  },
  typicalText: {
    color: '#555',
  },
  typicalTextActive: {
    color: '#2e7d32',
  },
  questionsList: {
    gap: Spacing.three,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: Spacing.two,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  questionEmoji: {
    fontSize: 22,
    width: 25,
    textAlign: 'center',
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#e0e0e0',
  },
  toggleBtnActiveYes: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
  },
  toggleText: {
    fontSize: 12,
    color: '#666',
  },
  toggleTextActive: {
    color: '#333',
    fontWeight: '700',
  },
  toggleTextActiveYes: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  inputGroup: {
    gap: Spacing.one,
    marginTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  textInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fafafa',
    marginTop: 4,
  },
  actionRow: {
    marginTop: Spacing.two,
  },
  saveBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 14,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnDisabled: {
    opacity: 0.7,
  },
});

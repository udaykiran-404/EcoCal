import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, TextInput, ScrollView, Platform, Image } from 'react-native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';

type CaptureType = 'food' | 'electricity_bill' | 'receipt';

interface CaptureFlowProps {
  initialType?: CaptureType;
  onComplete?: () => void;
}

export default function CaptureFlow({ initialType = 'food', onComplete }: CaptureFlowProps) {
  const { apiPost, apiPatch, fetchDashboard } = useApp();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<CaptureType>(initialType);
  const [stage, setStage] = useState<'capture' | 'processing' | 'confirm' | 'saved'>('capture');
  const [isLoading, setIsLoading] = useState(false);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      alert('Camera uploads are simulated on mobile devices. Tap "Enter Manually".');
    }
  };

  // AI Extracted Draft States
  const [draftFood, setDraftFood] = useState({ meal_category: 'vegetarian', main_items: [] as string[], portion_size: 'medium' });
  const [draftBill, setDraftBill] = useState({ billing_period_days: '30', units_consumed_kwh: '150' });
  const [draftReceipt, setDraftReceipt] = useState({ items: [] as { name: string, category: string, amount: string }[], total_amount: '' });

  // Manual fallback fields (shown when skip-photo is tapped or unreadable is triggered)
  const [isManualMode, setIsManualMode] = useState(false);
  const [isTotallyManual, setIsTotallyManual] = useState(false);
  const [manualFood, setManualFood] = useState({ meal_category: 'vegetarian', portion_size: 'medium', custom_description: '' });
  const [manualBill, setManualBill] = useState({ billing_period_days: '30', units_consumed_kwh: '' });
  const [manualReceipt, setManualReceipt] = useState({ category: 'groceries_veg', amount_spent: '', custom_description: '' });
  const [manualCustom, setManualCustom] = useState({ itemName: '', quantity: '', categoryUnit: 'food', description: '' });
  const [aiClarification, setAiClarification] = useState<string | null>(null);

  // Saved Results state (for STAGE_SAVED toast)
  const [savedResult, setSavedResult] = useState<any>(null);

  const getLoaderMessage = () => {
    switch (activeTab) {
      case 'food': return 'Analyzing your meal photo...';
      case 'electricity_bill': return 'Reading your electricity bill DISCOM...';
      case 'receipt': return 'Scanning receipt items...';
    }
  };

  const resetFlow = () => {
    setStage('capture');
    setIsManualMode(false);
    setIsTotallyManual(false);
    setCaptureId(null);
    setSavedResult(null);
    setSelectedImage(null);
    setAiClarification(null);
    setManualFood({ meal_category: 'vegetarian', portion_size: 'medium', custom_description: '' });
    setManualBill({ billing_period_days: '30', units_consumed_kwh: '' });
    setManualReceipt({ category: 'groceries_veg', amount_spent: '', custom_description: '' });
    setManualCustom({ itemName: '', quantity: '', categoryUnit: 'food', description: '' });
  };

  const handleCapture = async (skipPhoto = false) => {
    if (skipPhoto) {
      setIsManualMode(true);
      setStage('confirm');
      return;
    }

    setStage('processing');
    setIsLoading(true);
    try {
      const mockImage = `https://mockstorage.ecopilot.com/captures/test_${activeTab}.jpg`;
      const res = await apiPost('/captures', {
        capture_type: activeTab,
        image: selectedImage || mockImage
      });

      setCaptureId(res.captureId);
      setAiClarification(res.draftData?.clarification_prompt || null);

      const isUnreadable = res.draftData?.unreadable || !res.draftData;
      if (isUnreadable) {
        setIsManualMode(true);
      } else {
        if (activeTab === 'food') {
          setDraftFood({
            meal_category: res.draftData.meal_category,
            main_items: res.draftData.main_items || [],
            portion_size: res.draftData.portion_size
          });
        } else if (activeTab === 'electricity_bill') {
          setDraftBill({
            billing_period_days: String(res.draftData.billing_period_days || 30),
            units_consumed_kwh: String(res.draftData.units_consumed_kwh || '')
          });
        } else if (activeTab === 'receipt') {
          setDraftReceipt({
            items: res.draftData.items.map((it: any) => ({ ...it, amount: String(it.amount) })),
            total_amount: String(res.draftData.total_amount || '')
          });
        }
      }
      setStage('confirm');
    } catch (error) {
      console.error('Extraction failed, defaulting to manual entry form:', error);
      setIsManualMode(true);
      setStage('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = async () => {
    setIsLoading(true);
    try {
      let payload: any = {};
      
      if (isManualMode) {
        if (isTotallyManual) {
          payload = {
            is_totally_manual: true,
            item_name: manualCustom.itemName,
            quantity: manualCustom.quantity,
            category_unit: manualCustom.categoryUnit,
            description: manualCustom.description
          };
        } else {
          if (activeTab === 'food') payload = manualFood;
          else if (activeTab === 'electricity_bill') payload = manualBill;
          else if (activeTab === 'receipt') payload = manualReceipt;
        }
      } else {
        if (activeTab === 'food') payload = draftFood;
        else if (activeTab === 'electricity_bill') payload = draftBill;
        else if (activeTab === 'receipt') payload = draftReceipt;
      }

      let activeId = captureId;
      if (!activeId) {
        const draftRes = await apiPost('/captures', {
          capture_type: activeTab,
          image: 'manual_fallback_no_photo'
        });
        activeId = draftRes.captureId;
      }

      const res = await apiPatch(`/captures/${activeId}/confirm`, {
        confirmed_data: payload,
        was_manual_fallback: isManualMode
      });

      setSavedResult(res);
      await fetchDashboard();
      setStage('saved');
      
      if (onComplete) {
        setTimeout(onComplete, 4000);
      }
    } catch (error) {
      console.error('Failed to confirm capture:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.scrollOuter} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Capture Selector Tabs */}
      {stage === 'capture' && (
        <View style={[styles.tabRow, { backgroundColor: theme.backgroundSelected }]}>
          {(['food', 'electricity_bill', 'receipt'] as const).map(tab => (
            <Pressable
              key={tab}
              style={[styles.tabBtn, activeTab === tab && [styles.tabBtnActive, { backgroundColor: theme.background }]]}
              onPress={() => setActiveTab(tab)}
            >
              <ThemedText 
                type="smallBold" 
                style={[styles.tabText, { color: activeTab === tab ? '#2e7d32' : theme.textSecondary }]}
              >
                {tab === 'electricity_bill' ? 'Bill ⚡' : tab === 'food' ? 'Food 🍗' : 'Receipt 🛒'}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      {/* STAGE 1: CAPTURE Viewfinder */}
      {stage === 'capture' && (
        <ThemedView style={styles.viewfinderContainer}>
          <View style={[styles.viewfinderMock, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <>
                <ThemedText style={styles.cameraIcon}>📸</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  {activeTab === 'food' 
                    ? 'Align food meal in center frame' 
                    : activeTab === 'electricity_bill' 
                    ? 'Align bill DISCOM columns and consumption table' 
                    : 'Align paper receipt in frame'}
                </ThemedText>
              </>
            )}
          </View>

          <View style={styles.actionsBlock}>
            {!selectedImage ? (
              <Pressable style={styles.captureBtn} onPress={pickImage}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Select / Take Photo</ThemedText>
              </Pressable>
            ) : (
              <View style={styles.captureRow}>
                <Pressable style={[styles.captureBtn, { flex: 2 }]} onPress={() => handleCapture(false)}>
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>Analyze Photo</ThemedText>
                </Pressable>
                <Pressable style={[styles.cancelBtn, { height: 52, flex: 1, borderColor: theme.backgroundSelected }]} onPress={() => setSelectedImage(null)}>
                  <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>Clear</ThemedText>
                </Pressable>
              </View>
            )}

            {activeTab === 'receipt' ? (
              <Pressable style={styles.skipBtn} onPress={() => handleCapture(true)}>
                <ThemedText type="smallBold" style={{ color: '#2e7d32' }}>Skip photo, enter manually</ThemedText>
              </Pressable>
            ) : (
              <Pressable style={styles.skipBtn} onPress={() => handleCapture(true)}>
                <ThemedText type="smallBold" style={{ color: '#2e7d32' }}>Enter Manually</ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
      )}

      {/* STAGE 2: PROCESSING (Vision AI Loader) */}
      {stage === 'processing' && (
        <ThemedView style={styles.processingCard}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <ThemedText type="smallBold" style={styles.loadingMsg}>{getLoaderMessage()}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Extracting structured details for estimation...</ThemedText>
        </ThemedView>
      )}

      {/* STAGE 3: CONFIRM & EDIT FORM */}
      {stage === 'confirm' && (
        <ThemedView style={styles.formCard}>
          <ThemedText type="subtitle" style={styles.formTitle}>
            {isManualMode ? '✏️ Log Details' : '🔍 Confirm AI Details'}
          </ThemedText>
          
          <ThemedText type="small" themeColor="textSecondary" style={styles.formSubtitle}>
            {isManualMode 
              ? 'Please provide values manually below.' 
              : 'Tap on any field below to correct the AI draft extraction.'}
          </ThemedText>

          {isManualMode && (
            <View style={[styles.toggleContainer, { backgroundColor: theme.backgroundSelected }]}>
              <Pressable
                style={[styles.toggleSubBtn, !isTotallyManual && [styles.toggleSubBtnActive, { backgroundColor: theme.background }]]}
                onPress={() => setIsTotallyManual(false)}
              >
                <ThemedText type="smallBold" style={[styles.toggleSubText, { color: !isTotallyManual ? '#2e7d32' : theme.textSecondary }]}>
                  Guided Form
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.toggleSubBtn, isTotallyManual && [styles.toggleSubBtnActive, { backgroundColor: theme.background }]]}
                onPress={() => setIsTotallyManual(true)}
              >
                <ThemedText type="smallBold" style={[styles.toggleSubText, { color: isTotallyManual ? '#2e7d32' : theme.textSecondary }]}>
                  Totally Manual (No pretext)
                </ThemedText>
              </Pressable>
            </View>
          )}

          {aiClarification && !isManualMode && (
            <View style={styles.aiClarificationBadge}>
              <ThemedText type="smallBold" style={{ color: '#1b5e20' }}>💡 AI Observation</ThemedText>
              <ThemedText type="small" style={{ color: '#2e7d32', marginTop: 2, fontSize: 13, lineHeight: 18 }}>
                {aiClarification}
              </ThemedText>
            </View>
          )}

          {/* Form Fields Render depending on Active Tab and Mode */}
          {isManualMode && isTotallyManual ? (
            <View style={styles.formFields}>
              <ThemedText type="smallBold">Item / Activity Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="e.g. Electricity bill, Veg Biryani, Petrol"
                placeholderTextColor="#999"
                value={manualCustom.itemName}
                onChangeText={(val) => setManualCustom(p => ({ ...p, itemName: val }))}
              />

              <ThemedText type="smallBold">Quantity / Amount</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                keyboardType="numeric"
                placeholder="e.g. 150, 2, 45"
                placeholderTextColor="#999"
                value={manualCustom.quantity}
                onChangeText={(val) => setManualCustom(p => ({ ...p, quantity: val }))}
              />

              <ThemedText type="smallBold">Category / Unit</ThemedText>
              <View style={styles.rowChoicesWrap}>
                {[
                  { id: 'food', label: 'Food (portions)' },
                  { id: 'electricity', label: 'Electricity (kWh)' },
                  { id: 'shopping', label: 'Shopping (₹ spent)' },
                  { id: 'fuel', label: 'Fuel (Litres)' },
                  { id: 'transport', label: 'Transport (km)' },
                  { id: 'other', label: 'Other / General' }
                ].map(cat => (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.choiceBtn,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                      manualCustom.categoryUnit === cat.id && [styles.choiceActive, { borderColor: '#2e7d32' }],
                      { width: '48%', marginVertical: 4 }
                    ]}
                    onPress={() => setManualCustom(p => ({ ...p, categoryUnit: cat.id }))}
                  >
                    <ThemedText type="small" style={[styles.choiceText, { color: manualCustom.categoryUnit === cat.id ? '#2e7d32' : theme.textSecondary }]}>
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>Optional Details / Description</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="e.g. travel by diesel SUV, dinner with 3 people"
                placeholderTextColor="#999"
                value={manualCustom.description}
                onChangeText={(val) => setManualCustom(p => ({ ...p, description: val }))}
              />
            </View>
          ) : (
            <>
              {activeTab === 'food' && (
                <View style={styles.formFields}>
                  <ThemedText type="smallBold">Meal Category</ThemedText>
                  <View style={styles.rowChoices}>
                    {['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian'].map(cat => {
                      const currentCat = isManualMode ? manualFood.meal_category : draftFood.meal_category;
                      const setCat = (val: string) => {
                        if (isManualMode) setManualFood(p => ({ ...p, meal_category: val }));
                        else setDraftFood(p => ({ ...p, meal_category: val }));
                      };
                      return (
                        <Pressable
                          key={cat}
                          style={[
                            styles.choiceBtn,
                            { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                            currentCat === cat && [styles.choiceActive, { borderColor: '#2e7d32' }]
                          ]}
                          onPress={() => setCat(cat)}
                        >
                          <ThemedText type="small" style={[styles.choiceText, { color: currentCat === cat ? '#2e7d32' : theme.textSecondary }]}>
                            {cat.replace('-', ' ')}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  <ThemedText type="smallBold">Portion Size</ThemedText>
                  <View style={styles.rowChoices}>
                    {['small', 'medium', 'large'].map(portion => {
                      const currentPortion = isManualMode ? manualFood.portion_size : draftFood.portion_size;
                      const setPortion = (val: string) => {
                        if (isManualMode) setManualFood(p => ({ ...p, portion_size: val }));
                        else setDraftFood(p => ({ ...p, portion_size: val }));
                      };
                      return (
                        <Pressable
                          key={portion}
                          style={[
                            styles.choiceBtn,
                            { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                            currentPortion === portion && [styles.choiceActive, { borderColor: '#2e7d32' }]
                          ]}
                          onPress={() => setPortion(portion)}
                        >
                          <ThemedText type="small" style={[styles.choiceText, { color: currentPortion === portion ? '#2e7d32' : theme.textSecondary }]}>
                            {portion}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  {!isManualMode && draftFood.main_items.length > 0 && (
                    <View>
                      <ThemedText type="smallBold">Detected Items</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.detectList}>
                        {draftFood.main_items.join(', ')}
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'electricity_bill' && (
                <View style={styles.formFields}>
                  <ThemedText type="smallBold">Units Consumed (kWh)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                    keyboardType="numeric"
                    placeholder="e.g. 180"
                    placeholderTextColor="#999"
                    value={isManualMode ? manualBill.units_consumed_kwh : draftBill.units_consumed_kwh}
                    onChangeText={(val) => {
                      if (isManualMode) setManualBill(p => ({ ...p, units_consumed_kwh: val }));
                      else setDraftBill(p => ({ ...p, units_consumed_kwh: val }));
                    }}
                  />

                  <ThemedText type="smallBold">Billing Period (Days)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                    keyboardType="numeric"
                    placeholder="30"
                    placeholderTextColor="#999"
                    value={isManualMode ? manualBill.billing_period_days : draftBill.billing_period_days}
                    onChangeText={(val) => {
                      if (isManualMode) setManualBill(p => ({ ...p, billing_period_days: val }));
                      else setDraftBill(p => ({ ...p, billing_period_days: val }));
                    }}
                  />
                </View>
              )}

              {activeTab === 'receipt' && (
                <View style={styles.formFields}>
                  {isManualMode ? (
                    <>
                      <ThemedText type="smallBold">Shopping Category</ThemedText>
                      <View style={styles.rowChoicesWrap}>
                        {[
                          { id: 'groceries_veg', label: 'Veg Groceries' },
                          { id: 'groceries_packaged', label: 'Packaged Food' },
                          { id: 'clothing', label: 'Clothing' },
                          { id: 'electronics', label: 'Electronics' },
                          { id: 'household', label: 'Household' },
                          { id: 'other', label: 'Other / Bills' }
                        ].map(cat => (
                          <Pressable
                            key={cat.id}
                            style={[
                              styles.choiceBtn, 
                              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                              manualReceipt.category === cat.id && [styles.choiceActive, { borderColor: '#2e7d32' }], 
                              { width: '47%', marginVertical: 4 }
                            ]}
                            onPress={() => setManualReceipt(p => ({ ...p, category: cat.id }))}
                          >
                            <ThemedText type="small" style={[styles.choiceText, { color: manualReceipt.category === cat.id ? '#2e7d32' : theme.textSecondary }]}>
                              {cat.label}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>

                      <ThemedText type="smallBold">Amount Spent (₹)</ThemedText>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                        keyboardType="numeric"
                        placeholder="e.g. 450"
                        placeholderTextColor="#999"
                        value={manualReceipt.amount_spent}
                        onChangeText={(val) => setManualReceipt(p => ({ ...p, amount_spent: val }))}
                      />
                    </>
                  ) : (
                    <>
                      <ThemedText type="smallBold">Detected Invoice Items</ThemedText>
                      {draftReceipt.items.map((item, idx) => (
                        <View key={idx} style={styles.receiptItemRow}>
                          <TextInput
                            style={[styles.input, { flex: 2, marginBottom: 0, height: 40, backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                            value={item.name}
                            onChangeText={(val) => {
                              const newItems = [...draftReceipt.items];
                              newItems[idx].name = val;
                              setDraftReceipt(p => ({ ...p, items: newItems }));
                            }}
                          />
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0, height: 40, backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                            keyboardType="numeric"
                            value={item.amount}
                            onChangeText={(val) => {
                              const newItems = [...draftReceipt.items];
                              newItems[idx].amount = val;
                              setDraftReceipt(p => ({ ...p, items: newItems }));
                            }}
                          />
                        </View>
                      ))}
                      
                      <ThemedText type="smallBold" style={{ marginTop: Spacing.two }}>
                        Total Bill Amount: ₹{draftReceipt.total_amount}
                      </ThemedText>
                    </>
                  )}
                </View>
              )}
            </>
          )}

          {/* Fallback to Manual Toggle Link */}
          {!isManualMode && (
            <Pressable style={styles.fallbackLink} onPress={() => setIsManualMode(true)}>
              <ThemedText type="linkPrimary" style={{ textAlign: 'center' }}>
                None of this looks right — enter manually
              </ThemedText>
            </Pressable>
          )}

          {/* Action CTAs */}
          <View style={styles.confirmActions}>
            <Pressable style={styles.cancelBtn} onPress={resetFlow} disabled={isLoading}>
              <ThemedText type="smallBold" style={{ color: '#555' }}>Retake</ThemedText>
            </Pressable>

            <Pressable 
              style={[styles.saveBtn, isLoading && styles.buttonDisabled]} 
              onPress={handleConfirmSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Confirm & Save</ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      )}

      {/* STAGE 4: SAVED SUCCESS TOAST */}
      {stage === 'saved' && savedResult && (
        <ThemedView style={styles.savedCard}>
          <ThemedText style={styles.successEmoji}>🎉</ThemedText>
          <ThemedText type="subtitle" style={styles.successTitle}>Carbon Logged!</ThemedText>
          
          <ThemedView type="backgroundElement" style={styles.successValueContainer}>
            <ThemedText type="title" style={{ color: '#1b5e20', fontWeight: '800' }}>
              +{savedResult.estimatedCo2Kg} <ThemedText type="smallBold" style={{ fontSize: 18 }}>kg CO₂</ThemedText>
            </ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">added today</ThemedText>
          </ThemedView>

          <View style={styles.equivalencyColumn}>
            <ThemedText type="smallBold" style={{ color: '#2e7d32', textAlign: 'center' }}>
              🌳 Equivalent to {savedResult.treesEquivalent} trees absorption / yr
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 4 }}>
              ⛽ ≈ {savedResult.petrolEquivalent} Litres of petrol combusted
            </ThemedText>
          </View>

          <Pressable style={styles.doneBtn} onPress={resetFlow}>
            <ThemedText type="smallBold" style={{ color: '#fff' }}>Log Another Activity</ThemedText>
          </Pressable>
        </ThemedView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollOuter: {
    flex: 1,
    width: '100%',
  },
  container: {
    padding: Spacing.four,
    paddingTop: Platform.OS === 'web' ? 90 : Spacing.four,
    gap: Spacing.four,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: Spacing.three,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Spacing.two,
  },
  tabBtnActive: {
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
  tabTextActive: {
    color: '#2e7d32',
  },
  viewfinderContainer: {
    gap: Spacing.four,
  },
  viewfinderMock: {
    height: 320,
    backgroundColor: '#222',
    borderRadius: Spacing.four,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    borderWidth: 2,
    borderColor: '#4caf50',
    borderStyle: 'dashed',
  },
  cameraIcon: {
    fontSize: 56,
    marginBottom: Spacing.two,
  },
  actionsBlock: {
    gap: Spacing.three,
  },
  captureBtn: {
    height: 52,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipBtn: {
    height: 52,
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  processingCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loadingMsg: {
    marginTop: Spacing.two,
    color: '#2e7d32',
  },
  formCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1.5,
    borderColor: 'rgba(76, 175, 80, 0.15)',
    gap: Spacing.three,
  },
  formTitle: {
    fontWeight: '700',
    color: '#2e7d32',
  },
  formSubtitle: {
    marginTop: -Spacing.one,
  },
  formFields: {
    gap: Spacing.three,
    marginVertical: Spacing.two,
  },
  rowChoices: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  rowChoicesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  choiceBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  choiceActive: {
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  choiceText: {
    color: '#666',
    fontSize: 12,
  },
  choiceTextActive: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  detectList: {
    padding: Spacing.two,
    backgroundColor: '#f9f9f9',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: '#eee',
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fafafa',
    marginBottom: Spacing.one,
  },
  receiptItemRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: 2,
  },
  fallbackLink: {
    padding: Spacing.two,
    marginTop: Spacing.one,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    flex: 2,
    height: 48,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  savedCard: {
    padding: Spacing.five,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.four,
    borderWidth: 1.5,
    borderColor: '#2e7d32',
    backgroundColor: 'rgba(76, 175, 80, 0.04)',
  },
  successEmoji: {
    fontSize: 48,
  },
  successTitle: {
    fontWeight: '700',
    color: '#2e7d32',
    textAlign: 'center',
  },
  successValueContainer: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    width: '100%',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  equivalencyColumn: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  doneBtn: {
    height: 48,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: Spacing.two,
  },
  aiClarificationBadge: {
    padding: Spacing.three,
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    marginVertical: Spacing.two,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: Spacing.two,
    padding: 3,
    gap: 4,
    marginVertical: Spacing.two,
  },
  toggleSubBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleSubBtnActive: {
    backgroundColor: '#fff',
    elevation: 1,
  },
  toggleSubText: {
    color: '#666',
    fontSize: 12,
  },
  toggleSubTextActive: {
    color: '#2e7d32',
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: Spacing.three,
  },
  captureRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    width: '100%',
  },
});

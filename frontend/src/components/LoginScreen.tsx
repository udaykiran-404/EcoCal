import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/use-theme';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { login, signup } = useApp();
  const theme = useTheme();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    if (!loginEmail || !loginPassword) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    setErrorMessage('');
    if (!signupName || !signupEmail || !signupPassword || !signupConfirmPassword) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signup(signupName.trim(), signupEmail.trim(), signupPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Sign up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
    setErrorMessage('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
      enabled={Platform.OS !== 'web'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.card}>
          <View style={styles.header}>
            <ThemedText style={styles.logoIcon}>🌱</ThemedText>
            <ThemedText type="subtitle" style={styles.brandTitle}>EcoPilot</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.brandSubtitle}>
              Frictionless carbon tracking for a greener tomorrow
            </ThemedText>
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <ThemedText type="small" style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          ) : null}

          {/* Mode Switcher Tabs */}
          <View style={[styles.tabContainer, { backgroundColor: theme.backgroundSelected }]}>
            <Pressable 
              style={[styles.tabButton, authMode === 'login' && [styles.tabActive, { backgroundColor: theme.background }]]}
              onPress={() => setAuthMode('login')}
              disabled={isLoading}
            >
              <ThemedText 
                type="smallBold" 
                style={[
                  styles.tabText, 
                  { color: authMode === 'login' ? '#2e7d32' : theme.textSecondary }
                ]}
              >
                Sign In
              </ThemedText>
            </Pressable>
            
            <Pressable 
              style={[styles.tabButton, authMode === 'signup' && [styles.tabActive, { backgroundColor: theme.background }]]}
              onPress={() => setAuthMode('signup')}
              disabled={isLoading}
            >
              <ThemedText 
                type="smallBold" 
                style={[
                  styles.tabText, 
                  { color: authMode === 'signup' ? '#2e7d32' : theme.textSecondary }
                ]}
              >
                Register
              </ThemedText>
            </Pressable>
          </View>

          {authMode === 'login' ? (
            <View style={styles.form}>
              <ThemedText type="smallBold" style={styles.label}>Email Address</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="you@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={loginEmail}
                onChangeText={setLoginEmail}
                editable={!isLoading}
              />
              
              <ThemedText type="smallBold" style={styles.label}>Password</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="••••••••"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                value={loginPassword}
                onChangeText={setLoginPassword}
                editable={!isLoading}
              />
              
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled
                ]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={styles.buttonText}>Sign In</ThemedText>
                )}
              </Pressable>
              
              <Pressable onPress={toggleAuthMode} disabled={isLoading} style={styles.toggleLink}>
                <ThemedText type="linkPrimary" style={{ textAlign: 'center' }}>
                  {"Don't have an account? Register here"}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <ThemedText type="smallBold" style={styles.label}>Full Name</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="Alex Thompson"
                placeholderTextColor="#999"
                value={signupName}
                onChangeText={setSignupName}
                editable={!isLoading}
              />

              <ThemedText type="smallBold" style={styles.label}>Email Address</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="you@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                value={signupEmail}
                onChangeText={setSignupEmail}
                editable={!isLoading}
              />
              
              <ThemedText type="smallBold" style={styles.label}>Password</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="••••••••"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                value={signupPassword}
                onChangeText={setSignupPassword}
                editable={!isLoading}
              />

              <ThemedText type="smallBold" style={styles.label}>Confirm Password</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="••••••••"
                placeholderTextColor="#999"
                secureTextEntry
                autoCapitalize="none"
                value={signupConfirmPassword}
                onChangeText={setSignupConfirmPassword}
                editable={!isLoading}
              />
              
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled
                ]}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={styles.buttonText}>Create Account</ThemedText>
                )}
              </Pressable>
              
              <Pressable onPress={toggleAuthMode} disabled={isLoading} style={styles.toggleLink}>
                <ThemedText type="linkPrimary" style={{ textAlign: 'center' }}>
                  Already have an account? Sign In here
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.15)',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  logoIcon: {
    fontSize: 40,
    marginBottom: Spacing.one,
  },
  brandTitle: {
    fontWeight: '700',
    color: '#2e7d32',
  },
  brandSubtitle: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderRadius: Spacing.two,
    padding: 3,
    marginBottom: Spacing.three,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Spacing.one + 2,
  },
  tabActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  tabText: {
    color: '#666',
  },
  tabTextActive: {
    color: '#2e7d32',
  },
  form: {
    gap: Spacing.three,
  },
  label: {
    marginBottom: -Spacing.two,
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
  button: {
    height: 48,
    backgroundColor: '#2e7d32',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: {
    backgroundColor: '#1b5e20',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  errorContainer: {
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.3)',
    borderRadius: Spacing.two,
    padding: Spacing.two,
    marginBottom: Spacing.two,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  toggleLink: {
    padding: Spacing.two,
    marginTop: Spacing.one,
  },
});

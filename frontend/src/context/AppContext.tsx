import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firebaseService } from '../services/firebaseService';

interface AppContextType {
  user: FirebaseUser | null;
  userId: string | null;
  isAuthenticated: boolean;
  hasProfile: boolean;
  isLoading: boolean;
  dashboardData: any;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  submitOnboarding: (data: any) => Promise<any>;
  completeOnboarding: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  apiGet: (path: string) => Promise<any>;
  apiPost: (path: string, body: any) => Promise<any>;
  apiPatch: (path: string, body: any) => Promise<any>;
  setHasProfile: (val: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Load auth state from Firebase on startup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
        
        try {
          // Check if profile exists
          const profile = await firebaseService.getOnboardingProfile(currentUser.uid);
          setHasProfile(!!profile);
          if (profile) {
            const dash = await firebaseService.fetchDashboard(currentUser.uid);
            setDashboardData(dash);
          } else {
            setDashboardData(null);
          }
        } catch (err) {
          console.error('[AppContext] Error loading user Firestore data:', err);
        }
      } else {
        setUser(null);
        setUserId(null);
        setHasProfile(false);
        setDashboardData(null);
      }
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error('[Firebase Auth] Sign in failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const signup = async (name: string, email: string, pass: string) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });
        // Create user document in firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          userId: userCredential.user.uid,
          name,
          email,
          ecoPoints: 100, // starting points
          streak: 0,
          hasProfile: false
        });
      }
    } catch (error: any) {
      console.error('[Firebase Auth] Sign up failed:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('[Firebase Auth] Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitOnboarding = async (formData: any) => {
    if (!userId) throw new Error('Not authenticated');
    return await firebaseService.saveOnboardingProfile(userId, formData);
  };

  const completeOnboarding = async () => {
    setHasProfile(true);
    await fetchDashboard();
  };

  const fetchDashboard = async () => {
    if (!userId) return;
    try {
      const data = await firebaseService.fetchDashboard(userId);
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    }
  };

  // REST API Emulation over client-side Firestore
  const apiGet = async (path: string) => {
    if (!userId) throw new Error('Not authenticated');
    if (path === '/dashboard') {
      return await firebaseService.fetchDashboard(userId);
    }
    if (path === '/goals') {
      return await firebaseService.getGoals(userId);
    }
    if (path === '/history') {
      return await firebaseService.getEmissionsHistory(userId);
    }
    if (path.startsWith('/calendar')) {
      const match = path.match(/[?&]month=([^&]+)/);
      const month = match ? match[1] : new Date().toISOString().substring(0, 7);
      return await firebaseService.getMonthlyCalendarData(userId, month);
    }
    throw new Error(`GET Endpoint ${path} not implemented`);
  };

  const apiPost = async (path: string, body: any) => {
    if (!userId) throw new Error('Not authenticated');
    if (path === '/checkin') {
      return await firebaseService.saveDailyCheckin(userId, body);
    }
    if (path === '/checkin/activity') {
      const targetDate = body.log_date || new Date().toISOString().split('T')[0];
      return await firebaseService.saveDailyActivity(userId, targetDate, body.activity_type, body.value);
    }
    if (path === '/checkin/conclude') {
      const targetDate = body.log_date || new Date().toISOString().split('T')[0];
      return await firebaseService.concludeDailyLog(userId, targetDate);
    }
    if (path === '/captures') {
      return await firebaseService.uploadCaptureDraft(userId, body.capture_type, body.image);
    }
    if (path === '/onboarding') {
      return await firebaseService.saveOnboardingProfile(userId, body);
    }
    if (path === '/goals') {
      return await firebaseService.startGoal(userId, body.goal_type);
    }
    if (path.startsWith('/goals/') && path.endsWith('/progress')) {
      const parts = path.split('/');
      const goalId = parts[2];
      return await firebaseService.updateGoalProgress(userId, goalId, body.log_date, body.completed);
    }
    throw new Error(`POST Endpoint ${path} not implemented`);
  };

  const apiPatch = async (path: string, body: any) => {
    if (!userId) throw new Error('Not authenticated');
    if (path.startsWith('/captures/') && path.endsWith('/confirm')) {
      const parts = path.split('/');
      const captureId = parts[2];
      return await firebaseService.confirmCapture(userId, captureId, body.confirmed_data, body.was_manual_fallback);
    }
    throw new Error(`PATCH Endpoint ${path} not implemented`);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        userId,
        isAuthenticated: !!userId,
        hasProfile,
        isLoading,
        dashboardData,
        login,
        signup,
        logout,
        submitOnboarding,
        completeOnboarding,
        fetchDashboard,
        apiGet,
        apiPost,
        apiPatch,
        setHasProfile
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

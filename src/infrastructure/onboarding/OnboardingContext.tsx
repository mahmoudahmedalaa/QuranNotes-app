import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';

const ONBOARDING_KEY_PREFIX = '@quran_notes:onboarding:';

export interface OnboardingState {
    completed: boolean;
    currentStep: number; // 1-5
    skippedAt?: string; // ISO timestamp if skipped
    recordingMade?: boolean; // Track if they made a recording
}

const INITIAL_STATE: OnboardingState = {
    completed: false,
    currentStep: 1,
};

interface OnboardingContextType {
    state: OnboardingState;
    loading: boolean;
    goToStep: (step: number) => void;
    completeOnboarding: () => Promise<void>;
    skipOnboarding: () => Promise<void>;
    markRecordingMade: () => void;
    resetOnboarding: () => Promise<void>;
    shouldShowOnboarding: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding must be used within OnboardingProvider');
    }
    return context;
};

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
    const [loading, setLoading] = useState(true);

    // Determines the storage key based on current user
    const getStorageKey = () => {
        if (!user) return null;
        return `${ONBOARDING_KEY_PREFIX}${user.id}`;
    };

    useEffect(() => {
        loadOnboardingState();
    }, [user]);

    const loadOnboardingState = async () => {
        setLoading(true);
        const key = getStorageKey();

        if (!key) {
            // No user -> Reset to initial
            setState(INITIAL_STATE);
            setLoading(false);
            return;
        }

        try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                setState(parsed);
            } else {
                // New user (no onboarding data yet)
                // Check if this is a sign-in (user already exists in Firebase but no local onboarding data).
                // We check user's creationTime vs current time. If account is older than 60 seconds,
                // it's a returning user → skip onboarding automatically.
                const creationTime = user?.createdAt;
                if (creationTime) {
                    const ageMs = Date.now() - new Date(creationTime).getTime();
                    const isReturningUser = ageMs > 60_000; // account older than 60 seconds = returning
                    if (isReturningUser) {
                        // Returning user — mark onboarding as complete
                        const completedState: OnboardingState = { ...INITIAL_STATE, completed: true };
                        await AsyncStorage.setItem(key, JSON.stringify(completedState));
                        setState(completedState);
                    } else {
                        // Genuinely new user — show onboarding
                        setState(INITIAL_STATE);
                    }
                } else {
                    // No creation time available — fall back to initial
                    setState(INITIAL_STATE);
                }
            }
        } catch (error) {
            console.error('Failed to load onboarding state:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveState = async (newState: OnboardingState) => {
        const key = getStorageKey();

        // Set state in-memory immediately to prevent race conditions
        setState(newState);

        if (!key) return;

        try {
            await AsyncStorage.setItem(key, JSON.stringify(newState));
        } catch (error) {
            console.error('Failed to save onboarding state:', error);
        }
    };

    const goToStep = (step: number) => {
        const newState = { ...state, currentStep: step };
        saveState(newState);
    };

    const completeOnboarding = async () => {
        const newState = { ...state, completed: true };
        await saveState(newState);
    };

    const skipOnboarding = async () => {
        const newState = {
            ...state,
            completed: true,
            skippedAt: new Date().toISOString(),
        };
        await saveState(newState);
    };

    const markRecordingMade = () => {
        const newState = { ...state, recordingMade: true };
        saveState(newState);
    };

    const resetOnboarding = async () => {
        await saveState(INITIAL_STATE);
    };

    const shouldShowOnboarding = !loading && !state.completed;

    return (
        <OnboardingContext.Provider
            value={{
                state,
                loading,
                goToStep,
                completeOnboarding,
                skipOnboarding,
                markRecordingMade,
                resetOnboarding,
                shouldShowOnboarding,
            }}>
            {children}
        </OnboardingContext.Provider>
    );
};

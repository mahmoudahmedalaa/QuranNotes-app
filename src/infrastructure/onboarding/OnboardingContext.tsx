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
        return `${ONBOARDING_KEY_PREFIX}${user.uid}`;
    };

    useEffect(() => {
        loadOnboardingState();
    }, [user]);

    const loadOnboardingState = async () => {
        setLoading(true);
        const key = getStorageKey();

        if (!key) {
            // No user -> Reset to initial (not completed) or maybe completed if guest?
            // For now, reset to initial.
            setState(INITIAL_STATE);
            setLoading(false);
            return;
        }

        try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
                setState(JSON.parse(data));
            } else {
                // New user (no data yet) -> Start fresh
                setState(INITIAL_STATE);
            }
        } catch (error) {
            console.error('Failed to load onboarding state:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveState = async (newState: OnboardingState) => {
        const key = getStorageKey();
        if (!key) return; // Don't save if no user (or save to guest key?)

        try {
            await AsyncStorage.setItem(key, JSON.stringify(newState));
            setState(newState);
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

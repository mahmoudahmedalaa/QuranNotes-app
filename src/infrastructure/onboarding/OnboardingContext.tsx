import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@quran_notes:onboarding';

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
    const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOnboardingState();
    }, []);

    const loadOnboardingState = async () => {
        try {
            const data = await AsyncStorage.getItem(ONBOARDING_KEY);
            if (data) {
                setState(JSON.parse(data));
            }
        } catch (error) {
            console.error('Failed to load onboarding state:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveState = async (newState: OnboardingState) => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState));
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

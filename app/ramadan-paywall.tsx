import { useLocalSearchParams } from 'expo-router';
import RamadanPaywallScreen from '../src/features/payments/presentation/RamadanPaywallScreen';

export default function RamadanPaywallRoute() {
    const { hard, location } = useLocalSearchParams<{ hard?: string; location?: string }>();

    return (
        <RamadanPaywallScreen
            allowDismiss={hard !== '1'}
            location={location === 'onboarding' ? 'onboarding' : 'ramadan'}
        />
    );
}

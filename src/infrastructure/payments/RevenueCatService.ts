import Purchases, {
    PurchasesOffering,
    PurchasesPackage,
    CustomerInfo,
    LOG_LEVEL
} from 'react-native-purchases';
export { PurchasesOffering, PurchasesPackage, CustomerInfo };
import { Platform } from 'react-native';

const API_KEYS = {
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
};

class RevenueCatService {
    private static instance: RevenueCatService;
    private isInitialized = false;

    private constructor() { }

    static getInstance(): RevenueCatService {
        if (!RevenueCatService.instance) {
            RevenueCatService.instance = new RevenueCatService();
        }
        return RevenueCatService.instance;
    }

    async initialize() {
        if (this.isInitialized) return;

        const apiKey = Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android;
        if (!apiKey) {
            console.warn('RevenueCat API key not found');
            return;
        }

        if (__DEV__) {
            Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }

        await Purchases.configure({ apiKey });
        this.isInitialized = true;
    }

    async getOfferings(): Promise<PurchasesOffering | null> {
        if (!this.isInitialized) {
            console.warn('[RevenueCat] Not initialized, attempting to initialize...');
            await this.initialize();
        }

        try {
            console.log('[RevenueCat] Fetching offerings...');
            const offerings = await Purchases.getOfferings();
            console.log('[RevenueCat] Offerings fetched:', JSON.stringify(offerings));
            if (!offerings.current) {
                console.warn('[RevenueCat] No current offering found. Check RevenueCat dashboard.');
            }
            return offerings.current;
        } catch (e: any) {
            console.error('[RevenueCat] Error fetching offerings:', e.message, e.code, e.userInfo);
            return null;
        }
    }

    async purchasePackage(pack: PurchasesPackage): Promise<{ success: boolean; userCancelled?: boolean; error?: string }> {
        try {
            console.log('[RevenueCat] Purchasing package:', pack.identifier);
            const { customerInfo } = await Purchases.purchasePackage(pack);
            const isPro = this.isPro(customerInfo);
            return { success: isPro };
        } catch (e: any) {
            // Log full error for debugging
            console.log('[RevenueCat] Purchase Error Object:', e);

            // Robust Cancellation Detection
            // Code 1 = UserCancelled
            const isCancelled = e.userCancelled === true || e.code === '1' || e.code === 1 || (e.message && e.message.includes('cancelled'));

            if (isCancelled) {
                console.log('[RevenueCat] User cancelled purchase - suppressing error.');
                return { success: false, userCancelled: true };
            }

            // Sanitize Error Message
            let cleanMessage = 'Could not complete purchase.';
            if (e.message) {
                // Remove RevenueCat prefixes like "[RevenueCat] 🍎‼️"
                cleanMessage = e.message.replace(/\[RevenueCat\]|🍎|‼️/g, '').trim();
                // Fix capitalization
                cleanMessage = cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1);
            }

            // Map common error codes to friendly messages
            if (e.code === 2) cleanMessage = 'Store problem. Please try again later.'; // StoreProblemError
            if (e.code === 3) cleanMessage = 'Purchase not allowed on this device.'; // PurchaseNotAllowedError
            if (e.code === 4) cleanMessage = 'Invalid purchase configuration.'; // InvalidPurchaseError
            if (e.code === 10) cleanMessage = 'Network error. Please check your connection.'; // NetworkError

            console.error('[RevenueCat] Return user-friendly error:', cleanMessage);
            return { success: false, userCancelled: false, error: cleanMessage };
        }
    }

    async restorePurchases(): Promise<boolean> {
        try {
            const customerInfo = await Purchases.restorePurchases();
            return this.isPro(customerInfo);
        } catch (e) {
            console.error('Restore error:', e);
            return false;
        }
    }

    async getCustomerInfo(): Promise<CustomerInfo> {
        return await Purchases.getCustomerInfo();
    }

    isPro(customerInfo: CustomerInfo): boolean {
        // Replace 'pro_access' with your actual entitlement identifier from RevenueCat dashboard
        const entitlement = customerInfo.entitlements.active['pro_access'];
        return !!entitlement;
    }
}

export const revenueCatService = RevenueCatService.getInstance();

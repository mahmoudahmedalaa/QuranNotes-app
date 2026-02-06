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

    async purchasePackage(pack: PurchasesPackage): Promise<boolean> {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pack);
            return this.isPro(customerInfo);
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error('Purchase error:', e);
            }
            return false;
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

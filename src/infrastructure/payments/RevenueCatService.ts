import Purchases, {
    PurchasesOffering,
    PurchasesPackage,
    CustomerInfo,
    LOG_LEVEL
} from 'react-native-purchases';
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
        try {
            const offerings = await Purchases.getOfferings();
            return offerings.current;
        } catch (e) {
            console.error('Error fetching offerings:', e);
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

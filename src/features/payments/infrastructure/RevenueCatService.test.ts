import Purchases from 'react-native-purchases';
import { revenueCatService } from './RevenueCatService';

const PRO_CUSTOMER_INFO = {
    entitlements: { active: { pro_access: { identifier: 'pro_access' } } },
};
const LOCKED_CUSTOMER_INFO = {
    entitlements: { active: {} },
};

function purchasesMock(name: keyof typeof Purchases): jest.Mock {
    return Purchases[name] as unknown as jest.Mock;
}

describe('RevenueCatService identity', () => {
    let warnSpy: jest.SpyInstance;

    beforeAll(() => {
        Object.assign(Purchases, {
            getAppUserID: jest.fn(),
            logIn: jest.fn(),
            logOut: jest.fn(),
        });
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        purchasesMock('logOut').mockResolvedValue(LOCKED_CUSTOMER_INFO);
        await revenueCatService.logoutUser();
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('logs in an initial Firebase user and returns authoritative customer info', async () => {
        purchasesMock('getAppUserID')
            .mockResolvedValueOnce('$RCAnonymousID:old')
            .mockResolvedValueOnce('firebase-uid');
        purchasesMock('logIn').mockResolvedValue({ customerInfo: PRO_CUSTOMER_INFO });

        await expect(revenueCatService.ensureUserIdentity('firebase-uid')).resolves.toBe(PRO_CUSTOMER_INFO);

        expect(Purchases.logIn).toHaveBeenCalledWith('firebase-uid');
        expect(Purchases.getAppUserID).toHaveBeenCalledTimes(2);
    });

    it('does not log in again when RevenueCat already has the Firebase UID', async () => {
        purchasesMock('getAppUserID').mockResolvedValue('firebase-uid');
        purchasesMock('getCustomerInfo').mockResolvedValue(PRO_CUSTOMER_INFO);

        await expect(revenueCatService.ensureUserIdentity('firebase-uid')).resolves.toBe(PRO_CUSTOMER_INFO);

        expect(Purchases.logIn).not.toHaveBeenCalled();
        expect(Purchases.getCustomerInfo).toHaveBeenCalled();
    });

    it('clears service identity readiness on logout', async () => {
        purchasesMock('getAppUserID').mockResolvedValue('firebase-uid');
        purchasesMock('getCustomerInfo').mockResolvedValue(PRO_CUSTOMER_INFO);
        await revenueCatService.ensureUserIdentity('firebase-uid');
        expect(revenueCatService.isIdentityReady('firebase-uid')).toBe(true);

        await revenueCatService.logoutUser();

        expect(revenueCatService.isIdentityReady('firebase-uid')).toBe(false);
    });

    it('fails closed with a sanitized error when login fails', async () => {
        purchasesMock('getAppUserID').mockResolvedValue('$RCAnonymousID:old');
        purchasesMock('logIn').mockRejectedValue(new Error('provider secret details'));

        let caughtError: unknown;
        try {
            await revenueCatService.ensureUserIdentity('firebase-uid');
        } catch (error) {
            caughtError = error;
        }
        expect(caughtError).toEqual(new Error(
            'Could not verify your purchase account. Please sign in again and retry.',
        ));
        expect(String(caughtError)).not.toContain('provider secret details');
    });

    it('fails closed when RevenueCat reports a different app user ID after login', async () => {
        purchasesMock('getAppUserID')
            .mockResolvedValueOnce('$RCAnonymousID:old')
            .mockResolvedValueOnce('different-user');
        purchasesMock('logIn').mockResolvedValue({ customerInfo: PRO_CUSTOMER_INFO });

        await expect(revenueCatService.ensureUserIdentity('firebase-uid')).rejects.toThrow(
            'Could not verify your purchase account. Please sign in again and retry.',
        );
    });

    it('never exposes a provider purchase error to callers', async () => {
        purchasesMock('purchasePackage').mockRejectedValue(new Error('RevenueCat private provider failure'));

        await expect(revenueCatService.purchasePackage({} as never)).resolves.toEqual({
            success: false,
            userCancelled: false,
            error: 'Could not complete purchase. Please try again.',
        });
    });
});

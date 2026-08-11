import {
    configureAppCheckProvider,
    getQuranNotesAppCheckToken,
    resetAppCheckForTests,
} from './AppCheckService';

jest.mock('./NativeAppCheckProvider', () => ({
    nativeAppCheckTokenProvider: {
        initialize: jest.fn(async () => undefined),
        getToken: jest.fn(async () => 'native-app-check-token'),
    },
}));

describe('AppCheckService', () => {
    afterEach(() => resetAppCheckForTests());

    it('initializes an injected provider exactly once for concurrent token requests', async () => {
        const initialize = jest.fn(async () => undefined);
        const getToken = jest.fn(async () => 'app-check-token');
        configureAppCheckProvider({ initialize, getToken });

        await Promise.all([getQuranNotesAppCheckToken(), getQuranNotesAppCheckToken()]);

        expect(initialize).toHaveBeenCalledTimes(1);
        expect(getToken).toHaveBeenCalledTimes(2);
    });

    it('fails closed when no provider has been configured', async () => {
        configureAppCheckProvider(null);
        await expect(getQuranNotesAppCheckToken()).rejects.toMatchObject({ code: 'app_check_unavailable' });
    });
});

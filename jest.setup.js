jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useSegments: () => [],
    useLocalSearchParams: () => ({}),
    Redirect: () => null,
}));

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    LOG_LEVEL: { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 },
    default: {
        configure: jest.fn(),
        setLogLevel: jest.fn(),
        getOfferings: jest.fn(),
        purchasePackage: jest.fn(),
        restorePurchases: jest.fn(),
        getCustomerInfo: jest.fn(),
        addCustomerInfoUpdateListener: jest.fn(),
        removeCustomerInfoUpdateListener: jest.fn(),
    }
}));

// Mock firebase
jest.mock('firebase/compat/app', () => {
    const buildDocRef = () => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        collection: jest.fn(() => buildCollectionRef()),
    });

    const buildCollectionRef = () => ({
        doc: jest.fn(() => buildDocRef()),
        get: jest.fn(),
        add: jest.fn(),
        where: jest.fn(() => ({
            get: jest.fn(),
        })),
    });

    const mockFirebase = {
        initializeApp: jest.fn(),
        apps: [],
        app: jest.fn(() => ({
            auth: jest.fn(),
            firestore: jest.fn(),
        })),
        auth: jest.fn(() => ({
            onAuthStateChanged: jest.fn(),
            signInWithEmailAndPassword: jest.fn(),
            createUserWithEmailAndPassword: jest.fn(),
            signOut: jest.fn(),
            currentUser: null,
        })),
        firestore: jest.fn(() => ({
            collection: jest.fn(() => buildCollectionRef()),
            doc: jest.fn(() => buildDocRef()),
        })),
    };
    mockFirebase.firestore.FieldValue = {
        serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
        increment: jest.fn((value) => ({ __increment: value })),
    };
    return {
        __esModule: true,
        default: mockFirebase,
        ...mockFirebase,
    };
});
jest.mock('firebase/compat/auth', () => { });
jest.mock('firebase/compat/firestore', () => { });
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(async () => ({ docs: [] })),
    deleteDoc: jest.fn(async () => undefined),
    doc: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
    initializeAuth: jest.fn(),
    getReactNativePersistence: jest.fn(),
    getAuth: jest.fn(() => ({
        currentUser: null,
        onAuthStateChanged: jest.fn(),
    })),
}));

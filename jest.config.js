module.exports = {
    preset: 'jest-expo',
    setupFiles: ['./jest.setup.js'],
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/\\.archive/',
        '/\\.codex-worktrees/',
        '/QuranApp-paywall-audit/',
        '/dist/',
        '/build/',
        '/functions/',
        '/scripts/',
    ],
    modulePathIgnorePatterns: [
        '<rootDir>/.archive/',
        '<rootDir>/.codex-worktrees/',
        '<rootDir>/QuranApp-paywall-audit/',
        '<rootDir>/tmp/',
        '<rootDir>/ios/',
    ],
    watchPathIgnorePatterns: [
        '<rootDir>/.archive/',
        '<rootDir>/.codex-worktrees/',
        '<rootDir>/QuranApp-paywall-audit/',
        '<rootDir>/tmp/',
        '<rootDir>/ios/',
    ],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|react-native-purchases|firebase|@firebase|unimodules|sentry-expo|native-base|react-native-svg)',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@features/(.*)$': '<rootDir>/src/features/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    },
};

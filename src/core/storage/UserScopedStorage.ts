import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_OWNER_PREFIX = '@qurannotes/legacy-owner/';

function normalizeUserId(userId: string | null | undefined): string {
    return userId?.trim() || 'anonymous';
}

export function getUserScopedKey(baseKey: string, userId: string | null | undefined): string {
    return `@qurannotes/user/${normalizeUserId(userId)}/${baseKey}`;
}

async function claimLegacyValue(baseKey: string, userId: string): Promise<string | null> {
    const ownerKey = `${LEGACY_OWNER_PREFIX}${baseKey}`;
    const owner = await AsyncStorage.getItem(ownerKey);
    if (owner && owner !== userId) return null;

    const legacyValue = await AsyncStorage.getItem(baseKey);
    if (!legacyValue) return null;

    if (!owner) {
        await AsyncStorage.setItem(ownerKey, userId);
    }
    return legacyValue;
}

export const UserScopedStorage = {
    key(baseKey: string, userId: string | null | undefined): string {
        return getUserScopedKey(baseKey, userId);
    },

    async getItem(baseKey: string, userId: string | null | undefined, migrateLegacy = true): Promise<string | null> {
        const normalizedUserId = normalizeUserId(userId);
        const scopedKey = getUserScopedKey(baseKey, normalizedUserId);
        const scopedValue = await AsyncStorage.getItem(scopedKey);
        if (scopedValue !== null) return scopedValue;

        if (!migrateLegacy || normalizedUserId === 'anonymous') return null;

        const legacyValue = await claimLegacyValue(baseKey, normalizedUserId);
        if (legacyValue !== null) {
            await AsyncStorage.setItem(scopedKey, legacyValue);
        }
        return legacyValue;
    },

    async setItem(baseKey: string, userId: string | null | undefined, value: string): Promise<void> {
        await AsyncStorage.setItem(getUserScopedKey(baseKey, userId), value);
    },

    async removeItem(baseKey: string, userId: string | null | undefined): Promise<void> {
        await AsyncStorage.removeItem(getUserScopedKey(baseKey, userId));
    },

    async clearUserNamespace(userId: string | null | undefined): Promise<void> {
        const normalizedUserId = normalizeUserId(userId);
        if (normalizedUserId === 'anonymous') return;
        const prefix = `@qurannotes/user/${normalizedUserId}/`;
        const keys = await AsyncStorage.getAllKeys();
        const userKeys = keys.filter((key) => key.startsWith(prefix));
        if (userKeys.length > 0) {
            await AsyncStorage.multiRemove(userKeys);
        }
    },
};

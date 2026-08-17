import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserScopedKey, UserScopedStorage } from './UserScopedStorage';

describe('UserScopedStorage', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    it('builds separate keys for authenticated users and anonymous use', () => {
        expect(getUserScopedKey('user_notes', 'user-a')).toBe('@qurannotes/user/user-a/user_notes');
        expect(getUserScopedKey('user_notes', null)).toBe('@qurannotes/user/anonymous/user_notes');
    });

    it('migrates a legacy value to the first authenticated user by default', async () => {
        await AsyncStorage.setItem('user_notes', JSON.stringify({ note: 'preserved' }));

        await expect(UserScopedStorage.getItem('user_notes', 'user-a')).resolves.toBe(
            JSON.stringify({ note: 'preserved' }),
        );
        await expect(AsyncStorage.getItem('@qurannotes/user/user-a/user_notes')).resolves.toBe(
            JSON.stringify({ note: 'preserved' }),
        );
    });

    it('never exposes a claimed legacy value to another user', async () => {
        await AsyncStorage.setItem('user_notes', JSON.stringify({ note: 'private' }));

        await UserScopedStorage.getItem('user_notes', 'user-a');

        await expect(UserScopedStorage.getItem('user_notes', 'user-b')).resolves.toBeNull();
        await expect(AsyncStorage.getItem('@qurannotes/user/user-b/user_notes')).resolves.toBeNull();
    });

    it('clears only the requested authenticated user namespace', async () => {
        await UserScopedStorage.setItem('user_notes', 'user-a', 'a');
        await UserScopedStorage.setItem('user_notes', 'user-b', 'b');
        await UserScopedStorage.setItem('user_notes', null, 'anonymous');

        await UserScopedStorage.clearUserNamespace('user-a');

        await expect(UserScopedStorage.getItem('user_notes', 'user-a', false)).resolves.toBeNull();
        await expect(UserScopedStorage.getItem('user_notes', 'user-b', false)).resolves.toBe('b');
        await expect(UserScopedStorage.getItem('user_notes', null, false)).resolves.toBe('anonymous');
    });
});

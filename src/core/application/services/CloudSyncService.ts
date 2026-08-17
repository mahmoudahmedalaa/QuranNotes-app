/**
 * CloudSyncService — Syncs AsyncStorage-only data to/from Firestore.
 *
 * Covers 7 data domains:
 * 1. Settings (font, reciter, reminders, etc.)
 * 2. Mood history (check-ins, free uses)
 * 3. Adhkar progress (daily counts, streaks)
 * 4. Hadith bookmarks
 * 5. Reading positions (per-surah bookmarks)
 * 6. Streaks (reflection history)
 * 7. Highlights (verse color highlights)
 *
 * Runs ONLY for Pro users. Uses latest-timestamp merge strategy.
 * All operations are fire-and-forget — sync failures never break the app.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSyncEvents } from './CloudSyncEvents';
import { UserScopedStorage, getUserScopedKey } from '../../storage/UserScopedStorage';

// ── Firestore paths ─────────────────────────────────────────────────
const SYNC_COLLECTION = 'users';
const SYNC_SUBCOLLECTION = 'sync';

function syncDocRef(userId: string, docId: string) {
    return doc(db, SYNC_COLLECTION, userId, SYNC_SUBCOLLECTION, docId);
}

// ── AsyncStorage keys (must match the source contexts) ──────────────
const SETTINGS_KEY = 'app_settings';
const HIGHLIGHTS_KEY = '@quran_highlights';
const STREAKS_KEY = 'reflection_streaks';
const HADITH_BOOKMARKS_KEY = 'hadith_bookmarks';
const ADHKAR_PROGRESS_PREFIX = 'adhkar_progress';
const ADHKAR_STREAK_KEY = 'adhkar_streak';
const READING_POSITION_PREFIX = 'reading_position_surah_';
const READING_POSITION_GLOBAL = 'reading_position_global';

// ── Sync metadata ───────────────────────────────────────────────────
const LAST_SYNCED_KEY = 'cloud_sync_last_synced';

interface SyncDocument {
    data: unknown;
    updatedAt: string; // ISO timestamp
}

// ── Main Service ────────────────────────────────────────────────────
export class CloudSyncService {
    constructor(private userId: string) { }

    /**
     * Run a full bidirectional sync for all data domains.
     * Latest-timestamp wins for each domain.
     */
    async syncAll(): Promise<void> {
        if (!this.userId) return;

        try {
            const results = await Promise.all([
                this.syncDomain('settings', SETTINGS_KEY),
                this.syncDomain('highlights', HIGHLIGHTS_KEY, true),
                this.syncDomain('streaks', STREAKS_KEY, true),
                this.syncHadithBookmarks(),
                this.syncMoodData(),
                this.syncAdhkarData(),
                this.syncReadingPositions(),
            ]);

            // If any domain pulled remote data, notify contexts to re-read
            if (results.some(pulled => pulled)) {
                CloudSyncEvents.emitPull();
            }

            // Record last sync time
            await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
        } catch (e) {
            if (__DEV__) console.warn('[CloudSync] syncAll skipped:', (e as Error)?.message || e);
        }
    }

    /**
     * Generic bidirectional sync for a single AsyncStorage key ↔ Firestore doc.
     * Only works with data that is stored as a JSON object (not arrays).
     */
    private async syncDomain(firestoreDocId: string, asyncStorageKey: string, userScoped = false): Promise<boolean> {
        try {
            const [localRaw, remoteSnap] = await Promise.all([
                userScoped
                    ? UserScopedStorage.getItem(asyncStorageKey, this.userId)
                    : AsyncStorage.getItem(asyncStorageKey),
                getDoc(syncDocRef(this.userId, firestoreDocId)),
            ]);

            const localData = localRaw ? JSON.parse(localRaw) : null;
            const remoteDoc = remoteSnap.exists()
                ? (remoteSnap.data() as SyncDocument)
                : null;

            // Determine which is newer
            const localTime = localData?._syncedAt
                ? new Date(localData._syncedAt).getTime()
                : 0;
            const remoteTime = remoteDoc?.updatedAt
                ? new Date(remoteDoc.updatedAt).getTime()
                : 0;

            if (localData && (!remoteDoc || localTime >= remoteTime)) {
                // Local is newer or remote doesn't exist → push to cloud
                const now = new Date().toISOString();
                // Only add _syncedAt to objects, not arrays or primitives
                const isObject = localData && typeof localData === 'object' && !Array.isArray(localData);
                const dataWithTimestamp = isObject
                    ? { ...localData, _syncedAt: now }
                    : localData;
                if (isObject) {
                    if (userScoped) {
                        await UserScopedStorage.setItem(asyncStorageKey, this.userId, JSON.stringify(dataWithTimestamp));
                    } else {
                        await AsyncStorage.setItem(asyncStorageKey, JSON.stringify(dataWithTimestamp));
                    }
                }
                await setDoc(syncDocRef(this.userId, firestoreDocId), {
                    data: dataWithTimestamp,
                    updatedAt: now,
                } as SyncDocument);
            } else if (remoteDoc && remoteTime > localTime) {
                // Remote is newer → pull from cloud
                if (userScoped) {
                    await UserScopedStorage.setItem(asyncStorageKey, this.userId, JSON.stringify(remoteDoc.data));
                } else {
                    await AsyncStorage.setItem(asyncStorageKey, JSON.stringify(remoteDoc.data));
                }
                return true;
            }
            // If neither exists, nothing to sync
            return false;
        } catch (e) {
            if (__DEV__) console.warn(`[CloudSync] syncDomain(${firestoreDocId}) error:`, e);
            return false;
        }
    }

    /**
     * Hadith bookmarks are stored as a JSON array of IDs.
     * We wrap the array in a container object for safe Firestore storage.
     */
    private async syncHadithBookmarks(): Promise<boolean> {
        try {
            const [localRaw, remoteSnap] = await Promise.all([
                UserScopedStorage.getItem(HADITH_BOOKMARKS_KEY, this.userId),
                getDoc(syncDocRef(this.userId, 'hadith_bookmarks')),
            ]);

            const localBookmarks: string[] = localRaw ? JSON.parse(localRaw) : [];
            const remoteDoc = remoteSnap.exists()
                ? (remoteSnap.data() as SyncDocument)
                : null;
            const remoteBundle = remoteDoc?.data as { bookmarks: string[]; _syncedAt: string } | null;

            const remoteTime = remoteDoc?.updatedAt
                ? new Date(remoteDoc.updatedAt).getTime()
                : 0;

            if (localBookmarks.length > 0 && (!remoteDoc || Date.now() >= remoteTime)) {
                // Push to cloud — wrap array in an object
                const now = new Date().toISOString();
                await setDoc(syncDocRef(this.userId, 'hadith_bookmarks'), {
                    data: { bookmarks: localBookmarks, _syncedAt: now },
                    updatedAt: now,
                } as SyncDocument);
            } else if (remoteBundle?.bookmarks && remoteTime > 0) {
                // Pull from cloud — restore the array
                await UserScopedStorage.setItem(HADITH_BOOKMARKS_KEY, this.userId, JSON.stringify(remoteBundle.bookmarks));
                return true;
            }
            return false;
        } catch (e) {
            if (__DEV__) console.warn('[CloudSync] syncHadithBookmarks error:', e);
            return false;
        }
    }

    /**
     * Mood data uses per-user scoped keys, so we need custom handling.
     */
    private async syncMoodData(): Promise<boolean> {
        const uid = this.userId;
        const keys = {
            history: `mood_history_${uid}`,
            freeUses: `mood_free_uses_${uid}`,
            todayMood: `mood_today_${uid}`,
        };

        try {
            // Bundle all mood data into a single Firestore document
            const [historyRaw, freeUsesRaw, todayRaw] = await Promise.all([
                AsyncStorage.getItem(keys.history),
                AsyncStorage.getItem(keys.freeUses),
                AsyncStorage.getItem(keys.todayMood),
            ]);

            const localBundle = {
                history: historyRaw ? JSON.parse(historyRaw) : null,
                freeUses: freeUsesRaw,
                todayMood: todayRaw ? JSON.parse(todayRaw) : null,
                _syncedAt: new Date().toISOString(),
            };

            const remoteSnap = await getDoc(syncDocRef(uid, 'mood'));
            const remoteDoc = remoteSnap.exists()
                ? (remoteSnap.data() as SyncDocument)
                : null;
            const remoteBundle = remoteDoc?.data as typeof localBundle | null;

            const localTime = localBundle._syncedAt
                ? new Date(localBundle._syncedAt).getTime()
                : 0;
            const remoteTime = remoteDoc?.updatedAt
                ? new Date(remoteDoc.updatedAt).getTime()
                : 0;

            if (!remoteDoc || localTime >= remoteTime) {
                // Push to cloud
                await setDoc(syncDocRef(uid, 'mood'), {
                    data: localBundle,
                    updatedAt: localBundle._syncedAt,
                } as SyncDocument);
            } else if (remoteBundle && remoteTime > localTime) {
                // Pull from cloud
                if (remoteBundle.history) {
                    await AsyncStorage.setItem(keys.history, JSON.stringify(remoteBundle.history));
                }
                if (remoteBundle.freeUses !== null && remoteBundle.freeUses !== undefined) {
                    await AsyncStorage.setItem(keys.freeUses, String(remoteBundle.freeUses));
                }
                if (remoteBundle.todayMood) {
                    await AsyncStorage.setItem(keys.todayMood, JSON.stringify(remoteBundle.todayMood));
                }
                return true;
            }
            return false;
        } catch (e) {
            if (__DEV__) console.warn('[CloudSync] syncMoodData error:', e);
            return false;
        }
    }

    /**
     * Adhkar uses date-scoped keys (adhkar_progress_{date}_{period}).
     * We bundle current-day progress + streak into one Firestore doc.
     */
    private async syncAdhkarData(): Promise<boolean> {
        try {
            const [progressRaw, streakRaw] = await Promise.all([
                this.getAllAdhkarProgressKeys(),
                UserScopedStorage.getItem(ADHKAR_STREAK_KEY, this.userId),
            ]);

            const localBundle = {
                progress: progressRaw,
                streak: streakRaw ? JSON.parse(streakRaw) : null,
                _syncedAt: new Date().toISOString(),
            };

            const remoteSnap = await getDoc(syncDocRef(this.userId, 'adhkar'));
            const remoteDoc = remoteSnap.exists()
                ? (remoteSnap.data() as SyncDocument)
                : null;
            const remoteBundle = remoteDoc?.data as typeof localBundle | null;

            const localTime = new Date(localBundle._syncedAt).getTime();
            const remoteTime = remoteDoc?.updatedAt
                ? new Date(remoteDoc.updatedAt).getTime()
                : 0;

            if (!remoteDoc || localTime >= remoteTime) {
                await setDoc(syncDocRef(this.userId, 'adhkar'), {
                    data: localBundle,
                    updatedAt: localBundle._syncedAt,
                } as SyncDocument);
            } else if (remoteBundle && remoteTime > localTime) {
                // Restore adhkar progress keys
                if (remoteBundle.progress) {
                    for (const [key, value] of Object.entries(remoteBundle.progress)) {
                        if (key.startsWith('@qurannotes/user/')) {
                            await AsyncStorage.setItem(key, JSON.stringify(value));
                        } else {
                            await UserScopedStorage.setItem(key, this.userId, JSON.stringify(value));
                        }
                    }
                }
                if (remoteBundle.streak) {
                    await UserScopedStorage.setItem(ADHKAR_STREAK_KEY, this.userId, JSON.stringify(remoteBundle.streak));
                }
                return true;
            }
            return false;
        } catch (e) {
            if (__DEV__) console.warn('[CloudSync] syncAdhkarData error:', e);
            return false;
        }
    }

    /**
     * Reading positions are stored per-surah with dynamic keys.
     * We bundle them all into one Firestore document.
     */
    private async syncReadingPositions(): Promise<boolean> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const scopedPositionPrefix = getUserScopedKey(READING_POSITION_PREFIX, this.userId);
            const scopedGlobalKey = getUserScopedKey(READING_POSITION_GLOBAL, this.userId);
            const positionKeys = allKeys.filter(
                k => k.startsWith(scopedPositionPrefix) || k === scopedGlobalKey
            );

            const entries: Record<string, unknown> = {};
            for (const key of positionKeys) {
                const raw = await AsyncStorage.getItem(key);
                if (raw) entries[key] = JSON.parse(raw);
            }

            const localBundle = {
                positions: entries,
                _syncedAt: new Date().toISOString(),
            };

            const remoteSnap = await getDoc(syncDocRef(this.userId, 'reading_positions'));
            const remoteDoc = remoteSnap.exists()
                ? (remoteSnap.data() as SyncDocument)
                : null;
            const remoteBundle = remoteDoc?.data as typeof localBundle | null;

            const localTime = new Date(localBundle._syncedAt).getTime();
            const remoteTime = remoteDoc?.updatedAt
                ? new Date(remoteDoc.updatedAt).getTime()
                : 0;

            if (!remoteDoc || localTime >= remoteTime) {
                await setDoc(syncDocRef(this.userId, 'reading_positions'), {
                    data: localBundle,
                    updatedAt: localBundle._syncedAt,
                } as SyncDocument);
            } else if (remoteBundle?.positions && remoteTime > localTime) {
                for (const [key, value] of Object.entries(remoteBundle.positions)) {
                    const scopedKey = key.startsWith('@qurannotes/user/')
                        ? key
                        : getUserScopedKey(key, this.userId);
                    await AsyncStorage.setItem(scopedKey, JSON.stringify(value));
                }
                return true;
            }
            return false;
        } catch (e) {
            if (__DEV__) console.warn('[CloudSync] syncReadingPositions error:', e);
            return false;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    /**
     * Collect all adhkar progress keys from AsyncStorage into a map.
     */
    private async getAllAdhkarProgressKeys(): Promise<Record<string, unknown>> {
        const allKeys = await AsyncStorage.getAllKeys();
        const scopedPrefix = getUserScopedKey(ADHKAR_PROGRESS_PREFIX, this.userId);
        const adhkarKeys = allKeys.filter(k => k.startsWith(scopedPrefix));
        const result: Record<string, unknown> = {};
        for (const key of adhkarKeys) {
            const raw = await AsyncStorage.getItem(key);
            if (raw) result[key] = JSON.parse(raw);
        }
        return result;
    }

    /**
     * Get the last sync timestamp (for display in Settings).
     */
    static async getLastSyncedAt(): Promise<string | null> {
        return AsyncStorage.getItem(LAST_SYNCED_KEY);
    }
}

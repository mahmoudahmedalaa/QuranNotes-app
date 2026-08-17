/**
 * HadithBookmarkService — Persistence layer for bookmarked hadiths.
 * Uses AsyncStorage for local persistence.
 */
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';

const BOOKMARKS_KEY = 'hadith_bookmarks';

export class HadithBookmarkService {
    /** Get all bookmarked hadith IDs */
    static async getBookmarks(userId?: string | null): Promise<string[]> {
        try {
            const stored = await UserScopedStorage.getItem(BOOKMARKS_KEY, userId);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    /** Add a hadith to bookmarks */
    static async addBookmark(hadithId: string, userId?: string | null): Promise<void> {
        const bookmarks = await this.getBookmarks(userId);
        if (!bookmarks.includes(hadithId)) {
            bookmarks.push(hadithId);
            await UserScopedStorage.setItem(BOOKMARKS_KEY, userId, JSON.stringify(bookmarks));
        }
    }

    /** Remove a hadith from bookmarks */
    static async removeBookmark(hadithId: string, userId?: string | null): Promise<void> {
        const bookmarks = await this.getBookmarks(userId);
        const filtered = bookmarks.filter(id => id !== hadithId);
        await UserScopedStorage.setItem(BOOKMARKS_KEY, userId, JSON.stringify(filtered));
    }

    /** Check if a hadith is bookmarked */
    static async isBookmarked(hadithId: string, userId?: string | null): Promise<boolean> {
        const bookmarks = await this.getBookmarks(userId);
        return bookmarks.includes(hadithId);
    }

    /** Get bookmark count */
    static async getBookmarkCount(userId?: string | null): Promise<number> {
        const bookmarks = await this.getBookmarks(userId);
        return bookmarks.length;
    }

    /** Clear all bookmarks (used on logout/login to prevent leaking between accounts) */
    static async clearAll(userId?: string | null): Promise<void> {
        try {
            await UserScopedStorage.removeItem(BOOKMARKS_KEY, userId);
        } catch (e) {
            if (__DEV__) console.warn('[HadithBookmarkService] clearAll failed:', e);
        }
    }
}

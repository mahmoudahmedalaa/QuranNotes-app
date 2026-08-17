import { IBookmarkRepository } from '../../domain/repositories/IBookmarkRepository';
import { Bookmark } from '../../domain/entities/Bookmark';
import { UserScopedStorage } from '../../storage/UserScopedStorage';

export class LocalBookmarkRepository implements IBookmarkRepository {
    private readonly KEY = 'user_bookmarks';
    constructor(private userId?: string | null) { }

    private async getMap(): Promise<Record<string, Bookmark>> {
        try {
            const data = await UserScopedStorage.getItem(this.KEY, this.userId);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    private getKey(surah: number, verse: number): string {
        return `${surah}:${verse}`;
    }

    async toggleBookmark(surah: number, verse: number): Promise<boolean> {
        const map = await this.getMap();
        const key = this.getKey(surah, verse);
        const exists = !!map[key];

        if (exists) {
            delete map[key];
        } else {
            map[key] = { surahNumber: surah, verseNumber: verse, timestamp: Date.now() };
        }

        await UserScopedStorage.setItem(this.KEY, this.userId, JSON.stringify(map));
        return !exists;
    }

    async isBookmarked(surah: number, verse: number): Promise<boolean> {
        const map = await this.getMap();
        return !!map[this.getKey(surah, verse)];
    }

    async getBookmarks(): Promise<Bookmark[]> {
        const map = await this.getMap();
        return Object.values(map).sort((a, b) => b.timestamp - a.timestamp);
    }
}

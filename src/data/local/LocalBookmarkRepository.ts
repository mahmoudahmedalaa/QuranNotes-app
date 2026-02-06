import AsyncStorage from '@react-native-async-storage/async-storage';
import { IBookmarkRepository } from '../../domain/repositories/IBookmarkRepository';
import { Bookmark } from '../../domain/entities/Bookmark';

export class LocalBookmarkRepository implements IBookmarkRepository {
    private readonly KEY = 'user_bookmarks';

    private async getMap(): Promise<Record<string, Bookmark>> {
        try {
            const data = await AsyncStorage.getItem(this.KEY);
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

        await AsyncStorage.setItem(this.KEY, JSON.stringify(map));
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

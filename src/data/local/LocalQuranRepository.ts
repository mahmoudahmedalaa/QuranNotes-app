import AsyncStorage from '@react-native-async-storage/async-storage';
import { Surah } from '../../domain/entities/Quran';

export class LocalQuranRepository {
    private readonly STORAGE_KEY = 'quran_cache_';
    private readonly LIST_KEY = 'quran_list_cache';

    async getSurah(surahNumber: number): Promise<Surah> {
        try {
            const data = await AsyncStorage.getItem(`${this.STORAGE_KEY}${surahNumber}`);
            if (!data) throw new Error(`Surah ${surahNumber} not found`);
            return JSON.parse(data);
        } catch (e) {
            console.error('Error reading local surah', e);
            throw e;
        }
    }

    async saveSurah(surah: Surah): Promise<void> {
        try {
            await AsyncStorage.setItem(`${this.STORAGE_KEY}${surah.number}`, JSON.stringify(surah));
        } catch (e) {
            console.error('Error saving local surah', e);
        }
    }

    async getAllSurahs(): Promise<Surah[]> {
        try {
            const data = await AsyncStorage.getItem(this.LIST_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading local surah list', e);
            return [];
        }
    }

    async saveSurahsList(surahs: Surah[]): Promise<void> {
        try {
            await AsyncStorage.setItem(this.LIST_KEY, JSON.stringify(surahs));
        } catch (e) {
            console.error('Error saving local surah list', e);
        }
    }
}

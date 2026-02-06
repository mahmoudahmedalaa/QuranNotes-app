import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalQuranRepository } from './LocalQuranRepository';
import { Surah } from '../../domain/entities/Quran';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

const mockSurah: Surah = {
    number: 1,
    name: 'Al-Fatiha',
    englishName: 'The Opening',
    englishNameTranslation: 'The Opening',
    numberOfAyahs: 7,
    revelationType: 'Meccan',
    verses: [],
};

describe('LocalQuranRepository', () => {
    let repository: LocalQuranRepository;

    beforeEach(() => {
        repository = new LocalQuranRepository();
        jest.clearAllMocks();
    });

    describe('getSurah', () => {
        it('should return surah when found in cache', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockSurah));

            const result = await repository.getSurah(1);
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('quran_cache_1');
            expect(result).toEqual(mockSurah);
        });

        it('should throw error when not found', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            await expect(repository.getSurah(999)).rejects.toThrow('Surah 999 not found');
        });
    });

    describe('getAllSurahs', () => {
        it('should return surah list when cached', async () => {
            const mockList = [mockSurah];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockList));

            const result = await repository.getAllSurahs();
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('quran_list_cache');
            expect(result).toHaveLength(1);
            expect(result[0].number).toBe(1);
        });

        it('should return empty array when cache is empty', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

            const result = await repository.getAllSurahs();
            expect(result).toEqual([]);
        });
    });

    describe('saveSurah', () => {
        it('should save surah to async storage', async () => {
            await repository.saveSurah(mockSurah);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'quran_cache_1',
                JSON.stringify(mockSurah),
            );
        });
    });
});

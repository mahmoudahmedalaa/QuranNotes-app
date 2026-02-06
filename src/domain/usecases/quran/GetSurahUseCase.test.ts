import { GetSurahUseCase } from './GetSurahUseCase';
import { IQuranRepository } from '../../repositories/IQuranRepository';
import { Surah } from '../../entities/Quran';

const mockSurah: Surah = {
    number: 1,
    name: 'Al-Fatiha',
    englishName: 'The Opening',
    englishNameTranslation: 'The Opening',
    numberOfAyahs: 7,
    revelationType: 'Meccan',
    verses: [],
};

const mockRepository: IQuranRepository = {
    getAllSurahs: jest.fn(),
    getSurah: jest.fn().mockResolvedValue(mockSurah),
};

describe('GetSurahUseCase', () => {
    it('should return a surah when repository succeeds', async () => {
        const useCase = new GetSurahUseCase(mockRepository);
        const result = await useCase.execute(1);

        expect(mockRepository.getSurah).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockSurah);
    });
});

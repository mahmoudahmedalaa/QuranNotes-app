import { GetAllSurahsUseCase } from './GetAllSurahsUseCase';
import { IQuranRepository } from '../../repositories/IQuranRepository';
import { Surah } from '../../entities/Quran';

const mockSurahs: Surah[] = [
    {
        number: 1,
        name: 'Al-Fatiha',
        englishName: 'The Opening',
        englishNameTranslation: 'The Opening',
        numberOfAyahs: 7,
        revelationType: 'Meccan',
        verses: [],
    },
    {
        number: 2,
        name: 'Al-Baqarah',
        englishName: 'The Cow',
        englishNameTranslation: 'The Cow',
        numberOfAyahs: 286,
        revelationType: 'Medinan',
        verses: [],
    },
];

const mockRepository: IQuranRepository = {
    getAllSurahs: jest.fn().mockResolvedValue(mockSurahs),
    getSurah: jest.fn(),
};

describe('GetAllSurahsUseCase', () => {
    it('should return all surahs from the repository', async () => {
        const useCase = new GetAllSurahsUseCase(mockRepository);
        const result = await useCase.execute();

        expect(mockRepository.getAllSurahs).toHaveBeenCalled();
        expect(result).toHaveLength(2);
        expect(result[0].englishName).toBe('The Opening');
        expect(result[1].englishName).toBe('The Cow');
    });

    it('should return empty array if repository returns empty', async () => {
        (mockRepository.getAllSurahs as jest.Mock).mockResolvedValueOnce([]);
        const useCase = new GetAllSurahsUseCase(mockRepository);
        const result = await useCase.execute();

        expect(result).toEqual([]);
    });
});

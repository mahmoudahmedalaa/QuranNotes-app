import { Surah, Verse } from '../../domain/entities/Quran';

export class QuranMapper {
    static toDomain(apiResponse: any): Surah {
        // Al-Quran Cloud API returns data in "data" object
        // We expect a response with edits (uthmani + translation)

        // This mapper assumes we are handling the specific response structure for "editions/quran-uthmani,en.sahih"

        const ArabicEdition = apiResponse.data[0];
        const EnglishEdition = apiResponse.data[1];

        const verses: Verse[] = ArabicEdition.ayahs.map((ayah: any, index: number) => ({
            number: ayah.numberInSurah,
            text: ayah.text,
            translation: EnglishEdition.ayahs[index].text,
            surahNumber: ArabicEdition.number,
            juz: ayah.juz,
            page: ayah.page,
        }));

        return {
            number: ArabicEdition.number,
            name: ArabicEdition.name,
            englishName: ArabicEdition.englishName,
            englishNameTranslation: ArabicEdition.englishNameTranslation,
            numberOfAyahs: ArabicEdition.numberOfAyahs,
            revelationType: ArabicEdition.revelationType,
            verses: verses,
        };
    }

    static toDomainList(apiResponse: any): Surah[] {
        // For the surah list endpoint
        return apiResponse.data.map((surah: any) => ({
            number: surah.number,
            name: surah.name,
            englishName: surah.englishName,
            englishNameTranslation: surah.englishNameTranslation,
            numberOfAyahs: surah.numberOfAyahs,
            revelationType: surah.revelationType,
            verses: [], // List view doesn't need verses
        }));
    }
}

# Directive: Build Quran Reader (Day 2)

## Goal
Implement the core reading experience: display Arabic text + English translation, with offline caching.

## Architecture
Follow Clean Architecture principle.

### 1. Domain Layer (Pure TypeScript)
- **Entities:** `Verse`, `Surah`
- **Repo Interface:** `IQuranRepository`
- **Use Case:** `GetSurahUseCase` (handle logic: check cache -> fetch -> cache)

### 2. Data Layer
- **Local:** `LocalQuranRepository` (AsyncStorage)
- **Remote:** `RemoteQuranRepository` (Al-Quran Cloud API)
- **Mapper:** `QuranMapper` (API response -> Domain entity)

### 3. Presentation Layer
- **Components:** `SurahList`, `VerseItem`, `QuranReader`
- **Screen:** `src/presentation/screens/quran/QuranScreen.tsx` (or directly in `app/(tabs)/index.tsx`)

## Implementation Steps

1.  **Domain Setup:**
    - Create `src/domain/entities/Quran.ts`
    - Create `src/domain/repositories/IQuranRepository.ts`
    - Create `src/domain/usecases/quran/GetSurahUseCase.ts`

2.  **Data Setup:**
    - Create `src/data/models/QuranMapper.ts`
    - Create `src/data/local/LocalQuranRepository.ts` (`AsyncStorage` key: `quran_cache_${surahNumber}`)
    - Create `src/data/remote/RemoteQuranRepository.ts` (API: `http://api.alquran.cloud/v1/surah/${number}/editions/quran-uthmani,en.sahih`)

3.  **UI Construction:**
    - Create `src/presentation/components/quran/VerseItem.tsx`
    - Create `src/presentation/components/quran/SurahList.tsx`
    - Update `src/presentation/hooks/useQuran.ts` to use the UseCase.

## Acceptance Criteria
- [ ] Loads Surah 1 (Al-Fatiha) correctly.
- [ ] Displays Arabic and English side-by-side or stacked.
- [ ] Works offline after first load (check airplane mode).
- [ ] Smooth scrolling.
- [ ] Loading state handled.

## API Reference
- **Al-Quran Cloud:** `http://api.alquran.cloud/v1/surah/{number}/editions/quran-uthmani,en.sahih`
- **Note:** Fetch both editions in one call to get Arabic and English matched by verse number.

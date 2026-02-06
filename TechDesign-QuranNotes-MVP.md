# Technical Design Document: QuranNotes MVP

## Executive Summary

**System:** QuranNotes
**Version:** MVP 1.0
**Architecture Pattern:** Clean Architecture (Hexagonal/Ports & Adapters)
**Platform:** React Native + Expo (iOS & Android)
**Estimated Effort:** 12 days (Next Friday launch)
**Team:** Solo founder + AI assistance (Antigravity/Claude)

---

## Architecture Overview

### High-Level Architecture

We use **Clean Architecture** to ensure business logic is isolated from frameworks, making the app scalable and testable.

```text
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (React Native Components, Screens,     │
│   Hooks, Navigation)                    │
├─────────────────────────────────────────┤
│           Domain Layer                  │
│  (Entities, Use Cases, Repository       │
│   Interfaces) - Pure TypeScript         │
├─────────────────────────────────────────┤
│           Data Layer                    │
│  (Repository Implementations: Local     │
│   Storage, Remote API, Firebase)        │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│  (External Services: Quran API,         │
│   Audio Recorder, RevenueCat, Analytics)│
└─────────────────────────────────────────┘
```

### Why Clean Architecture?

| Benefit | How We Achieve It |
|---------|-------------------|
| **Testability** | Domain layer has no dependencies, easily unit tested |
| **Scalability** | Swap data sources (local → cloud) without touching UI |
| **Maintainability** | Clear separation of concerns, new features don't break old |
| **Framework Independence** | Can switch from Expo to bare React Native later if needed |

---

## Tech Stack Decision

### Frontend

| Category | Technology | Justification |
|----------|-----------|---------------|
| **Framework** | React Native (Expo SDK 52) | Fastest path to native iOS/Android, over-the-air updates |
| **Navigation** | Expo Router (v3) | File-based routing, deep linking built-in, type-safe |
| **UI Library** | React Native Paper (v5) | Material Design 3, accessibility built-in, fast theming |
| **State Management** | React Context + hooks | Sufficient for MVP, Zustand can be added later if needed |
| **Forms** | React Hook Form | Performance, validation, less re-renders |
| **Validation** | Zod | TypeScript-first schema validation |
| **Icons** | @expo/vector-icons | Native icons, no extra dependencies |

### Backend & Services

| Category | Technology | Justification |
|----------|-----------|---------------|
| **Authentication** | Firebase Auth | Google Sign-In, Apple Sign-In, anonymous auth, free tier |
| **Database (Cloud)** | Firestore | Real-time sync, offline persistence, scalable |
| **Database (Local)** | AsyncStorage | On-device caching, works offline |
| **File Storage** | expo-file-system | Local audio recordings, no cloud costs initially |
| **Payments** | RevenueCat | Handles iOS/Android store complexities, free up to $10K MRR |
| **Analytics** | Firebase Analytics | Free, tracks user behavior, crash reporting |
| **Error Tracking** | Sentry (free tier) | Real-time error monitoring |

### Quran & Audio

| Category | Technology | Justification |
|----------|-----------|---------------|
| **Quran API** | Al-Quran Cloud API | Free, no rate limits, 100+ translations, CDN-hosted |
| **Audio Recording** | expo-audio (SDK 52+) | Official Expo package, high-quality, cross-platform |
| **Audio Playback** | expo-av | Mature, handles background audio, seek/scrub |
| **Audio Format** | AAC (m4a) | Best compression/quality ratio, native support |

---

## Project Structure

```text
quran-notes/
├── src/
│   ├── domain/                    # Business logic (pure TypeScript)
│   │   ├── entities/              # Core types
│   │   │   ├── Quran.ts           # Surah, Verse types
│   │   │   ├── Note.ts            # Note entity
│   │   │   ├── Recording.ts       # Recording entity
│   │   │   └── User.ts            # User entity
│   │   ├── usecases/              # Business operations
│   │   │   ├── quran/             # Fetch surah, search
│   │   │   ├── notes/             # CRUD notes
│   │   │   ├── recordings/        # CRUD recordings
│   │   │   └── auth/              # Login, logout, sync
│   │   └── repositories/          # Interfaces (ports)
│   │       ├── IQuranRepository.ts
│   │       ├── INoteRepository.ts
│   │       ├── IRecordingRepository.ts
│   │       └── IAuthRepository.ts
│   │
│   ├── data/                      # Implementation (adapters)
│   │   ├── local/                 # On-device storage
│   │   │   ├── LocalQuranRepository.ts
│   │   │   ├── LocalNoteRepository.ts
│   │   │   └── LocalRecordingRepository.ts
│   │   ├── remote/                # Firebase, APIs
│   │   │   ├── RemoteQuranRepository.ts
│   │   │   ├── RemoteNoteRepository.ts
│   │   │   ├── RemoteAuthRepository.ts
│   │   │   └── FirebaseConfig.ts
│   │   └── models/                # Data mappers
│   │       ├── QuranMapper.ts
│   │       ├── NoteMapper.ts
│   │       └── RecordingMapper.ts
│   │
│   ├── presentation/              # UI layer
│   │   ├── components/            # Reusable UI
│   │   │   ├── quran/
│   │   │   │   ├── VerseItem.tsx
│   │   │   │   ├── SurahList.tsx
│   │   │   │   └── QuranReader.tsx
│   │   │   ├── notes/
│   │   │   │   ├── NoteEditor.tsx
│   │   │   │   ├── NoteList.tsx
│   │   │   │   └── FolderItem.tsx
│   │   │   ├── recordings/
│   │   │   │   ├── RecordButton.tsx
│   │   │   │   ├── AudioPlayer.tsx
│   │   │   │   └── RecordingList.tsx
│   │   │   └── common/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Loading.tsx
│   │   ├── screens/               # Full pages
│   │   │   ├── (tabs)/            # Bottom tab navigation
│   │   │   │   ├── index.tsx      # Quran reader (home)
│   │   │   │   ├── notes.tsx      # Notes list
│   │   │   │   └── recordings.tsx # Recordings list
│   │   │   ├── auth/
│   │   │   │   ├── login.tsx
│   │   │   │   └── onboarding.tsx
│   │   │   ├── note/
│   │   │   │   ├── [id].tsx       # Edit note
│   │   │   │   └── new.tsx        # New note
│   │   │   └── settings.tsx
│   │   ├── hooks/                 # Connect usecases to UI
│   │   │   ├── useQuran.ts
│   │   │   ├── useNotes.ts
│   │   │   ├── useRecordings.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useSync.ts
│   │   └── theme/                 # Styling
│   │       ├── colors.ts
│   │       ├── typography.ts
│   │       └── spacing.ts
│   │
│   ├── infrastructure/            # External services
│   │   ├── api/
│   │   │   ├── AlQuranCloudAPI.ts
│   │   │   └── APIClient.ts
│   │   ├── audio/
│   │   │   ├── AudioRecorder.ts
│   │   │   └── AudioPlayer.ts
│   │   ├── payments/
│   │   │   └── RevenueCatService.ts
│   │   └── analytics/
│   │       └── FirebaseAnalytics.ts
│   │
│   └── utils/                     # Helpers
│       ├── date.ts
│       ├── storage.ts
│       └── validation.ts
│
├── assets/                        # Images, fonts
├── app.json                       # Expo config
├── eas.json                       # EAS Build config
├── package.json
├── tsconfig.json
└── .env.example                   # Environment variables template
```

---

## Feature Implementation

### Feature 1: Quran Text Display

#### Domain Layer

```typescript
// src/domain/entities/Quran.ts
export interface Verse {
  number: number;           // Verse number in surah
  text: string;            // Arabic Uthmani
  translation: string;     // English
  surahNumber: number;
  juz: number;
  page: number;
}

export interface Surah {
  number: number;
  name: string;            // Arabic name
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
  verses: Verse[];
}
```

#### Use Case

```typescript
// src/domain/usecases/quran/GetSurah.ts
export class GetSurahUseCase {
  constructor(private quranRepo: IQuranRepository) {}
  
  async execute(surahNumber: number): Promise<Surah> {
    // 1. Check local cache first
    const cached = await this.quranRepo.getLocal(surahNumber);
    if (cached) return cached;
    
    // 2. Fetch from API
    const surah = await this.quranRepo.fetchFromAPI(surahNumber);
    
    // 3. Cache locally
    await this.quranRepo.saveLocal(surah);
    
    return surah;
  }
}
```

#### Data Layer

```typescript
// src/data/local/LocalQuranRepository.ts
export class LocalQuranRepository implements IQuranRepository {
  private readonly STORAGE_KEY = 'quran_cache_';
  
  async getLocal(surahNumber: number): Promise<Surah | null> {
    const data = await AsyncStorage.getItem(`${this.STORAGE_KEY}${surahNumber}`);
    return data ? JSON.parse(data) : null;
  }
  
  async saveLocal(surah: Surah): Promise<void> {
    await AsyncStorage.setItem(
      `${this.STORAGE_KEY}${surah.number}`,
      JSON.stringify(surah)
    );
  }
}

// src/data/remote/RemoteQuranRepository.ts
export class RemoteQuranRepository implements IQuranRepository {
  private readonly API_BASE = 'https://api.alquran.cloud/v1';
  
  async fetchFromAPI(surahNumber: number): Promise<Surah> {
    const response = await fetch(
      `${this.API_BASE}/surah/${surahNumber}/editions/quran-uthmani,en.sahih`
    );
    const data = await response.json();
    return QuranMapper.toDomain(data);
  }
}
```

### Feature 2: Verse-Level Note Taking

#### Domain Layer

```typescript
// src/domain/entities/Note.ts
export interface Note {
  id: string;
  verseId: string;         // "2:255" (surah:verse)
  content: string;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
}
```

#### Repository Interface

```typescript
// src/domain/repositories/INoteRepository.ts
export interface INoteRepository {
  getByVerse(verseId: string): Promise<Note | null>;
  getByFolder(folderId: string): Promise<Note[]>;
  getAll(): Promise<Note[]>;
  save(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<Note[]>;
}
```

### Feature 3: Audio Recording Per Verse

#### Domain Layer

```typescript
// src/domain/entities/Recording.ts
export interface Recording {
  id: string;
  verseId: string;
  uri: string;             // Local file path
  duration: number;        // Seconds
  createdAt: Date;
  folderId: string | null;
}
```

#### Infrastructure Layer

```typescript
// src/infrastructure/audio/AudioRecorder.ts
import { useAudioRecorder, RecordingPresets } from 'expo-audio';

export class AudioRecorder {
  private recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  
  async start(): Promise<void> {
    await this.recorder.record();
  }
  
  async stop(): Promise<{ uri: string; duration: number }> {
    await this.recorder.stop();
    return {
      uri: this.recorder.uri,
      duration: this.recorder.durationMillis / 1000
    };
  }
}
```

### Feature 4: Notebook/Folder Organization

```typescript
// src/domain/entities/Folder.ts
export interface Folder {
  id: string;
  name: string;
  color: string;           // Hex color
  createdAt: Date;
  noteCount?: number;      // Computed
}

// Default folders created on first launch
export const DEFAULT_FOLDERS = [
  { id: 'all', name: 'All Notes', color: '#6366F1' },
  { id: 'recent', name: 'Recent', color: '#10B981' },
  { id: 'favorites', name: 'Favorites', color: '#F59E0B' },
];
```

### Feature 5: Firebase Authentication

```typescript
// src/data/remote/RemoteAuthRepository.ts
import { getAuth, signInWithPopup, GoogleAuthProvider, AppleAuthProvider } from 'firebase/auth';

export class RemoteAuthRepository implements IAuthRepository {
  private auth = getAuth();
  
  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    return UserMapper.toDomain(result.user);
  }
  
  async signInWithApple(): Promise<User> {
    const provider = new AppleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    return UserMapper.toDomain(result.user);
  }
  
  async signInAnonymous(): Promise<User> {
    const result = await signInAnonymously(this.auth);
    return UserMapper.toDomain(result.user);
  }
}
```

### Feature 6: RevenueCat Payments

```typescript
// src/infrastructure/payments/RevenueCatService.ts
import Purchases from 'react-native-purchases';

export class RevenueCatService {
  private readonly API_KEYS = {
    ios: 'appl_...',
    android: 'goog_...',
  };
  
  async initialize(): Promise<void> {
    Purchases.configure({
      apiKey: Platform.select(this.API_KEYS),
      appUserID: await getCurrentUserId(),
    });
  }
  
  async getOfferings(): Promise<Offering[]> {
    return await Purchases.getOfferings();
  }
  
  async purchase(package: Package): Promise<void> {
    await Purchases.purchasePackage(package);
  }
  
  async restorePurchases(): Promise<void> {
    await Purchases.restorePurchases();
  }
}
```

**Premium Offering:**
- $4.99/month or $49.99/year
- Unlimited recordings (vs 10 free)
- Cloud sync across devices
- Rich text notes
- Multiple translations
- Export data

---

## Security Implementation

### Authentication Flow

```
1. App Launch → Check Firebase Auth current user
2. If logged in → Load user data from Firestore
3. If not logged in → Show onboarding with "Continue as Guest" or "Sign In"
4. Guest users → Anonymous auth (local only, no sync)
5. Signed in users → Full sync enabled
```

### Data Security

- **Local data:** Encrypted at rest (iOS/Android native encryption)
- **Transit:** HTTPS for all API calls
- **Firestore rules:** Users can only read/write their own data
- **Audio files:** Stored locally, optional cloud backup in v2

### Privacy Policy Requirements

- GDPR: Right to data deletion, data portability
- CCPA: Opt-out of data sale (not applicable, we don't sell)
- Firebase: Disclose use of Google Analytics
- RevenueCat: Disclose use of purchase tracking

---

## Development Workflow

### Git Strategy: GitHub Flow

```
main (production-ready)
├── feature/quran-display
├── feature/note-taking
├── feature/audio-recording
├── feature/auth
├── feature/payments
└── hotfix/crash-on-launch
```

### Branch Naming

- `feature/short-description`
- `fix/bug-description`
- `hotfix/critical-fix`

### Commit Messages

```
feat: add verse-level note taking
fix: resolve audio recording crash on Android
refactor: extract Quran API client
docs: update setup instructions
```

### Pre-Commit Hooks (Optional but Recommended)

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write", "tsc --noEmit"]
  }
}
```

---

## Testing Strategy

### Unit Tests (Domain Layer)

```typescript
// src/domain/usecases/quran/__tests__/GetSurah.test.ts
describe('GetSurahUseCase', () => {
  it('returns cached surah if available', async () => {
    // Test logic
  });
  
  it('fetches from API if not cached', async () => {
    // Test logic
  });
});
```

### Integration Tests (Data Layer)

- Repository implementations with mock Firebase
- API client error handling

### Manual Testing Checklist

- [ ] App launches in < 3 seconds
- [ ] Quran loads offline after first download
- [ ] Audio records and plays back
- [ ] Notes save and persist
- [ ] Search returns correct results
- [ ] Auth flows work (Google, Apple, Guest)
- [ ] Purchase flow works (TestFlight sandbox)
- [ ] Works on iPhone SE (small screen)
- [ ] Works on iPhone 15 Pro Max (large screen)
- [ ] Works on Android (Pixel, Samsung)
- [ ] Dark mode renders correctly
- [ ] Airplane mode (full offline) works

---

## Deployment

### Environments

| Environment | Purpose | Trigger |
|-------------|---------|---------|
| **Local** | Development | `expo start` |
| **Preview** | PR testing | EAS Build on PR |
| **Staging** | Pre-release | Manual EAS Build |
| **Production** | App Store | EAS Submit |

### EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "enterpriseProvisioning": "adhoc"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_ID",
        "ascTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### Deployment Steps

**Day 10-11 (Wednesday-Thursday):**
1. Create production build: `eas build --platform ios --profile production`
2. Create production build: `eas build --platform android --profile production`
3. Test on physical devices
4. Fix critical bugs

**Day 12 (Friday):**
1. Submit to App Store: `eas submit --platform ios`
2. Submit to Play Store: `eas submit --platform android`
3. Prepare launch assets (screenshots, description)
4. Soft launch to 10 beta testers

---

## Cost Analysis

### Year 1 Costs

| Item | Cost | Notes |
|------|------|-------|
| Apple Developer Program | $99 | One-time |
| Google Play Developer | $25 | One-time |
| Firebase (Spark Plan) | $0 | Free tier sufficient |
| RevenueCat | $0 | Free up to $10K MRR |
| EAS Build | $0 | Free tier: 30 builds/month |
| Sentry | $0 | Free tier: 5K errors/month |
| **Total Year 1** | **$124** | |

### Scale Costs (When You Hit 10K Users)

| Service | Monthly Cost | Trigger |
|---------|--------------|---------|
| Firebase Blaze | $20-50 | 50K+ daily active users |
| RevenueCat | $0 | Still free at $10K MRR |
| EAS Build | $0 | Still within free tier |
| Sentry | $26 | Team plan for more errors |
| **Total Monthly** | **$46-76** | |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **App Store rejection** | Medium | High | Follow guidelines, no controversial content, test thoroughly |
| **RevenueCat integration fails** | Low | High | Test in sandbox, have fallback (free-only launch) |
| **Audio quality issues** | Medium | Medium | Use HIGH_QUALITY preset, test on real devices |
| **Firebase Auth setup complex** | Medium | Medium | Use Expo Firebase config plugin, test flows early |
| **Clean architecture too complex** | Low | High | Simplify if needed, domain layer is priority |
| **Miss Friday deadline** | Medium | High | Cut nice-to-have features, not core functionality |

---

## 12-Day Development Roadmap

### Week 1: Foundation + Core Features

**Day 1 (Monday): Setup & Architecture**
- [ ] Initialize Expo project with TypeScript
- [ ] Set up folder structure (domain/data/presentation)
- [ ] Configure Firebase (Auth, Firestore, Analytics)
- [ ] Set up RevenueCat (configure offerings)
- [ ] Install dependencies
- [ ] Create base entities and repository interfaces

**Day 2 (Tuesday): Quran Display**
- [ ] Implement Al-Quran Cloud API client
- [ ] Create local/remote repository pattern
- [ ] Build Quran reader screen
- [ ] Surah selector component
- [ ] Offline caching
- [ ] Test on device

**Day 3 (Wednesday): Note Taking**
- [ ] Note entity and repository
- [ ] Note editor screen
- [ ] Verse-level note linking
- [ ] Note list screen
- [ ] Folder creation/management
- [ ] Search functionality

**Day 4 (Thursday): Audio Recording**
- [ ] Audio recorder infrastructure (expo-audio)
- [ ] Audio player component (expo-av)
- [ ] Recording list screen
- [ ] Link recordings to verses
- [ ] Test recording quality

**Day 5 (Friday): UI Polish & Auth**
- [ ] React Native Paper theming
- [ ] Auth screens (login, onboarding)
- [ ] Google Sign-In integration
- [ ] Apple Sign-In integration
- [ ] Guest/anonymous auth
- [ ] User settings screen

### Week 2: Payments, Testing & Launch

**Day 6 (Monday): RevenueCat Integration**
- [ ] Configure offerings (monthly/annual)
- [ ] Paywall screen design
- [ ] Purchase flow implementation
- [ ] Restore purchases
- [ ] Test in sandbox

**Day 7 (Tuesday): Sync & Data**
- [ ] Firestore sync logic
- [ ] Conflict resolution (local vs remote)
- [ ] Migration from anonymous to authenticated
- [ ] Data export (premium feature)

**Day 8 (Wednesday): Testing & Bug Fixes**
- [ ] Manual testing on iOS
- [ ] Manual testing on Android
- [ ] Fix critical bugs
- [ ] Performance optimization
- [ ] Error handling

**Day 9 (Thursday): App Store Preparation**
- [ ] App Store screenshots
- [ ] App description and keywords
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Beta testing with 5 users

**Day 10-11 (Friday-Weekend): Production Builds**
- [ ] Create production builds (iOS & Android)
- [ ] Final testing on physical devices
- [ ] Submit to App Store (may take 24-48h review)
- [ ] Submit to Play Store (faster review)

**Day 12 (Next Monday): Launch**
- [ ] App goes live
- [ ] Announce to network
- [ ] Monitor analytics
- [ ] Respond to feedback

---

## Success Metrics

### Technical Success

- [ ] App launches in < 3 seconds
- [ ] Audio recording starts in < 1 second
- [ ] Zero data loss (notes/recordings persist)
- [ ] < 1% crash rate
- [ ] Works offline (airplane mode)
- [ ] Passes App Store review

### Business Success

- [ ] 100 downloads in month 1
- [ ] 20% daily active users
- [ ] 5+ notes per user average
- [ ] 3+ recordings per user average
- [ ] 4.0+ App Store rating
- [ ] $500-1,000 MRR by month 1

---

## AI-Assisted Development Workflow

### Antigravity (Primary Builder)

**Use for:**
- Generating component scaffolding
- Implementing repository patterns
- Setting up Firebase/RevenueCat config
- Writing TypeScript types and interfaces

**Prompts:**
```
"Create a Clean Architecture folder structure for a React Native Quran app with domain/data/presentation layers"

"Implement the GetSurahUseCase following the repository pattern with local caching"

"Build a QuranReader screen with verse selection and note indicators"
```

### Claude Code (Architecture & Debugging)

**Use for:**
- Complex architectural decisions
- Debugging tricky issues
- Code review and refactoring
- Firebase security rules

### ChatGPT (Quick Research)

**Use for:**
- Package compatibility checks
- Syntax questions
- Error message explanations

---

## Post-Launch Roadmap

### Month 2: Premium Features

- [ ] Rich text notes (@10play/tentap-editor)
- [ ] Text highlighting
- [ ] Multiple translations
- [ ] Dark mode
- [ ] Export to PDF

### Month 3: AI Features

- [ ] AI Tafsir assistant (OpenAI integration)
- [ ] Audio transcription (Whisper API)
- [ ] Smart note suggestions

### Month 4: Social & Growth

- [ ] Share notes (images/text)
- [ ] Community features (optional public profiles)
- [ ] Streaks and gamification

---

## Final Checklist

**Before starting development:**
- [ ] All accounts created (Apple, Google, Firebase, RevenueCat)
- [ ] Development environment ready (Node, Expo CLI, EAS CLI)
- [ ] Clean architecture understood
- [ ] Budget confirmed ($124 year 1)
- [ ] Timeline realistic (12 days)

**During development:**
- [ ] Following PRD features only
- [ ] Testing after each feature
- [ ] Committing code regularly
- [ ] Updating AGENTS.md as we learn

**Before launch:**
- [ ] All P0 features working
- [ ] Tested on real devices
- [ ] App Store assets ready
- [ ] Privacy policy drafted
- [ ] Beta testers recruited

---

*Technical Design for: QuranNotes*
*Architecture: Clean Architecture (Hexagonal)*
*Platform: React Native + Expo*
*Launch Target: Next Friday (12 days)*
*Estimated Cost: $124 year 1*

**Ready to build! 🚀📿**
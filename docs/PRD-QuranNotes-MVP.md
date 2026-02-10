# Product Requirements Document: QuranNotes MVP

## Product Overview

**App Name:** QuranNotes
**Tagline:** "Your personal space for Quran study, reflection, and growth"
**Launch Goal:** 100 users, $500-1,000 MRR in month 1; $50K+ MRR long-term to quit day job
**Target Launch:** Next Friday (12-day sprint)
**Long-term Vision:** Become the leading Quran study app, competing with Tarteel and Bible note apps

## Who It's For

### Primary User: Amina, the Seminar Student
A 22-year-old Islamic studies student in Malaysia. She attends daily classes, needs to translate Arabic to Malay and English, and studies with peers. Currently uses physical notebooks (can't write in Quran). She needs to capture insights, record her recitation for practice, and organize notes by topic for revision.

**Her Current Pain:**
- Physical notebooks get lost or damaged
- Can't link notes directly to specific verses
- No way to record and review her recitation
- Hard to find old notes when she needs them

**What She Needs:**
- Digital notes attached to exact verses
- Audio recording of her recitation and lectures
- Organization by class/topic/surah
- Offline access in the mosque (poor signal)

### Secondary Users

**Recent Convert (David, 35):**
- Learning Quran in English first
- Needs accessible explanations
- Wants to track his learning journey
- Values privacy in his exploration

**Modern Reflector (Fatima, 28):**
- Uses iPhone for everything
- Wants deep study, not just reading
- Links Quran to daily life situations
- Shares insights with close friends

**Curious Parent (Ahmed, 55):**
- Traditional but tech-curious
- Wants to help grandchildren learn
- Uses voice features (easier than typing)
- Values simplicity and respectfulness

## The Problem We're Solving

**Current Solutions Fall Short:**
- **Quran.com:** Great reading, no personal notes
- **Quran Plus:** Basic bookmarks only
- **Tarteel:** AI recitation focus, no note-taking
- **Generic notes apps (Notion, Apple Notes):** No Quran integration, no verse linking
- **Physical notebooks:** Can't search, record audio, or backup

**Why Now:**
- 2.16B spiritual wellness app market growing 14.6% yearly
- Quran apps have 10M+ downloads but gap in study tools
- Bible note apps prove the model (Scripture Notes, Church Notes successful)
- AI tools make building this possible for non-technical founders

## User Journey

### Discovery → First Use → Success

**1. Discovery Phase**
- Amina searches "Quran notes app" on App Store
- Finds QuranNotes — clear name, good reviews
- Downloads (free, no commitment)

**2. Onboarding (First 2 Minutes)**
- Opens app: Clean, calming interface
- Sees simple tutorial: "Select a surah, tap any verse to add notes or record"
- Selects Al-Fatiha (short, familiar)
- Taps verse 1, adds first note: "Opening of every prayer"
- Feeling: "This is exactly what I needed"

**3. Core Usage Loop (Daily)**
- **Morning:** Opens app during class
- **Action:** Teacher explains verse → Amina taps verse → adds note + records 30-second audio
- **Reward:** Sees her growing collection of notes organized by class
- **Investment:** 3-5 notes per day, building her personal Quran knowledge base

**4. Success Moment (Week 1)**
- **"Aha!" moment:** Searching "mercy" finds all verses she noted about Allah's mercy across different surahs
- **Share trigger:** Shows her study group how she organized notes; they download too

## MVP Features

### Must Have for Launch (Friday)

#### 1. Quran Text Display
- **What:** Display Arabic Uthmani script + English translation (Saheeh International)
- **User Story:** As a student, I want to read Quran with translation so I can understand meaning while studying
- **Success Criteria:**
  - [ ] Loads in &lt; 3 seconds
  - [ ] Smooth scrolling through longest surah (Al-Baqarah, 286 verses)
  - [ ] Works offline after first download
  - [ ] Clear Arabic font, readable English
- **Priority:** P0 (Critical)

#### 2. Verse-Level Note Taking
- **What:** Plain text notes attached to specific verses
- **User Story:** As a learner, I want to write my reflections on specific verses so I can revisit my understanding
- **Success Criteria:**
  - [ ] Tap any verse → add/edit/delete note
  - [ ] Note indicator shows if verse has notes
  - [ ] Unlimited local notes
  - [ ] Auto-save (no data loss)
- **Priority:** P0 (Critical)

#### 3. Audio Recording Per Verse
- **What:** Record and playback audio attached to verses (lectures, personal recitation, reflections)
- **User Story:** As a student, I want to record my recitation and teacher's explanations so I can review them later
- **Success Criteria:**
  - [ ] Record button on each verse
  - [ ] Playback with seek/scrub
  - [ ] Recording list view (by date/surah)
  - [ ] Works offline, stores locally
  - [ ] High-quality audio (expo-audio HIGH_QUALITY preset)
- **Priority:** P0 (Critical)

#### 4. Notebook/Folder Organization
- **What:** Organize notes into custom folders (by class, topic, or surah)
- **User Story:** As a power user, I want to organize my notes by subject so I can find related insights quickly
- **Success Criteria:**
  - [ ] Create unlimited folders
  - [ ] Move notes between folders
  - [ ] Folder list view
  - [ ] Default folders: "All Notes", "Recent", "Favorites"
- **Priority:** P0 (Critical)

#### 5. Basic Search
- **What:** Search within notes and find verses
- **User Story:** As a student, I want to search my notes for keywords so I can find specific reflections quickly
- **Success Criteria:**
  - [ ] Search across all note text
  - [ ] Results show verse reference + note preview
  - [ ] Tap result → jump to verse
- **Priority:** P0 (Critical)

### Nice to Have (Post-Launch Week 2-4)
- **Rich text formatting** (bold, italic) — upgrade to @10play/tentap-editor
- **Text highlighting** — color-code verses
- **Multiple translations** — add 2-3 more English translations
- **Dark mode** — easier on eyes for night reading
- **Audio transcription** (Whisper API) — turn voice notes into searchable text
- **Cloud sync** — backup and cross-device access
- **Export data** — PDF or backup file

### NOT in MVP (Saving for Later)
- **AI Tafsir assistant** — v2 priority, requires API costs and content safety review
- **Social features** — sharing, public profiles, community
- **Gamification** — streaks, badges, leaderboards
- **iPad optimization** — mobile-first for v1
- **Push notifications** — daily reminders
- **Payment/subscription** — validate free version first

*Why we're waiting: Keeps MVP focused and launchable in 5 days. AI and social features add complexity and costs.*

## How We'll Know It's Working

### Launch Success Metrics (First 30 Days)
| Metric | Target | Measure |
|--------|--------|---------|
| Downloads | 100 | App Store Connect |
| Daily Active Users | 20% of downloads | In-app analytics |
| Notes created per user | 5+ average | Database count |
| Recordings per user | 3+ average | Storage count |
| App Store rating | 4.0+ stars | Reviews |

### Growth Metrics (Months 2-3)
| Metric | Target | Measure |
|--------|--------|---------|
| Monthly Active Users | 200 | Analytics |
| Premium conversions | 10% | RevenueCat |
| User retention (Day 7) | 30% | Analytics |
| Organic referrals | 20% of new users | Survey |

## Look & Feel

**Design Vibe:** Clean, modern, fast, calming, respectful

**Visual Principles:**
1. **Clean:** Minimal UI, no clutter, focus on Quran text
2. **Modern:** Native iOS/Android feel, smooth animations
3. **Fast:** Instant response, no loading spinners
4. **Calming:** Soft colors (blues, greens, warm neutrals), no harsh reds
5. **Respectful:** No flashy animations on Quran text, proper spacing

**Key Screens:**
1. **Home/Quran Reader:** Full-screen Quran, verse selection
2. **Note Editor:** Clean input, save/cancel
3. **Recording Interface:** Simple record/stop/playback
4. **Folders List:** Organized notebooks
5. **Search Results:** Clean list, easy navigation

### Simple Wireframe
[Home/Quran Reader]
┌─────────────────────────┐
│  [Surah Selector ▼]     │
├─────────────────────────┤
│                         │
│   بِسْمِ ٱللَّٰهِ        │
│   (Arabic text)         │
│                         │
│   In the name of Allah  │
│   (English below)       │
│                         │
│  [📝] [🎙️] [🔖]        │ ← Tap for note/record/bookmark
│                         │
├─────────────────────────┤
│  [Prev]  [Surah 1:1]  [Next] │
└─────────────────────────┘
[Note View]
┌─────────────────────────┐
│  Al-Fatiha 1:1    [X]   │
├─────────────────────────┤
│                         │
│  My Notes:              │
│  ┌─────────────────┐    │
│  │ Opening prayer..│    │
│  │ every salah...  │    │
│  │                 │    │
│  └─────────────────┘    │
│                         │
│  [Recordings: 2]        │
│  ▶️ Lecture clip (2:34) │
│  ▶️ My recitation (0:45)│
│                         │
│  [Save]  [Cancel]       │
└─────────────────────────┘

## Technical Considerations

**Platform:** React Native + Expo (iOS and Android)
**Responsive:** Mobile-first, tablet later
**Performance:** 
- App launch < 3 seconds
- Audio recording starts < 1 second
- Smooth 60fps scrolling
- Works on 3-year-old devices

**Offline-First:**
- Quran text caches locally (AsyncStorage + expo-file-system)
- Notes/recordings save immediately to device
- No internet required for core features

**Accessibility:**
- WCAG 2.1 AA minimum
- Screen reader support
- High contrast mode
- Font size adjustment

**Security/Privacy:**
- All data stays on device by default
- No tracking, no ads, no data selling
- Optional cloud sync in v2 (user-controlled)

**Scalability:**
- Handle all 114 surahs (largest: 286 verses)
- Unlimited local notes (device storage limited)
- 10,000+ users with current architecture

## Quality Standards

**What This App Will NOT Accept:**
- Placeholder content in production ("Lorem ipsum", sample images)
- Broken features — everything listed works or isn't included
- Skipping mobile testing before launch
- Ignoring accessibility basics
- Requiring internet for core reading/notes

*These standards will be enforced by the AI coding assistant.*

## Budget & Constraints

**Development Budget:** $50/month initial
**Monthly Operating:** $0 (free tiers sufficient for MVP scale)
**Timeline:** 5 days to launch (Friday deadline)
**Team:** Solo founder + AI assistance

**Cost Breakdown:**
- Apple Developer Account: $99/year (one-time)
- Google Play Developer: $25 (one-time)
- Expo: Free tier
- Al-Quran Cloud API: Free (no rate limits)
- AsyncStorage: Free (on-device)
- **Total Year 1: $124** (under budget)

## Open Questions & Assumptions
- Users prefer offline-first over cloud sync initially
- English + Arabic sufficient for MVP (more translations v2)
- Plain text notes acceptable for launch (rich text v2)
- App Store approval straightforward (religious content guidelines)

## Launch Strategy (Brief)

**Soft Launch:** Friday release to personal network, Islamic student groups, Reddit r/islam, r/MuslimLounge
**Target Users:** 100 downloads in month 1
**Feedback Plan:** In-app feedback button, email support, Google Form for feature requests
**Iteration Cycle:** Weekly updates based on user feedback

## Definition of Done for MVP

The MVP is ready to launch when:
- [ ] All P0 features are functional
- [ ] Basic error handling works (no crashes)
- [ ] It works on mobile and tablet (iOS and Android)
- [ ] One complete user journey works end-to-end (open app → read → add note → record → find note)
- [ ] Offline functionality verified (airplane mode test)
- [ ] App loads in < 3 seconds
- [ ] No placeholder content
- [ ] Privacy policy drafted
- [ ] App Store screenshots created
- [ ] 5 friends/family test complete with no critical bugs
- [ ] Deployment to TestFlight/Internal Testing ready

# QuranNotes Feature Spec: Cross-Pollination from Brainrot, Prayer Lock, Pray

> **Purpose:** Define 3 new features adapted from competitor analysis. Serves as the single source of truth for development — all implementation must validate against this document.

---

## Competitor Analysis Summary

| App | Ratings | Core Mechanic | What Works | What Fails |
|-----|---------|--------------|------------|------------|
| **Brainrot** | 6.4K · 4.5★ | App blocking + brain avatar that decays with doomscrolling | Visual mascot creates emotional bond; breathing pause before unlock | Forced paywall before trial; buggy widgets; automations reset |
| **Prayer Lock** | 13K · 4.9★ | Bible prayer required before opening blocked apps | "Helps me focus on God throughout the day"; emotional reviews; free core | Repetitive prayers (~100 recycled); subscription for full features |
| **Pray** | 9K · 4.9★ | Bible verse + prayer prompt before app access; 3x daily scheduled locks | Structured blocking; "unplug from doom-scrolling" | Heavy ads (2x 30-sec per prayer); same prayer loops for weeks; glitchy locks |

**The pattern:** All 3 gate phone usage behind spiritual content. Gets triggered 20-50x/day. Transforms doomscrolling guilt into spiritual engagement. Inherently viral on TikTok.

---

## The QuranNotes Narrative

These features are not bolted on. They extend a single story:

> **QuranNotes is your spiritual companion.** It already helps you read Quran, reflect on verses, track adhkar, monitor your khatma, and check in with your heart. Now it goes further — **it protects your spiritual space from distraction and shows you, through Noor, whether your soul is being nourished or neglected.**

Every feature connects:
- **Quran Lock** = Noor guards your attention, replacing mindless scrolling with Quran
- **Noor Health** = Noor reflects your spiritual state — when you engage, Noor thrives; when you don't, Noor wilts
- **Sacred Pause** = Noor gives you a gentle moment of dhikr before you re-enter the noise

Noor is not a gimmick. Noor is the thread that unifies the entire app experience.

---

## Feature 1: Quran Lock 🔒
**The headline feature. The download driver. The acquisition engine.**

### What It Does
When a user tries to open a blocked app (TikTok, Instagram, etc.), QuranNotes intercepts and shows a Quran verse. The user must read and engage with the verse before the app unlocks.

### User Flow

```
SETUP (one-time):
  Settings → "Quran Lock" → Grant Screen Time API permission
  → Select apps to lock
  → Choose engagement mode:
     • "Read" → verse displays, 5-second delay, tap to dismiss
     • "Reflect" → verse displays, must tap comprehension acknowledgment
     • "Journal" → verse displays, must write a 1-line reflection
  → Choose content source:
     • Sequential (follows khatma progress)
     • Thematic (matches most recent mood check-in)
     • Bookmarked verses (personal favorites)
     • Daily adhkar (during adhkar windows)

TRIGGER (every blocked app open):
  1. iOS Screen Time API / FamilyControls intercepts launch
  2. Full-screen overlay: Arabic calligraphy + translation
  3. User reads → engages per their chosen mode → app unlocks
  4. Verse logged to reading history automatically
  5. If "Journal" mode: note saved to verse's reflection library
```

### Monetization
| Tier | What You Get |
|------|-------------|
| **Free** | Lock **1 app**. "Read" mode only. Sequential content only |
| **Pro** | Lock **unlimited apps**. All 3 modes. All content sources. Journal integration |

> 1 free lock is the taste. Most users want 2-3 (TikTok + Instagram + YouTube). That's the conversion trigger.

### Competitive Edge
- Prayer Lock/Pray show ~100 recycled prayers → **we have 6,236 unique ayat**
- Their content is static → **ours is contextual** (khatma-synced, mood-matched, bookmarked)
- They have no note-taking → **ours feeds the reflection journal**
- They're ad-heavy → **ours is ad-free**

### Viral Mechanic
- "POV: I tried to open TikTok but the Quran opened instead" = instant TikTok content format
- "Day 15 of replacing doomscrolling with Quran" = journey series
- Users screenshot beautiful verse overlays → share on Instagram stories with QuranNotes watermark

---

## Feature 2: Noor Health 🌱
**Visual spiritual companion. Replaces numerical scoring (which is controversial in Islam — counting deeds risks riya/showing off).**

### What It Does
The Noor mascot appears on the Dashboard in different visual states based on the user's spiritual engagement. Noor is radiant when the user is engaged, and withers when they're not — exactly like Brainrot's brain avatar, but with spiritual meaning.

### Noor States

| State | Visual | Trigger |
|-------|--------|---------|
| **Radiant** ✨ | Noor glowing, smiling, golden light | High engagement: adhkar + reading + notes |
| **Content** 😊 | Noor calm, gentle smile, soft light | Moderate engagement: some activities done |
| **Neutral** 😐 | Noor still, muted colors | Minimal engagement: opened app but didn't do much |
| **Tired** 😔 | Noor drooping, dim, muted | Low engagement: no activities for 24h+ |
| **Withering** 🥀 | Noor faded, wilting, grey tones | No engagement for 48h+ or heavy blocked app usage |

### What Affects Noor's State
Noor's health is calculated from the **last 24-hour window** (rolling, not daily reset):

**Nourishing activities (Noor brightens):**
- Completed morning or evening adhkar
- Quran reading session (5+ minutes)
- Wrote a verse reflection note
- Listened to recitation (5+ minutes)
- Completed emotional check-in
- Read a Quran Lock verse (engaged, didn't just dismiss)

**Draining activities (Noor dims):**
- Extended blocked app usage after Quran Lock unlock
- No app engagement for 24h+
- Dismissing Quran Lock repeatedly without reading

> The system never explicitly "counts" deeds or shows numbers. Noor simply reflects your state. Users interpret it spiritually without the app making theological claims.

### Display
- Dashboard: Noor widget replaces or sits alongside the emotional check-in
- Animated transitions between states (smooth, not jarring)
- Tapping Noor shows a gentle encouragement: "Noor is feeling bright today ✨" or "Noor misses your recitation 📖"
- **Shareable card**: tap and hold to generate a branded card with Noor's current state + a motivational message + QuranNotes watermark

### Monetization
| Tier | What You Get |
|------|-------------|
| **Free** | See Noor's current state on Dashboard |
| **Pro** | Shareable cards, Noor's weekly journey (state history), personalized encouragement messages |

### Why This Works
- Emotional bond with a character > seeing a number
- No theological controversy — it's a visual reflection, not a deed counter
- Shareable moments: "Look how happy Noor is today!" with app watermark = organic marketing
- Leverages existing Noor brand mascot identity (already have design specs, campaign assets)

---

## Feature 3: Sacred Pause ✨
**Micro-moment of mindfulness. The gentlest intervention.**

### What It Does
A 10-second breathing + dhikr animation before a blocked app opens. Not a verse — a moment of intentional presence. This is the lightweight alternative within Quran Lock's flow.

### User Flow
```
1. User tries to open blocked app
2. Calming full-screen animation: expanding/contracting circle
3. Text: "Breathe. Remember Allah."
4. Optional dhikr counter: SubhanAllah / Alhamdulillah / Allahu Akbar
5. Progress bar fills over 10 seconds
6. App unlocks
```

### Where It Lives
- Settings → Quran Lock → choose between "Verse" mode and "Sacred Pause" mode per app
- Or: set as the mode for 2nd+ unlock of the same app in a session (first time = verse, subsequent = pause)

### Monetization
Included with Quran Lock access (free for 1 locked app, Pro for unlimited).

---

## Monetization Summary

| Feature | Free | Pro |
|---------|------|-----|
| **Quran Lock** | 1 app, "Read" mode, sequential verses | Unlimited apps, all modes, all content sources |
| **Noor Health** | Current state on Dashboard | Shareable cards, weekly journey, personalized messages |
| **Sacred Pause** | Available for 1 locked app | Available for all locked apps |

---

## Project Structure

```
features/quran-lock/
├── docs/
│   ├── feature_spec.md          ← THIS FILE (single source of truth)
│   ├── user_journeys.md         ← Developer creates: all user flows (MECE)
│   ├── edge_cases.md            ← Developer creates: edge case matrix
│   └── integration_impact.md    ← Developer creates: what could break
├── assets/
│   └── noor-states/
│       ├── 01_radiant.png       ← ✨ Glowing, golden sparkles, joyful
│       ├── 02_content.png       ← 😊 Calm, gentle smile, soft glow
│       ├── 03_neutral.png       ← 😐 Flat expression, muted colors
│       ├── 04_tired.png         ← 😔 Drooping, desaturated, sad star
│       └── 05_withering.png     ← 🥀 Fading, grey, particles drifting off
└── src/                         ← Developer creates: implementation code
```

> All documentation goes in `docs/` BEFORE any code goes in `src/`. The developer must read and validate against `feature_spec.md` continuously.

---

## Git Branch Strategy

> [!IMPORTANT]
> **All work MUST happen on a feature branch, not main.**

```bash
git checkout -b feature/quran-lock
```

- Branch name: `feature/quran-lock`
- All commits scoped to this branch until feature is stable and reviewed
- Merge to `main` only after full regression and storytelling validation (Phase 3)
- Never push broken code to `main`

---

## Noor Mascot Assets

Reference images for all 5 Noor states are pre-generated in `features/quran-lock/assets/noor-states/`. These are the visual targets for the in-app implementation.

| File | State | Use In App |
|------|-------|-----------|
| `01_radiant.png` | ✨ Radiant | Dashboard when high engagement |
| `02_content.png` | 😊 Content | Dashboard when moderate engagement |
| `03_neutral.png` | 😐 Neutral | Dashboard when minimal engagement |
| `04_tired.png` | 😔 Tired | Dashboard when 24h+ no activity |
| `05_withering.png` | 🥀 Withering | Dashboard when 48h+ no activity / heavy scroll |

The developer should use these as reference to create SVG/Lottie animations in-app (matching the existing `NoorMascot.tsx` component architecture). The PNG assets can also be used directly for shareable cards and marketing.

---

## Shipping Sequence

Do NOT ship all features at once. Build in stages:

| Phase | Feature | Branch |
|-------|---------|--------|
| **V1** | Quran Lock + Sacred Pause (mode within Lock) | `feature/quran-lock` |
| **V2** | Noor Health (Dashboard visual states) | `feature/noor-health` (branch from V1) |

Ship V1 first. Validate it drives downloads. Then layer V2 on top.

---

## Developer Handoff Protocol

> [!CAUTION]
> **Do NOT write a single line of code before completing the documentation phase below.** This is feature-driven development. The spec is the contract. Code validates against the spec, not the other way around.

### Phase 1: Feature Documentation (Before Any Code)

For **each feature**, the implementing developer must produce:

1. **User Journey Map** — Every path a user can take, from first encounter to daily use to edge cases
   - Happy path
   - First-time setup flow
   - Returning user flow
   - Error/failure states
   - Permission denial flows
   - Subscription upgrade/downgrade flows

2. **Edge Case Matrix (MECE)** — Mutually exclusive, collectively exhaustive:
   - What happens when Screen Time permission is revoked mid-use?
   - What happens when the user has no internet?
   - What happens when the user hasn't completed khatma setup but chose "Sequential" mode?
   - What happens when the user's subscription expires while they have 3 locked apps?
   - What happens when Noor state updates during background/killed app state?
   - What if the user force-quits during Quran Lock overlay?
   - What if two locked apps are opened simultaneously?

3. **Integration Impact Assessment** — Verify no existing feature breaks:
   - Does Quran Lock conflict with the existing notification ecosystem?
   - Does Noor Health Dashboard widget conflict with emotional check-in layout?
   - Does reading history correctly absorb Quran Lock verses?
   - Does Sacred Pause dhikr count integrate with adhkar tracking?
   - Does RevenueCat entitlement gating work for the new tiering?

4. **Brand Coherence Check** — All UI must:
   - Follow the existing Neutral Zinc-scale design system (#09090B Background, #18181B Surface)
   - Use established typography (no new fonts)
   - Match the premium, high-contrast dark mode aesthetic
   - Feel like a natural extension of QuranNotes, not a bolt-on

### Phase 2: Develop → Validate Loop

```
Document feature spec
    ↓
Implement one component
    ↓
Return to spec → validate behavior matches
    ↓
Test integration with existing features
    ↓
Move to next component
    ↓
(repeat until feature complete)
    ↓
Full regression against spec
```

### Phase 3: Storytelling Validation

Before shipping, ask: **Does this feel like QuranNotes?**
- Does Quran Lock feel like a spiritual companion guiding you, or a punitive blocker?
- Does Noor feel alive and connected to the user's journey, or like a Tamagotchi gimmick?
- Does Sacred Pause feel like a moment with Allah, or a forced delay timer?

If any answer leans toward the negative, redesign before shipping.

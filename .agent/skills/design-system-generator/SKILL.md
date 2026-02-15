---
name: design-system-generator
description: Research, select, and document a complete frontend design system for QuranNotes. Use when creating or updating the design system.
---

# Design System & Frontend Guidelines Generator

> **Skill:** Research-backed design system creation instead of ad-hoc choices.

## When to Use This Skill

- During initial project setup for `FRONTEND_GUIDELINES.md`
- When adding a new feature area that needs design decisions
- When the current design feels inconsistent or "off"
- When considering a UI library change

---

## The 9-Step Process

### Step 1: Context Gathering
Before any research:
- Read `AGENTS.md` — understand the project
- Read `.agent/rules/base.md` — locked tech stack
- Read `.agent/rules/design-reference.md` — existing palette and rules
- Review existing `DesignSystem.ts` — current implementation

### Step 2: Domain-Specific Color Research
Research color psychology for Islamic/Quran companion apps:

**Search queries:**
```
"Islamic app color psychology trust UX"
"Quran app design trends 2025 modern premium"
"Arabic reading app typography best practices"
```

**Key questions:**
- What colors convey spiritual reverence + modern premium feel?
- What do Quran.com, Tarteel, Muslim Pro look like?
- Should it default to dark or light mode?

### Step 3: Library Selection
For each UI need, evaluate using `.agent/skills/technology-evaluation/`:

| Need | Current Choice | Alternatives to Evaluate |
|:-----|:---------------|:------------------------|
| UI Framework | React Native Paper | gluestack-ui, Tamagui |
| Animations | Moti + Reanimated | Only if current is insufficient |
| Bottom Sheets | @gorhom/bottom-sheet | Standard for RN |
| Icons | MaterialCommunityIcons | Lucide, Phosphor |

### Step 4: Build the Color System
Create token-based palette with light AND dark mode:
```
Primary palette (50-900 scale)
Accent palette (gold/achievement)
Success / Error / Warning
Neutral palette (backgrounds, text, borders)
Semantic mappings (what each color MEANS)
```

### Step 5: Typography Scale
Define using platform-native + Arabic fonts:
```
Display (32px) — Hero stats
H1 (24px) — Screen titles
H2 (20px) — Sections
H3 (17px) — Cards
Body (15px) — Default
Caption (13px) — Secondary
Arabic Verse (28px+) — Quranic text
```

### Step 6: Component Patterns
Document key UI patterns with ASCII art for the domain:
```
┌────────────────────────────────┐
│ ⟵  Al-Baqarah (286 verses)    │
│────────────────────────────────│
│ بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ │
│ ▶ 🔖 💬                        │
│────────────────────────────────│
│ ٱلْحَمْدُ لِلَّهِ رَبِّ      │
│ ▶ 🔖 💬                        │
└────────────────────────────────┘
```

### Step 7: Animation Guidelines
| Type | Duration | When |
|:-----|:---------|:-----|
| Micro | 100ms | Press feedback |
| Transition | 250ms | Screen changes |
| Data reveal | 800-1200ms | Streak, Juz count |
| Celebration | 1500-2000ms | Khatma completion |

### Step 8: Accessibility Checklist
- [ ] WCAG AA contrast ratios (4.5:1 body, 3:1 large)
- [ ] Touch targets 44x44pt minimum
- [ ] Screen reader labels on all interactive elements
- [ ] RTL support for Arabic text
- [ ] Dynamic Type support (iOS)
- [ ] Reduced motion preference

### Step 9: Design Benchmarks
| App | What to Learn |
|:----|:-------------|
| Quran.com | Verse layout, audio UX |
| Tarteel | Premium Islamic aesthetic |
| Muslim Pro | Notification patterns |
| Headspace | Mood check-in UX |
| Calm | Illustration-driven interface |

---

## Output

The skill produces:
1. Updated `DesignSystem.ts` with token-based palette
2. Updated `.agent/rules/design-reference.md` with research findings
3. Component pattern documentation

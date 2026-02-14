---
description: Mobile app color palettes and UI component patterns for premium, engaging interfaces
---

# Mobile App Color & UI Design Skill

## Color Palette Principles

### 1. Dual-Accent Color System
Never use a single color for everything. Every premium app uses **at least 2 contrasting accent colors**:

| Pattern | Primary | Accent | When to use |
|---------|---------|--------|-------------|
| **Purple + Gold** | `#6C63FF` | `#F5A623` / `#FFB020` | Spiritual, mindfulness apps |
| **Blue + Coral** | `#4A90D9` | `#FF6B6B` | Productivity, health |
| **Teal + Amber** | `#2DD4BF` | `#FBBF24` | Fresh, growth-oriented |
| **Indigo + Emerald** | `#6366F1` | `#10B981` | Trust + achievement |
| **Deep Blue + Warm Orange** | `#3B82F6` | `#F97316` | Energy, motivation |

### 2. Semantic Color Assignments
Map colors to meaning, not just decoration:
- **Progress/achievement**: Warm colors (gold `#F5A623`, amber `#FBBF24`, orange `#F97316`)
- **Completion/success**: Green spectrum (`#10B981`, `#34D399`, `#38A169`)
- **Navigation/primary actions**: Cool colors (purple, blue, indigo)
- **Warning/behind**: Soft warm (`#F59E0B`, not harsh red)
- **Background accents**: Muted, desaturated versions of the accent at 10-15% opacity

### 3. Color Temperature Contrast
The secret of apps like Headspace, Duolingo, Calm:
- **Cool base** (purple/blue) + **warm highlights** (gold/orange/coral)
- This creates visual depth and draws the eye to important elements
- Numbers, progress indicators, and celebrations should use the **warm** accent

## Component Patterns

### Progress Indicators
```
✅ DO: Use warm accent for progress numbers/rings/bars
❌ DON'T: Use the same primary purple for everything
```
- Progress rings: Fill with **gold/amber gradient**
- Stats numbers: Render in **warm accent color**
- Progress bars: Use **gradient from primary → accent**

### Checkmarks & Completion States
```
✅ DO: Consistent shape (all circles OR all rounded squares)
✅ DO: Use a single icon library consistently
❌ DON'T: Mix circle checkmarks with square ones
❌ DON'T: Show multiple redundant checkmarks
```
- Use `MaterialCommunityIcons` for consistent icon language:
  - Completed: `check-circle` (filled circle with check)
  - In progress: `circle-slice-4` or custom progress
  - Not started: `circle-outline`

### Day/Week Strips (Headspace/Duolingo style)
- Compact single row showing 7 days
- Each day: circle avatar with state indicator
- Today highlighted with ring/border, not fill
- Past completed: filled accent color
- Future: grey/muted
- Expandable to full month on tap

### Motivational Content
```
✅ DO: Large, breathing text with generous line height
✅ DO: Arabic text at 28-32pt with 48+ line height
❌ DON'T: Cram motivational text into small colored bars
❌ DON'T: Use the same container style for status AND motivation
```

### Font Size Scale (React Native)
| Element | Size | Weight |
|---------|------|--------|
| Page title | 28-32 | 800 |
| Section header | 18-20 | 700 |
| Card title | 16 | 700 |
| Body text | 14-15 | 400-500 |
| Label/caption | 12 | 500 |
| Tiny label | 10-11 | 500 |

### Banner/Status Messages
- Keep them lightweight: text only, no heavy containers
- Use color for the text, not a colored background
- One icon max, positioned left
- No checkmark icons in text-based status messages

## Premium App Patterns to Emulate

### Headspace
- Playful illustrations
- Compact weekly strip with character avatars
- Warm coral + cool teal palette
- Large, confident motivational text
- Lots of whitespace

### Duolingo
- Bright, contrasting colors per section
- Progress feels rewarding (animations, celebrations)
- Gold for streaks and achievements
- Simple, bold icons

### Calm
- Gradient backgrounds
- Nature-inspired warm tones
- Minimal UI, maximum breathing room
- Progress is subtle, not overwhelming

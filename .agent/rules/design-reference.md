# Design Reference — QuranNotes

> Domain-specific design intelligence for Islamic/Quran companion apps.

---

## Color Palette — Islamic/Religious Domain

### Psychology
Islamic apps should feel **reverent, warm, and elegant**. Gold conveys spiritual achievement, deep purples create a premium feel, greens reference Islamic tradition, and warm neutrals provide a calm reading environment.

### QuranNotes Palette
| Role | Light Mode | Dark Mode | Psychology |
|:-----|:-----------|:----------|:-----------|
| Primary | `#7C3AED` (purple) | `#A78BFA` | Premium, spiritual depth |
| Accent | `#D4A853` (gold) | `#D4A853` | Achievement, progress, sacred |
| Success | `#10B981` (green) | `#34D399` | Growth, completion, Islamic tradition |
| Error | `#EF4444` (red) | `#F87171` | Warnings, validation |
| Surface | `#FFFFFF` | `#1E1E2E` | Clean reading surface |
| Text Primary | `#1A1A2E` | `#E8E8E8` | High contrast readability |
| Text Secondary | `#6B7280` | `#9CA3AF` | Supporting information |
| Border | `#E5E7EB` | `#2D2D3F` | Subtle separation |

> [!CAUTION]
> Avoid: Loud neon colors, gamification patterns (badges/XP), aggressive red CTAs. Islamic apps must feel respectful and contemplative.

---

## Font Considerations

### Arabic Text
| Font | Use Case |
|:-----|:---------|
| **Amiri** | Classic Quranic text display |
| **Noto Naskh Arabic** | Modern Arabic body text |
| **KFGQPC Uthmanic Script** | Traditional mushaf rendering |

### English/Latin Text
| Font | Use Case |
|:-----|:---------|
| **Inter** | Body text, UI labels |
| **System (SF Pro)** | iOS-native feel for navigation |

### Typography Scale
| Level | Size | Weight | Use |
|:------|:-----|:-------|:----|
| Display | 32px | Bold | Hero stats (streak count, Juz number) |
| H1 | 24px | SemiBold | Screen titles |
| H2 | 20px | SemiBold | Section headers |
| H3 | 17px | Medium | Card titles |
| Body | 15px | Regular | Default text |
| Caption | 13px | Regular | Timestamps, secondary info |
| Arabic Verse | 28px+ | Regular | Quranic text (must be larger than body) |

---

## UX Anti-Patterns (High Severity)

### Touch & Interaction
| ❌ Don't | ✅ Do | Severity |
|:---------|:------|:---------|
| Touch targets < 44px | Min 44×44pt (Apple HIG) | 🔴 High |
| No haptic on key actions | Light haptic on confirm, medium on destructive | 🟠 Medium |
| Swipe-to-delete without undo | Provide undo for destructive actions (3-5s window) | 🔴 High |

### Navigation
| ❌ Don't | ✅ Do | Severity |
|:---------|:------|:---------|
| Navigate Khatma with `?verse=` | Always `?page=` to land at top | 🔴 High |
| Auto-scroll on manual verse tap | Only auto-scroll on sequential advance | 🔴 High |
| No back button on detail screens | Always provide navigation affordance | 🔴 High |

### Loading & Feedback
| ❌ Don't | ✅ Do | Severity |
|:---------|:------|:---------|
| Spinner for loading | Skeleton shimmer within 100ms | 🔴 High |
| Generic "Error occurred" | Specific, actionable error + retry | 🔴 High |
| No empty state | Design empty states with illustration + CTA | 🟠 Medium |

### Animation Timing
| Type | Duration | When |
|:-----|:---------|:-----|
| Micro (press) | 100ms | Button press, toggle, checkbox |
| Transition (screen) | 250–300ms | Navigation, modals, sheets |
| Data reveal (count-up) | 800–1200ms | Streak count, Juz progress |
| Celebration | 1500–2000ms | Khatma completion, achievements |
| Skeleton shimmer | ∞ loop | Content loading |

> **Easing:** `ease-out` for enter, `ease-in` for exit, `ease-in-out` for transitions.

### Accessibility
| ❌ Don't | ✅ Do | Severity |
|:---------|:------|:---------|
| Color-only indicators | Color + icon/shape/text | 🔴 High |
| Text contrast < 4.5:1 | WCAG AA: 4.5:1 body, 3:1 large | 🔴 High |
| No `accessibilityLabel` on icons | Label every interactive element | 🟠 Medium |
| Ignore RTL for Arabic | Full RTL support for Arabic text | 🔴 High |

---

## Design Benchmarks

| App | What to Learn |
|:----|:-------------|
| **Quran.com** | Clean reading UX, verse-by-verse layout, audio integration |
| **Tarteel** | Voice recognition UX, premium Islamic aesthetic |
| **Muslim Pro** | Prayer times UX, notification patterns, onboarding |
| **Headspace** | Mood check-in UX (we adapted this for our mood feature) |
| **Calm** | Illustration-driven interface, warm color palette |

---

## Domain → Aesthetic

| Domain | Aesthetic | Color Mood | Font Mood | Avoid |
|:-------|:---------|:-----------|:----------|:------|
| **Islamic/Religious** | Reverent, warm, elegant | Gold + deep purple/navy | Arabic-supporting + clean sans | Loud colors, gamification, heavy animations |

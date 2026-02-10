# Autonomous Testing & Quality Assurance Protocol

## Objective
Ensure QuranNotes is smooth, beautiful, and sexy through comprehensive autonomous testing without user intervention.

## Multi-Perspective Decision Making

When making decisions, consider ALL these perspectives simultaneously:

### End User Perspective
- "Does this feel intuitive?"
- "Would I enjoy using this daily?"
- "Is it fast and responsive?"
- "Does it look premium or cheap?"
- "Would I recommend this to a friend?"

### Owner/Business Perspective
- "Does this drive retention?"
- "Is the premium value clear?"
- "Will this generate positive reviews?"
- "Is the scope appropriate for timeline?"

### Engineer Perspective
- "Is this maintainable?"
- "Will this scale to 10K users?"
- "Are there edge cases I'm missing?"
- "Is error handling robust?"
- "Is performance optimized?"

### Designer Perspective
- "Does this follow platform conventions?"
- "Is the visual hierarchy clear?"
- "Are interactions delightful?"
- "Is accessibility considered?"
- "Does it feel cohesive?"

**Decision Rule:** If 3+ perspectives agree, proceed. If split, choose user experience over engineering elegance for MVP.

---

## Autonomous Testing Protocol

### Phase 1: Functional Testing (No Emulator)

**Unit Tests:**
- Test all use cases in domain layer
- Test repository methods with mock data
- Validate TypeScript types compile

**Integration Tests:**
- Test API clients with real calls (safe endpoints only)
- Test storage read/write operations
- Test audio recording/playback flow

**Static Analysis:**
- Run ESLint with zero warnings
- Run Prettier for formatting
- Run TypeScript compiler (`tsc --noEmit`)

### Phase 2: Emulator Testing (Automated + Manual)

**Launch Emulator:**
- iOS Simulator (iPhone 15 Pro, iPhone SE)
- Android Emulator (Pixel 7, small screen device)

**Automated Interactions:**
Use Maestro, Detox, or Appium to automate:
- App launch → Home screen
- Surah selection → Display Quran
- Tap verse → Add note → Save
- Record audio → Playback → Delete
- Navigate all tabs
- Background/foreground app
- Kill and relaunch app

**Manual Exploration (You as User):**
Spend 10 minutes per screen:
- Tap everything clickable
- Try edge gestures
- Rotate device
- Trigger error states (airplane mode, no permissions)
- Test with large font sizes (accessibility)
- Test with screen reader (VoiceOver/TalkBack)

### Phase 3: Real Device Testing (If Available)

**Physical Device Checks:**
- Audio quality on real microphone
- Performance on 3-year-old device
- Battery usage during recording
- Offline functionality
- App store build installation

### Phase 4: Visual & UX Polish

**Visual Review Checklist:**
- [ ] Consistent spacing (use 4px/8px grid)
- [ ] Colors match design system
- [ ] Typography hierarchy is clear
- [ ] Loading states are smooth
- [ ] Empty states are helpful
- [ ] Error messages are friendly
- [ ] Animations are subtle (150-300ms)
- [ ] No layout shifts on load

**Sexy App Criteria:**
- Transitions feel natural, not jarring
- Micro-interactions delight (button presses, toggles)
- Content loads progressively (skeletons &gt; spinners)
- No "jank" (dropped frames)
- Feels native to platform (iOS/Android differences respected)

---

## Self-Correction Loop

When you find issues:

1. **Categorize:**
   - Critical: Crash, data loss, security → Fix immediately
   - Major: Broken feature, poor UX → Fix before moving on
   - Minor: Visual polish, nice-to-have → Add to "Polish List"

2. **Fix Critical/Major:**
   - Implement fix
   - Re-test affected flow
   - Verify no regressions

3. **Document Minor:**
   - Add to AGENTS.md "Polish List"
   - Tackle when critical path clear

4. **Update Directive:**
   - If new error type found, add to testing protocol
   - If pattern emerges, create prevention rule

---

## No-Ask Decision Authority

You MAY make these decisions without asking:

| Decision Type | Examples |
|-------------|----------|
| **Visual polish** | Colors, spacing, font sizes, shadows |
| **Animation timing** | 200ms vs 300ms, easing curves |
| **Error messages** | Friendly copy, retry logic |
| **Performance optimization** | Memoization, lazy loading |
| **Small UX improvements** | Button placement, icon choice |
| **Refactoring** | Extract component, rename variable |
| **Test coverage** | Add tests for edge cases |

You MUST ask for:

| Decision Type | Examples |
|-------------|----------|
| **Scope changes** | Adding features not in PRD |
| **Architecture changes** | Abandoning Clean Architecture |
| **Tech stack changes** | New dependencies, replacing packages |
| **Breaking changes** | Schema migrations, API changes |
| **Monetization changes** | Pricing, paywall timing |
| **Major UX changes** | Navigation structure, core flows |

---

## Testing Schedule

**After EACH feature:**
- Run static analysis (5 min)
- Emulator smoke test (10 min)
- Fix critical issues immediately

**End of EACH day:**
- Full emulator test suite (30 min)
- Visual polish review (15 min)
- Update "Polish List" in AGENTS.md

**Before ANY commit:**
- TypeScript compiles
- No ESLint errors
- Feature manually tested

---

## Success Criteria

App is "smooth, beautiful, sexy" when:

**Smooth:**
- 60fps animations
- &lt; 100ms response to taps
- No loading states &gt; 2 seconds
- Graceful error recovery

**Beautiful:**
- Consistent design system
- Platform-appropriate aesthetics
- Professional polish (no rough edges)
- Accessibility compliant

**Sexy:**
- Delightful micro-interactions
- Feels premium (not MVP-hacky)
- Users say "wow" on first use
- Worthy of $4.99/month premium

---

## Reporting

Update AGENTS.md with:

```
## Testing Report - [Date]

### Features Tested
- [List]

### Issues Found
- Critical: [Count] - [List]
- Major: [Count] - [List]  
- Minor: [Count] - [List]

### Polish List (Minor fixes to tackle later)
- [Item 1]
- [Item 2]

### Confidence Level
- Day X complete: [High/Medium/Low]
- Ready for user testing: [Yes/No]
- Blockers: [None/List]
```

---

Be thorough. Be critical. Be autonomous. Make it sexy.
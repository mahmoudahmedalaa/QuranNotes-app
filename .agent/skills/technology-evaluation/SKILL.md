---
name: Technology Evaluation
description: Framework for evaluating new libraries and technologies before adding them to the project
---

# Technology Evaluation Skill

Before adding any new dependency, run through this evaluation framework.

## Evaluation Criteria

### 1. Does It Solve a Real Problem?
- [ ] What specific problem does this solve?
- [ ] Can we solve it with existing dependencies?
- [ ] Is the problem worth a new dependency?

### 2. Compatibility Check
- [ ] Works with React Native / Expo SDK?
- [ ] Requires native module (needs prebuild)?
- [ ] Works on both iOS and Android?
- [ ] Compatible with our Expo SDK version?
- [ ] Any known conflicts with our existing stack?

### 3. Quality Signals
| Signal | Minimum | Check |
|:-------|:--------|:------|
| GitHub Stars | 1,000+ | [ ] |
| Last commit | < 3 months ago | [ ] |
| Open issues ratio | < 30% | [ ] |
| Weekly downloads | > 10,000 | [ ] |
| TypeScript types | Built-in or @types/ | [ ] |
| React Native support | Explicit docs | [ ] |

### 4. Bundle Impact
- [ ] What's the package size?
- [ ] Does it have heavy transitive dependencies?
- [ ] Will it noticeably increase app startup time?

### 5. Migration Risk
- [ ] Can we wrap it behind an interface? (dependency inversion)
- [ ] What happens if it's abandoned?
- [ ] How hard is it to replace later?

## Decision Template

```markdown
## [Library Name] Evaluation

**Problem**: [What problem it solves]
**Alternative**: [What we'd do without it]
**Decision**: ✅ ADD / ❌ SKIP / 🔄 DEFER

**Rationale**: [Why this decision]
**Risk**: [What could go wrong]
**Mitigation**: [How we reduce risk]
```

## Recent Evaluations

| Library | Decision | Rationale |
|:--------|:---------|:----------|
| `react-native-track-player` | ✅ Added | Native background audio, lock screen controls, gapless playback — impossible with expo-av |
| `expo-av` | ✅ Kept (recording only) | Still needed for voice recording; RNTP doesn't do recording |
| `moti` | ✅ Kept | Best animation lib for React Native, small footprint |
| `react-native-paper` | ✅ Kept | Material Design components, theming, consistent UI |

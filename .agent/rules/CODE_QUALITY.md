# Code Quality Standards — QuranNotes

> Non-negotiable standards for all code in this project.

## Architecture

### Clean Architecture (Enforced)
```
domain/        → Entities, use cases, interfaces (zero framework deps)
data/          → Repository implementations, API clients, mappers
presentation/  → Screens, components, view models, hooks, theme
infrastructure/ → Auth, storage, config, third-party SDKs (Firebase, RevenueCat, Audio)
```

**Rule**: Dependencies point inward. `domain/` never imports from `data/`, `presentation/`, or `infrastructure/`.

### File Organization
- One component/class per file
- Group by feature within layer (e.g., `presentation/components/khatma/`, `presentation/components/audio/`)
- Barrel exports (`index.ts`) for public APIs only

---

## Naming Conventions

| Entity | Convention | Example |
|:-------|:-----------|:--------|
| Files (components) | PascalCase | `StickyAudioPlayer.tsx` |
| Files (utilities) | camelCase | `formatDate.ts` |
| Files (tests) | Match + suffix | `AppFlow.test.tsx` |
| Variables | camelCase | `currentVerse` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `Surah`, `Reciter`, `AudioContextType` |
| Components | PascalCase | `<GlobalMiniPlayer />` |
| DB columns | snake_case | `created_at` |
| Hooks | use prefix + camelCase | `useAudio`, `useQuran`, `useSettings` |

---

## TypeScript Rules

- **Strict mode**: Always enabled (`"strict": true`)
- **No `any`**: Use `unknown` + type narrowing instead
- **No implicit returns**: All functions declare return types
- **No magic numbers**: Use named constants
- **Import paths**: Use relative imports from `src/` — keep paths manageable (max 3 levels `../../../`)

---

## Testing Requirements

### What to Test
| Priority | Target | Coverage Target |
|:---------|:-------|:---------------|
| **Critical** | Auth logic, payment flows (RevenueCat) | 90%+ |
| **High** | Business logic, Quran data, Khatma calculations | 80%+ |
| **Medium** | UI components (happy path), AudioContext | 70%+ |
| **Low** | Pure UI, static screens, StickyAudioPlayer | Optional |

### Test Structure
```typescript
describe('ComponentName', () => {
  describe('when [condition]', () => {
    it('should [expected behavior]', () => {
      // Arrange → Act → Assert
    });
  });
});
```

### Mocking Rules
- Mock external services (Firebase, RevenueCat, expo-av, react-native-track-player)
- Never mock the thing you're testing
- Use `require` inside mock factories to avoid hoisting issues:
  ```javascript
  jest.mock('moti', () => {
    const { View } = require('react-native');
    return { MotiView: ({ children }) => <View>{children}</View> };
  });
  ```
- Import domain entities from source (`domain/entities/`), not through service layers

---

## Code Review Checklist

Before considering any feature "done":

- [ ] All TypeScript errors resolved (`tsc --noEmit`)
- [ ] Tests pass (`npm test -- --passWithNoTests`)
- [ ] No `console.log` (use `__DEV__` guard or remove)
- [ ] Error states handled (loading, empty, error)
- [ ] No hardcoded strings (use constants or i18n)
- [ ] No secrets in code (use env vars with `EXPO_PUBLIC_` prefix)

---

## Import Hygiene

### Common Pitfalls
1. **Broken relative paths**: Always verify imports after moving files
2. **Missing exports**: Run `tsc --noEmit` to catch
3. **Circular dependencies**: Domain layer must never import from data/presentation
4. **Stale mocks**: Test mocks must match current domain entity shapes

### Build Verification
Run before every commit:
```bash
npx tsc --noEmit                   # Catch type errors
npm test -- --passWithNoTests      # Catch logic errors
```

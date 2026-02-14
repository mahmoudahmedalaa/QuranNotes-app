# Security-First Principles — QuranNotes

> Security is not a feature — it's a constraint on every feature.

## Secrets Management

### Rules
- **Never** hardcode API keys, tokens, or passwords in source code
- **Never** commit `.env` files to git
- **Always** use environment variables — Expo convention: `EXPO_PUBLIC_` prefix for client-side keys
- **Always** create `.env.example` with placeholder values (not real secrets)

### Current Secrets
```bash
# Format: EXPO_PUBLIC_SERVICE_PURPOSE
EXPO_PUBLIC_FIREBASE_API_KEY="..."
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
EXPO_PUBLIC_FIREBASE_PROJECT_ID="..."
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
EXPO_PUBLIC_FIREBASE_APP_ID="..."
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID="..."
EXPO_PUBLIC_REVENUECAT_IOS_KEY="appl_..."
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY="goog_..."
```

### Verification
```bash
# Check for accidentally committed secrets
git log --all --diff-filter=A -- '*.env' '.env*'
grep -r "sk_live\|api_key\|password" src/ --include="*.ts" --include="*.tsx"
```

---

## Authentication Security (Firebase)

| Measure | QuranNotes Implementation |
|:--------|:-------------------------|
| Auth provider | Firebase Auth (Compat layer) |
| Social login | Google + Apple Sign-In |
| Session persistence | LOCAL (survives force-close) |
| Clean slate login | `signOut()` before new provider sign-in |

### Known Auth Pitfalls (from real experience)
1. **Firebase "Component not registered"** → Use Compat layer (`firebase/compat/app`), NOT modular SDK in React Native
2. **Cross-provider conflicts** → Always `signOut()` before new provider sign-in
3. **Session lost on force-close** → Set persistence to LOCAL explicitly
4. **Social login silent failures** → Log the full credential object for debugging
5. **Apple Sign-In enum crash** → Use numeric literals `requestedScopes: [0, 1]` (0=FULL_NAME, 1=EMAIL)
6. **Google Sign-In `idToken` not found** → API wraps result: `const { idToken } = (await GoogleSignin.signIn()).data;`

---

## Production Hardening

### Pre-Release Checklist
- [ ] **Debug screens removed** — No dev tools accessible to users
- [ ] **Test toggles stripped** — No `isPro` overrides, no onboarding resets
- [ ] **Console logs guarded** — `if (__DEV__)` or removed entirely
- [ ] **Environment sync** — Using production Firebase + RevenueCat keys
- [ ] **Error reporting** — Crash reporting enabled (future: Sentry/Crashlytics)

### Environment Parity
| Item | Development | Production |
|:-----|:------------|:-----------|
| Firebase keys | Production (same project) | Production |
| RevenueCat | Sandbox | Production |
| Log level | DEBUG | ERROR |
| Dev tools | Enabled | Removed |
| Analytics | Disabled | Enabled |

---

## Data Protection
- HTTPS only for all API calls (Firebase handles this)
- Never log passwords or tokens
- Implement "Delete Account" feature (App Store requirement) ✅
- Quran text data is public — no encryption needed
- User recordings stored locally — consider backup strategy

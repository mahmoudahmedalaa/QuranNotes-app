---
description: EAS-only development - no Expo Go fallbacks. Build and distribute via Xcode.
---

# EAS-Only Development Policy

This project uses **EAS development builds** exclusively. Do NOT create mock/fallback implementations for native modules.

## Rules

1. **No Mock Implementations**: Never create "demo mode" or mock fallbacks for native modules
2. **Use Native Directly**: Import and use native modules (expo-speech-recognition, @react-native-firebase/*, etc.) directly
3. **Trust EAS**: The EAS dev build includes all native modules - they WILL work
4. **No Expo Go**: Do not consider Expo Go compatibility

## Native Modules Available

- `expo-speech-recognition` - Voice recognition
- `@react-native-firebase/auth` - Firebase Authentication  
- `@react-native-firebase/firestore` - Cloud sync
- `expo-av` - Audio recording/playback
- `expo-haptics` - Haptic feedback
- `react-native-purchases` (RevenueCat) - In-app purchases

## Verification (TypeScript Only)

For code verification, **only** use the TypeScript compiler. Do NOT launch the simulator.

```bash
// turbo
npx tsc --noEmit
```

## Building & Distributing

**All builds and distribution go through Xcode directly.** Do NOT use `npx expo start`, `expo start --ios`, or any Expo dev server commands.

1. **Prebuild** (regenerate native project if needed):
   ```bash
   npx expo prebuild --clean
   ```

2. **Open in Xcode**:
   ```bash
   open ios/QuranNotes.xcworkspace
   ```

3. **Archive & Distribute**: Use Xcode's Product → Archive → Distribute App workflow
4. **TestFlight**: Upload via Xcode Organizer or Transporter

## 📋 App Store Connect Checklist (BEFORE Submitting for Review)

Before submitting any build for App Store Review, complete ALL of the following in App Store Connect:

### IAP / Subscriptions
> ⚠️ Subscriptions are NOT under "In-App Purchases" — go to **MONETIZATION → Subscriptions** in the left sidebar
- [ ] Create subscription group (e.g., "Pro Group") under MONETIZATION → Subscriptions
- [ ] Create individual subscriptions inside the group:
  - Product IDs must match RevenueCat exactly: `qurannotesapp_monthly`, `qurannotesapp_annual`
  - Each product needs: pricing, localization (display name + description), review screenshot, review notes
  - Status must be **"Ready to Submit"** (not "Missing Metadata")
- [ ] Create **Subscription Group Localization** (bottom of group page → Localization → Create)
  - Group Display Name: `QuranNotes Pro`, App Name: `QuranNotes app`
  - **Without this, products stay in "Missing Metadata" even if individually complete!**
- [ ] Attach subscriptions to app version (Version page → In-App Purchases and Subscriptions section → **+**)

### Legal Metadata
- [ ] Privacy Policy URL set (App Information → Privacy Policy URL)
  - URL: `https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/privacy.html`
- [ ] Terms of Use / EULA set (App Information → License Agreement)
  - URL: `https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/terms.html`
- [ ] App Description includes subscription disclosure at bottom:
  ```
  SUBSCRIPTION INFORMATION:
  • Pro Monthly: $4.99/month  •  Pro Annual: $35.99/year ($3.00/mo)
  • Payment charged to Apple ID account
  • Auto-renews unless cancelled 24 hours before period ends
  • Manage: Settings → Apple ID → Subscriptions
  
  Privacy Policy: https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/privacy.html
  Terms of Use: https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/terms.html
  ```

### Other
- [ ] Paid Applications Agreement signed (Agreements, Tax, and Banking)
- [ ] App Privacy section completed
- [ ] Review notes include: demo credentials, feature explanation, contact info

## ⚠️ What NOT To Do

- ❌ Do NOT run `npx expo start` or `npx expo start --ios`
- ❌ Do NOT try to open the iOS simulator via Expo CLI
- ❌ Do NOT use `expo start --dev-client` for testing
- ❌ Do NOT submit for review without creating IAP products in App Store Connect
- ❌ Do NOT submit without EULA/Terms of Use URL in App Store Connect metadata
- ✅ DO use `npx tsc --noEmit` for code verification
- ✅ DO use Xcode for building, testing, and distributing
- ✅ DO verify all IAP products show "Ready to Submit" before clicking Submit for Review

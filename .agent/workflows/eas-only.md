---
description: EAS-only development - no Expo Go fallbacks
---

# EAS-Only Development Policy

This project uses **EAS development builds** exclusively. Do NOT create mock/fallback implementations for native modules.

## Rules

1. **No Mock Implementations**: Never create "demo mode" or mock fallbacks for native modules
2. **Use Native Directly**: Import and use native modules (expo-speech-recognition, @react-native-firebase/*, etc.) directly
3. **Trust EAS**: The EAS dev build includes all native modules - they WILL work
4. **Test on Device**: Always test using the EAS development build via QR code or direct install
5. **No Expo Go**: Do not consider Expo Go compatibility

## Native Modules Available

- `expo-speech-recognition` - Voice recognition
- `@react-native-firebase/auth` - Firebase Authentication  
- `@react-native-firebase/firestore` - Cloud sync
- `expo-av` - Audio recording/playback
- `expo-haptics` - Haptic feedback
- `react-native-purchases` (RevenueCat) - In-app purchases

## Starting the App

```bash
// turbo
npx expo start --dev-client
```

Then scan QR code with the EAS dev build app (NOT Expo Go).

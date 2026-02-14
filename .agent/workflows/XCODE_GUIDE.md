---
description: Xcode build guide — debug, release, and TestFlight workflows for QuranNotes
---

# Xcode & iOS Build Guide — QuranNotes

> Build, test, and deploy locally. No cloud build services needed.

## Quick Reference

### Build for TestFlight / App Store
```bash
./build-ios.sh
```
This script handles: clean, patch path issues, archive, and export IPA.

### Install on Your iPhone (Debug Testing)
```bash
# Plug iPhone in via USB, then:
open ios/QuranNotes.xcworkspace
# In Xcode: Select your iPhone → Cmd+R
```

### Upload to TestFlight
```bash
# After ./build-ios.sh:
# Xcode → Window → Organizer → Select archive → Distribute App → Upload
```

---

## Build Types

| Type | Purpose | How | Who Gets It |
|:-----|:--------|:----|:------------|
| **Debug** | Development testing | `Cmd+R` in Xcode | Just you (USB) |
| **Release** | Production testing | `./build-ios.sh` | TestFlight testers |
| **App Store** | Public release | Upload from Organizer | Everyone |

---

## After Native Module Changes

When adding a native dependency (like `react-native-track-player`):

```bash
# 1. Regenerate native project
npx expo prebuild --clean

# 2. Verify the pod is installed
grep "new-module-name" ios/Podfile.lock

# 3. Open in Xcode and build
open ios/QuranNotes.xcworkspace
# Select device → Cmd+R
```

> [!IMPORTANT]
> If Xcode shows "workspace modified by another application" → click **"Use Version on Disk"**

---

## Version & Build Numbers

Before each release, update in `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",        // User-facing (semver)
    "ios": {
      "buildNumber": "12"       // Must increment per upload
    }
  }
}
```

Then regenerate: `npx expo prebuild --clean`

---

## Troubleshooting

| Issue | Fix |
|:------|:----|
| "No signing certificate found" | Xcode → Settings → Accounts → Download Profiles |
| "Build failed: No such file or directory" | Path has spaces — `build-ios.sh` patches this |
| "CocoaPods out of date" | `cd ios && pod install --repo-update && cd ..` |
| "Archive not in Organizer" | Set device to "Any iOS Device (arm64)" |
| "Build number already used" | Increment `buildNumber` in `app.json` + prebuild |
| After `prebuild --clean` | Run `./build-ios.sh` — re-patches everything |

---

## Important Notes

> [!IMPORTANT]
> **Never use EAS Build or paid cloud services.** Always use local Xcode builds via `./build-ios.sh`.

> [!WARNING]
> When `ios/` directory exists, changes to `app.json` (like `infoPlist`, `buildNumber`, `icon`) require `npx expo prebuild --clean` to take effect.

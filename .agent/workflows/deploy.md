---
description: Deploy to TestFlight - complete build and upload workflow
---

# Deploy to TestFlight

Complete workflow for building and uploading a new TestFlight build.

## Pre-flight Checks

1. Ensure all code changes are committed
2. Run TypeScript check:
// turbo
```bash
npx tsc --noEmit
```
3. Verify version in `app.json` is correct (build number auto-increments)

## Build

// turbo
4. Run expo prebuild to regenerate native project:
```bash
npx expo prebuild --clean
```

// turbo
5. Run the build script (auto-increments build number, ~10 min):
```bash
chmod +x build-ios.sh && ./build-ios.sh
```

6. Verify the IPA exists at `build/QuranNotes.ipa`

## Upload

7. Open Transporter app and drag `build/QuranNotes.ipa` into it
8. Click **Deliver** and wait for upload to complete
9. Check App Store Connect → TestFlight for the new build

## Post-deploy

10. Commit the build number increment:
```bash
git add app.json && git commit -m "chore: bump build number"
```

// turbo
11. Push to remote:
```bash
git push
```

## Version Management

- **Version** (`app.json > expo.version`): Bump manually for each release (e.g., 1.0.0 → 1.2.0)
- **Build number** (`app.json > expo.ios.buildNumber`): Auto-incremented by `build-ios.sh`
- **Team ID**: Auto-detected from `project.pbxproj`, falls back to `eas.json`

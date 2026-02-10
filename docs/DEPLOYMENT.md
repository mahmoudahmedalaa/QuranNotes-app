# Deployment Guide for QuranNotes

This guide outlines the steps to build and deploy the QuranNotes app using Expo Application Services (EAS).

## Prerequisites
1.  **Expo Account**: You need an account at [expo.dev](https://expo.dev).
2.  **EAS CLI**: Install globally: `npm install -g eas-cli`.
3.  **Login**: Run `eas login` in the terminal.

## 1. Configure Project
Run the following command to link the project to your Expo account:
```bash
eas build:configure
```
Select "All" when prompted for platforms. This will generate a `projectId` in your `app.json`.

## 2. Build for Production

### iOS
Requires an Apple Developer Account ($99/year).
```bash
eas build --platform ios --profile production
```
You will be prompted to log in to your Apple ID to generate certificates and provisioning profiles automatically.

### Android
```bash
eas build --platform android --profile production
```
This will generate an AAB (Android App Bundle) file for the Play Store. It will also manage your Keystore.

## 3. Submission

### Submit to App Store
```bash
eas submit --platform ios
```

### Submit to Play Store
```bash
eas submit --platform android
```
Note: For the first Android submission, you usually need to upload the AAB manually via the Google Play Console web interface. Subsequent updates can be automated.

## 4. Credentials
- **Apple**: Team ID, Apple ID.
- **Google**: Google Play Service Account JSON (if setting up automated submission).

## Troubleshooting
- **Build Fails**: Check the build logs URL provided by EAS.
- **Environment Variables**: Ensure all `EXPO_PUBLIC_` variables are set in EAS Secrets if used during build time (though `EXPO_PUBLIC_` are usually embedded). For secret keys (like service accounts), add them to EAS Secrets via `eas secret:create`.

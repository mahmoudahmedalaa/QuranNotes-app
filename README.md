# QuranNotes App

A comprehensive Quran reading and note-taking application built with React Native (Expo).

## Features
- **Read**: Uthmani script with English translation.
- **Listen**: Audio playback for every verse.
- **Reflect**: Attach notes and voice recordings to verses.
- **Sync**: Cloud synchronization via Firebase.
- **Personalize**: Dark mode, font size control, and bookmarks.

## Tech Stack
- **Frontend**: React Native, Expo, React Native Paper.
- **Navigation**: Expo Router.
- **Backend (BaaS)**: Firebase (Auth, Firestore).
- **Architecture**: Clean Architecture (Domain, Data, Presentation).

## Project Structure

```
QuranApp/
├── app/          ← Expo Router screens (file-based routing)
├── src/          ← App source code (Clean Architecture)
│   ├── domain/        ← Entities, repositories, use cases
│   ├── data/          ← Data sources (local, remote)
│   ├── infrastructure/← External services (Firebase, audio, payments)
│   ├── presentation/  ← Components, hooks, theme
│   └── application/   ← App-level services
├── assets/       ← App icons and splash screen
├── ios/          ← iOS native project
├── docs/         ← Documentation, skills, directives, screenshots
└── build/        ← IPA build output (gitignored)
```

## Quick Start

1.  **Install**: `npm install`
2.  **Run**: `npx expo start`

## Deployment
Refer to [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for build instructions.

## License
MIT

# Technical Design Document: QuranNotes MVP

## Executive Summary

- **System:** QuranNotes  
- **Version:** MVP 1.0  
- **Architecture Pattern:** Clean Architecture (Hexagonal / Ports & Adapters)  
- **Platform:** React Native + Expo (iOS & Android)  
- **Estimated Effort:** 12 days (Next Friday launch)  
- **Team:** Solo founder + AI assistance (Antigravity / Claude)

---

## Architecture Overview

### High-Level Architecture

We use **Clean Architecture** to isolate business logic from frameworks, ensuring scalability and testability.

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (React Native Components, Screens,     │
│   Hooks, Navigation)                    │
├─────────────────────────────────────────┤
│             Domain Layer                │
│  (Entities, Use Cases, Repository       │
│   Interfaces) – Pure TypeScript         │
├─────────────────────────────────────────┤
│              Data Layer                 │
│  (Repository Implementations: Local     │
│   Storage, Remote API, Firebase)        │
├─────────────────────────────────────────┤
│          Infrastructure Layer           │
│  (External Services: Quran API,         │
│   Audio Recorder, RevenueCat, Analytics)│
└─────────────────────────────────────────┘
```

### Why Clean Architecture?

| Benefit | How We Achieve It |
|------|------------------|
| **Testability** | Domain layer has zero external dependencies |
| **Scalability** | Swap data sources without touching UI |
| **Maintainability** | Clear separation of concerns |
| **Framework Independence** | Can eject from Expo later |

---

## Tech Stack Decision

### Frontend

| Category | Technology | Justification |
|------|-----------|---------------|
| Framework | React Native (Expo SDK 52) | Fastest iOS/Android delivery |
| Navigation | Expo Router v3 | File-based routing, deep linking |
| UI | React Native Paper v5 | Material 3, accessibility |
| State | React Context + Hooks | Sufficient for MVP |
| Forms | React Hook Form | Performance & validation |
| Validation | Zod | Type-safe schemas |
| Icons | @expo/vector-icons | Native support |

### Backend & Services

| Category | Technology | Justification |
|------|-----------|---------------|
| Authentication | Firebase Auth | Google, Apple, anonymous |
| Cloud DB | Firestore | Offline + realtime |
| Local DB | AsyncStorage | Simple caching |
| File Storage | expo-file-system | Local audio |
| Payments | RevenueCat | Free up to $10K MRR |
| Analytics | Firebase Analytics | Free |
| Error Tracking | Sentry | Real-time monitoring |

---

## Final Summary

- **Product:** QuranNotes  
- **Architecture:** Clean Architecture  
- **Platform:** Expo (iOS & Android)  
- **Launch Target:** Next Friday  
- **Cost:** $124 (Year 1)  

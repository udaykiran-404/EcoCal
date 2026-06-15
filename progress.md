# EcoPilot v1 Build Progress

## Current Status: 🎉 All Sprints Completed successfully!

| Sprint | Description | Status |
| :--- | :--- | :--- |
| **Sprint 1** | Foundation (DB Schema, Emission Factors Seed, Mock OTP, Utility function) | ✅ Completed |
| **Sprint 2** | Onboarding + Dashboard (6 Onboarding steps, Dashboard Layout) | ✅ Completed |
| **Sprint 3** | Daily Check-in + Calculation Engine (Deltas vs Overrides, Live Dashboard wiring) | ✅ Completed |
| **Sprint 4** | Shared Capture Flow + Food Config (AI mock vision, Food logger) | ✅ Completed |
| **Sprint 5** | Electricity + Receipt Captures (Monthly triggers, manual fallback, logging) | ✅ Completed |
| **Sprint 6** | Forecast, Impact Converter, Goals (Reductions, convertCo2 everywhere, 4 Goal types) | ✅ Completed |
| **Sprint 7** | Polish & Edge cases (Empty/Error states, Notifications, prompts) | ✅ Completed |

---

## Detailed Task Checklist

### Sprint 1: Foundation
- [x] Initialize backend project and structure
- [x] Configure database configuration (SQLite / pg fallback)
- [x] Write migrations and seeds for `emission_factors`
- [x] Implement Auth flow (Mock OTP request + verification)
- [x] Create `convertCo2()` backend and frontend utility

### Sprint 2: Onboarding + Dashboard
- [x] Create React Native Expo project structure
- [x] Build 6-step Onboarding UI flow (Housing, Diet, Commute, Appliances, LPG, Air Travel)
- [x] Implement onboarding baseline calculation backend endpoint
- [x] Design main Dashboard Layout UI (Grade, Hero stat, charts, Today card, Forecast strip)

### Sprint 3: Daily Check-in + Calculation Engine
- [x] Build Daily Check-in modal in the mobile app
- [x] Implement Daily Check-in backend routing & data tables
- [x] Build the Carbon Calculation engine resolving daily deltas and capture overrides
- [x] Wire Dashboard UI to fetch dynamic backend data

### Sprint 4: Shared Capture Flow + Food
- [x] Create the generic configurable Capture Flow UI component (Camera viewfinder, loader, edit form, toast)
- [x] Wire the `food` configuration and calculation logic
- [x] Implement override-vs-delta validation on the backend (Captures override Daily Check-in)

### Sprint 5: Electricity + Receipt
- [x] Build Electricity capture configuration and calculations (national grid factor, monthly prompts)
- [x] Build Receipt capture configuration with manual-first framing and instant fallback
- [x] Record and log manual fallback rates on the backend

### Sprint 6: Forecast, Impact Converter, Goals
- [x] Implement Forecast projections (Current trajectory vs goal suggestions)
- [x] Standardize and audit all screen displays to use `convertCo2()` equivalents
- [x] Create Goals tab screen with progress counters for the 4 fixed goal types

### Sprint 7: Polish & Edge cases
- [x] Handle empty states for new profiles
- [x] Handle offline and API extraction error displays
- [x] Implement notification scheduling triggers locally

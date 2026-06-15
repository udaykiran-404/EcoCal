# EcoPilot — Frictionless Carbon Tracker for India 🌿

EcoPilot (EcoCal) is a smart, dynamic carbon tracking application custom-designed for urban and semi-urban Indian smartphone users (ages 18–40). By translating abstract carbon metrics into concrete equivalents (trees, petrol litres, and money saved), it makes sustainability interactive, positive, and friction-free.

---

## 🚀 Chosen Vertical & Persona
- **Target Audience**: Indian mobile users who care about sustainability but will not tolerate complex homework, guilt-tripping interfaces, or carbon jargon.
- **Product Promise**: Zero-friction carbon tracking. EcoPilot guesses emissions from baseline onboarding answers and daily check-ins, allowing users to verify via vision captures (meals, power bills, retail receipts) without active manual calculations.

---

## 🛠️ Architecture & Tech Stack

```
   ┌────────────────────────────────────────┐
   │         React Native Expo App          │ (Expo Web support enabled)
   └───────────────────┬────────────────────┘
                       │ HTTP REST
   ┌───────────────────▼────────────────────┐
   │         Express Node.js Server         │
   └───────────────────┬────────────────────┘
                       │ Knex DB Wrapper
   ┌───────────────────▼────────────────────┐
   │      SQLite / PostgreSQL Database      │
   └────────────────────────────────────────┘
```

1. **Frontend (`/frontend`)**: Built with React Native (Expo SDK 56) with Expo Router file-based navigation and full Web-bundler compatibility so it runs visually in browsers.
2. **Backend (`/backend`)**: Node.js Express REST API using Knex query builder.
3. **Database**: Configured to run on **SQLite** locally for zero-configuration, instant startup, while remaining fully compatible with **PostgreSQL** in production by setting the `DATABASE_URL` environment variable.

---

## 📊 Core Calculation Logic & Approach

### 1. Zero-Friction Smart Onboarding
EcoPilot creates a starting footprint baseline in under 3 minutes through a 6-step survey wizard:
- **Housing & Appliances**: Proportional electricity baseline constructed from housing type, family size, AC ownership, and heavy appliance checkboxes.
- **Diet**: Baseline meal footprint derived from diet type (Vegan, Vegetarian, Eggetarian, Non-Vegetarian) and weekly non-veg frequencies.
- **Commute**: Travel baseline based on primary mode (Walk, Two-wheeler, Car, Transit, Mixed) and daily round-trip distance.
- **LPG**: Cylinders consumed per month (defaults to family size approximation if user is unsure).
- **Air Travel**: Domestic and international annual flights.

### 2. Daily Check-ins vs. Vision Captures (Override Logic)
- **Check-in Deltas**: Daily check-ins apply coarse multipliers (e.g. +50% travel emissions if user commuted more today) to estimate daily baseline adjustments.
- **Vision Capture Overrides**: Precise camera uploads (Food items, Electricity bills, Shopping receipts) act as **overrides** rather than stacking. When a capture exists for a category on a given day, it replaces the check-in's delta estimate for that category.
- **Reminder Prompts**: The backend monitors the user's upload timeline and dynamically generates dashboard reminders (monthly bill scans, monthly LPG updates, quarterly air travel counts).

### 3. Translation equivalents (convertCo2 Utility)
To make metrics relatable, EcoPilot converts raw kg CO₂ emissions using verified conversion keys:
- **Trees equivalent**: `CO2 kg / 21` (absorptive capacity of 1 mature tree per year).
- **Fuel equivalent**: `CO2 kg / 2.3` (emissions of burning 1 Litre of petrol).
- **Cost savings**: Blends tariff reductions (`1 kWh ≈ ₹8`) and fuel cost replacements (`1 L petrol ≈ ₹100`).

---

## 📋 Assumptions Made
1. **Grid Emission Factor**: Utilizes a single national grid average of `0.71 kg CO₂/kWh` for India (based on CEA baseline data).
2. **LPG Combustion**: Assumes standard domestic cylinders (14.2 kg LPG) emit `42.5 kg CO₂` per cylinder.
3. **Flight Constants**: Emits a flat `250 kg CO₂` per domestic flight and `1100 kg CO₂` per international flight.
4. **Vehicular Averages**: Commutes assume `0.14 kg CO₂/km` for cars, `0.04 kg CO₂/km` for two-wheelers, and `0.025 kg CO₂/km` for public transit.
5. **Vision AI Mocking**: Incorporates a mock LLM vision service returning pre-coded draft objects with a simulated 1.5s network delay to facilitate testing without requiring live Claude/Gemini API keys.

---

## 🏃 Setup & Local Execution

### Prerequisites
- **Node.js** (v18+)
- **npm** (v10+)

### 1. Run Backend Server
```bash
cd backend
npm install
npm run dev
```
*The server will start on port `3000` and automatically run database migrations and seeds on startup.*

### 2. Run Frontend Web App
```bash
cd frontend
npm install
npm run web
```
*The Metro Bundler will launch the application in your browser on `http://localhost:8081`.*

### 🧪 Demo Credentials
- **Mobile Number**: `9876543210`
- **Verification OTP**: `123456`

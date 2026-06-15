# EcoPilot (EcoCal) — Product Documentation

Welcome to **EcoPilot**! This document details the product purpose, target persona, core features, and user experience paradigms.

---

## 🎯 Purpose & Design Philosophy
**EcoPilot** is a zero-friction, positive-reinforcement carbon tracking application tailor-made for Indian urban and semi-urban smartphone users (ages 18–40). 

### UX Core Principles
1. **Zero Friction First**: Daily actions should take under 15 seconds to log.
2. **AI Guesses, Human Confirms**: Image inputs use visual intelligence for draft extraction, but always allow the user to review and correct before committing.
3. **Positive Framing**: No guilt-tripping or red warning states. Everything is presented as an opportunity to improve.
4. **Relatable Equivalents**: Emphasizes everyday metrics (trees, fuel litres, rupee savings) over raw carbon coefficients (`kg CO₂`).
5. **Override over Stacking**: Vision records (precise logs) override coarse estimation profiles for the same day and category to prevent double-counting.

---

## 🚀 Key Features Explained

### 1. Smart Onboarding Survey
- **Purpose**: Establishes a starting baseline carbon footprint in under 3 minutes.
- **Details**: Captures basic inputs across housing types, diet types, commute modes, appliance checklists, LPG cylinders, and annual flight counts. Users can skip steps to fall back on sensible Indian national averages.
- **Output**: Celebrates the user's start with a translation e.g. *"Your starting baseline: ~420 kg CO₂/month — equivalent to planting 20 trees per year."*

### 2. Frictionless Daily Check-ins
- **Purpose**: Logs daily changes (deltas) from the onboarding baseline in seconds.
- **Details**: Asks 4 simple yes/no questions (Travelled more today? Ate meat? Purchased something? Run AC longer?).
- **Typical Day Shortcut**: A single prominent button lets users mark all answers as "No" at once, maintaining consistent daily habits with one tap.

### 3. Configurable Vision Capture Flow
- **Purpose**: A shared, multi-step image analysis pipeline that reads real-world assets:
  - **🥗 Food Capture**: Scans a meal photo to classify it (Vegan, Veg, Egg, Meat) and extracts main food items.
  - **⚡ Electricity Bill Capture**: Extracts units consumed (kWh) and billing duration to override household power baselines.
  - **🛒 Receipt Capture**: Parses retail receipts (even handwritten or faded) to extract purchased items and categorize expenditures.
- **Features**: Live simulated vision analysis, confirmation screens with editable forms, and an immediate **"Enter Manually"** shortcut that avoids camera constraints.

### 4. Hybrid Carbon Calculation Engine
- **Coarse + Precise Integration**: The calculation service merges daily log records. If a user did a check-in delta AND uploaded a receipt, the precise receipt values **override** and replace the check-in's delta category for that day.
- **Indian Emission Factors**: Employs coefficients tuned for India (e.g. standard LPG cylinders, DISCOM average electricity grid factor of `0.71 kg CO₂/kWh`, and localized transit emissions).

### 5. Carbon Forecast & Actionable Insights
- **Trajectory Projection**: Multiplies current monthly emissions by the remaining days in the month.
- **Goal Reductions**: Recommends personalized swaps (e.g. walking instead of driving) and dynamically charts the emission difference under the "suggested habits" projection.

### 6. Relatable Carbon-to-Impact Converter
- **Structural Utility**: Enforces the translation of carbon scores across the entire UI:
  - **Trees**: Relates savings to the annual absorptive capacity of mature trees (`1 tree ≈ 21 kg CO₂`).
  - **Fuel**: Relates transport usage to petrol litres burned (`1 L ≈ 2.3 kg CO₂`).
  - **Rupees Saved**: Estimates financial savings (e.g. ₹8 per kWh of electricity or ₹100 per L of fuel).

### 7. Core Eco-Challenges (Goals)
- **Included Challenges**:
  - *10% Carbon Diet*: Reduce total monthly carbon output by 10% vs. baseline.
  - *No Meat Mondays*: Commit to vegetarian/vegan meals every Monday.
  - *Walk or Cycle 5km*: Commute actively to offset car/motorcycle usage.
  - *Zero Single-Use Plastic*: Track plastic avoidance habits.
- **Tracking**: Real-time progress indicators (e.g. "4/7 days done") displayed in a dedicated Goals interface.

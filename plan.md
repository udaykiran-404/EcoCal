EcoPilot v1 — Build Plan
========================

## Strict Submission & Evaluation Guidelines
- **Attempts**: Maximum 3 attempts allowed.
- **Repository Size**: Must be less than 10 MB (optimize dependencies and assets, ignore unnecessary modules in git).
- **Public Repo & Single Branch**: Must be a public GitHub repository with a single branch.
- **High Focus Areas**: Code Quality (structure, readability, reusability, maintainability), Security (safe data handling), Efficiency, Testing, and Accessibility.
- **Documentation**: A detailed README explaining vertical selection, logic, how it works, and assumptions.

A structured specification for building EcoPilot v1, written for direct use by coding agents.
Each section is self-contained enough to hand to an agent as a build task.
1. Product context (read this first, always)
Who we're building for: Urban and semi-urban Indian smartphone users, roughly 18–40,
on Android-first devices, often on patchy mobile data. They're curious about sustainability
but not activists — they will not tolerate friction, guilt, or jargon. Many have never used a
"carbon tracker" before and will abandon anything that feels like homework.
The product promise: EcoPilot tells you your carbon footprint without making you work
for it, and tells you exactly what to change in terms you understand (money, trees, fuel) —
never in raw kg CO₂ alone.
Five UX principles every screen must satisfy:
1. Zero friction first — every screen should be completable in under 15 seconds unless
it's onboarding (one-time cost is acceptable).
2. AI guesses, human confirms — never silently trust an AI extraction. Always show an
editable confirm screen before saving anything that affects the carbon score.
3. Positive framing, never guilt — no red "you failed" states. Frame everything as
"here's an opportunity," never "you did this wrong."
4. Numbers need a translation — never show raw kg CO₂ alone. Always pair it with a
relatable equivalent (trees, 
₹
, km, cylinders).
5. Progressive disclosure — onboarding asks only what's needed for a rough baseline.
Deeper detail is requested later, contextually, when it improves accuracy.
2. Tech stack
Layer
Choice
Notes
Mobile app
React Native (Expo)
Single codebase, Android-first, camera/image
picker built in
Backend
Node.js + Express (or Fastify)
REST API, simple to extend
Database
PostgreSQL
Relational data fits well (users, logs, factors)
AI / vision
Claude API (vision-capable
model)
Food photos, bill photos, receipt photos —
single provider, single prompt pattern
Layer
Choice
Notes
Auth
Phone number + OTP
Indian users default to phone-first auth, not
email
Image storage
S3-compatible bucket (e.g.
Cloudflare R2 or AWS S3)
Store captured images for audit/re-processing
Push
notifications
Firebase Cloud Messaging
For daily check-in reminders
3. Information architecture — screen map
Onboarding (one-time, 6 steps)
→ Home / Dashboard (default landing screen)
→ Daily Check-in (modal/sheet, triggered once per day)
→ Capture flow (shared): Food | Electricity bill | Receipt
→ Trends / History
→ Goals
→ Profile & Settings
Navigation: Bottom tab bar with 4 tabs: Home, Log (camera capture entry point), Trends,
Goals. Profile accessible via avatar icon top-right of Home.
4. Shared component: Capture Flow
This is the single most important component in v1 — it is reused for Food, Electricity Bill,
and Receipt capture. Build it ONCE as a generic, configurable flow.
Flow (4 screens, all three capture types)
1. Capture screen — camera viewfinder + "upload from gallery" fallback. Single primary
button: "Capture".
2. Processing screen — brief loading state (max 3–5 sec expectation) while image is sent
to AI for extraction. Show a friendly, non-technical loading message (e.g. "Reading
your meal...", "Reading your bill...").
3. Confirm/edit screen — THE critical screen. Shows AI-extracted structured data in
editable fields. User can tap any field to correct it. Always includes a "None of this
looks right — enter manually" link that drops to a blank manual-entry form of the
same shape.
4. Saved confirmation — toast/banner: "Logged. +X.X kg CO₂ today" with a one-line
plain-English equivalent (e.g. "≈ a 4 km car ride").
Config object per capture type
json
{
}

"food": {
"ai_prompt_template": "food_extraction_v1",
"fields": ["meal_category", "main_items", "portion_size", "estimated_co2_kg
"manual_fallback_fields": ["meal_category", "portion_size"]
},
"electricity_bill": {
"ai_prompt_template": "electricity_extraction_v1",
"fields": ["billing_period_days", "units_consumed_kwh", "estimated_co2_kg"]
"manual_fallback_fields": ["units_consumed_kwh"]
},
"receipt": {
"ai_prompt_template": "receipt_extraction_v1",
"fields": ["items[]", "total_amount", "category_breakdown", "estimated_co2_
"manual_fallback_fields": ["category", "amount_spent"]
}
AI prompt templates (use with Claude vision API)
food_extraction_v1

You are analyzing a photo of a meal for a carbon-tracking app used by Indian
users.
Identify: 1) meal category (vegetarian / non-vegetarian / vegan / egg-based),
2) the main food items visible (list, max 5),
3) an approximate portion size (small / medium / large) relative to a typical
Indian meal.
Respond ONLY in JSON: {"meal_category": "...", "main_items": ["..."],
"portion_size": "..."}
Do not guess emissions — that is calculated separately.
electricity_extraction_v1
You are reading an Indian electricity bill (DISCOM format) from a photo.
Extract: 1) billing period in days, 2) total units consumed in kWh.
If the bill shows a units range or multiple meters, sum them.
Respond ONLY in JSON: {"billing_period_days": N, "units_consumed_kwh": N}
If a field is unreadable, return null for it rather than guessing.
receipt_extraction_v1
You are reading a retail receipt from India, which may be handwritten, faded,
or
from a small kirana store. Extract a best-effort list of purchased items and
the
total amount. For each item, classify into one category:
["groceries_veg", "groceries_packaged", "clothing", "electronics",
"household", "other"]
Respond ONLY in JSON: {"items": [{"name": "...", "category": "...", "amount":
N}], "total_amount": N}
If the receipt is unreadable, return {"items": [], "total_amount": null,
"unreadable": true}.
Edge case rules (apply to all three)
If AI returns 
unreadable: true
 or any required field is 
null 
, skip straight to the
manual-entry form (don't show an empty confirm screen).
Always log the raw AI response + image reference for later debugging/recalibration —
store in a 
capture_logs
 table, not shown to user.
Receipt capture is expected to have the highest manual-fallback rate. Track this rate
from day one (see Section 9, metrics).
5. Feature specs
5.1 Smart Onboarding
Goal: Produce an initial baseline carbon estimate in under 3 minutes, with every step
skippable to a sensible default.
Steps (one screen per step, progress dots at top):
1. Housing — type (apartment / independent house), household size, AC ownership
(yes/no, count)
2. Diet — vegetarian / non-vegetarian / vegan / eggetarian, frequency of non-veg meals
per week (if applicable)
3. Commute — primary mode (walk / two-wheeler / car / public transport / mixed),
approx daily distance
4. Appliances — checklist: AC, fridge, washing machine, water heater (geyser),
microwave
5. LPG — cylinders used per month (default: 1, with a "not sure" → defaults to household
size-based estimate)
6. Air travel — domestic flights last 12 months (number), international flights last 12
months (number)
baseline_profile
 record + an initial 
monthly_co2_kg
 estimate, shown on a
Output:
celebratory final screen: "Your starting footprint: ~X kg CO₂/month — that's about [N] trees
worth per year. Let's see how we can bring it down."
Data model — 
baseline_profile 
:
sql
CREATE TABLE baseline_profile (
user_id UUID PRIMARY KEY REFERENCES users(id),
housing_type TEXT, household_size INT, ac_count INT,
diet_type TEXT, nonveg_meals_per_week INT,
commute_mode TEXT, commute_distance_km NUMERIC,
appliances JSONB,-- {"ac": true, "fridge": true, ...}
lpg_cylinders_per_month NUMERIC,
domestic_flights_per_year INT, international_flights_per_year INT,
baseline_co2_kg_monthly NUMERIC,
created_at TIMESTAMPTZ DEFAULT now()
);
5.2 Carbon Dashboard (Home)
Goal: One-glance answer to "how am I doing?"
Layout (top to bottom):
Header: greeting + current carbon score (e.g. "B+") with one-line context ("Better than
60% of similar households")
Hero stat: this month's total CO₂ so far, with a small sparkline trend vs. last month
Category breakdown: horizontal bar chart — Transport, Food, Electricity, Shopping,
LPG/Gas, Flights
"Today" card: quick-access buttons to Daily Check-in (if not done) and Log (camera
capture)
Forecast strip (see 5.8): "On track for ~X kg this month"
Data needed: aggregate of 
daily_logs
 + 
compared to 
baseline_profile 
.
captures
 for current month, grouped by category,
5.3 Daily Smart Check-in
Goal: Sub-15-second daily input that captures deltas from baseline.
Trigger: Once per day, via push notification (user-configurable time) or banner on Home if
not yet completed.
Questions (single screen, tap to answer, all default to "Typical day" if skipped):
1. 🚗 Travelled more than usual today? — Yes / No
2. 🍗 Ate more meat than usual? — Yes / No
3. 
�
�
 Bought something today? — Yes / No → if Yes, deep-link to Receipt capture
4. ⚡ Higher electricity usage than usual? (e.g. AC ran longer) — Yes / No
5. 😊 Just a typical day — single tap to answer all "No" at once (shown as a prominent
shortcut button above the 4 questions)
Logic: Each "Yes" answer applies a small modifier (% adjustment) to that category's daily
baseline estimate, stored as a 
daily_log
 entry. This is intentionally coarse — it's a delta
signal, not a precise measurement. Precise measurement comes from camera captures.
Data model — 
daily_logs 
:
sql
CREATE TABLE daily_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id),
log_date DATE,
travelled_more BOOLEAN, ate_more_meat BOOLEAN,
bought_something BOOLEAN, higher_electricity BOOLEAN,
is_typical_day BOOLEAN,
computed_delta_co2_kg NUMERIC,
created_at TIMESTAMPTZ DEFAULT now(),
UNIQUE(user_id, log_date)
);
Relationship to camera captures (important — resolves the overlap raised earlier): Daily
check-in answers are coarse multipliers applied to baseline category estimates. Camera
captures (food/electricity/receipt) are precise overrides — when a capture exists for a
category on a given day, it replaces the check-in's delta estimate for that category for that
day, rather than stacking with it. The carbon calculation service must check for an existing
capture before applying a check-in delta.
5.4 Food Camera Capture
Uses the shared Capture Flow (Section 4) with 
food
 config.
Carbon calculation:
meal_category
 + 
portion_size
 → lookup in 
(e.g. 
emission_factors
 table
food_vegetarian_medium = 0.9 kg CO2 
). This is a simple lookup, not computed from
main_items
 in v1 — 
main_items
 is stored for future personalization but not used in the v1
calculation, keeping the math predictable and auditable.
Data model — 
captures 
:
sql
CREATE TABLE captures (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id),
capture_type TEXT,-- 'food' | 'electricity_bill' | 'receipt'
image_url TEXT,
ai_raw_response JSONB,
confirmed_data JSONB,-- the user-edited final values
was_manual_fallback BOOLEAN DEFAULT false,
estimated_co2_kg NUMERIC,
captured_at TIMESTAMPTZ DEFAULT now()
);
5.5 Electricity Bill Capture
Uses the shared Capture Flow with 
electricity_bill
 config.
Carbon calculation:
units_consumed_kwh
 ÷ 
billing_period_days
 × 30 (normalize to
monthly) × grid emission factor (kg CO₂ per kWh — use a single national average constant
for v1, e.g. 0.71 kg CO₂/kWh for India; per-state grid factors are a v2 enhancement under
"Local Context Engine").
Frequency: Bills arrive monthly — prompt the user once per billing cycle (set reminder
based on their first upload date + 30 days), not daily.
5.6 Receipt Capture (with manual-first framing for trust)
Uses the shared Capture Flow with 
receipt
 config. Given the expected high manual
fallback rate:
The capture screen for receipts should include a visible secondary button "Skip photo,
enter manually" alongside "Capture" — don't force the camera path.
On the confirm/edit screen, if 
items
 list is empty or 
unreadable: true 
, transition
immediately (no extra tap) to a manual form: category dropdown + amount spent.
This must feel like the expected path, not an error state.
Carbon calculation:
category
 + 
amount_spent
 → lookup multiplier in 
(e.g. 
emission_factors
electronics = 0.4 kg CO2 per ₹100 spent 
). Sum across items for total.
5.7 Air Travel & LPG quick-entry
LPG: Collected at onboarding (cylinders/month). In v1, re-prompt every 30 days via a
lightweight non-blocking card on Home: "Still using ~1 cylinder/month? [Yes] [Update]".
Air travel: Collected at onboarding (flights/year). Re-prompt quarterly via the same
lightweight card pattern: "Any flights in the last 3 months? [No] [Add a flight]" → if "Add a
flight", single screen: domestic/international toggle + count.
Carbon calculation: Flat per-flight constants — e.g. domestic ≈ 250 kg CO₂, international ≈
1100 kg CO₂ (placeholder values; refine in emission factor database). LPG: cylinders/month
× 42.5 kg CO₂ per 14.2kg cylinder (standard Indian domestic cylinder).
5.8 Carbon Forecast
Goal: "At current habits you'll emit X kg this month. Following recommendations could
bring it to Y kg."
Calculation:
X
 = (sum of confirmed 
daily_logs
 + 
captures
 so far this month) ÷ (days elapsed) ×
(days in month)
Y
 = 
X
 × a reduction factor derived from the user's top 1–2 highest categories (e.g. if
Transport is the largest category and user mostly drives, suggest the public-transport
swap reduction %, defined per category in 
emission_factors 
)
Display: On Dashboard as a single sentence + small two-bar comparison chart (current
trajectory vs. "with one change").
5.9 Carbon-to-Impact Converter
Goal: Translate any kg CO₂ figure into relatable units, used throughout the app (dashboard,
capture confirmations, forecast).
Conversion constants (store in 
emission_factors 
, not hardcoded):
1 tree absorbs ≈ 21 kg CO₂/year → 
trees_equivalent = co2_kg / 21
Money saved: category-specific (e.g. reducing 1 kWh ≈ 
₹
8 saved)
Fuel equivalent: 1 litre petrol ≈ 2.3 kg CO₂ → 
fuel_litres_equivalent = co2_kg / 2.3
Implementation: A single shared utility function 
convertCo2(kg, type)
 used everywhere
a CO₂ number is displayed — enforces the "never show raw kg alone" principle structurally.
5.10 Basic Goals
Goal types (v1, fixed set — no custom goals yet):
1. "Reduce footprint by 10% this month" — auto-tracked against forecast baseline
2. "No Meat Monday" — checks 
daily_logs.ate_more_meat = false
 on Mondays
3. "Walk/cycle 5km this week" — manual self-report (single tap "I did this" on relevant
days)
4. "Plastic-Free Week" — manual daily self-report toggle
Data model — 
goals
 and 
goal_progress 
:
sql
CREATE TABLE goals (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID REFERENCES users(id),
goal_type TEXT, started_at DATE, ends_at DATE,
status TEXT DEFAULT 'active'-- 'active' | 'completed' | 'failed'
);
CREATE TABLE goal_progress (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
goal_id UUID REFERENCES goals(id),
log_date DATE, completed BOOLEAN
);
UX: Goals tab shows active goals as progress cards (e.g. "4/7 days — keep going").
Completion triggers a positive, non-pushy toast — no aggressive gamification yet
(badges/streaks are v1.1).
6. Emission factor database
A single 
emission_factors
 table that every calculation references — this is the foundation.
Build and seed this BEFORE wiring up calculations.
sql

CREATE TABLE emission_factors (
key TEXT PRIMARY KEY,-- e.g. 'food_vegetarian_medium', 'electricity_grid_avg
value NUMERIC,
unit TEXT,-- 'kg_co2_per_meal', 'kg_co2_per_kwh', etc.
source TEXT,-- citation/reference for the number
last_updated DATE
);
v1 seed list (placeholder values — flag for review before launch):
food_vegetarian_small/medium/large 
, 
food_nonveg_small/medium/large 
,
food_vegan_*
electricity_grid_avg_india
 (kg CO₂/kWh)

lpg_per_cylinder
 (kg CO₂)
flight_domestic 
, 
flight_international
 (kg CO₂/flight)
transport_car_per_km 
, 
transport_two_wheeler_per_km 
, 
transport_public_per_km
shopping_<category>_per_100inr
 for each receipt category
co2_per_tree_year 
, 
co2_per_litre_petrol
Note: these values must be sourced/verified (e.g. against India GHG Program, CEA grid
factor reports) before public launch — flag this as a pre-launch checklist item, not a coding
task.
7. Core API endpoints
POST   /auth/otp/request
POST   /auth/otp/verify
POST   /onboarding              
estimate
GET    
/dashboard                
POST   /checkin                  
GET    
/checkin/today            
POST   /captures                 
PATCH  /captures/:id/confirm      
calc
GET    
/goals
POST   /goals                    
GET    -> creates baseline_profile, returns initial-> aggregated current month data-> creates daily_log entry-> has today's check-in been done?-> upload image, returns AI-extracted draft-> save confirmed/edited data, triggers CO2-> start a goal
POST   /goals/:id/progress       
/forecast                 
projection-> log daily progress-> current month forecast + "with changes"
8. Build sequence (sprints for coding agent)
Sprint 1 — Foundation
DB schema (all tables in Sections 5–6)
Seed 
emission_factors
 with placeholder values
Auth (phone OTP)
Shared 
convertCo2()
 utility
Sprint 2 — Onboarding + Dashboard
Onboarding flow (6 steps) → 
baseline_profile
 + initial estimate
Dashboard screen with category breakdown (static/baseline data only at this point)
Sprint 3 — Daily Check-in + calculation engine
Daily check-in flow + 
daily_logs
Carbon calculation service: baseline + check-in deltas → daily/monthly totals
Wire Dashboard to live data
Sprint 4 — Shared Capture Flow + Food
Build the generic 4-screen Capture Flow component
Implement 
food
 config end-to-end (capture → AI → confirm → save → calc)
Implement the override-vs-delta logic (Section 5.3) between captures and check-ins
Sprint 5 — Electricity + Receipt captures
Implement 
electricity_bill
 config (monthly reminder logic)
Implement 
receipt
 config with manual-first framing
Track and log manual-fallback rate per capture type
Sprint 6 — Forecast, Impact Converter, Goals
Forecast calculation + Dashboard forecast strip
Apply 
convertCo2()
 across all CO₂ displays (audit every screen)
Goals tab with the 4 fixed goal types
Sprint 7 — Polish & edge cases
Empty states (new user, no data yet)
Error states (AI extraction failure, no network)
Onboarding skip-to-default paths
Notification scheduling (daily check-in reminder, LPG/flight quarterly prompts)
9. Metrics to instrument from day one
Daily check-in completion rate
Capture usage rate by type (food / electricity / receipt)
Manual-fallback rate per capture type (receipt expected highest — track to validate)
Time-to-complete onboarding
Day 1 / Day 7 / Day 30 retention
10. Explicit non-goals for v1 (do not build)
Open-ended AI chatbot (templated Q&A only — v1.1)
Gamification (streaks/badges — v1.1)
Green alternatives suggestions, Carbon Wallet, Brand Scorecard, Community
Challenges, Local Context Engine (all v2)
Per-state electricity grid factors (single national average for v1)
Custom user-defined goals (fixed set of 4 only)
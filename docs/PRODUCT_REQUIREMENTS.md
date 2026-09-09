# Healthi Product Requirements Document

Version: 1.0  
Product type: Native mobile app  
Platforms: iOS and Android  
Working codename: Healthi  
Production brand: TBD

## 1. Product thesis

Healthi is a holistic adaptive coaching system that integrates sleep, circadian rhythm, recovery, allostatic load, food quality, personal food response, digestion, hydration, posture, mobility, flexibility, training performance, stress, motivation, and user goals into one daily plan.

Healthi is not a workout app, not a calorie app, not a sleep app, and not a barcode scanner. It is the interpretation layer above all of those systems.

### Core promise

Wake up knowing what your body needs today: restore, nourish, correct, move, or perform, and know exactly why.

### Product category

Adaptive holistic health operating system.

### Main user question

Given my whole system today, what should I do, eat, buy, avoid, and adjust?

## 2. Product positioning

### One-sentence positioning

Healthi is a premium adaptive wellness coach that connects sleep, food, movement, recovery, posture, stress, and personal response into one daily plan.

### User-facing promise

Stop forcing your body through generic plans. Learn what it needs today.

### Internal product mantra

The user's goal gives direction. The body's current state gives permission.

### Differentiation

| Existing app type | What it does | What Healthi adds |
|---|---|---|
| Recovery wearables | Recovery, HRV, sleep, strain | Connects recovery to food, posture, workout selection, shopping, and daily protocol |
| Sleep/circadian apps | Sleep debt and energy rhythm | Uses sleep/circadian state to adapt training, food, caffeine, sunlight, and wind-down |
| Food scanners | General product quality | Combines ingredient quality with personal response and current readiness |
| Food trackers | Food and macro logging | Tracks how food affects energy, digestion, mood, cravings, clarity, sleep, and training |
| Workout apps | Static programming | Adjusts exercise choice, load, reps, and intensity based on recovery and movement permission |
| Personal trainers | Human coaching, often template-driven | Systematic daily assessment of posture, mobility, allostatic load, food response, and readiness |

## 3. Source and IP boundary

Healthi is inspired by holistic practitioner-style reasoning and whole-person assessment. It must not copy proprietary questionnaires, diagrams, exercise instructions, course language, trademarks, or branded methodology from any source unless licensed.

Rules:

- Do not market Healthi as a specific branded practitioner system unless there is a license or partnership.
- Do not use proprietary names in consumer-facing copy.
- Do not copy questionnaire wording from books, manuals, PDFs, courses, websites, or apps.
- All questionnaires, logic, explanations, exercises, and UI language must be original.
- Use broad wellness language: estimate, suggest, flag, guidance, screen.
- Avoid diagnosis language: diagnose, treat, cure, prescribe, clinical assessment.

## 4. Core product philosophy

Healthi must follow these laws throughout the product.

### 4.1 Sleep before strain

If sleep debt, poor sleep quality, elevated resting pulse, low HRV, or circadian disruption are present, training intensity must reduce.

### 4.2 Movement quality before load

If posture, mobility, flexibility, pain, or pattern control is insufficient, the app must correct before loading.

### 4.3 Progression only when adaptation is available

The app should chase one small measurable improvement only when recovery and mechanics support it.

### 4.4 Restore when overloaded

When allostatic load is too high, the app replaces workouts with restorative movement, breathwork, walking, sunlight, stretching, hydration, food support, and sleep repair.

### 4.5 Biofeedback before dogma

Food recommendations must use the user's personal response history, not just generic food rules.

### 4.6 Food quality plus personal response

A clean ingredient label does not guarantee a food is a good fit for the user. A personal response pattern can override general food quality.

### 4.7 Every recommendation must explain why

Every workout change, meal suggestion, shopping list, recovery intervention, or notification must include reason codes.

### 4.8 Confidence over false certainty

When data is incomplete, Healthi must lower confidence instead of pretending to know.

### 4.9 One integrated system

Sleep affects training. Training affects food needs. Food affects sleep. Digestion affects readiness. Posture affects exercise selection. Stress affects cravings. Hydration affects energy. Everything talks to everything.

## 5. Product goals

Healthi must:

- Provide a daily holistic morning briefing.
- Identify the user's primary limiting factor each day.
- Generate a daily protocol across movement, recovery, food, hydration, circadian rhythm, and mindset.
- Adapt workouts based on readiness, allostatic load, posture, mobility, soreness, pain, and last performance.
- Track progressive overload intelligently.
- Detect when lack of progression may be caused by sleep, food, hydration, stress, overtraining, caffeine, or movement restriction.
- Replace inappropriate workouts with restorative sessions.
- Track food quality and personal food response.
- Build meal plans and shopping lists from goals, current state, food quality, and personal response history.
- Explain recommendations in warm, direct, practitioner-style language.
- Keep all advice within wellness guidance boundaries.

## 6. Product non-goals

Healthi must not:

- Diagnose disease.
- Treat medical conditions.
- Prescribe medication.
- Replace a physician, dietitian, physical therapist, psychologist, or licensed clinician.
- Claim to measure cortisol without lab data.
- Claim ingredient categories are universally harmful or universally healthy.
- Provide eating disorder treatment.
- Provide injury rehabilitation beyond general wellness movement guidance.
- Use copyrighted or trademarked language externally without permission.
- Make AI the source of truth.

## 7. Target users

### 7.1 Premium holistic optimizer

A wellness-oriented user who wants a calm, premium, integrated daily health briefing. She may already use sleep trackers, recovery wearables, Pilates, strength training, sauna, supplements, or personal coaching.

Needs:

- Tell me what my body needs today.
- Tell me when to train hard and when to pull back.
- Tell me what to eat and buy based on my body.
- Explain why.

### 7.2 Serious lifter who wants intelligent progression

A user tracking lifts, reps, RPE, soreness, sleep, and recovery. They believe in progressive overload but know not every day is a PR day.

Needs:

- Can I progress today?
- What should I try to beat from last session?
- Why did performance drop?
- Should I train, maintain, correct, or recover?

### 7.3 Food-sensitive wellness user

A user who reacts differently to different foods and does not trust one-size-fits-all diet rules.

Needs:

- Which foods actually work for me?
- What should I buy this week?
- Which healthy-looking foods make me feel bad?
- What foods support my energy, digestion, mood, and training?

### 7.4 Busy, stressed professional

A user carrying high life stress, poor sleep, inconsistent meals, caffeine dependence, and low recovery capacity.

Needs:

- What is the minimum effective action today?
- Should I work out or recover?
- What can I do in 15 minutes?
- How do I stop digging the hole deeper?

## 8. Product architecture

Healthi has five major product layers:

1. Data Capture Layer: user inputs, wearables, food logs, workouts, scans, check-ins.
2. Interpretation Layer: foundation scores, allostatic load, readiness, movement permissions, food fit.
3. Decision Layer: daily priority, day mode, workout modification, food plan, shopping guidance.
4. Explanation Layer: user-facing reasons, AI practitioner, score explanations.
5. Action Layer: workout, rebalancing session, meal plan, shopping list, notifications, wind-down.

## 9. Operating model

### 9.1 Foundation domains

| Internal domain ID | Consumer name | Description |
|---|---|---|
| `recovery_rhythm` | Recovery + Rhythm | Sleep, circadian rhythm, nervous system recovery, wind-down, relaxation |
| `nourishment` | Nourishment | Food quality, hydration, digestion, food response, meal rhythm |
| `movement_capacity` | Movement | Posture, mobility, flexibility, training, pain flags, progression |
| `mind_life_load` | Mind + Life Load | Stress, emotional state, motivation, values, meaning, lifestyle burden |

### 9.2 Daily priority

Each morning, Healthi determines the user's primary daily priority.

Possible values:

- `recovery_rhythm`
- `nourishment`
- `movement_capacity`
- `mind_life_load`
- `balanced`

### 9.3 Day mode

Possible values:

- `build`: recovery and movement quality support progression.
- `maintain`: some stress exists but training is still useful.
- `correct`: movement, posture, or pain limits safe loading.
- `restore`: allostatic load too high for productive training.
- `professional_guidance`: safety concern present.

## 10. Primary user loops

### 10.1 Daily loop

Wake up -> Morning Briefing -> Today's Priority -> Daily Protocol -> Adaptive Movement or Rebalancing -> Food/hydration guidance -> Logs and responses -> Evening Closeout -> Score update -> Tomorrow adapts.

### 10.2 Weekly loop

Review trends -> Identify bottlenecks -> Adjust training load -> Update meal plan -> Update shopping list -> Retest movement if needed -> Set next week focus.

### 10.3 Long-term loop

Assess -> Interpret -> Act -> Track response -> Adapt plan -> Reassess baseline.

## 11. Account, auth, and profile

Requirements:

- Email/password signup and login.
- Apple Sign-In.
- Google Sign-In.
- Secure session persistence.
- Protected app navigation.
- Profile creation after signup.
- Account deletion.
- Data export.
- Wearable disconnect.
- AI data-sharing consent controls.
- Notification preferences.
- Subscription status.

## 12. Holistic onboarding

Onboarding must feel like a calm conversation with a thoughtful practitioner, not a medical form.

Sections:

1. Identity and goals.
2. Dream, values, motivation.
3. Sleep and circadian rhythm.
4. Stress and life load.
5. Digestion and elimination.
6. Nutrition style and food quality.
7. Hydration and stimulants.
8. Food constraints and allergies.
9. Training history.
10. Injuries and limitations.
11. Movement assessment.
12. Posture assessment.
13. Equipment and schedule.
14. Biometrics and wearable connections.
15. Safety disclaimers and consent.

Output:

- Baseline profile.
- Estimated sleep need.
- Hydration target.
- Food constraints.
- Movement flags.
- Posture flags.
- Stress tendencies.
- Digestion tendencies.
- Initial foundation scores.
- Calibration status.

Acceptance criteria:

- User can leave onboarding and resume later.
- Every answer is stored.
- Baseline profile is generated from answers.
- App displays calibrating during first 7 to 14 days.
- No diagnosis language appears.

## 13. Foundation scoring

Healthi calculates four domain scores daily:

- Recovery + Rhythm.
- Nourishment.
- Movement.
- Mind + Life Load.

Each domain score includes:

- 0 to 100 score.
- Confidence: low, medium, high.
- Reason codes.
- Limiting factors.

## 14. Recovery + Rhythm engine

Inputs:

- Sleep duration.
- Sleep quality.
- Sleep debt.
- Bedtime consistency.
- Wake time consistency.
- Circadian phase at check-in.
- Morning sunlight.
- Caffeine timing.
- RHR deviation.
- HRV trend if available.
- Wind-down adherence.

Outputs:

- Sleep debt estimate.
- Circadian energy map.
- Best movement window.
- Caffeine cutoff.
- Wind-down plan.
- Recovery priority.

## 15. Nourishment engine

Inputs:

- Hydration percentage.
- Meal regularity.
- Protein target adherence.
- Energy intake adequacy.
- Digestion check-in.
- Bloating, reflux, constipation flags.
- Food response scores.
- Caffeine or alcohol timing.
- Food quality of recent logs.

Outputs:

- Meal strategy.
- Hydration target.
- Foods to emphasize.
- Foods to reduce.
- Shopping priorities.
- Recipe constraints.

## 16. Movement engine

Inputs:

- Movement screen results.
- Posture screen results.
- Pain flags.
- Mobility restrictions.
- Flexibility restrictions.
- Pattern permissions.
- Soreness.
- Last session performance.
- Training load trend.
- Warm-up feedback.

Outputs:

- Pattern-specific readiness.
- Exercise permissions.
- Workout mode.
- Progression target.
- Corrective focus.
- Rebalancing prescription if needed.

## 17. Mind + Life Load engine

Inputs:

- Motivation.
- Emotional stress proxies.
- Patience or irritability.
- Mental fog.
- Lifestyle load.
- Work stress.
- Relationship stress.
- Schedule pressure.
- Self-time.
- Values alignment check-in.

Outputs:

- Stress regulation plan.
- Reflection prompt.
- Training friction adjustment.
- Breathing or walking recommendation.
- Recovery emphasis.

## 18. Sleep and circadian engine

Default sleep need is 8 hours. Healthi adjusts over time using:

- User-reported sleep quality.
- Wake ease.
- Daytime energy.
- Sleep duration.
- Sleep consistency.
- Wearable sleep data if available.
- Recovery response after sleep extension.

Sleep debt:

Nightly Sleep Debt = Sleep Need - Actual Sleep Duration  
7-Day Sleep Debt = Sum of sleep deficits over the last 7 nights.

Sleep debt impacts:

| 7-day sleep debt | Impact |
|---|---|
| 0 to 1 hour | Minimal |
| 1 to 3 hours | Mild deduction |
| 3 to 5 hours | Moderate deduction, maintain/correct likely |
| 5+ hours | Strong deduction, restore likely |

Circadian windows:

| Window | Estimate |
|---|---|
| Alertness rise | Wake + 30 to 60 min |
| Peak 1 | Wake + 1.5 to 3 hours |
| Afternoon dip | Wake + 6 to 8 hours |
| Peak 2 | Wake + 9 to 11 hours |
| Wind-down begins | Target bedtime - 90 min |

Use estimated language. Never claim to measure cortisol without lab data.

## 19. Allostatic load and readiness engine

Healthi models allostatic load as the total stress burden the user is carrying today.

Readiness state includes:

- Readiness score: 0 to 100.
- System load score: 0 to 100, higher means more load.
- Vitality score: 0 to 100.
- Confidence.
- Zone: green, yellow, red.
- Day mode.
- Daily priority.
- Reason codes.

Zone definitions:

| Zone | Score | Meaning |
|---|---|---|
| Green | 80 to 100 | Build or full training likely |
| Yellow | 55 to 79 | Maintain, modify, or correct |
| Red | 0 to 54 | Restore or professional guidance |

Missing data handling:

- Missing input does not equal bad input.
- Available weights are normalized.
- Confidence drops when important data is missing.
- First 7 to 14 days show calibrating.

## 20. Daily decision engine

The Daily Decision Engine determines:

- Primary daily priority.
- Day mode.
- Daily protocol.
- Workout or recovery session.
- Food strategy.
- Hydration strategy.
- Circadian actions.
- Shopping and meal planning constraints.
- Explanation.

Decision priority:

1. Safety flags.
2. Recovery and rhythm.
3. Movement restrictions.
4. Nourishment limitations.
5. Mind and life load.
6. Build/progress if all clear.

## 21. Movement, posture, mobility, and flexibility system

Healthi must not assign loading to movement patterns the user cannot perform comfortably with acceptable control.

Movement patterns:

- Horizontal push.
- Vertical push.
- Horizontal pull.
- Vertical pull.
- Squat.
- Hinge.
- Lunge.
- Carry.
- Rotation.
- Anti-rotation.
- Core stability.
- Locomotion.

Movement assessment checks:

- Pain.
- Discomfort.
- Range limitation.
- Stability.
- Balance.
- Compensation.
- Left/right asymmetry.
- User confidence.
- Notes and body map location.

Posture assessment checks:

- Forward head tendency.
- Rounded shoulders.
- Thoracic restriction.
- Rib flare.
- Pelvic tilt tendency.
- Knee valgus tendency.
- Foot arch tendency.
- Left/right asymmetry.
- Breathing pattern tendency.

Pattern permissions:

- Allowed.
- Allowed with modification.
- Technique only.
- Corrective only.
- Blocked.

Permission rules:

| Finding | App response |
|---|---|
| Pain during squat | Block loaded squat, assign corrective mobility/stability |
| Hinge discomfort | Block heavy hinge/deadlift, assign posterior chain mobility/core stability |
| Overhead restriction | Block overhead press, assign thoracic/shoulder correctives |
| Push pain | Modify or block pressing based on pain location |
| Single-leg instability | Add balance/stability, avoid heavy unilateral loading |
| Forward head/rounded shoulders | Balance pressing with rows, scapular work, thoracic mobility |
| Low back discomfort | Block spinal loading until screen clears |

## 22. Training engine

Core equation:

Goal-based programming + recovery readiness + allostatic load + movement permission + posture/mobility/flexibility + previous performance + food/fuel status = today's training decision.

Training states:

| State | Use when | Output |
|---|---|---|
| Build | Recovery good, movement cleared | One progression target |
| Maintain | Moderate stress or under-fueled | Match or slightly reduce |
| Technique | Useful to train but not push | Tempo, pauses, skill work |
| Correct | Movement limitation present | Corrective movement |
| Restore | System overloaded | Rebalancing session |

Progression philosophy:

Healthi should not try to PR every exercise every workout. It should attempt one small measurable improvement when the system is ready.

Valid progression types:

- More reps.
- More load.
- Same work with lower RPE.
- Better form.
- Better range.
- More volume.
- Better tempo control.

The One More Rule:

When the system is ready, earn one small improvement. When the system is not ready, recover so the next improvement can happen.

Example:

Previous workout:

- Bench Press: 225 x 5.
- DB Bench: 70s x 8.
- Smith Incline: 185 x 10.

Next workout possible targets:

- Bench Press 225 x 6.
- DB Bench 70s x 9.
- Smith Incline 185 x 11.
- Smith Incline 190 x 10.

If the user hits only DB Bench 70s x 9, the day counts as successful progression.

Progression gate checks:

1. General readiness.
2. Allostatic load.
3. Sleep debt.
4. Fuel status.
5. Hydration.
6. Caffeine/stimulant status.
7. Soreness.
8. Pain.
9. Movement pattern permission.
10. Posture/mobility restrictions.
11. Last session outcome.
12. Warm-up feedback.

False progression protection:

Progression only counts if:

- Form quality is equal or better.
- Pain did not increase.
- Range of motion is comparable.
- Tempo is comparable unless intentionally changed.
- Rest time is comparable.
- RPE did not exceed target by more than allowed.
- No major compensation was reported.

Session outcomes:

- Productive progression.
- Productive maintenance.
- Recovery mismatch.
- Movement constraint.
- Under-fueled.
- Incomplete.

## 23. Rebalancing and restore engine

When training would create more cost than adaptation, Healthi prescribes a restorative session.

Consumer-facing names:

- Rebalancing Session.
- Restore Session.
- System Reset.
- Recovery Protocol.

Components:

- Nasal breathing.
- Diaphragmatic breathing.
- Box breathing.
- Gentle spinal mobility.
- Hip mobility.
- Shoulder mobility.
- Postural reset.
- Low-load core stability.
- Outdoor walk.
- Sunlight exposure.
- Dark-room stretching.
- Evening wind-down.
- Reflection.
- Hydration.
- Cook recovery meal.

Cause-to-intervention mapping:

| Limiting factor | Intervention |
|---|---|
| High sleep debt | Restore session, no intense loading, earlier wind-down |
| Circadian disruption | Morning sunlight, outdoor walk, caffeine cutoff, dark evening |
| Caffeine jitters | Walk, breathing, hydration, avoid more stimulants |
| Under-fueled | Cook/eat, protein-forward meal, no PR attempt |
| Poor digestion | Simple familiar meals, lower intensity |
| High soreness | Mobility, walking, reduce local loading |
| Pain flag | Corrective session, block loaded pattern |
| Emotional overload | Low-friction movement, breathwork, reflection |
| Overtraining trend | Deload, restore sessions |

## 24. Food system

Food is not judged only by calories, macros, or generic ingredient quality.

Food Fit Score = General Quality + Personal Response + Current Fit.

Food logging methods:

- Manual entry.
- Search.
- Barcode scan.
- Recipe.
- Meal plan item.
- Voice/text prompt later.
- Shopping item conversion.

General food quality considers:

- Ingredient simplicity.
- Processing level.
- Added sugar.
- Artificial dyes.
- Artificial sweeteners.
- Highly processed oils.
- Preservatives.
- Protein quality.
- Fiber.
- Sodium.
- Organic availability.
- Whole-food status.
- User dietary constraints.

Do not label foods as morally good or bad.

Use labels like:

- Strong fit.
- Moderate fit.
- Watch list.
- Limit often.
- Not recommended for today.

Personal food response tracks:

- Energy.
- Digestion.
- Bloating.
- Mental clarity.
- Mood.
- Cravings.
- Satiety.
- Sleep impact if eaten late.
- Training impact next day.
- Notes.

Pattern confidence:

| Logs | Label |
|---|---|
| 1 | Single response |
| 3 | Early signal |
| 5 | Emerging pattern |
| 8+ | Consistent pattern |

Dynamic food weighting:

| Factor | Normal week | Recovery week | Performance week |
|---|---|---|---|
| Personal response | 25% | 30% | 25% |
| Food quality | 20% | 20% | 15% |
| Goal/macros | 20% | 10% | 25% |
| Digestion fit | 10% | 20% | 10% |
| Circadian timing | 10% | 10% | 10% |
| Practicality | 10% | 5% | 5% |
| Variety | 5% | 5% | 10% |

## 25. Meal planning and recipes

Inputs:

- Goal.
- Macro targets.
- Food constraints.
- Dietary preferences.
- Personal food patterns.
- Current readiness.
- Digestion state.
- Schedule.
- Cooking skill.
- Prep time preference.
- Budget.

Rules:

- Use high-response foods when available.
- Avoid foods with consistent low response.
- Avoid new food experiments on high sleep debt or poor digestion days.
- Use simple, familiar meals on restore days.
- Use higher training-fuel support on build days.
- Respect allergies and intolerances absolutely.
- Respect dietary restrictions.
- Never recommend foods the user marks as allergy.

Recipe modes:

- Simple: ingredients, basic steps, prep time, macros estimate, why it fits today.
- Chef: technique, timing, flavor pairings, plating, substitutions, why it fits today.

## 26. Shopping assistant

Flagship use case:

User says: I am going to Costco. Based on my meal plan, what should I get?

Healthi generates a shopping list based on:

- Current goal.
- Current readiness.
- Daily priority.
- Meal plan.
- Personal food response.
- Food quality rules.
- Allergies/intolerances.
- Household servings.
- Budget.
- Store type.
- Cooking time.
- Pantry inventory if available.
- Training schedule for the week.

Shopping modes:

- Build my cart.
- Scan product.
- Compare products.
- Budget mode.
- Recovery mode.
- Performance mode.
- Meal prep week.

Shopping output:

- Strategy summary.
- Categorized shopping list.
- Avoid or limit list.
- Recipes.
- Prep plan.
- Explanation with reason codes.

## 27. Barcode scanner and product evaluation

Flow:

Open scanner -> Scan barcode -> Lookup product -> Parse nutrition and ingredients -> Evaluate general quality -> Compare to personal response history -> Evaluate current fit -> Show recommendation -> Allow one-tap log or add to shopping list.

Product evaluation output:

- Product name.
- Brand.
- General quality score.
- Personal response score.
- Current fit score.
- Label.
- Ingredient notes.
- Personal notes.
- Goal fit notes.
- Recommendation.

Example logic:

A product can have a high ingredient quality score but low personal response. In that case, Healthi should tell the user it is generally clean but not a strong fit for them today.

## 28. AI practitioner and concierge

The AI is not the brain. Deterministic engines are the brain. AI explains, translates, and helps the user act on structured data.

AI may:

- Explain morning briefing.
- Explain why a workout changed.
- Build a grocery list.
- Generate recipes from approved foods.
- Explain food response patterns.
- Suggest training substitutions from allowed exercises.
- Explain readiness and circadian rhythm.
- Guide breathing or recovery sessions.
- Help reflect on values and life load.
- Summarize trends.

AI must not:

- Diagnose.
- Prescribe medication.
- Treat injuries.
- Claim medical certainty.
- Recommend extreme dieting.
- Encourage training through pain.
- Override allergies, safety flags, or pattern blocks.
- Invent data not present in user records.

AI responses must be grounded in a structured context snapshot.

## 29. Morning Briefing

The Morning Briefing is the flagship screen.

It answers:

- What is my system status?
- What needs attention first?
- Can I train hard today?
- What should I eat?
- When should I move?
- What should I avoid?
- What is the plan tonight?

Content:

- Greeting.
- Date.
- Readiness state.
- Foundation scores.
- Primary priority.
- Day mode.
- System summary.
- Why.
- Movement plan.
- Food strategy.
- Hydration strategy.
- Circadian strategy.
- Evening focus.

## 30. Dashboard

Sections:

- System Status.
- Foundation Scores.
- Today's Priority.
- Today's Protocol.
- Energy Curve.
- Workout or Restore Card.
- Food Insight.
- Hydration.
- Sleep Debt.
- Shopping Shortcut.
- Ask Healthi.
- Recent Logs.
- Trends Link.

UI requirements:

- Premium, calm, modern.
- No noisy gamification.
- No guilt language.
- No aggressive red alerts except safety.
- Muted palette.
- Clear hierarchy.
- Large readable type.
- One primary action per screen.

## 31. Evening closeout

Purpose: close the daily feedback loop.

Ask only what the app cannot infer.

Questions:

- Did you follow today's movement plan?
- How did your body respond?
- Any pain?
- How was digestion today?
- Any foods worth scoring?
- Caffeine after cutoff?
- Did you get outdoor light?
- What time are you planning to wind down?

Outputs:

- Updates protocol adherence.
- Updates food response patterns.
- Updates recovery confidence.
- Prepares next morning's briefing.

## 32. History and progress

Display:

- Readiness over time.
- Foundation scores over time.
- Day mode frequency.
- Sleep debt trend.
- Circadian consistency.
- Training volume.
- Progression success rate.
- Productive progression days.
- Recovery mismatch days.
- Movement restriction trends.
- Food response trends.
- Personal power foods.
- Foods to reduce.
- Hydration consistency.
- Mood and life load trends.
- Weekly summary.

Weekly report answers:

- What improved?
- What blocked progress?
- What should change next week?
- Which foods helped?
- Which workouts were productive?
- Which recovery actions worked?

## 33. Wearables and integrations

Use:

- Apple HealthKit on iOS.
- Health Connect on Android.
- Indirect integrations through platform health layers where available.

Data pulled when permitted:

- Sleep.
- Resting heart rate.
- HRV.
- Steps.
- Workouts.
- Weight.
- Energy burned if available.

Data source priority:

1. Wearable/device data.
2. Manual user log.
3. Onboarding baseline.
4. Estimated default.

Every metric must store source and confidence.

## 34. Payments and subscriptions

Use RevenueCat for:

- iOS subscriptions.
- Android subscriptions.
- Entitlement management.
- Trial state.
- Restore purchases.
- Subscription analytics.

Possible entitlements:

- Premium.
- AI chat.
- Barcode scan.
- Advanced meal planning.
- Wearable sync.
- Advanced training.

## 35. Technical architecture

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo |
| Language | TypeScript |
| Navigation | Expo Router |
| Build | EAS Build with custom development client |
| Backend | Supabase |
| Auth | Supabase Auth |
| Database | Supabase Postgres |
| Edge logic | Supabase Edge Functions |
| AI | AI provider through backend only |
| Food data | Food database API through backend only |
| Barcode | Expo Camera |
| iOS health | Apple HealthKit |
| Android health | Health Connect |
| Payments | RevenueCat |
| Push | Expo Notifications |

Backend secrets must never be exposed in the mobile app.

## 36. Database model

Core groups:

Identity and settings:

- profiles.
- user_settings.
- user_consents.
- privacy_events.
- data_export_requests.
- data_deletion_requests.
- subscription_status.

Onboarding and assessments:

- assessment_sessions.
- assessment_answers.
- baseline_profiles.
- movement_assessments.
- movement_screen_results.
- posture_assessments.
- breathing_assessments.
- food_constraints.

Metrics and scores:

- metric_sources.
- metric_observations.
- sleep_logs.
- sleep_debt_history.
- circadian_profiles.
- circadian_logs.
- hydration_logs.
- daily_checkins.
- stress_assessments.
- foundation_scores.
- readiness_scores.
- allostatic_load_scores.

Movement and training:

- exercise_library.
- exercise_prerequisites.
- movement_pattern_permissions.
- training_plans.
- training_sessions.
- exercise_sets.
- progression_targets.
- session_outcomes.
- warmup_logs.
- stretch_logs.
- corrective_protocols.
- rebalancing_sessions.
- recovery_interventions.

Food and meal planning:

- food_items.
- food_ingredients.
- barcode_scans.
- food_logs.
- meal_logs.
- food_response_logs.
- food_patterns.
- meal_plans.
- meal_plan_items.
- recipes.
- recipe_history.
- shopping_lists.
- shopping_list_items.
- pantry_items.

AI:

- ai_chat_sessions.
- ai_messages.
- ai_context_snapshots.
- ai_safety_events.

Wearables:

- wearable_connections.
- wearable_data_logs.

## 37. Edge functions

Required functions:

- calculateMorningBriefing.
- calculateFoundationScores.
- calculateReadiness.
- generateWorkout.
- evaluateProgressionGate.
- logWorkoutSession.
- calculateFoodFit.
- evaluateBarcodeProduct.
- generateMealPlan.
- buildShoppingList.
- generateRecipe.
- aiPractitionerChat.
- processWearableSync.
- processRevenueCatWebhook.
- sendNotification.
- exportUserData.
- deleteUserData.

## 38. Reason code system

Every recommendation must be explainable.

Reason code examples:

- high_sleep_debt.
- poor_sleep_quality.
- circadian_shift.
- current_circadian_dip.
- rhr_above_baseline.
- hrv_below_baseline.
- stress_flags_high.
- hydration_low.
- under_fueled.
- digestion_off.
- caffeine_late.
- caffeine_high.
- local_soreness_high.
- pain_flag_present.
- movement_pattern_blocked.
- posture_limitation.
- mobility_limitation.
- last_session_regressed.
- last_session_progressed.
- recovery_supports_progression.
- food_response_positive.
- food_response_negative.
- ingredient_watch_list.
- allergy_constraint.
- goal_fit.
- professional_guidance_needed.

## 39. Notifications

Types:

- Morning briefing ready.
- Hydration nudge.
- Food response prompt.
- Training window.
- Walk window.
- Caffeine cutoff.
- Wind-down start.
- Movement retest due.
- Weekly report ready.
- Shopping list ready.

Rules:

- User-configurable.
- Respect quiet hours.
- No shame.
- No over-notifying.
- Respect timezone.
- No medical-sounding alerts.

## 40. Safety and compliance

Position as a general wellness product.

Use words:

- estimate.
- suggest.
- may indicate.
- flag.
- screen.
- guidance.
- wellness.
- general recommendation.
- consider consulting a professional.

Avoid words:

- diagnose.
- treat.
- cure.
- prescribe.
- clinical assessment.
- medical decision.
- guaranteed.
- disease claims.

Medical red flags:

- Chest pain.
- Fainting.
- Severe dizziness.
- Shortness of breath at rest.
- New neurological symptoms.
- Severe injury.
- Pregnancy-related medical concern.
- Eating disorder history with restrictive behavior.
- Severe depression or self-harm signals.

When red flags appear, stop intense wellness guidance and recommend qualified professional support.

## 41. Privacy requirements

User controls:

- Export my data.
- Delete my data.
- Manage AI data sharing.
- Disconnect wearable.
- Delete food history.
- Delete chat history.
- Manage notifications.
- Manage third-party integrations.

Data minimization:

- Store only necessary health data.
- Do not send full user history to AI.
- Send minimal context snapshots.
- Store AI context snapshots only if appropriate and consented.
- Avoid sensitive free-text over-collection.

## 42. Success metrics

Activation:

- Onboarding completion.
- Movement assessment completion.
- First morning briefing viewed.
- First food log.
- First workout/rebalancing session completed.
- First shopping list generated.

Engagement:

- Daily active users.
- Morning briefing open rate.
- Weekly active users.
- Food response completion.
- Workout logging completion.
- Shopping assistant usage.
- AI chat usage.

Outcome:

- Sleep debt trend.
- Readiness trend.
- Foundation score trend.
- Progression success rate.
- Recovery mismatch frequency.
- Pain flag frequency.
- Food response confidence growth.
- Hydration consistency.
- Circadian consistency.

Business:

- Trial start rate.
- Trial conversion.
- Monthly churn.
- Annual conversion.
- Feature usage by tier.

## 43. Acceptance scenarios

### Bad sleep changes the whole day

Given:

- Sleep debt: 5.2 hours.
- RHR: +9 bpm.
- Motivation: low.
- Digestion: off.
- Planned workout: heavy lower body.

Expected:

- Day mode: restore.
- Priority: recovery_rhythm.
- Workout replaced with rebalancing session.
- Food strategy: familiar, easy-digesting meals.
- Caffeine cutoff moved earlier.
- Wind-down protocol created.
- Explanation includes sleep debt, RHR, digestion.

### Good recovery permits one progression target

Given:

- Readiness: green.
- Sleep debt: low.
- Pain: none.
- Movement pattern: allowed.
- Last DB Bench: 70s x 8.

Expected:

- Day mode: build.
- Progression allowed.
- Target: DB Bench 70s x 9 or equivalent.
- App does not require progression on every exercise.

### Under-fueled user maintains instead of pushes

Given:

- Sleep: decent.
- Hydration: 38%.
- Calories/protein yesterday: low.
- Planned upper push session.

Expected:

- Day mode: maintain.
- No progressive overload target.
- Workout volume reduced.
- Food strategy emphasizes post-workout meal and hydration.

### Posture restriction blocks exercise

Given:

- Overhead reach restricted.
- Shoulder discomfort.
- Vertical push pattern: blocked.

Expected:

- No overhead pressing.
- Thoracic/shoulder corrective work.
- Horizontal pushing may be allowed if pain-free.
- Explanation references movement permission.

### Clean food with poor personal response is not recommended

Given:

- Product quality score: 90.
- User response to similar dairy: average 3.2 across 8 logs.
- Digestion today: off.

Expected:

- Current fit score low.
- Recommendation: not today.
- Explanation says ingredient profile may be strong but personal response is poor.

### Costco prompt uses meal plan and personal response

Given:

- User asks: I am going to Costco. What should I get?
- Goal: body recomposition.
- High response foods: salmon, eggs, rice, avocado.
- Low response foods: whey, milk, sugar alcohol protein bars.
- Day mode: maintain.

Expected:

- Shopping list uses high-response foods.
- Avoid list includes low-response foods.
- Recipes generated.
- Explanation references goal, readiness, food response history.

## 44. Product definition

Healthi succeeds when it can do this:

The user wakes up. Healthi reads sleep, circadian rhythm, recovery, hydration, food response, stress, posture, mobility, soreness, training history, and goals. It identifies the limiting factor. It decides whether today is for building, maintaining, correcting, or restoring. It gives the user one clear daily plan: what movement to do, whether to chase progression, what to eat, what to buy, what to avoid, when to get sunlight, when to stop caffeine, when to wind down, and why all of this changed today. Then it learns from the response and adapts tomorrow.

That is the product: a personal adaptation engine for holistic health.

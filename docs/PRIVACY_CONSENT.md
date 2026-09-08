# Healthi Privacy and Consent Requirements

Healthi collects sensitive wellness-adjacent data. Privacy controls must exist from day one.

## User controls

Users must be able to:

- Export all data.
- Delete account and data.
- Manage AI data sharing.
- Revoke AI consent.
- Connect and disconnect wearables.
- Delete food history.
- Delete chat history.
- Manage notifications.
- Manage third-party integrations.

## Consent types

Store consent records for:

- Terms of service
- Privacy policy
- AI data sharing
- Wearable data access
- Health data access
- Push notifications
- Food API lookup
- RevenueCat subscriptions

## AI consent

Before sending any personal health, sleep, food, workout, wearable, or free-text data to AI:

1. Explain what data may be sent.
2. Explain why it is sent.
3. Explain that AI is not a medical provider.
4. Allow opt-in.
5. Store consent version.
6. Allow revocation.

## Data minimization

- Send only the minimal context needed for the task.
- Do not send full history unless required and consented.
- Prefer structured summaries over raw logs.
- Avoid storing sensitive free text longer than needed.
- Do not expose raw API payloads in client logs.

## Data source transparency

Every metric should store:

- Source
- Observed time
- Confidence
- Metadata

Example sources:

- manual
- healthkit
- health_connect
- wearable_import
- estimated
- nutrition_api
- ai_generated

## Deletion behavior

When a user deletes data:

- Remove profile-owned records.
- Cancel scheduled notifications.
- Disconnect wearables.
- Remove AI context snapshots where required.
- Preserve only legally required subscription/transaction metadata if necessary.

## Export behavior

Data export should include:

- Profile
- Onboarding responses
- Movement assessments
- Posture assessments
- Metric observations
- Scores
- Training sessions
- Food logs
- Food response logs
- Food patterns
- Meal plans
- Shopping lists
- AI chat history if user chooses to include it

# Supabase Notes

## Auth

Use Supabase Auth as the source of truth for identity. The `profiles.id` should match `auth.users.id`.

## RLS

Enable Row Level Security on every public table. User-owned rows should include `user_id` and policies should enforce `auth.uid() = user_id`.

## Edge Functions

Use Edge Functions for:

- AI calls
- Food API calls
- Payment webhooks
- User data exports
- User data deletion jobs
- Scheduled notifications
- Scoring jobs that need server trust

## Secrets

Never expose these in the app:

- Anthropic key
- Nutritionix key
- Supabase service role key
- RevenueCat webhook secret
- Payment secrets

## Recommended local commands

```bash
supabase init
supabase start
supabase db reset
supabase functions serve
```

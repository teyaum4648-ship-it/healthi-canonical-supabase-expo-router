import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/0025_premium_data_write_enforcement.sql', 'utf8');
const protectedTableSection = migration.split('foreach premium_table in array array[')[1]?.split('] loop')[0] ?? '';
const protectedTables = [...protectedTableSection.matchAll(/'([a-z_]+)'/g)].map(match => match[1]);

describe('premium write policies and safe billing launch', () => {
  it('starts with billing disabled and does not grant client access to the switch', () => {
    expect(migration).toContain('values (1,false)');
    expect(migration).toContain('revoke all on public.billing_gate_settings from public, anon, authenticated');
    expect(migration).toContain('grant select, update on public.billing_gate_settings to service_role');
  });

  it('checks server-owned subscription rows and expiration, never user-editable metadata', () => {
    expect(migration).toContain('s.user_id = (select auth.uid())');
    expect(migration).toContain("s.entitlement = 'pro'");
    expect(migration).toContain("s.status = 'active'");
    expect(migration).toContain('s.current_period_end > now()');
    expect(migration).not.toContain('auth.jwt()');
  });

  it('protects all primary logged experiences without locking onboarding, privacy, or account data', () => {
    expect(protectedTables.length).toBe(54);
    for (const table of [
      'meal_logs', 'meal_log_items', 'sleep_sessions', 'workout_sessions',
      'day_schedule_blocks', 'hydration_logs', 'training_plans', 'meal_plans'
    ]) expect(protectedTables).toContain(table);
    for (const table of [
      'profiles', 'assessment_sessions', 'assessment_answers', 'baseline_profiles',
      'onboarding_plan_results', 'user_consents', 'data_deletion_requests',
      'data_export_requests', 'user_settings', 'food_constraints'
    ]) expect(protectedTables).not.toContain(table);
  });

  it('uses restrictive database INSERT and UPDATE rules without blocking historical reads/deletes', () => {
    expect(migration).toMatch(/as restrictive for insert to authenticated with check/);
    expect(migration).toMatch(/as restrictive for update to authenticated using/);
    expect(migration).not.toMatch(/as restrictive for select/);
    expect(migration).not.toMatch(/as restrictive for delete/);
  });
});

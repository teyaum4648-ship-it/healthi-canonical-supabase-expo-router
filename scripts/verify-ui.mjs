#!/usr/bin/env node
/**
 * Open the built app on real routes, screenshot them, and report what the console said.
 *
 * Written because the first thing this caught was a pillar reading "100 / 100 — in good
 * shape this week" for a profile with nothing logged. Typecheck was clean, 1329 tests
 * passed, the bundle contained every string, and the screen was still wrong. A number
 * that flatters an empty profile is not a class of defect a unit test volunteers.
 *
 *   npm run build:demo
 *   node scripts/verify-ui.mjs movement rhythm
 *   node scripts/verify-ui.mjs "" --seed            # Today with a sample day, at 09:41
 *   node scripts/verify-ui.mjs "" --seed --now=15:20
 *
 * Routes default to the tabs. Shots land in reports/ui/. Needs a Chromium that Playwright
 * can drive; it says so and exits rather than installing anything.
 *
 * Each shot covers the whole screen, not just the first viewport: React Native Web scrolls
 * inside its own container, so the viewport is grown to that container's full height first.
 *
 * --seed writes a sample day into the demo's own device storage before loading (a week of
 * sleep, today's breakfast and two glasses of water, two workouts, a week of resting heart
 * rate and HRV with one day missing), so screens can be
 * compared with the design references. It exists only in this script; the app never ships
 * it, and every number on screen is still computed by the app's engines from it.
 * --now=HH:MM fixes the browser clock to that time today (09:41 by default with --seed).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist', 'client');
const OUT = path.join(ROOT, 'reports', 'ui');
const PORT = Number(process.env.VERIFY_UI_PORT ?? 8099);

// Derived from the app's own key constants, so a rename cannot leave this stale.
const DEMO_STATE = {
  'healthi:demo:sessionActive': 'true',
  // The literal 'true' is what parseDemoOnboardingStatus reads as completed. 'completed'
  // parses as not_started and bounces to onboarding without saying why.
  'healthi:demo:onboardingCompleted': 'true'
};

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json'
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('No build found at dist/client. Run: npm run build:demo');
  process.exit(1);
}

/** Static server with a single-page fallback, so client routes resolve. */
function serve() {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      let file = path.join(DIST, decodeURIComponent(url.pathname));
      if (!file.startsWith(DIST)) { response.writeHead(403).end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
      response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(response);
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function chromium() {
  for (const specifier of ['playwright', 'playwright-core']) {
    try { return (await import(specifier)).chromium; } catch { /* try the next one */ }
  }
  // CommonJS resolution also honors NODE_PATH in managed development environments.
  const require = createRequire(import.meta.url);
  for (const specifier of ['playwright', 'playwright-core']) {
    try { return require(specifier).chromium; } catch { /* try the next location */ }
  }
  try {
    const { execSync } = await import('node:child_process');
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return (await import(path.join(globalRoot, 'playwright', 'index.mjs'))).chromium;
  } catch {
    console.error('Playwright is not available. Install it, or run the app with `npm run web` and look yourself.');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const seed = args.includes('--seed');
const nowArg = args.find((arg) => arg.startsWith('--now='))?.slice('--now='.length) ?? (seed ? '09:41' : null);
const routes = args.filter((arg) => !arg.startsWith('--'));
const targets = routes.length > 0 ? routes : ['movement', 'rhythm', 'food', 'mood', ''];

function fixedNow() {
  if (!nowArg) return null;
  const match = nowArg.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) { console.error(`--now needs HH:MM, got ${nowArg}`); process.exit(1); }
  const now = new Date();
  now.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return now;
}

/** Runs in the page: a sample day for the demo, dated around the fixed clock. Formats match the demo stores' validators. */
function writeSampleDay(nowIso) {
  const now = new Date(nowIso);
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  const at = (date, h, m) => { const d = new Date(date); d.setHours(h, m, 0, 0); return d.toISOString(); };
  /* Sleep engines read the local wall clock on the UTC axis: a 06:40 wake is T06:40Z of its day. */
  const wall = (key, h, m) => `${key}T${pad(h)}:${pad(m)}:00.000Z`;
  const created = now.toISOString();

  const nights = [[0, 412], [1, 431], [2, 398], [4, 445], [5, 452], [6, 418]];
  const sleep = nights.map(([ago, minutes]) => {
    const key = dayKey(daysAgo(ago));
    const prev = dayKey(daysAgo(ago + 1));
    const endMinutes = 6 * 60 + 40;
    const startTotal = 24 * 60 + endMinutes - minutes;
    return {
      id: `seed-sleep-${ago}`, date: key,
      sleep_start_at: wall(prev, Math.floor(startTotal / 60) % 24, startTotal % 60),
      sleep_end_at: wall(key, 6, 40), duration_minutes: minutes,
      source: 'manual', source_confidence: 'medium', reason_codes: [], created_at: created
    };
  });

  const meal = (id, date, h, m, type, name, protein, calories) => ({
    id, user_id: 'demo-user', logged_at: at(date, h, m), meal_type: type, name, source: 'manual', source_confidence: 'medium',
    calories, protein_g: protein, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null, micronutrients: null,
    ingredients: [], quality_flags: [], user_response: null, corrected_by_user: false, confirmed_by_user: true, reason_codes: [], created_at: created
  });
  const meals = [
    meal('seed-meal-0', daysAgo(0), 7, 50, 'breakfast', 'Breakfast', 31, 520),
    meal('seed-meal-1', daysAgo(1), 8, 5, 'breakfast', 'Breakfast', 28, 480),
    meal('seed-meal-2', daysAgo(1), 13, 0, 'lunch', 'Lunch', 36, 640),
    meal('seed-meal-3', daysAgo(2), 19, 10, 'dinner', 'Dinner', 42, 720)
  ];
  const water = [[8, 0], [8, 30]].map(([h, m], index) => ({ id: `seed-water-${index}`, user_id: 'demo-user', amount_ml: 250, logged_at: at(daysAgo(0), h, m), source: 'manual' }));
  const workout = (ago, title, type, minutes, effort) => ({
    id: `seed-workout-${ago}`, user_id: 'demo-user', logged_at: at(daysAgo(ago), 18, 30), session_date: dayKey(daysAgo(ago)), title, workout_type: type,
    duration_minutes: minutes, perceived_effort: effort, readiness_before: null, session_note: null, source: 'demo', source_confidence: 'medium',
    reason_codes: [], created_at: created, updated_at: created
  });
  const workouts = [workout(1, 'Strength', 'strength', 55, 6), workout(3, 'Easy run', 'cardio', 35, 5)];

  /* Resting heart rate and HRV for six of the last seven mornings; one day is left empty on purpose, to show the gap. */
  const readings = [[6, 55, 52], [5, 56, 50], [4, 54, 55], [2, 57, 47], [1, 55, 51], [0, 58, 46]].flatMap(([ago, rhr, hrv]) => [
    { id: `seed-rhr-${ago}`, kind: 'resting_heart_rate', value: rhr, date: dayKey(daysAgo(ago)), recorded_at: created, source: 'manual' },
    { id: `seed-hrv-${ago}`, kind: 'heart_rate_variability', value: hrv, date: dayKey(daysAgo(ago)), recorded_at: created, source: 'manual' }
  ]);

  localStorage.setItem('healthi.sleep-window.sessions.v1', JSON.stringify(sleep));
  localStorage.setItem('healthi:biomarkers:v1', JSON.stringify({ demo: readings }));
  localStorage.setItem('healthi:demo:nutrition:mealLogs', JSON.stringify(meals));
  localStorage.setItem('healthi:demo:hydration:entries', JSON.stringify(water));
  localStorage.setItem('healthi:demo:movement:workoutSessions', JSON.stringify(workouts));
}

/** Grows the viewport to the app's own scroll container, so the shot holds the whole screen. */
async function fullHeight(page) {
  let height = 844;
  for (let pass = 0; pass < 3; pass += 1) {
    const extra = await page.evaluate(() => {
      let best = null;
      for (const element of document.querySelectorAll('div')) {
        const style = getComputedStyle(element);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && element.clientHeight > 200 && element.scrollHeight > element.clientHeight + 1) {
          if (!best || element.scrollHeight - element.clientHeight > best.scrollHeight - best.clientHeight) best = element;
        }
      }
      return best ? best.scrollHeight - best.clientHeight : 0;
    });
    if (extra <= 0) break;
    height += extra;
    await page.setViewportSize({ width: 390, height });
    await page.waitForTimeout(400);
  }
  return height;
}

const server = await serve();
const launcher = await chromium();
const browser = await launcher.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const now = fixedNow();
if (now) await page.clock.setFixedTime(now);

const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error}`));
page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

const base = `http://localhost:${PORT}`;
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate((state) => {
  for (const [key, value] of Object.entries(state)) localStorage.setItem(key, value);
}, DEMO_STATE);
if (seed) await page.evaluate(writeSampleDay, (now ?? new Date()).toISOString());

fs.mkdirSync(OUT, { recursive: true });
let failures = 0;

for (const route of targets) {
  const name = route || 'home';
  await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  const bouncedToOnboarding = /wellness test|STEP \d+ OF/i.test(body);
  const bouncedToLogin = /\/(?:login|signup)(?:[/?#]|$)/.test(page.url()) || /Accounts unavailable/.test(body);
  if (bouncedToOnboarding || bouncedToLogin) failures += 1;

  await fullHeight(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  console.log(`\n── /${name} ${bouncedToOnboarding ? '(BOUNCED TO ONBOARDING)' : bouncedToLogin ? '(ACCOUNT ROUTE BLOCKED)' : ''}`);
  console.log(body.slice(0, 400));
}

console.log(`\nShots: ${path.relative(ROOT, OUT)}`);
console.log(problems.length === 0 ? 'Console: clean' : `Console problems:\n  ${problems.slice(0, 10).join('\n  ')}`);

await browser.close();
server.close();
process.exit(failures > 0 || problems.length > 0 ? 1 : 0);

// Captures the real app screens the promo uses, from the web demo build, into assets/.
//
//   npm run build:demo                      (from the repo root, once)
//   node marketing/kinetic-promo-30s/capture-screens.mjs
//
// Seeds a week of demo data, fixes the clock at 9:47 AM, and answers food search with
// unbranded yogurt fixtures so no real product or chain name reaches the ad. Needs
// Playwright; CHROMIUM=/path overrides the browser.
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line import/no-unresolved -- a dev tool for the marketing folder, not an app dependency
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '../../dist/client');
const OUT = path.join(HERE, 'assets');
const PORT = 8125;
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('No web build at dist/client. Run npm run build:demo first.');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer((req, res) => {
  let file = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, resolve));

// A believable week: sleep, meals, sessions, breathing, daylight, readiness and resting signals.
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const now = new Date().toISOString();
const sleep = [[-6, 420, '07:00'], [-5, 390, '06:30'], [-4, 450, '07:15'], [-2, 360, '08:40'], [-1, 400, '07:00'], [0, 430, '07:05']].map(([o, minutes, wake]) => {
  const date = day(o);
  const end = `${date}T${wake}:00.000Z`;
  return { date, sleep_start_at: new Date(Date.parse(end) - minutes * 60000).toISOString(), sleep_end_at: end, duration_minutes: minutes, sleep_quality: 3, source: 'manual', source_confidence: 'high', reason_codes: ['manual_sleep_entry'], created_at: end };
});
const meals = [[-6, 2050, 95, 230, 72], [-5, 1900, 80, 240, 60], [-4, 2150, 130, 210, 75], [-3, 1700, 70, 200, 55], [-1, 2000, 85, 225, 70], [0, 650, 30, 80, 20]].map(([o, calories, protein_g, carbs_g, fat_g], i) => ({
  id: `m${i}`, user_id: 'demo-user', logged_at: new Date(`${day(o)}T12:30:00`).toISOString(), meal_type: 'lunch', name: 'Meal', source: 'manual', source_confidence: 'medium', calories, protein_g, carbs_g, fat_g, quality_flags: [], reason_codes: [], created_at: now,
}));
const workouts = [[-5, 'cardio', 35], [-3, 'strength', 45], [-1, 'cardio', 30]].map(([o, type, minutes], i) => ({
  id: `w${i}`, user_id: 'demo-user', logged_at: new Date(`${day(o)}T18:00:00`).toISOString(), session_date: day(o), title: type, workout_type: type, duration_minutes: minutes, perceived_effort: 6, readiness_before: null, session_note: null, source: 'manual', source_confidence: 'medium', reason_codes: [], created_at: now, updated_at: now,
}));
const biomarkers = [];
const rhr = [57, 58, null, 56, 58, 57, 61], hrv = [62, 58, 65, 60, null, 63, 52], rr = [14.2, 14.0, 14.4, null, 14.1, 14.3, 14.6];
for (let i = 0; i < 7; i++) {
  const d = day(i - 6);
  for (const [kind, value] of [['resting_heart_rate', rhr[i]], ['heart_rate_variability', hrv[i]], ['respiratory_rate', rr[i]]]) {
    if (value !== null) biomarkers.push({ id: `b-${kind}-${d}`, kind, value, date: d, recorded_at: `${d}T07:00:00.000Z`, source: 'manual' });
  }
}
const seed = {
  'healthi:demo:sessionActive': 'true',
  'healthi:demo:onboardingCompleted': 'true',
  'healthi.sleep-window.sessions.v1': JSON.stringify(sleep),
  'healthi:demo:nutrition:mealLogs': JSON.stringify(meals),
  'healthi:demo:movement:workoutSessions': JSON.stringify(workouts),
  'healthi:practice:breath:v1': JSON.stringify({ demo: [[-4, 120], [-2, 300], [0, 180]].map(([o, seconds], i) => ({ id: `p${i}`, date: day(o), rhythmId: 'settle', seconds, finishedAt: now })) }),
  'healthi:practice:daylight:v1': JSON.stringify({ demo: [[-3, 'early', 15], [-1, 'evening', 30]].map(([o, window, minutes], i) => ({ id: `l${i}`, date: day(o), minutes, window, estimated: false, loggedAt: now })) }),
  'healthi:demo:nutrition:goalSetup': JSON.stringify({ version: 'nutrition_goals_v1', answers: { age: 30, heightCm: 178, weightKg: 78, equation: 'male', activity: 'active', goal: 'maintain', needsGuidance: 'no' }, completedAt: now }),
  'healthi:readiness:history:v1': JSON.stringify({ demo: [[-6, 72], [-5, 70], [-4, 74], [-2, 68], [-1, 71]].map(([o, score]) => ({ date: day(o), score, label: 'steady', confidence: 'medium', recordedAt: now })) }),
  'healthi:biomarkers:v1': JSON.stringify({ demo: biomarkers }),
};

// Unbranded yogurts for the search screen, each with a drawn cup instead of a product photo.
const food = (code, name, kcal, protein, carbs, fat, sugars, fiber, salt, ingredients, nova) => ({
  code, product_name: name, brands: '', serving_size: '170 g', serving_quantity: 170, quantity: '500 g', countries_tags: ['en:united-states'], categories_tags: ['en:dairies', 'en:yogurts', 'en:greek-style-yogurts'], nova_group: nova,
  image_front_small_url: `https://images.openfoodfacts.org/images/products/000/000/000/${code.slice(-4)}/front.png`, ingredients_text: ingredients,
  nutriments: { 'energy-kcal_100g': kcal, proteins_100g: protein, carbohydrates_100g: carbs, fat_100g: fat, sugars_100g: sugars, fiber_100g: fiber, salt_100g: salt, 'saturated-fat_100g': fat * 0.6 },
});
const products = [
  food('0000000000101', 'Plain Greek Yogurt, 2%', 73, 9.7, 3.9, 2, 3.6, 0, 0.09, 'Cultured pasteurized reduced fat milk, live active cultures.', 1),
  food('0000000000102', 'Nonfat Greek Yogurt, Plain', 59, 10.3, 3.6, 0.4, 3.2, 0, 0.09, 'Cultured pasteurized nonfat milk, live active cultures.', 1),
  food('0000000000103', 'Greek Yogurt, Honey', 118, 7.6, 16.5, 2.4, 15.9, 0, 0.08, 'Cultured pasteurized milk, honey, live active cultures.', 3),
  food('0000000000104', 'Greek Yogurt, Strawberry', 96, 7.1, 13.5, 1.6, 11.8, 0.4, 0.08, 'Cultured pasteurized milk, strawberries, cane sugar, pectin, natural flavor, live active cultures.', 4),
  food('0000000000105', 'Whole Milk Greek Yogurt', 97, 9, 3.9, 5, 3.9, 0, 0.1, 'Cultured pasteurized whole milk, live active cultures.', 1),
];
const cups = { '0101': ['#CFE3F7', '#7FA9D6', ''], '0102': ['#CDEFE2', '#5FBF9C', ''], '0103': ['#F8E2B8', '#E3A63B', 'honey'], '0104': ['#F9D3D9', '#E0607A', 'berry'], '0105': ['#F3EBDD', '#C9A876', ''] };
const cupSvg = ([band, accent, top]) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<rect width="200" height="200" fill="#fff"/><ellipse cx="100" cy="176" rx="62" ry="8" fill="#000" opacity=".07"/>
<path d="M40 62 L160 62 L148 168 Q100 180 52 168 Z" fill="#FBFBFA" stroke="#E4E4E2" stroke-width="2"/>
<path d="M44.5 96 L155.5 96 L151 134 Q100 144 49 134 Z" fill="${band}"/><circle cx="100" cy="115" r="13" fill="${accent}"/>
<ellipse cx="100" cy="62" rx="62" ry="13" fill="#fff" stroke="#E4E4E2" stroke-width="2"/><ellipse cx="100" cy="62" rx="52" ry="9" fill="#F6F4EF"/>
${top === 'honey' ? '<path d="M70 60 Q100 52 130 62 Q112 70 84 66 Z" fill="#E7B04A" opacity=".9"/>' : ''}
${top === 'berry' ? '<circle cx="88" cy="60" r="7" fill="#E0607A"/><circle cx="108" cy="63" r="6" fill="#D44A66"/><circle cx="118" cy="58" r="5" fill="#E77A8F"/>' : ''}</svg>`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const drawer = await browser.newPage({ viewport: { width: 200, height: 200 } });
const thumbs = {};
for (const [key, look] of Object.entries(cups)) {
  await drawer.setContent(`<body style="margin:0">${cupSvg(look)}</body>`);
  thumbs[key] = await drawer.screenshot();
}
await drawer.close();

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await ctx.addInitScript(`(()=>{const s=${JSON.stringify(seed)};if(localStorage.getItem('seeded')!=='1'){for(const k in s)localStorage.setItem(k,s[k]);}localStorage.setItem('seeded','1');})()`);
await ctx.route('**/api/food-search**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ products, usdaFoods: [] }) }));
await ctx.route((url) => !url.href.startsWith(`http://localhost:${PORT}`), (route) => route.abort());
await ctx.route('https://images.openfoodfacts.org/**', (route) => {
  const key = route.request().url().match(/\/(\d{4})\/front\.png$/)?.[1];
  return thumbs[key] ? route.fulfill({ status: 200, contentType: 'image/png', body: thumbs[key] }) : route.abort();
});
const page = await ctx.newPage();
await page.clock.install({ time: new Date(`${day(0)}T09:47:00`) });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

const go = async (route) => {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
};
const shot = async (name) => {
  await page.waitForTimeout(700);
  // The app is now daywoven; the old working name must not appear in an ad frame.
  if (/healthi/i.test(await page.evaluate(() => document.body.innerText))) throw new Error(`The old app name is visible on ${name}.`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('captured', name);
};

await go('/');
await shot('home');
await go('/rhythm');
await shot('rhythm');
await go('/mood');
await shot('mood');
await go('/food');
await page.getByText('Add', { exact: true }).nth(1).click();
await page.waitForTimeout(900);
await page.getByLabel('Search foods by name or brand').fill('greek yogurt');
await page.getByRole('button', { name: 'Search food database' }).click();
await page.waitForTimeout(2500);
// The built-in restaurant list also matches; its rows name real chains, so they stay out of the frame.
await page.evaluate(() => {
  for (const el of document.querySelectorAll('div')) {
    if (el.childElementCount !== 0 || !/Chain menu data/.test(el.textContent)) continue;
    let row = el;
    while (row.parentElement && !row.querySelector('[aria-label^="Choose "]')) row = row.parentElement;
    row.style.display = 'none';
  }
});
await shot('food-results');
await page.getByLabel(/Plain Greek Yogurt, 2%: quality/).first().click();
await page.waitForTimeout(1000);
await page.evaluate(() => {
  for (const el of document.querySelectorAll('div')) if (el.scrollTop > 0) el.scrollTop = 0;
});
await shot('food-why');

await browser.close();
server.close();
if (errors.length) console.warn('Page errors:', errors.slice(0, 3));

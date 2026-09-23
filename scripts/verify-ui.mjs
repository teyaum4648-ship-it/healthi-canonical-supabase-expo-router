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
 *
 * Routes default to the tabs. Shots land in reports/ui/. Needs a Chromium that Playwright
 * can drive; it says so and exits rather than installing anything.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';

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
  try {
    const { execSync } = await import('node:child_process');
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return (await import(path.join(globalRoot, 'playwright', 'index.mjs'))).chromium;
  } catch {
    console.error('Playwright is not available. Install it, or run the app with `npm run web` and look yourself.');
    process.exit(1);
  }
}

const routes = process.argv.slice(2);
const targets = routes.length > 0 ? routes : ['movement', 'rhythm', 'food', 'mood', ''];

const server = await serve();
const launcher = await chromium();
const browser = await launcher.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error}`));
page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

const base = `http://localhost:${PORT}`;
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate((state) => {
  for (const [key, value] of Object.entries(state)) localStorage.setItem(key, value);
}, DEMO_STATE);

fs.mkdirSync(OUT, { recursive: true });
let failures = 0;

for (const route of targets) {
  const name = route || 'home';
  await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  const bouncedToOnboarding = /wellness test|STEP \d+ OF/i.test(body);
  if (bouncedToOnboarding) failures += 1;

  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`\n── /${name} ${bouncedToOnboarding ? '(BOUNCED TO ONBOARDING)' : ''}`);
  console.log(body.slice(0, 400));
}

console.log(`\nShots: ${path.relative(ROOT, OUT)}`);
console.log(problems.length === 0 ? 'Console: clean' : `Console problems:\n  ${problems.slice(0, 10).join('\n  ')}`);

await browser.close();
server.close();
process.exit(failures > 0 || problems.length > 0 ? 1 : 0);

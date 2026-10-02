// Renders daywoven-ad.html frame by frame into an H.264 MP4, or stills with --stills.
//
//   node render.mjs                      → daywoven-ad-30s-9x16.mp4
//   node render.mjs --stills 3.5 8 18    → still-*.png at those seconds
//
// Needs Playwright (npm install playwright, then npx playwright install chromium) and an
// ffmpeg with libx264 on PATH, or FFMPEG=/path/to/ffmpeg. CHROMIUM=/path overrides the
// browser. Every frame is render(t) for an exact t, so nothing depends on machine speed.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line import/no-unresolved -- installed only to render this ad, not an app dependency
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FPS = 30, SECONDS = 30;
const args = process.argv.slice(2);
const stills = args.includes('--stills') ? args.filter((a) => /^\d+(\.\d+)?$/.test(a)).map(Number) : null;
const out = args.find((a) => a.endsWith('.mp4')) ?? path.join(here, 'daywoven-ad-30s-9x16.mp4');

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(here, 'daywoven-ad.html')}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

if (stills) {
  for (const t of stills) {
    await page.evaluate((time) => window.render(time), t);
    await page.screenshot({ path: path.join(here, `still-${String(t).padStart(5, '0')}.png`) });
  }
  console.log(`stills: ${stills.join(', ')}`);
} else {
  const ffmpeg = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-r', String(FPS), out],
  { stdio: ['pipe', 'ignore', 'inherit'] });
  const total = FPS * SECONDS;
  for (let f = 0; f < total; f += 1) {
    await page.evaluate((time) => window.render(time), f / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ffmpeg.stdin.write(png)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    if (f % 150 === 0) console.log(`frame ${f}/${total}`);
  }
  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))));
  console.log(`wrote ${out}`);
}
await browser.close();

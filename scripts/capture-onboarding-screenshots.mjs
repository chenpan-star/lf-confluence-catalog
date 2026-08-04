/**
 * Capture soft-theme onboarding screenshots (job-focused guide).
 * Usage: node scripts/capture-onboarding-screenshots.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/onboarding');
const base = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const chrome =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(outDir, { recursive: true });

// Clear previous PNGs so stale tour shots are not re-uploaded
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.png')) unlinkSync(join(outDir, f));
}

const person = encodeURIComponent('Alex Chadyuk');

const shots = [
  {
    file: '01-home.png',
    path: '/',
    caption: 'Job 1 — Home: start here',
    wait: '.hero-home',
  },
  {
    file: '02-category.png',
    path: '/category/dno-platform',
    caption: 'Job 1 — Pick a category, then a space',
    wait: '.space-index-nav, .space-index-embedded, .page-shell',
  },
  {
    file: '03-space.png',
    path: '/category/dno-platform/space/PCONF',
    caption: 'Job 2 — Open one space',
    wait: '.space-hero-title',
  },
  {
    file: '04-filter-person.png',
    path: '/category/dno-platform/space/PCONF',
    caption: 'Job 2 — Filter by person (editors in this space)',
    wait: '.space-person-panel',
    beforeShot: async (page) => {
      const showBtn = await page.$('.space-person-panel button');
      if (showBtn) {
        const label = await page.evaluate((el) => el.textContent || '', showBtn);
        if (/show/i.test(label)) await showBtn.click();
      }
      await page.waitForSelector('.space-person-list, .space-person-body', { timeout: 8000 });
      await page.evaluate(() => {
        document.querySelector('.space-person-panel')?.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 400));
    },
  },
  {
    file: '05-person-pages.png',
    path: `/category/dno-platform/space/PCONF?person=${person}`,
    caption: 'Job 2 — One person’s pages in this space',
    wait: '.space-person-active-name',
    beforeShot: async (page) => {
      await page.evaluate(() => {
        const note = document.querySelector('.space-filter-person-note');
        const target =
          note ||
          document.querySelector('.page-tree') ||
          document.querySelector('.space-page-filters');
        target?.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 500));
    },
  },
  {
    file: '06-send-reminders.png',
    path: '/review/editors',
    caption: 'Job 3 — Send reminders',
    wait: '.editor-review-stack, .page-shell',
  },
  {
    file: '07-remind-modal.png',
    path: '/review/editors',
    caption: 'Remind dialog — preview, Jira, and Slack',
    wait: '.editor-review-stack, .page-shell',
    beforeShot: async (page) => {
      const opened = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.editor-review-card')];
        for (const card of cards) {
          if (card.querySelector('.editor-review-badges .badge')) continue;
          const btn = card.querySelector(
            '.editor-review-actions .btn-primary:not([disabled])',
          );
          if (btn) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (!opened) throw new Error('No remind button found');
      await page.waitForSelector('.review-modal', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 400));
    },
  },
];

async function applySoftTheme(page) {
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('lf-catalog-theme', 'soft');
    } catch {
      /* ignore */
    }
  });
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--window-size=1600,1000', '--no-sandbox'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
await applySoftTheme(page);

const manifest = [];

for (const shot of shots) {
  const url = `${base}${shot.path}`;
  process.stderr.write(`Capturing ${shot.file} ← ${url}\n`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.setItem('lf-catalog-theme', 'soft');
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', 'soft');
  });
  // Give React theme effect a beat to settle
  await new Promise((r) => setTimeout(r, 200));
  try {
    await page.waitForSelector(shot.wait, { timeout: 15000 });
  } catch {
    process.stderr.write(`  warn: selector not found (${shot.wait}), capturing anyway\n`);
  }
  if (shot.beforeShot) {
    try {
      await shot.beforeShot(page);
    } catch (err) {
      process.stderr.write(`  warn: beforeShot failed: ${err.message}\n`);
    }
  }
  await new Promise((r) => setTimeout(r, 500));
  const dest = join(outDir, shot.file);
  await page.screenshot({ path: dest, fullPage: false, type: 'png' });
  manifest.push({
    file: shot.file,
    path: shot.path,
    caption: shot.caption,
    theme: 'soft',
    url: `onboarding/${shot.file}`,
  });
  process.stderr.write(`  wrote ${dest}\n`);
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
console.log(JSON.stringify({ outDir, count: manifest.length, manifest }, null, 2));

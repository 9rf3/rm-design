import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/admin/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright');

const args = process.argv.slice(2);
const out = args.find((a) => a.startsWith('--out='))?.split('=')[1] || 'assets/header-shot.png';
const url = 'file://' + path.resolve(args.find((a) => !a.startsWith('--')) || 'index.html');
const widths = (args.find((a) => a.startsWith('--w='))?.split('=')[1] || '1440').split(',').map(Number);
const height = Number(args.find((a) => a.startsWith('--h='))?.split('=')[1] || 520);
const full = args.includes('--full');

const browser = await chromium.launch();
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height }, deviceScaleFactor: 2 });
  await page.goto(url);
  await page.waitForTimeout(700);
  await page.screenshot({
    path: out.replace('.png', `-${w}.png`),
    fullPage: full,
  });
  await page.close();
  console.log('shot ' + out.replace('.png', `-${w}.png`) + ' @' + w);
}
await browser.close();

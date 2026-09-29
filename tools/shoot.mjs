import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/admin/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright');

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith('--scale='));
const scale = Number(scaleArg ? scaleArg.split('=')[1] : 1);
const preview = args.includes('--preview');
const files = args.filter((a) => !a.startsWith('--')).map((f) => path.resolve(f));

function intrinsic(svg) {
  const w = /width="([\d.]+)"/.exec(svg);
  const h = /height="([\d.]+)"/.exec(svg);
  if (w && h) return { w: +w[1], h: +h[1] };
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg);
  const p = vb[1].trim().split(/\s+/).map(Number);
  return { w: p[2], h: p[3] };
}

const browser = await chromium.launch();

for (const file of files) {
  const svg = fs.readFileSync(file, 'utf8');
  const size = intrinsic(svg);
  const dir = path.join(path.dirname(file), 'png');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, path.basename(file, '.svg') + '.png');
  const page = await browser.newPage({
    viewport: { width: Math.ceil(size.w), height: Math.ceil(size.h) },
    deviceScaleFactor: scale,
  });
  await page.goto('file://' + file);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out, omitBackground: true });
  await page.close();
  console.log('rendered ' + out + '  ' + size.w + 'x' + size.h + ' @' + scale + 'x');
}

if (preview) {
  const bg = process.env.PREVIEW_BG || '#141b2b';
  let cells = '';
  for (const f of files) {
    const svg = fs.readFileSync(f, 'utf8');
    const size = intrinsic(svg);
    const inline = svg.replace(/\sxmlns="[^"]*"/, '');
    const w = Math.min(size.w, 900);
    const h = (size.h / size.w) * w;
    cells += '<figure><div class="box" style="width:' + w + 'px;height:' + h + 'px">' +
      '<div class="art" style="width:' + w + 'px;height:' + h + 'px">' + inline + '</div></div>' +
      '<figcaption>' + path.basename(f) + '  ' + size.w + '×' + size.h + '</figcaption></figure>';
  }
  const html = '<!doctype html><meta charset="utf-8"><style>' +
    '*{box-sizing:border-box}body{margin:0;padding:28px;background:' + bg + ';' +
    'background-image:linear-gradient(45deg,rgba(255,255,255,.035) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.035) 75%),' +
    'linear-gradient(45deg,rgba(255,255,255,.035) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.035) 75%);' +
    'background-size:44px 44px;background-position:0 0,22px 22px;' +
    'font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fa6c4;display:flex;flex-wrap:wrap;gap:26px;align-content:flex-start}' +
    'figure{margin:0;display:flex;flex-direction:column;gap:8px;align-items:center}' +
    '.box{display:flex;align-items:center;justify-content:center;outline:1px dashed rgba(120,220,255,.28);outline-offset:6px}' +
    '.art svg{width:100%;height:100%;display:block}' +
    'figcaption{opacity:.75}' +
    '</style>' + cells;
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.waitForTimeout(300);
  const out = path.resolve('assets/preview.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log('preview ' + out);
}

await browser.close();

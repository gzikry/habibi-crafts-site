/**
 * Guard against a viewer that exists but has no size.
 * A .spin whose children are all absolutely positioned collapses to 0px
 * unless an explicit width is set — and the page still "works", so only a
 * size assertion catches it.
 *   node verify-viewer-size.js [base]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const path = require('path');
const SITE = process.env.HABIBI_SITE || path.join(__dirname, '..', 'site');

(async () => {
  const slugs = fs.readdirSync(SITE)
    .filter((f) => f.startsWith('product-') && f.endsWith('.html'))
    .map((f) => f.replace(/^product-/, '').replace(/\.html$/, ''));
  const pages = ['/', '/shop.html', '/mugs.html', '/tees.html', '/totes.html',
                 '/onesies.html', '/prints.html',
                 ...slugs.map((s) => `/product-${s}.html`)];

  const browser = await chromium.launch();
  let fails = 0;

  for (const vp of [{ w: 1440, h: 900 }, { w: 390, h: 844 }]) {
    for (const path of pages) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => {
        const viewers = [...document.querySelectorAll('[data-spin]')];
        return viewers.map((v) => {
          const b = v.getBoundingClientRect();
          const img = v.querySelector('[data-spin-image]');
          const ib = img?.getBoundingClientRect();
          return {
            w: Math.round(b.width), h: Math.round(b.height),
            imgW: Math.round(ib?.width || 0), imgH: Math.round(ib?.height || 0),
            loaded: img?.complete && img?.naturalWidth > 0,
          };
        });
      });
      const bad = r.filter((v) => v.w < 120 || v.h < 120 || v.imgW < 100 || !v.loaded);
      const ok = bad.length === 0;
      if (!ok) { fails++; console.log(`FAIL  [${vp.w}] ${path}`, JSON.stringify(bad)); }
      await page.close();
    }
  }

  console.log(`${fails} failure(s) across ${pages.length} pages x 2 viewports`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

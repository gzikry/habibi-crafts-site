/**
 * Measure the slider specifically.
 *
 * The slider had a step of 1 over 3 positions, so dragging it jumped between
 * three states. It should now span a full revolution at fine resolution and
 * produce a graded visual response.
 *
 *   node verify-slider.js [base]
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8090';

(async () => {
  const browser = await chromium.launch();
  let fails = 0;

  for (const slug of ['ya-aini', 'khalas-habibi', 'baladi']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/product-${slug}.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const cfg = await page.evaluate(() => {
      const s = document.querySelector('[data-spin-slider]');
      const v = document.querySelector('[data-spin]').__spin;
      return { max: +s.max, step: +s.step, frames: v.count };
    });

    // drive the slider across its whole range and watch the overlay opacity
    await page.evaluate(() => {
      const over = document.querySelector('[data-spin-overlay]');
      window.__ops = [];
      window.__t = setInterval(() => {
        window.__ops.push(parseFloat(getComputedStyle(over).opacity));
      }, 16);
    });

    const s = await page.locator('[data-spin-slider]').boundingBox();
    await page.mouse.move(s.x + s.width * 0.02, s.y + s.height / 2);
    await page.mouse.down();
    const N = 40;
    for (let i = 1; i <= N; i++) {
      await page.mouse.move(s.x + (s.width * i) / N, s.y + s.height / 2);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.waitForTimeout(300);

    const ops = await page.evaluate(() => { clearInterval(window.__t); return window.__ops; });
    const mid = ops.filter((o) => o > 0.08 && o < 0.92).length;
    const distinct = new Set(ops.map((o) => o.toFixed(2))).size;

    const problems = [];
    if (cfg.step > 0.05) problems.push(`slider step ${cfg.step} is too coarse`);
    if (cfg.max < cfg.frames) problems.push(`slider max ${cfg.max} < ${cfg.frames} frame(s)`);
    if (mid < 5) problems.push(`only ${mid} blended samples across a full slider sweep`);
    if (distinct < 8) problems.push(`opacity took only ${distinct} distinct values`);

    if (problems.length) { fails++; console.log(`FAIL ${slug}: ${problems.join('; ')}`); }
    else {
      console.log(`PASS ${slug.padEnd(15)} step=${cfg.step} max=${cfg.max} ` +
                  `blended=${mid}/${ops.length} distinct=${distinct}`);
    }
    await page.close();
  }

  console.log(`\n${fails} failure(s)`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

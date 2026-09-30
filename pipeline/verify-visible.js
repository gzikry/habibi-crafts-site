/**
 * Verify no product card can end up permanently invisible.
 *
 * Cards start hidden and reveal as they scroll into view, so checking opacity
 * right after load would "fail" by design. The invariant that matters is:
 * after scrolling the page, nothing is still hidden — and with JS disabled,
 * nothing is hidden at all.
 *   node verify-visible.js [base]
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const PAGES = ['/', '/shop.html', '/mugs.html', '/tees.html', '/totes.html',
               '/onesies.html', '/prints.html', '/product-ya-aini.html'];

(async () => {
  const browser = await chromium.launch();
  let fails = 0;

  for (const path of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + path, { waitUntil: 'networkidle' });

    // walk the page so every reveal gets a chance to fire, in steps rather
    // than one jump: a single jump would skip past observers
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.6);
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 400));
    });
    await page.waitForTimeout(1200);

    const r = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.reveal')];
      const hidden = cards.filter((c) => getComputedStyle(c).opacity !== '1');
      const imgs = [...document.querySelectorAll('img')];
      return {
        cards: cards.length,
        hidden: hidden.length,
        hiddenTitles: hidden.map((c) => c.querySelector('h3')?.textContent || c.className),
        broken: imgs.filter((i) => i.complete && i.naturalWidth === 0)
                    .map((i) => i.getAttribute('src')),
      };
    });

    const ok = r.hidden === 0 && r.broken.length === 0;
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${path.padEnd(26)} cards=${r.cards} stillHidden=${r.hidden} broken=${r.broken.length}`);
    if (r.hidden) console.log('        hidden:', r.hiddenTitles.join(', '));
    if (r.broken.length) console.log('        broken:', r.broken.join(', '));
    await page.close();
  }

  // fail-open: with JS off nothing may be hidden
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const np = await ctx.newPage();
  await np.goto(BASE + '/', { waitUntil: 'load' });
  const styleOk = await np.evaluate(() => {
    const cs = [...document.querySelectorAll('.reveal')].map((c) => getComputedStyle(c).opacity);
    return cs.length ? cs.every((o) => o === '1') : false;
  });
  if (!styleOk) fails++;
  console.log(`${styleOk ? 'PASS' : 'FAIL'}  no-JS fallback: all cards visible`);

  console.log(`\n${fails} failure(s)`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

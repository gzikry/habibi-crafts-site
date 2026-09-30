/**
 * Verify grid hover preview cycles angle frames on product cards.
 *   node verify-hover.js [base]
 */
const { chromium } = require('playwright');

(async () => {
  const BASE = process.argv[2] || 'http://127.0.0.1:8090';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let fails = 0;

  await page.goto(BASE + '/mugs.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < 900; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
  });
  await page.waitForTimeout(600);

  const cards = await page.evaluate(() => [...document.querySelectorAll('.product-card[data-preview]')].map(c => ({
    title: c.querySelector('h3')?.textContent,
    previewCount: JSON.parse(c.getAttribute('data-preview') || '[]').length,
    base: c.querySelector('img.mockup')?.getAttribute('src'),
  })));
  console.log('cards with preview:', JSON.stringify(cards, null, 2));
  if (!cards.length) { console.log('FAIL no cards carry data-preview'); fails++; }

  // hover the first card and see the image swap
  const first = page.locator('.product-card[data-preview]').first();
  const before = await first.locator('img.mockup').getAttribute('src');
  await first.hover();
  await page.waitForTimeout(1400);
  const during = await first.locator('img.mockup').getAttribute('src');
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);
  const after = await first.locator('img.mockup').getAttribute('src');

  const swapped = before !== during;
  const restored = after === before;
  console.log(`${swapped ? 'PASS' : 'FAIL'}  hover swaps the card image`);
  console.log(`${restored ? 'PASS' : 'FAIL'}  leaving restores the base image`);
  if (!swapped) fails++;
  if (!restored) fails++;

  // no cards should be left showing a blank 'back' frame
  const backs = await page.evaluate(() => [...document.querySelectorAll('img.mockup')]
    .map(i => i.getAttribute('src')).filter(s => /\/back\.png$/.test(s)));
  console.log(`${backs.length === 0 ? 'PASS' : 'FAIL'}  no base image points at a blank back (${backs.length})`);
  if (backs.length) fails++;

  console.log(`\n${fails} failure(s)`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

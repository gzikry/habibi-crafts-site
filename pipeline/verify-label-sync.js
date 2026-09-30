/**
 * The label must name the angle that is actually on screen.
 *
 * A blended step crosses over at the halfway point; a cut step shows the old
 * frame until the boundary. Getting this wrong labels a shopper's mug "Handle
 * on Left" while the picture still shows the right-handle view.
 *
 * Walks every frame boundary of every product and asserts that the label, the
 * counter, and the slider's spoken value all agree with the visible frame.
 *   node verify-label-sync.js [base]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const SITE = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace/habibi-crafts-site/site';

(async () => {
  const slugs = fs.readdirSync(SITE)
    .filter((f) => f.startsWith('product-') && f.endsWith('.html'))
    .map((f) => f.replace(/^product-/, '').replace(/\.html$/, ''))
    .sort();

  const browser = await chromium.launch();
  let fails = 0, checked = 0;

  for (const slug of slugs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${BASE}/product-${slug}.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const frames = await page.evaluate(() =>
      document.querySelector('[data-spin]').__spin.frames.map((f) => f.label));

    if (frames.length < 2) { await page.close(); continue; }

    const bad = [];
    // sample the whole revolution at fine resolution
    const N = frames.length * 8;
    for (let k = 0; k < N; k++) {
      const pos = (k / N) * frames.length;
      const r = await page.evaluate((p) => {
        const root = document.querySelector('[data-spin]');
        const v = root.__spin;
        v.fling = 0; v.tween = null; v.pos = p;
        v.render();

        // which frame is actually visible? The base unless the overlay has
        // meaningfully faded in.
        const over = root.querySelector('[data-spin-overlay]');
        const op = over ? parseFloat(getComputedStyle(over).opacity) : 0;
        const baseSrc = root.querySelector('[data-spin-image]').getAttribute('src');
        const overSrc = over ? over.getAttribute('src') : null;
        const visible = op > 0.5 ? overSrc : baseSrc;

        const counter = root.querySelector('[data-spin-counter]');
        const slider = root.querySelector('[data-spin-slider]');
        return {
          baseSrc, overSrc, opacity: op, visible,
          counterLabel: counter && !counter.hasAttribute('hidden') ? counter.textContent.trim() : '',
          sliderText: slider ? slider.getAttribute('aria-valuetext') : '',
          frames: v.frames,
        };
      }, pos);

      // the frame whose src is on screen
      const shown = r.frames.find((f) => f.src === r.visible);
      if (!shown) { bad.push(`pos=${pos.toFixed(2)}: no frame matches visible src`); continue; }
      const shownLabel = shown.label;

      // At an exact 50/50 crossfade both frames are equally visible, so either
      // name is honest. Only flag a mismatch when one frame is clearly ahead.
      const tied = Math.abs(r.opacity - 0.5) < 0.04;
      const other = r.frames.find((f) => f.src === (r.visible === r.baseSrc ? r.overSrc : r.baseSrc));
      const acceptable = tied && other ? [shownLabel, other.label] : [shownLabel];

      if (r.counterLabel && acceptable.indexOf(r.counterLabel) === -1) {
        bad.push(`pos=${pos.toFixed(2)}: counter says "${r.counterLabel}" but "${shownLabel}" is shown`);
      }
      if (r.sliderText && !acceptable.some((l) => r.sliderText.indexOf(l) === 0)) {
        bad.push(`pos=${pos.toFixed(2)}: slider says "${r.sliderText}" but "${shownLabel}" is shown`);
      }
    }

    checked++;
    if (bad.length) {
      fails++;
      console.log(`FAIL ${slug}: ${bad.length} mismatch(es)`);
      bad.slice(0, 3).forEach((b) => console.log('   ', b));
    }
    await page.close();
  }

  console.log(`\n${checked - fails}/${checked} products: label always matches the visible frame`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

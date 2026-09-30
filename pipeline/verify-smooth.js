/**
 * Measure rotation smoothness.
 *
 * "Smooth" has to mean something checkable, so this measures three things:
 *
 *   1. Crossfade — during a drag, the overlay's opacity must take intermediate
 *      values. If it only ever reads 0 or 1, frames are snapping, not blending.
 *   2. Frame order — the sequence of angles shown must be a true rotational
 *      cycle. A tee returning Front,Left,Right,Back has two 180-degree jumps.
 *   3. Idle cost — with nothing moving, no animation loop may be running.
 *      A frame callback that always reschedules itself burns a core forever.
 *
 *   node verify-smooth.js [base]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const SITE = '/Users/georgezikry/.hermes/profiles/habibicrafts/workspace/habibi-crafts-site/site';

const DEGREES = {
  front: 0, 'front view': 0, default: 0,
  right: 90, 'handle on right': 90,
  back: 180, 'back view': 180,
  left: 270, 'handle on left': 270,
};

function cycleSteps(labels) {
  const d = labels.map((l) => DEGREES[String(l).trim().toLowerCase()] ?? 999);
  const steps = [];
  for (let i = 0; i < d.length; i++) {
    const a = d[i];
    const b = d[(i + 1) % d.length];
    let s = b - a;
    if (s <= 0) s += 360;
    steps.push(s);
  }
  return steps;
}

(async () => {
  const slugs = fs.readdirSync(SITE)
    .filter((f) => f.startsWith('product-') && f.endsWith('.html'))
    .map((f) => f.replace(/^product-/, '').replace(/\.html$/, ''))
    .sort();

  const browser = await chromium.launch();
  let fails = 0;
  const rows = [];

  for (const slug of slugs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // count animation frames actually requested while idle
    await page.addInitScript(() => {
      window.__rafCount = 0;
      const orig = window.requestAnimationFrame;
      window.requestAnimationFrame = function (cb) {
        window.__rafCount++;
        return orig.call(window, cb);
      };
    });

    await page.goto(`${BASE}/product-${slug}.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);

    const meta = await page.evaluate(() => {
      const root = document.querySelector('[data-spin]');
      const v = root.__spin;
      const over = root.querySelector('[data-spin-overlay]');
      return {
        frames: v.count,
        labels: v.frames.map((f) => f.label),
        hasOverlay: !!over,
        rafIdle: window.__rafCount,
        blendableCount: v.frames.filter((_, i) => v.frames.length > 1 && (function () {
          const D = { front: 0, 'front view': 0, default: 0, right: 90, 'handle on right': 90, back: 180, 'back view': 180, left: 270, 'handle on left': 270 };
          const a = D[String(v.frames[i].label || '').trim().toLowerCase()];
          const b = D[String(v.frames[(i + 1) % v.frames.length].label || '').trim().toLowerCase()];
          if (a === undefined || b === undefined) return true;
          let st = ((b - a) % 360 + 360) % 360; if (st === 0) st = 360;
          return st < 135;
        })()).length,
      };
    });

    // --- idle cost: no loop may be running when nothing moves -------------
    const idleAfter = await page.evaluate(async () => {
      const before = window.__rafCount;
      await new Promise((r) => setTimeout(r, 900));
      return window.__rafCount - before;
    });

    const problems = [];
    if (idleAfter > 3) {
      problems.push(`idle rAF loop still running (${idleAfter} callbacks in 900ms)`);
    }
    if (meta.frames > 1 && !meta.hasOverlay) {
      problems.push('no crossfade overlay element');
    }

    // --- frame order must be a real rotational cycle ----------------------
    if (meta.frames > 2) {
      const steps = cycleSteps(meta.labels);
      const worst = Math.max(...steps);
      // 4 views 90 apart, or 3 views with one real 180 gap in the data
      const allowed = meta.frames === 3 ? 180 : 90;
      if (worst > allowed) {
        problems.push(`frame step ${worst}deg exceeds ${allowed}deg (order: ${meta.labels.join(', ')})`);
      }
    }

    // --- crossfade: opacity must take intermediate values while dragging ---
    let samples = [];
    if (meta.frames > 1) {
      const box = await page.locator('[data-spin-stage]').boundingBox();
      const y = box.y + box.height / 2;
      const x0 = box.x + box.width - 20;
      await page.evaluate(() => {
        const over = document.querySelector('[data-spin-overlay]');
        window.__ops = [];
        window.__opTimer = setInterval(() => {
          window.__ops.push(parseFloat(getComputedStyle(over).opacity));
        }, 16);
      });
      await page.mouse.move(x0, y);
      await page.mouse.down();
      const steps = 36;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(x0 - (box.width / steps) * i, y);
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      samples = await page.evaluate(() => {
        clearInterval(window.__opTimer);
        return window.__ops;
      });

      const mid = samples.filter((o) => o > 0.08 && o < 0.92).length;
      const distinct = new Set(samples.map((o) => o.toFixed(2))).size;
      // Blending is only correct across a step that has a real intermediate
      // photograph. Across a half-turn there is none, and dissolving paints a
      // double exposure (two mug handles at once), so those steps must cut.
      const expectBlend = meta.blendableCount > 0;
      if (expectBlend && mid < 3) {
        problems.push(`crossfade never blended (${mid} mid-opacity samples of ${samples.length}; distinct ${distinct})`);
      }
      if (!expectBlend && mid > 2) {
        problems.push(`blended across a half-turn, which double-exposes (${mid} mid samples)`);
      }
    }

    const mid = samples.filter((o) => o > 0.08 && o < 0.92).length;
    rows.push({ slug, frames: meta.frames, idleAfter, mid, samples: samples.length });

    if (problems.length) {
      fails++;
      console.log(`FAIL ${slug} (${meta.frames} frames): ${problems.join('; ')}`);
    }
    await page.close();
  }

  const withFade = rows.filter((r) => r.frames > 1);
  console.log(`\n${rows.length - fails}/${rows.length} product pages smooth`);
  console.log(`  crossfade blending on ${withFade.filter((r) => r.mid >= 3).length}/${withFade.length} multi-frame products`);
  console.log(`  idle animation callbacks (max): ${Math.max(...rows.map((r) => r.idleAfter))}`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

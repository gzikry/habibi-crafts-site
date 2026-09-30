/**
 * Verify the angle viewer: rotation works, the slider drives it, and no
 * transform is applied to the artwork (the distortion bug).
 *   node verify-viewer.js [base]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8090';
const path = require('path');
const SITE = process.env.HABIBI_SITE || path.join(__dirname, '..', 'site');

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
    await page.waitForTimeout(250);

    const r = await page.evaluate(() => {
      const root = document.querySelector('[data-spin]');
      const img = document.querySelector('[data-spin-image]');
      const slider = document.querySelector('[data-spin-slider]');
      const v = root && root.__spin;
      const cs = img ? getComputedStyle(img) : null;
      const parentCs = img ? getComputedStyle(img.parentElement) : null;
      return {
        mounted: !!v,
        frames: v ? v.count : 0,
        sliderVisible: !!(slider && !slider.hasAttribute('hidden') && slider.offsetParent !== null),
        sliderMax: slider ? Number(slider.max) : -1,
        sliderStep: slider ? Number(slider.step) : -1,
        imgTransform: cs ? cs.transform : 'none',
        parentTransform: parentCs ? parentCs.transform : 'none',
        perspective: parentCs ? parentCs.perspective : 'none',
        hasDots: !!document.querySelector('.spin-dot, .spin-rail'),
      };
    });

    const bad = [];
    if (!r.mounted) bad.push('not mounted');
    if (r.hasDots) bad.push('dots still present');
    // the distortion fix: the image itself must never be transformed
    if (r.imgTransform !== 'none') bad.push(`img transform=${r.imgTransform}`);
    if (r.parentTransform !== 'none') bad.push(`stage transform=${r.parentTransform}`);
    if (r.perspective !== 'none') bad.push(`perspective=${r.perspective}`);
    if (r.frames > 1 && !r.sliderVisible) bad.push('slider hidden with multiple frames');
    // The slider spans one full revolution at fine resolution, not one stop per
    // photograph. A step of 1 over 3 positions is what made it jump.
    if (r.frames > 1 && r.sliderMax !== r.frames) {
      bad.push(`slider max ${r.sliderMax} != ${r.frames} (one turn)`);
    }
    if (r.frames > 1 && r.sliderStep > 0.05) bad.push(`slider step ${r.sliderStep} too coarse`);

    // slider actually changes the frame
    if (r.frames > 1 && r.sliderVisible) {
      const before = await page.getAttribute('[data-spin-image]', 'src');
      await page.locator('[data-spin-slider]').fill(String(r.frames / 2));
      await page.waitForTimeout(250);
      const after = await page.getAttribute('[data-spin-image]', 'src');
      if (before === after) bad.push('slider did not change frame');
      const label = await page.getAttribute('[data-spin-slider]', 'aria-valuetext');
      if (!label) bad.push('slider has no aria-valuetext');
    }

    // Drag slowly and deliberately (long gaps between moves) so the fling
    // term is ~0 and the landing frame is deterministic. spin.js advances one
    // frame per (stageWidth / frameCount) px, so drag exactly that much.
    if (r.frames > 1) {
      await page.locator('[data-spin-slider]').fill('0');
      await page.waitForTimeout(150);
      const before = await page.getAttribute('[data-spin-image]', 'src');
      const box = await page.locator('[data-spin-stage]').boundingBox();
      const y = box.y + box.height / 2;
      const x0 = box.x + box.width - 20;
      const need = box.width / r.frames;      // one frame of travel
      const steps = 12;
      await page.mouse.move(x0, y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(x0 - (need * i) / steps, y);
        await page.waitForTimeout(130);
      }
      await page.mouse.up();
      await page.waitForTimeout(1200);
      const after = await page.getAttribute('[data-spin-image]', 'src');
      if (before === after) {
        const st = await page.evaluate(() => {
          const v = document.querySelector('[data-spin]').__spin;
          return { pos: v.pos, idx: v.index, count: v.count, perFrame: v.perFrame,
                   stageW: v.stageWidth() };
        });
        bad.push(`drag did not change frame (${JSON.stringify(st)})`);
      }
    }

    checked++;
    if (bad.length) {
      fails++;
      console.log(`FAIL ${slug} (${r.frames} frames): ${bad.join('; ')}`);
    }
    await page.close();
  }

  console.log(`\n${checked - fails}/${checked} product pages pass`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})();

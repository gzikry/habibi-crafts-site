/*!
 * Habibi Crafts Co — product angle viewer
 *
 * Between the product's real photographs. Frames are the available angles
 * (front, right, back, left) in rotational order.
 *
 * Two things make this smooth, and neither is a transform:
 *
 * 1. Continuous position. `pos` is a float over the frame sequence, not an
 *    integer index. As it moves between frame 2 and frame 3, frame 3 is drawn
 *    over frame 2 with an opacity equal to the fraction travelled. So the
 *    mug dissolves from one angle into the next instead of snapping, and a
 *    three-frame product still reads as motion.
 *
 * 2. Correct frame order. The photographs are not always named in rotational
 *    order, and sorting them by name (Front, Left, Right, Back) gives steps of
 *    90°, 270°, 180° — two of the four jump half a turn. Frames are handed in
 *    by their real angle, so the cycle is even. The JS trusts the order it is
 *    handed and never re-sorts.
 *
 * The image itself is never rotated, scaled or skewed. Any 3D transform on a
 * flat product still shears the print; that was a reported defect.
 *
 * Progressive enhancement: without JS the markup shows a plain <img>.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsHover = window.matchMedia('(hover:hover)').matches;

  // A drag is measured against the stage, not in absolute pixels: the same
  // gesture should mean the same thing on a wide hero and on a phone. A
  // full-width drag covers exactly one revolution.
  function pxPerFrame(count, width) {
    var w = width || 560;
    return Math.max(60, w / Math.max(count, 1));
  }

  var FLING_DECAY = 0.925;      // per frame at 60fps
  var FLING_STOP = 0.002;       // frames per frame; below this, stop
  var MAX_COAST = 1.2;          // frames a flick may coast after release
  var MIN_DT = 8;               // ms; jittery pointers report 0ms between
                                // moves, which makes velocity explode
  var TWEEN_MS = 260;           // a single stepped move (arrow key, autospin)
  var SLIDER_MIN = 0.001;       // a dead slider thumb cannot be dragged
  var SNAP_DEGREES = 135;       // steps wider than this get a cut, not a blend

  // These are still photographs, not a turntable. A 90-degree step has a real
  // intermediate position, so dissolving between the two frames reads as
  // rotation. A 180-degree step does not: blending a mug's handle-right into
  // its handle-left paints two handles at once — a double exposure. Steps at
  // or above SNAP_DEGREES therefore cut straight to the next frame.
  var VIEW_DEGREES = {
    'front': 0, 'front view': 0, 'default': 0,
    'right': 90, 'handle on right': 90,
    'back': 180, 'back view': 180,
    'left': 270, 'handle on left': 270,
  };

  function degreesOf(label) {
    var d = VIEW_DEGREES[String(label || '').trim().toLowerCase()];
    return d === undefined ? null : d;
  }

  /** True when the step from frame i to the next is small enough to blend. */
  function blendable(frames, i) {
    if (frames.length < 2) return false;
    var a = degreesOf(frames[i].label);
    var b = degreesOf(frames[(i + 1) % frames.length].label);
    if (a === null || b === null) return true;   // unknown names: trust the data
    var step = ((b - a) % 360 + 360) % 360;
    if (step === 0) step = 360;
    return step < SNAP_DEGREES;
  }

  function mod(n, m) { return ((n % m) + m) % m; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function Viewer(root) {
    this.root = root;
    this.stage = root.querySelector('[data-spin-stage]');
    this.img = root.querySelector('[data-spin-image]');
    this.hint = root.querySelector('[data-spin-hint]');
    this.slider = root.querySelector('[data-spin-slider]');
    this.counter = root.querySelector('[data-spin-counter]');

    this.frames = [];
    var raw = root.getAttribute('data-frames');
    if (raw) {
      try { this.frames = JSON.parse(raw) || []; } catch (e) { this.frames = []; }
    }
    if (!this.frames.length && this.img) {
      this.frames = [{ src: this.img.getAttribute('src'), label: '' }];
    }

    this.count = this.frames.length;
    this.pos = 0;              // float position along the frame sequence
    this.shown = -1;           // index currently painted as the base layer
    this.nextShown = -1;       // index currently painted as the overlay
    this.labeled = -1;         // index the visible label describes
    this.dragging = false;
    this.taken = false;        // shopper has interacted; stop any autospin
    this.velocity = 0;
    this.fling = 0;
    this.tween = null;
    this.lastX = 0;
    this.lastT = 0;
    this.raf = null;
    this.lastFrameT = 0;
    this.baseSrc = null;
    this.overSrc = null;
    this.perFrame = 1;
    this.dragStartIndex = 0;
    this.dragFrames = 0;
    this.autospinTimer = null;
    this.autospinLeft = 0;

    this.perFrame = pxPerFrame(this.count, this.stageWidth());
    this.makeOverlay();
    this.syncSlider();
    this.preload();
    this.bind();
    this.render(true);
    this.autospin();
  }

  /** The overlay image the crossfade is drawn on. Created here rather than in
   *  the markup so the no-JS fallback stays a single plain <img>. */
  Viewer.prototype.makeOverlay = function () {
    if (this.count < 2 || !this.stage || !this.img) return;
    var over = this.img.cloneNode(false);
    over.removeAttribute('data-spin-image');
    over.setAttribute('data-spin-overlay', '');
    over.setAttribute('aria-hidden', 'true');
    over.alt = '';
    over.style.position = 'absolute';
    over.style.inset = '0';
    over.style.opacity = '0';
    this.stage.appendChild(over);
    this.over = over;
  };

  Viewer.prototype.syncSlider = function () {
    if (!this.slider) return;
    if (this.count > 1) {
      // A step of 1 gave the slider exactly as many positions as there were
      // photographs — three for a mug — so dragging it jumped. It now spans a
      // full revolution at fine resolution and drives the blend directly.
      this.slider.min = '0';
      this.slider.max = String(this.count);
      this.slider.step = '0.005';
      this.slider.value = '0';
      this.slider.removeAttribute('hidden');
    } else {
      this.slider.setAttribute('hidden', '');
    }
  };

  Viewer.prototype.preload = function () {
    this.frames.forEach(function (f) {
      var im = new Image();
      im.decoding = 'async';
      im.src = f.src;
    });
  };

  Viewer.prototype.stageWidth = function () {
    if (this.stage) {
      var w = this.stage.getBoundingClientRect().width;
      if (w > 0) return w;
    }
    return 560;
  };

  Viewer.prototype.finish = function () {
    this.settle();
    this.finishDrag();
  };

  Viewer.prototype.bind = function () {
    var self = this;
    if (!this.stage) return;

    function pointX(e) {
      return (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
    }

    if (this.count > 1) {
      function down(e) {
        self.dragging = true;
        self.taken = true;
        self.fling = 0;
        self.tween = null;
        self.lastX = pointX(e);
        self.lastT = performance.now();
        self.velocity = 0;
        self.perFrame = pxPerFrame(self.count, self.stageWidth());
        self.dragStartIndex = self.nearest();
        self.dragFrames = 0;
        self.root.classList.add('is-dragging');
        if (self.hint) self.hint.classList.remove('is-visible');
        if (e.cancelable) e.preventDefault();
      }

      function move(e) {
        if (!self.dragging) return;
        var x = pointX(e);
        var now = performance.now();
        var dt = Math.max(now - self.lastT, MIN_DT);
        var dx = x - self.lastX;
        self.velocity = dx / dt;
        self.lastX = x;
        self.lastT = now;

        self.pos = mod(self.pos - dx / self.perFrame, self.count);
        self.dragFrames += Math.abs(dx) / self.perFrame;
        self.render();
        if (e.cancelable) e.preventDefault();
      }

      function up() {
        if (!self.dragging) return;
        self.dragging = false;
        self.root.classList.remove('is-dragging');
        // Coast in the drag direction. The loop multiplies `fling` by
        // FLING_DECAY each frame, so it travels fling / (1 - decay) frames in
        // total; seed from the intended distance, or a light gesture runs away.
        var framesPerMs = Math.abs(self.velocity) / self.perFrame;
        var coast = Math.min(framesPerMs * 260, MAX_COAST);
        var seed = coast * (1 - FLING_DECAY);
        self.fling = self.velocity < 0 ? seed : -seed;
        // Two-angle products have no room to coast past their neighbour.
        var cap = Math.min(MAX_COAST, self.count - 1) * (1 - FLING_DECAY);
        self.fling = clamp(self.fling, -cap, cap);
        self.flingDir = self.velocity > 0 ? -1 : 1;
        if (reduced || Math.abs(self.fling) < 0.0005) {
          self.fling = 0;
          self.finish();
        } else {
          self.run();
        }
      }

      this.stage.addEventListener('mousedown', down);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      this.stage.addEventListener('touchstart', down, { passive: false });
      this.stage.addEventListener('touchmove', move, { passive: false });
      this.stage.addEventListener('touchend', up);
      this.stage.addEventListener('touchcancel', up);

      this.stage.setAttribute('tabindex', '0');
      this.stage.setAttribute('role', 'group');
      this.stage.setAttribute('aria-label', 'Product angle. Use left and right arrow keys to rotate.');
      this.stage.addEventListener('keydown', function (e) {
        var step = 0;
        if (e.key === 'ArrowLeft') step = -1;
        else if (e.key === 'ArrowRight') step = 1;
        else if (e.key === 'Home') { self.taken = true; self.step(0 - self.nearest()); e.preventDefault(); return; }
        else if (e.key === 'End') { self.taken = true; self.step((self.count - 1) - self.nearest()); e.preventDefault(); return; }
        else return;
        self.taken = true;
        self.fling = 0;
        self.step(step);
        e.preventDefault();
      });

      if (this.slider) {
        var fromSlider = false;
        this.slider.addEventListener('input', function () {
          self.taken = true;
          self.fling = 0;
          self.tween = null;
          // the slider spans a full revolution: count == one full turn
          self.pos = mod(Number(self.slider.value) || 0, self.count);
          self.render();
        });
        // while the shopper holds the slider, the render loop must not write
        // back to it or the thumb fights the pointer
        this.slider.addEventListener('pointerdown', function () { fromSlider = true; });
        this.slider.addEventListener('pointerup', function () { fromSlider = false; });
        this.slider.addEventListener('pointercancel', function () { fromSlider = false; });
        this.sliderHeld = function () { return fromSlider; };
      }
    }

    if (this.count > 1) {
      var onResize = function () {
        self.perFrame = pxPerFrame(self.count, self.stageWidth());
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
    }
  };

  Viewer.prototype.nearest = function () {
    return mod(Math.round(this.pos), this.count);
  };

  /** Move a whole number of frames, animated. */
  Viewer.prototype.step = function (n) {
    if (!n) return;
    var self = this;
    var from = this.pos;
    var to = from + n;
    if (reduced) { this.pos = to; this.render(); this.finish(); return; }
    this.tween = { from: from, to: to, start: performance.now() };
    this.run();
  };

  Viewer.prototype.settle = function () {
    this.pos = mod(Math.round(this.pos), this.count);
    this.render();
  };

  /**
   * A drag that ends on the frame it started from reads as a viewer that does
   * not work — most likely on a two-angle product. If the shopper clearly
   * dragged and landed back where they began, step one frame the way they
   * were heading.
   */
  Viewer.prototype.finishDrag = function () {
    if (this.dragFrames < 0.5 || this.count < 2) { this.dragFrames = 0; return; }
    if (this.nearest() !== this.dragStartIndex) { this.dragFrames = 0; return; }
    this.pos = mod(this.nearest() + (this.flingDir || 1), this.count);
    this.dragFrames = 0;
    this.render();
  };

  Viewer.prototype.autospin = function () {
    // Opt-in, and only on the hero: a slow turn shows the product turns at all.
    if (reduced || this.count < 2) return;
    if (!this.root.hasAttribute('data-autospin')) return;

    var self = this;
    this.autospinLeft = this.count;

    // One revolution, easing between angles, then stop on the printed front.
    // Looping forever is distracting, and a mug left mid-turn barely shows its
    // print, so the hero would read as an empty product.
    function tick() {
      if (self.taken || self.dragging || self.tween) { self.autospinTimer = setTimeout(tick, 120); return; }
      if (self.autospinLeft <= 0) { self.autospinTimer = null; return; }
      self.autospinLeft--;
      self.step(1);
      self.autospinTimer = setTimeout(tick, 2600);
    }
    this.autospinTimer = setTimeout(tick, 1200);

    this.stopAutospin = function () {
      if (self.autospinTimer) { clearTimeout(self.autospinTimer); self.autospinTimer = null; }
    };
    this.root.addEventListener('mouseenter', function () { self.taken = true; self.stopAutospin(); });
    this.root.addEventListener('focusin', function () { self.taken = true; self.stopAutospin(); });
  };

  /** Run the animation loop only while something is actually animating. */
  Viewer.prototype.run = function () {
    if (this.raf || reduced) return;
    var self = this;
    this.lastFrameT = 0;
    function tick(t) {
      self.raf = null;
      var dt = self.lastFrameT ? Math.min(t - self.lastFrameT, 64) : 16.7;
      self.lastFrameT = t;
      var active = false;

      if (self.tween) {
        var p = clamp((t - self.tween.start) / TWEEN_MS, 0, 1);
        self.pos = self.tween.from + (self.tween.to - self.tween.from) * easeOut(p);
        if (p >= 1) { self.tween = null; self.settle(); self.finishDrag(); }
        else active = true;
        self.render();
      }

      if (self.fling) {
        // normalise the decay to 60fps so the coast is the same on any display
        var decay = Math.pow(FLING_DECAY, dt / 16.7);
        self.pos = mod(self.pos + self.fling * (dt / 16.7), self.count);
        self.fling *= decay;
        if (Math.abs(self.fling) < FLING_STOP) {
          self.fling = 0;
          self.settle();
          self.finishDrag();
        } else active = true;
        self.render();
      }

      if (active) self.raf = requestAnimationFrame(tick);
      else self.lastFrameT = 0;
    }
    this.raf = requestAnimationFrame(tick);
  };

  Viewer.prototype.render = function (initial) {
    if (!this.frames.length) return;

    var i = Math.floor(this.pos);
    var frac = this.pos - i;
    var baseIdx = mod(i, this.count);
    var overIdx = mod(i + 1, this.count);
    var f = this.frames[baseIdx];

    // Only touch the DOM when something actually changed. Writing `src`,
    // `alt`, and the label on every frame is what made this stutter.
    if (this.img && this.shown !== baseIdx) {
      this.img.setAttribute('src', f.src);
      this.shown = baseIdx;
      this.baseSrc = f.src;
    }
    if (this.over && this.nextShown !== overIdx) {
      this.over.setAttribute('src', this.frames[overIdx].src);
      this.nextShown = overIdx;
      this.overSrc = this.frames[overIdx].src;
    }
    // The crossfade: the next angle fading in over the current one — but only
    // across a small step. A half-turn has no intermediate photograph, so
    // blending it would show a double exposure instead of a rotation.
    var canBlend = blendable(this.frames, baseIdx);
    this.blending = canBlend;
    if (this.over) {
      this.over.style.opacity = (canBlend && frac > 0.004) ? String(frac) : '0';
    }

    // The label must change exactly when the picture does. A blended step
    // crosses over at the halfway point, but a cut step shows the old frame
    // right up to the boundary — switching the label early would name an
    // angle the shopper cannot see yet.
    var labelIdx = canBlend ? (frac < 0.5 ? baseIdx : overIdx) : baseIdx;
    if (this.labeled !== labelIdx || initial) {
      this.labeled = labelIdx;
      var lf = this.frames[labelIdx];
      var base = this.root.getAttribute('data-alt') || '';
      var label = lf && lf.label;
      if (this.img) this.img.setAttribute('alt', label ? base + ' — ' + label : base);
      if (this.counter) {
        if (label) { this.counter.textContent = label; this.counter.removeAttribute('hidden'); }
        else this.counter.setAttribute('hidden', '');
      }
      if (this.slider && this.count > 1) {
        var name = label || ('Angle ' + (labelIdx + 1));
        this.slider.setAttribute('aria-valuetext',
          name + ' (' + (labelIdx + 1) + ' of ' + this.count + ')');
      }
    }

    if (this.slider && this.count > 1 && !(this.sliderHeld && this.sliderHeld())) {
      var v = mod(this.pos, this.count);
      if (v < SLIDER_MIN && this.pos > 0.5) v = this.count;   // wrap, not snap back
      if (Math.abs(Number(this.slider.value) - v) > 0.004) {
        this.slider.value = String(v);
      }
    }

    if (initial && this.hint && this.count > 1 && supportsHover) {
      this.hint.classList.add('is-visible');
    }
  };

  function boot() {
    var nodes = document.querySelectorAll('[data-spin]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__spin) {
        var v = new Viewer(nodes[i]);
        nodes[i].__spin = v;
        if (v.count > 1) nodes[i].classList.add('has-frames');
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

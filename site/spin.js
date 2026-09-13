/*!
 * Habibi Crafts Co — product angle viewer
 *
 * Moves between the product's real photographs with a drag or the slider.
 * Frames come from the Printful mockup generator (front, left, right, back).
 *
 * The image is never 3D-transformed. With only a handful of real stills per
 * product, a rotateY offset shears the artwork instead of adding depth, so
 * rotation here means stepping between real photos and nothing more.
 *
 * Progressive enhancement: without JS the markup shows a plain <img>.
 */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsHover = window.matchMedia('(hover:hover)').matches;

  // A drag is measured against the stage, not in absolute pixels: 110px is a
  // fifth of a turn on a wide hero and most of a turn on a phone, so the same
  // gesture meant different things at different sizes. A full-width drag now
  // covers exactly one revolution, whatever the product has.
  function pxPerFrame(count, width) {
    var w = width || 560;
    return Math.max(70, w / Math.max(count, 1));
  }
  var FLING_DECAY = 0.9;
  var FLING_STOP = 0.004;
  var MAX_COAST = 0.9;           // frames a flick may coast after release
  var MIN_DT = 8;                // ms floor: synthetic and jittery pointers can
                                 // report 0ms between moves, which makes
                                 // velocity explode into nonsense

  function mod(n, m) { return ((n % m) + m) % m; }

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
    this.pos = 0;            // float position along the frame sequence
    this.index = 0;          // integer frame currently shown
    this.dragging = false;
    this.taken = false;      // shopper has interacted; stop any autospin
    this.velocity = 0;
    this.fling = 0;
    this.lastX = 0;
    this.lastT = 0;
    this.raf = null;
    this.currentSrc = null;
    this.perFrame = 1;
    this.dragStartIndex = 0;   // where a drag began, to detect a dead landing
    this.dragFrames = 0;       // total frames travelled this drag

    this.syncSlider();
    this.preload();
    this.bind();
    this.render(true);
    this.autospin();
  }

  Viewer.prototype.syncSlider = function () {
    if (!this.slider) return;
    if (this.count > 1) {
      this.slider.min = '0';
      this.slider.max = String(this.count - 1);
      this.slider.step = '1';
      this.slider.value = String(this.index);
      this.slider.removeAttribute('hidden');
    } else {
      // nothing to rotate through: hide the control rather than show a dead one
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

  Viewer.prototype.goTo = function (i) {
    this.pos = mod(i, this.count);
    this.render();
  };

  Viewer.prototype.stageWidth = function () {
    if (this.stage) {
      var w = this.stage.getBoundingClientRect().width;
      if (w > 0) return w;
    }
    return 560;
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
        self.lastX = pointX(e);
        self.lastT = performance.now();
        self.velocity = 0;
        self.perFrame = pxPerFrame(self.count, self.stageWidth());
        self.dragStartIndex = self.index;
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
        // Keep drifting in the drag direction, then settle on a real frame.
        // The loop multiplies `fling` by FLING_DECAY each frame, so the total
        // distance travelled is fling / (1 - FLING_DECAY) — ten times the
        // starting value. Seed it from the intended coast distance instead of
        // from raw velocity, or a small gesture coasts far too far.
        var framesPerMs = Math.abs(self.velocity) / self.perFrame;
        var coast = Math.min(framesPerMs * 260, MAX_COAST);
        var seed = coast * (1 - FLING_DECAY);
        self.fling = self.velocity < 0 ? seed : -seed;
        // A product with two angles has no room to coast past its neighbour.
        var cap = Math.min(MAX_COAST, self.count - 1) * (1 - FLING_DECAY);
        self.fling = Math.max(-cap, Math.min(cap, self.fling));
        self.flingDir = self.velocity > 0 ? -1 : 1;
        if (reduced || Math.abs(self.fling) < 0.001) {
          self.fling = 0;
          self.settle();
          self.finishDrag();
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
        if (e.key === 'ArrowLeft') {
          self.taken = true; self.fling = 0;
          self.goTo(Math.round(self.pos) - 1);
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          self.taken = true; self.fling = 0;
          self.goTo(Math.round(self.pos) + 1);
          e.preventDefault();
        } else if (e.key === 'Home') {
          self.taken = true; self.fling = 0; self.goTo(0); e.preventDefault();
        } else if (e.key === 'End') {
          self.taken = true; self.fling = 0; self.goTo(self.count - 1); e.preventDefault();
        }
      });

      // the slider is the primary control; dragging the photo also works
      if (this.slider) {
        this.slider.addEventListener('input', function () {
          self.taken = true;
          self.fling = 0;
          self.pos = Number(self.slider.value) || 0;
          self.render();
        });
      }
    }
  };

  Viewer.prototype.settle = function () {
    this.pos = Math.round(mod(this.pos, this.count));
    this.render();
  };

  /**
   * A drag that ends on the frame it started from reads as a viewer that does
   * not work — most likely on a two-angle product, where one revolution is a
   * single frame. If the shopper clearly dragged at least a full angle and
   * landed back where they began, step one frame the way they were heading.
   */
  Viewer.prototype.finishDrag = function () {
    if (this.dragFrames < 0.5) return;
    if (this.count < 2) return;
    if (mod(Math.round(this.pos), this.count) !== this.dragStartIndex) {
      this.dragFrames = 0;
      return;
    }
    var dir = this.flingDir || 1;
    this.pos = mod(Math.round(this.pos) + dir, this.count);
    this.dragFrames = 0;
    this.render();
  };

  Viewer.prototype.autospin = function () {
    // Opt-in, and only on the hero: a slow turn shows the product is
    // interactive. Product pages stay still until the shopper moves them.
    if (reduced || this.count < 2) return;
    if (!this.root.hasAttribute('data-autospin')) return;

    var self = this;
    var timer = setInterval(function () {
      if (self.taken || self.dragging) { clearInterval(timer); return; }
      self.pos = mod(Math.round(self.pos) + 1, self.count);
      self.render();
    }, 2800);

    this.stopAutospin = function () { clearInterval(timer); };
    this.root.addEventListener('mouseenter', function () { self.taken = true; clearInterval(timer); });
    this.root.addEventListener('focusin', function () { self.taken = true; clearInterval(timer); });
  };

  Viewer.prototype.loop = function () {
    var self = this;
    function tick() {
      if (self.fling) {
        self.pos = mod(self.pos + self.fling, self.count);
        self.fling *= FLING_DECAY;
        if (Math.abs(self.fling) < FLING_STOP) {
          self.fling = 0;
          self.settle();
          self.finishDrag();
        } else self.render();
      }
      self.raf = requestAnimationFrame(tick);
    }
    if (!reduced && this.count > 1) this.raf = requestAnimationFrame(tick);
  };

  Viewer.prototype.render = function (initial) {
    if (!this.frames.length) return;

    var i = mod(Math.round(this.pos), this.count);
    var f = this.frames[i];

    if (f && this.currentSrc !== f.src) {
      this.img.setAttribute('src', f.src);
      this.currentSrc = f.src;
    }
    this.index = i;

    // No transform is applied to the image. Any rotate/scale here would
    // distort the artwork rather than show a different angle.
    if (this.img) {
      var base = this.root.getAttribute('data-alt') || '';
      var label = f && f.label;
      this.img.setAttribute('alt', label ? base + ' — ' + label : base);
    }

    if (this.counter) {
      var text = (f && f.label) || '';
      if (text) { this.counter.textContent = text; this.counter.removeAttribute('hidden'); }
      else this.counter.setAttribute('hidden', '');
    }

    if (this.slider && this.count > 1) {
      if (Number(this.slider.value) !== i) this.slider.value = String(i);
      var name = (f && f.label) || ('Angle ' + (i + 1));
      this.slider.setAttribute('aria-valuetext', name + ' (' + (i + 1) + ' of ' + this.count + ')');
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
        // signals CSS whether there is anything to rotate
        if (v.count > 1) nodes[i].classList.add('has-frames');
        v.loop();
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

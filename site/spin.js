/*!
 * Habibi Crafts Co — product spin viewer
 *
 * Drag-to-rotate product viewer. Frames come from the Printful mockup
 * generator (front, handle-left, handle-right, ...).
 *
 * Printful gives only 2-6 stills per product, which is far short of the
 * 36+ frames a real 360 capture needs. So the viewer keeps a continuous
 * rotation angle and maps it onto the frames, applying the leftover
 * fraction as a live rotateY offset. The result reads as one smooth spin
 * instead of a slideshow between stills.
 *
 * Progressive enhancement: without JS the markup shows a plain <img>.
 */
(function () {
  'use strict';

  var supportsHover = window.matchMedia('(hover:hover)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DRAG_DEG_PER_PX = 0.55;   // how fast a drag turns the product
  var FLING_DECAY = 0.94;
  var FLING_STOP = 0.06;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function mod(n, m) { return ((n % m) + m) % m; }

  function SpinViewer(root) {
    this.root = root;
    this.stage = root.querySelector('[data-spin-stage]');
    this.img = root.querySelector('[data-spin-image]');
    this.hint = root.querySelector('[data-spin-hint]');
    this.rail = root.querySelector('[data-spin-rail]');
    this.counter = root.querySelector('[data-spin-counter]');

    this.frames = [];
    var raw = root.getAttribute('data-frames');
    if (raw) {
      try { this.frames = JSON.parse(raw) || []; } catch (e) { this.frames = []; }
    }
    if (!this.frames.length && this.img) {
      this.frames = [{ src: this.img.getAttribute('src'), label: 'Front' }];
    }

    this.count = this.frames.length;
    this.step = 360 / Math.max(this.count, 1);   // degrees per frame
    this.angle = 0;                              // continuous rotation
    this.extra = 0;                              // fractional offset applied as rotateY
    this.tiltX = 0;
    this.tiltY = 0;
    this.scale = 1;
    this.index = 0;
    this.dragging = false;
    this.hasSpun = false;
    this.velocity = 0;
    this.lastX = 0;
    this.lastT = 0;
    this.fling = 0;
    this.raf = null;
    this.currentSrc = null;

    this.buildRail();
    this.preload();
    this.bind();
    this.sync(true);
    this.loop();
  }

  SpinViewer.prototype.buildRail = function () {
    if (!this.rail || this.count < 2) return;
    var self = this;
    this.frames.forEach(function (f, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'spin-dot';
      b.setAttribute('aria-label', 'View ' + (f.label || ('angle ' + (i + 1))));
      b.addEventListener('click', function (e) {
        e.preventDefault();
        self.hasSpun = true;
        self.fling = 0;
        self.angle = i * self.step;   // snap exactly onto the frame
        self.extra = 0;
        self.sync();
      });
      self.rail.appendChild(b);
    });
  };

  SpinViewer.prototype.preload = function () {
    this.frames.forEach(function (f) {
      var im = new Image();
      im.decoding = 'async';
      im.src = f.src;
    });
  };

  SpinViewer.prototype.setAngle = function (deg) {
    this.angle = mod(deg, 360);
    this.sync();
  };

  SpinViewer.prototype.bind = function () {
    var self = this;
    if (!this.stage) return;

    function pointX(e) {
      return (e.touches && e.touches.length) ? e.touches[0].clientX : e.clientX;
    }

    // ---- single-frame products: pointer tilt instead of rotation ----
    // Flat prints (posters) only ever get one Printful placement, so a spin
    // would have nothing to show. A subtle 3D tilt still gives them depth.
    if (this.count < 2) {
      if (!supportsHover || reduced) return;
      this.root.classList.add('is-tilt');
      var stage = this.stage;
      stage.addEventListener('mousemove', function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        self.tiltY = clamp(px * 20, -14, 14);
        self.tiltX = clamp(py * 16, -11, 11);
        self.scale = 1.02;
        self.sync();
      });
      stage.addEventListener('mouseleave', function () {
        self.tiltX = 0; self.tiltY = 0; self.scale = 1; self.sync();
      });
      return;
    }

    function down(e) {
      if (self.count < 2) return;
      self.dragging = true;
      self.hasSpun = true;
      self.fling = 0;
      self.lastX = pointX(e);
      self.lastT = performance.now();
      self.velocity = 0;
      self.root.classList.add('is-dragging');
      if (self.hint) self.hint.classList.remove('is-visible');
      if (e.cancelable) e.preventDefault();
    }

    function move(e) {
      if (!self.dragging) return;
      var x = pointX(e);
      var now = performance.now();
      var dt = Math.max(now - self.lastT, 1);
      var dx = x - self.lastX;
      self.velocity = dx / dt;
      self.lastX = x;
      self.lastT = now;

      self.angle = mod(self.angle + dx * DRAG_DEG_PER_PX, 360);

      // slight vertical tilt following the pointer reads as depth
      var r = self.stage.getBoundingClientRect();
      self.tiltY = clamp(((x - r.left) / r.width - 0.5) * 16, -12, 12);
      self.sync();
      if (e.cancelable) e.preventDefault();
    }

    function up() {
      if (!self.dragging) return;
      self.dragging = false;
      self.root.classList.remove('is-dragging');
      // carry momentum in the drag direction
      self.fling = -self.velocity * 26;
      if (reduced || Math.abs(self.fling) < 8) self.fling = 0;
    }

    this.stage.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    this.stage.addEventListener('touchstart', down, { passive: false });
    this.stage.addEventListener('touchmove', move, { passive: false });
    this.stage.addEventListener('touchend', up);
    this.stage.addEventListener('touchcancel', up);

    this.stage.setAttribute('tabindex', '0');
    this.stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        self.hasSpun = true; self.fling = 0;
        self.angle = mod(Math.round(self.angle / self.step) * self.step - self.step, 360);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        self.hasSpun = true; self.fling = 0;
        self.angle = mod(Math.round(self.angle / self.step) * self.step + self.step, 360);
        e.preventDefault();
      } else if (e.key === 'Home') {
        self.hasSpun = true; self.fling = 0; self.angle = 0; e.preventDefault();
      } else if (e.key === 'End') {
        self.hasSpun = true; self.fling = 0;
        self.angle = (self.count - 1) * self.step; e.preventDefault();
      }
    });

    // idle drift until the shopper takes over
    if (supportsHover && !reduced && this.count > 1) {
      var idle = null;
      var startIdle = function () {
        if (idle || self.hasSpun) return;
        idle = setInterval(function () {
          if (self.hasSpun || self.dragging) { clearInterval(idle); idle = null; return; }
          self.angle = mod(self.angle + self.step, 360);
        }, 2600);
      };
      var stopIdle = function () { if (idle) { clearInterval(idle); idle = null; } };
      startIdle();
      this.root.addEventListener('mouseenter', stopIdle);
      this.root.addEventListener('mouseleave', startIdle);
      this.root.addEventListener('focusin', stopIdle);
    }
  };

  SpinViewer.prototype.loop = function () {
    var self = this;
    function tick() {
      if (self.fling) {
        self.angle = mod(self.angle + self.fling * 0.06, 360);
        self.fling *= FLING_DECAY;
        if (Math.abs(self.fling) < FLING_STOP) self.fling = 0;
      }
      // ease tilt back to level, and scale back to rest, when not dragging
      if (!self.dragging) {
        self.tiltY += (0 - self.tiltY) * 0.1;
        self.scale += (1 - self.scale) * 0.12;
      }
      self.sync();
      self.raf = requestAnimationFrame(tick);
    }
    if (reduced) return;              // no animation loop; static frames only
    this.raf = requestAnimationFrame(tick);
  };

  SpinViewer.prototype.sync = function (initial) {
    if (!this.frames.length) return;

    // nearest frame for the current angle
    var i = mod(Math.round(this.angle / this.step), this.count);
    var snapped = i * this.step;
    // leftover degrees become a live rotateY so motion stays continuous
    var diff = this.angle - snapped;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    this.extra = diff;
    this.index = i;

    var f = this.frames[i];
    if (f && this.currentSrc !== f.src) {
      this.img.setAttribute('src', f.src);
      this.currentSrc = f.src;
    }
    if (this.img) {
      var s = this.dragging ? 1.015 : this.scale;
      this.img.style.transform =
        'rotateY(' + (this.extra * 0.5 + this.tiltY * 0.35).toFixed(2) + 'deg) ' +
        'rotateX(' + (-this.tiltX).toFixed(2) + 'deg) ' +
        'scale(' + s.toFixed(3) + ')';
      var label = (f && f.label) || ('View ' + (i + 1));
      this.img.setAttribute('alt', (this.root.getAttribute('data-alt') || '') +
        (this.count > 1 ? ' — ' + label : ''));
    }
    if (this.counter && f) this.counter.textContent = f.label || ('View ' + (i + 1));
    if (this.rail) {
      for (var k = 0; k < this.rail.children.length; k++) {
        var d = this.rail.children[k];
        var on = k === i;
        d.classList.toggle('is-active', on);
        if (on) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      }
    }
    if (initial && this.hint && this.count > 1 && supportsHover) {
      this.hint.classList.add('is-visible');
    }
  };

  function boot() {
    var nodes = document.querySelectorAll('[data-spin]');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__spin) nodes[i].__spin = new SpinViewer(nodes[i]);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

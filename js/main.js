/* =====================================================================
   ALISO VEIJO — interactions
   Vanilla ES6+, no dependencies. One rAF-throttled scroll loop;
   everything else is IntersectionObserver-driven.
   ===================================================================== */
(() => {
  'use strict';

  window.AV_READY = true;

  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionQuery.matches;
  motionQuery.addEventListener?.('change', (e) => { reduceMotion = e.matches; });

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  /* ---------------- Footer year ---------------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------------- Split headings into masked words ---------------- */
  let wordIndex = 0;
  const splitNode = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/([ \t\n\r]+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          const inner = document.createElement('span');
          outer.className = 'w';
          inner.textContent = part;
          inner.style.setProperty('--wi', String(wordIndex++));
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        splitNode(child);
      }
    });
  };
  $$('[data-split]').forEach((el) => { wordIndex = 0; splitNode(el); });

  /* ---------------- Statement word-fill: wrap words ---------------- */
  const fillEl = $('[data-fill]');
  let fillWords = [];
  if (fillEl) {
    const words = fillEl.textContent.trim().split(/[ \t\n\r]+/);
    fillEl.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'fw';
      span.textContent = word;
      fillEl.appendChild(span);
      if (i < words.length - 1) fillEl.appendChild(document.createTextNode(' '));
    });
    fillWords = $$('.fw', fillEl);
  }

  /* ---------------- Scroll reveals ---------------- */
  const revealTargets = $$('[data-reveal], [data-split], [data-reveal-img]');

  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      let batch = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.hasAttribute('data-reveal')) el.style.setProperty('--i', String(batch++));
        el.classList.add('is-in');
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ---------------- Count-up figures ---------------- */
  const counters = $$('[data-count]');
  const formatNumber = (n) => n.toLocaleString('en-GB');

  const runCounter = (el) => {
    const target = Number(el.dataset.count);
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const t = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(2, -10 * t);
      el.textContent = formatNumber(Math.round(target * (t === 1 ? 1 : eased)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    counters.forEach((el) => { el.textContent = '0'; });
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => countObserver.observe(el));
  }


  // Premium smooth scrolling
  if (typeof Lenis !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const lenis = new Lenis({
      duration: 1.35,
      smoothWheel: true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.0,
    });

    const animateScroll = (time) => {
      lenis.raf(time);
      requestAnimationFrame(animateScroll);
    };
    requestAnimationFrame(animateScroll);
  }

  /* ---------------- Header state + parallax + word-fill (one loop) ---------------- */
  const header = $('#site-header');
  const parallaxEls = $$('[data-parallax]:not(.portraits__frame)');
  const visibleParallax = new Set();
  let lastY = window.scrollY;
  let ticking = false;
  let menuOpen = false;

  if ('IntersectionObserver' in window) {
    const pObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visibleParallax.add(e.target) : visibleParallax.delete(e.target)));
    }, { rootMargin: '10% 0px' });
    parallaxEls.forEach((el) => pObserver.observe(el.parentElement));
  }

  const updateHeader = (y) => {
    header.classList.toggle('is-scrolled', y > 40);
    const delta = y - lastY;
    if (Math.abs(delta) < 6) return;
    const focusInHeader = header.contains(document.activeElement);
    if (delta > 0 && y > 480 && !menuOpen && !focusInHeader) header.classList.add('is-hidden');
    else if (delta < 0) header.classList.remove('is-hidden');
    lastY = y;
  };

  const updateParallax = () => {
    if (reduceMotion) return;
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      if (!visibleParallax.has(el.parentElement)) return;
      const rect = el.parentElement.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - vh / 2) * Number(el.dataset.parallax);
      el.style.transform = `translate3d(0, ${clamp(offset, -35, 35).toFixed(1)}px, 0)`;
    });
  };

  let litCount = -1;
  const updateFill = () => {
    if (!fillEl) return;
    const vh = window.innerHeight;
    const rect = fillEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
    const progress = reduceMotion ? 1 : clamp((vh * 0.85 - rect.top) / (rect.height + vh * 0.3), 0, 1);
    const count = Math.round(progress * fillWords.length);
    if (count === litCount) return;
    fillWords.forEach((w, i) => w.classList.toggle('is-lit', i < count));
    litCount = count;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      updateHeader(y);
      updateParallax();
      updateFill();
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  onScroll();

  /* ---------------- Menu overlay ---------------- */
  const menu = $('#menu');
  const openBtn = $('#menu-open');
  const closeBtn = $('#menu-close');
  const backgroundRegions = [header, $('#main'), $('#footer')];

  const focusables = () => $$('a[href], button:not([disabled])', menu);

  const openMenu = () => {
    menuOpen = true;
    const scrollbar = window.innerWidth - root.clientWidth;
    document.body.style.paddingRight = scrollbar ? `${scrollbar}px` : '';
    document.body.classList.add('is-locked');
    menu.classList.add('is-open');
    openBtn.setAttribute('aria-expanded', 'true');
    backgroundRegions.forEach((el) => { el.inert = true; });
    requestAnimationFrame(() => closeBtn.focus());
  };

  const closeMenu = (restoreFocus = true) => {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    openBtn.setAttribute('aria-expanded', 'false');
    backgroundRegions.forEach((el) => { el.inert = false; });
    document.body.classList.remove('is-locked');
    document.body.style.paddingRight = '';
    if (restoreFocus) openBtn.focus({ preventScroll: true });
  };

  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', () => closeMenu());
  $$('.menu__list a', menu).forEach((link) => link.addEventListener('click', () => closeMenu(false)));

  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------------- Accordion ---------------- */
  const triggers = $$('.acc__trigger');

  const setExpanded = (trigger, expanded) => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    trigger.setAttribute('aria-expanded', String(expanded));
    panel.classList.toggle('is-collapsed', !expanded);
  };

  triggers.forEach((trigger, index) => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    $$('.tech li', panel).forEach((li, i) => li.style.setProperty('--i', String(i)));
    setExpanded(trigger, index === 0);

    trigger.addEventListener('click', () => {
      setExpanded(trigger, trigger.getAttribute('aria-expanded') !== 'true');
    });

    trigger.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: triggers.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      triggers[(keys[e.key] + triggers.length) % triggers.length].focus();
    });
  });

  /* ---------------- Approach steps: scroll-linked highlight ---------------- */
  const steps = $$('[data-step]');
  const approach = $('.approach');
  if (steps.length && 'IntersectionObserver' in window) {
    const stepObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = steps.indexOf(entry.target);
        steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
        approach.style.setProperty('--progress', String((idx + 1) / steps.length));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => stepObserver.observe(s));
  } else {
    steps.forEach((s) => s.classList.add('is-active'));
  }

  /* ---------------- Active nav link ---------------- */
  const navLinks = $$('.nav-inline a');
  const navMap = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        const link = navMap.get(entry.target.id);
        if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'location'); }
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => navObserver.observe(s));
  }

  /* ---------------- Contact form: design placeholder only ---------------- */
  const form = $('#contact-form');
  const notice = $('#form-notice');
  if (form && notice) {
    const fields = $$('input, textarea', form);
    const markValidity = () => fields.forEach((f) => f.setAttribute('aria-invalid', String(!f.validity.valid)));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.classList.add('was-validated');
      markValidity();
      if (!form.checkValidity()) {
        notice.hidden = true;
        form.reportValidity();
        return;
      }
      notice.hidden = false;
      notice.focus({ preventScroll: true });
      notice.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    });

    form.addEventListener('input', () => {
      if (form.classList.contains('was-validated')) markValidity();
    });
  }
})();

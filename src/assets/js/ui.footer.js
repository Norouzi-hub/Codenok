/*
 * پانویس نوکمان، و پنجرهٔ «دربارهٔ نوکمان».
 *
 * پانویس یک نوار باریک است، به رنگ نوار بالا، تا قاب صفحه بسته شود — نه
 * یک بخشِ بلند که جای پرونده‌ها را بگیرد. حرکتش آرام است و از جهانِ خودِ
 * برنامه می‌آید: مُهری که دورش می‌چرخد، شعاعی از برنج که روی لبهٔ بالا
 * می‌گذرد، و برقی که گاه‌به‌گاه از روی نام سازنده رد می‌شود.
 *
 * مُهر را که بزنید، «دربارهٔ نوکمان» باز می‌شود: همان مُهر، بزرگ، با
 * نوشته‌ای که دورش می‌گردد.
 *
 * داده‌ها از brand.js می‌آیند. همهٔ حرکت‌ها تابع تنظیم «انیمیشن‌ها» هستند.
 */
(function (w) {
  'use strict';

  var el = w.U.el;
  var SVG = 'http://www.w3.org/2000/svg';

  function B() { return w.BRAND || {}; }
  function fa(s) { return w.U.toFaDigits(String(s)); }

  function svg(tag, attrs, kids) {
    var n = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /** «© ۱۴۰۴–۱۴۰۵»: از سالِ شروع تا امسال */
  function years() {
    var now = Number(String(w.J.today()).slice(0, 4)) || 0;
    var since = Number(B().since) || now;
    return since && since < now ? fa(since) + '–' + fa(now) : fa(now || since);
  }

  /** شماره برای نمایش (۰۹۱۲ ۰۰۰ ۰۰۰۰) و برای tel: (لاتین، بی‌فاصله) */
  function phoneParts() {
    var raw = w.U.toLatinDigits(String(B().phone || '')).replace(/[^\d+]/g, '');
    if (!raw) return null;
    var shown = raw.length === 11
      ? raw.slice(0, 4) + ' ' + raw.slice(4, 7) + ' ' + raw.slice(7)
      : raw;
    return { tel: 'tel:' + raw, text: fa(shown) };
  }

  function siteParts() {
    var s = String(B().site || '').trim();
    if (!s) return null;
    var href = /^https?:\/\//i.test(s) ? s : 'https://' + s;
    var text = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
    // نامِ سایت با حرفِ بزرگ آغاز می‌شود: Hosseinnorouzi.com
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return { href: href, text: text };
  }

  /* --------------------------------------------------------- نمادها */
  function icon(kind) {
    var paths = {
      phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
      globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.95a15.6 15.6 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82A13.9 13.9 0 0 1 12 4.04zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.84 2h2.95c.32 1.25.78 2.45 1.38 3.56A8 8 0 0 1 5.1 16zm2.95-8H5.1a8 8 0 0 1 4.33-3.56A15.6 15.6 0 0 0 8.05 8zM12 19.96A14 14 0 0 1 10.09 16h3.82A14 14 0 0 1 12 19.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38z'
    };
    return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'ft-ico ft-ico-' + kind },
      [svg('path', { d: paths[kind], fill: 'currentColor' })]);
  }

  /** مُهر: حلقهٔ نقطه‌چینِ چرخان، حرفِ «ن» و ماهواره‌ای که دورش می‌گردد */
  function seal(size, ring) {
    var id = 'ft-ring-' + Math.random().toString(36).slice(2, 8);
    var kids = [
      svg('circle', { class: 'sl-halo', cx: 50, cy: 50, r: 47 }),
      svg('circle', { class: 'sl-dash', cx: 50, cy: 50, r: 41 }),
      svg('circle', { class: 'sl-core', cx: 50, cy: 50, r: ring ? 27 : 30 }),
      svg('g', { class: 'sl-orbit' }, [svg('circle', { class: 'sl-sat', cx: 50, cy: 3, r: 3.2 })])
    ];
    if (ring) {
      // نوشته‌ای که دور مُهر می‌گردد — فقط در اندازهٔ بزرگ خوانا است
      kids.push(svg('defs', {}, [svg('path', {
        id: id, d: 'M50,50 m-33.5,0 a33.5,33.5 0 1,1 67,0 a33.5,33.5 0 1,1 -67,0'
      })]));
      /* متنِ راست‌به‌چپ روی مسیر، با لنگرِ «start» در کروم از مسیر بیرون
         می‌افتد و دیده نمی‌شود؛ لنگرِ «middle» به جهت بستگی ندارد. */
      var text = svg('text', { class: 'sl-ring', 'text-anchor': 'middle' });
      var tp = svg('textPath', { href: '#' + id, startOffset: '50%' });
      tp.textContent = ring;
      text.appendChild(tp);
      kids.push(svg('g', { class: 'sl-spin' }, [text]));
    }
    var mark = svg('text', { class: 'sl-mark', x: 50, y: 50, 'text-anchor': 'middle',
      'dominant-baseline': 'central' });
    mark.textContent = 'ن';
    kids.push(mark);
    return svg('svg', { class: 'seal' + (ring ? ' seal-big' : ''), viewBox: '0 0 100 100',
      width: size, height: size, 'aria-hidden': 'true' }, kids);
  }

  function chip(kind, href, text, title) {
    var a = el('a.ft-chip.ft-' + kind, { href: href, title: title, dir: 'ltr' }, [
      icon(kind === 'site' ? 'globe' : 'phone'),
      el('span.ft-chip-t', { text: text })
    ]);
    if (kind === 'site') { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  /* ---------------------------------------------------------- پانویس */
  function build(app) {
    var b = B(), ph = phoneParts(), st = siteParts();
    var sealBtn = el('button.ft-seal', {
      type: 'button', title: 'دربارهٔ ' + (b.app || 'نوکمان'),
      onclick: function () { about(app); }
    }, [seal(30)]);

    return el('footer.app-footer', { role: 'contentinfo' }, [
      el('span.ft-comet', { 'aria-hidden': 'true' }),
      sealBtn,
      el('div.ft-copy', null, [
        el('span.ft-c', { text: '©' }),
        el('span.ft-year', { text: years() }),
        el('b.ft-app', { text: b.app || 'نوکمان' }),
        el('span.ft-sep', { 'aria-hidden': 'true' }),
        el('span.ft-by', { text: (b.role || 'طراحی و توسعه') + ':' }),
        el('button.ft-owner', {
          type: 'button', text: b.owner || '',
          onclick: function () { about(app); }
        }),
        el('span.ft-rights', { text: 'تمام حقوق محفوظ است.' })
      ]),
      el('div.spacer'),
      el('div.ft-links', null, [
        ph ? chip('phone', ph.tel, ph.text, 'تماس') : null,
        st ? chip('site', st.href, st.text, 'سایت') : null
      ])
    ]);
  }

  function mount(app) {
    var node = build(app);
    var tabbar = document.querySelector('.tabbar');
    if (tabbar) document.body.insertBefore(node, tabbar);
    else document.body.appendChild(node);
    return node;
  }

  /* ------------------------------------------------- دربارهٔ نوکمان */
  function about(app) {
    var b = B(), ph = phoneParts(), st = siteParts();
    // دو بار، تا دور تا دورِ مُهر پر شود
    var once = (b.app || 'نوکمان') + ' • ' + (b.tagline || '') + ' • ';
    var ring = once + once;
    var body = el('div.about-card', null, [
      el('div.about-seal', null, [seal(168, ring)]),
      el('h2.about-app', { text: b.app || 'نوکمان' }),
      el('p.about-tag', { text: b.tagline || '' }),
      el('div.about-rule', { 'aria-hidden': 'true' }),
      el('p.about-role', { text: b.role || 'طراحی و توسعه' }),
      el('p.about-owner', { text: b.owner || '' }),
      el('div.about-links', null, [
        ph ? chip('phone', ph.tel, ph.text, 'تماس') : null,
        st ? chip('site', st.href, st.text, 'سایت') : null
      ]),
      el('p.about-copy', {
        text: '© ' + years() + ' ' + (b.owner || '') + ' — تمام حقوق این نرم‌افزار محفوظ است.'
      })
    ]);
    var m = w.U.modal('دربارهٔ ' + (b.app || 'نوکمان'), body, [
      el('button.btn', { type: 'button', text: 'بستن', onclick: function () { m.close(); } })
    ]);
    m.root.classList.add('about-modal');
    return m;
  }

  w.UIFooter = {
    mount: mount, about: about, years: years, seal: seal,
    /** همان نوار، برای صفحه‌های ورود (بی‌نیاز به app) */
    strip: function () { var n = build(null); n.classList.add('gate-footer'); return n; }
  };
})(window);

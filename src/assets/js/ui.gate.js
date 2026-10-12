/*
 * دروازهٔ نوکمان — قابِ مشترکِ صفحه‌های ورود.
 *
 * دو صفحه از اینجا رد می‌شوند: «رمز را بده» (قفل) و «دیتابیس کجاست»
 * (شروع). هر دو همان زبانِ پانویس را دارند: جوهرِ سرمه‌ای، برنجِ مُهر،
 * و حرکت‌هایی آرام که چشم را خسته نمی‌کنند.
 *
 *   سمتِ نام — مُهرِ بزرگ با نوشته‌ای که دورش می‌گردد، «نوکمان» با برقی
 *              که از رویش می‌گذرد، و تاریخِ امروز.
 *   سمتِ کار — همان کارتِ سفیدِ همیشگی (رمز، یا گزینه‌های دیتابیس).
 *   پایین    — همان نوارِ پانویس: حق نشر، سازنده، تماس و سایت.
 *   پس‌زمینه — خط‌کشیِ دفترِ اندیکاتور که آرام می‌لغزد، و مُهری بزرگ و
 *              کم‌رنگ که بسیار آهسته می‌چرخد.
 *
 * همهٔ حرکت‌ها تابع تنظیم «انیمیشن‌ها» هستند.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J;

  function B() { return w.BRAND || {}; }

  function todayLong() {
    var t = J.today(), p = J.unpack(t);
    return p ? J.weekday(p.jy, p.jm, p.jd) + '، ' + J.format(t, { long: true }) : '';
  }

  /** نام برنامه، حرف‌به‌حرف، تا هر حرف با کمی فاصله از قبلی بالا بیاید */
  function title(text) {
    var h = el('h1.gate-title', { 'aria-label': text });
    /* حرف‌های فارسی به هم می‌چسبند؛ جدا کردنشان در span شکل‌شان را
       می‌شکند. پس کل واژه یک تکه است و فقط برق از رویش می‌گذرد. */
    h.appendChild(el('span.gate-title-word', { text: text }));
    return h;
  }

  /**
   * shell(card, opts)
   *   card       — کارتِ کار (lock-box یا start-box)
   *   opts.cls   — کلاسِ صفحه (lock-screen یا start-screen)
   *   opts.kicker — یک سطرِ کوچک بالای نام («ورود امن»، «آغاز کار»)
   */
  function shell(card, opts) {
    opts = opts || {};
    var b = B();
    var ring = (b.app || 'نوکمان') + ' • ' + (b.tagline || '') + ' • ';

    var brand = el('section.gate-brand', null, [
      el('div.gate-seal', null, [w.UIFooter.seal(220, ring + ring)]),
      el('div.gate-words', null, [
        opts.kicker ? el('span.gate-kicker', { text: opts.kicker }) : null,
        title(b.app || 'نوکمان'),
        el('p.gate-tag', { text: b.tagline || '' }),
        el('div.gate-rule', { 'aria-hidden': 'true' }),
        el('p.gate-date', { text: todayLong() })
      ])
    ]);

    card.classList.add('gate-card');
    var stage = el('div.gate-stage', null, [brand, el('section.gate-work', null, [card])]);

    var screen = el('div.gate.' + (opts.cls || 'gate-screen'), null, [
      el('div.gate-bg', { 'aria-hidden': 'true' }, [
        el('div.gate-lines'),
        el('div.gate-glow'),
        el('div.gate-mark', null, [w.UIFooter.seal(760)])
      ]),
      stage,
      w.UIFooter.strip()
    ]);
    return screen;
  }

  /** لرزشِ کوتاه کارت — برای رمزِ نادرست */
  function shake(card) {
    card.classList.remove('is-shake');
    void card.offsetWidth;          // تا انیمیشن دوباره از اول اجرا شود
    card.classList.add('is-shake');
  }

  w.UIGate = { shell: shell, shake: shake };
})(window);

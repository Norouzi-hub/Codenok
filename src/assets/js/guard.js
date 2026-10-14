/*
 * نگهبانِ صفحهٔ سفید. اولین اسکریپتی است که اجرا می‌شود.
 *
 * برنامه از چند ده فایل ساخته شده که کنار index.html در پوشهٔ assets
 * نشسته‌اند. اگر یکی‌شان نرسد — زیپ کامل باز نشده، index.html تنها به جای
 * دیگری کپی شده، یا (در نسخهٔ تک‌فایلی) دانلود نصفه مانده — مرورگر یک صفحهٔ
 * کاملاً سفید نشان می‌دهد، بدون هیچ پیامی.
 *
 * این فایل دو چیز را می‌پاید: خطای بارگذاریِ هر اسکریپت یا استایل، و
 * رسیدنِ آخرین اسکریپت (ready.js). اگر هرکدام کم باشد، به‌جای سفیدی
 * می‌گوید چه شده و چه باید کرد.
 */
(function () {
  'use strict';

  var missing = [];

  // خطای بارگذاریِ منابع حباب نمی‌زند؛ فقط در فاز capture دیده می‌شود
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t === window) return;
    var url = t.src || t.href;
    if (url && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
      missing.push(decodeURIComponent(String(url).split('/').slice(-2).join('/')));
    }
  }, true);

  function box(title, lines) {
    var s = document.createElement('div');
    s.className = 'boot-guard';
    s.setAttribute('style', 'max-width:600px;margin:60px auto;padding:22px 24px;' +
      'font:14px/2 Tahoma,sans-serif;direction:rtl;text-align:right;color:#2B2B2B;' +
      'border:1px solid #EFCCC5;background:#FCEFEC;border-radius:10px');
    var h = document.createElement('h2');
    h.setAttribute('style', 'margin:0 0 8px;font-size:17px;color:#B4482F');
    h.textContent = title;
    s.appendChild(h);
    lines.forEach(function (l) {
      var p = document.createElement('p');
      p.setAttribute('style', 'margin:0 0 6px');
      p.textContent = l;
      s.appendChild(p);
    });
    document.body.insertBefore(s, document.body.firstChild);
  }

  window.addEventListener('load', function () {
    var multi = !!document.querySelector('script[src]');
    if (missing.length) {
      box('بعضی از فایل‌های برنامه پیدا نشد', [
        'برنامهٔ نوکمان از فایل index.html و پوشهٔ assets کنارش ساخته شده و ' +
          'این فایل‌ها به دستش نرسید: ' + missing.slice(0, 4).join('، ') +
          (missing.length > 4 ? ' و…' : ''),
        'اگر برنامه را از فایل زیپ باز کرده‌اید، اول زیپ را کامل باز کنید ' +
          '(راست‌کلیک ← Extract All) و بعد index.html را از پوشهٔ بازشده ' +
          'اجرا کنید. پوشهٔ assets باید کنار index.html بماند.',
        'داده‌های شما در این فایل‌ها نیستند و دست‌نخورده‌اند.'
      ]);
      return;
    }
    if (window.__BUILD_COMPLETE) return;
    box('فایل برنامه ناقص است', multi ? [
      'آخرین فایل برنامه بارگذاری نشد، برای همین برنامه بالا نمی‌آید.',
      'زیپ را دوباره و کامل باز کنید و index.html را از همان پوشه اجرا کنید. ' +
        'داده‌های شما در این فایل‌ها نیستند و دست‌نخورده‌اند.'
    ] : [
      'این فایل کامل منتقل نشده است، برای همین برنامه بالا نمی‌آید و صفحه ' +
        'سفید می‌ماند.',
      'دوباره دانلودش کنید و صبر کنید تا دانلود تمام شود؛ حجم فایل حدود ' +
        '۲ مگابایت است. داده‌های شما در این فایل نیستند و دست‌نخورده‌اند.'
    ]);
  });
})();

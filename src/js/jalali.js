/* تبدیل و قالب‌بندی تاریخ هجری شمسی (الگوریتم jalaali) */
(function (w) {
  'use strict';

  var BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var WEEKDAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }

  function jalCal(jy, withoutLeap) {
    var bl = BREAKS.length, gy = jy + 621, leapJ = -14, jp = BREAKS[0];
    var jm, jump, leap, leapG, march, n, i;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی نامعتبر: ' + jy);
    for (i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (!withoutLeap) {
      if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
      leap = mod(mod(n + 1, 33) - 1, 4);
      if (leap === -1) leap = 4;
    }
    return { leap: leap, gy: gy, march: march };
  }

  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
      div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  }

  function d2g(jdn) {
    var j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    var i = div(mod(j, 1461), 4) * 5 + 308;
    var gd = div(mod(i, 153), 5) + 1;
    var gm = mod(div(i, 153), 12) + 1;
    var gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy: gy, gm: gm, gd: gd };
  }

  function j2d(jy, jm, jd) {
    var r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    var gy = d2g(jdn).gy, jy = gy - 621, r = jalCal(jy, false);
    var jdn1f = g2d(gy, 3, r.march), jd, jm, k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) return { jy: jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  function isLeap(jy) { return jalCal(jy, false).leap === 0; }

  function monthLength(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeap(jy) ? 30 : 29;
  }

  function toJalali(date) {
    return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
  }

  function toGregorian(jy, jm, jd) {
    var g = d2g(j2d(jy, jm, jd));
    return new Date(g.gy, g.gm - 1, g.gd);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** {jy,jm,jd} یا YYYYMMDD -> رشتهٔ ۸ رقمی */
  function pack(jy, jm, jd) { return String(jy) + pad2(jm) + pad2(jd); }

  function unpack(s) {
    s = String(s || '');
    if (!/^\d{8}$/.test(s)) return null;
    var jy = +s.slice(0, 4), jm = +s.slice(4, 6), jd = +s.slice(6, 8);
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    return { jy: jy, jm: jm, jd: jd };
  }

  /** هر ورودی کاربر را به YYYYMMDD تبدیل می‌کند؛ اگر نشد، همان متن را برمی‌گرداند. */
  function parse(input) {
    var s = window.U.toLatinDigits(String(input || '').trim());
    if (!s) return '';
    var digits = s.replace(/\D/g, '');
    if (digits.length === 8) return unpack(digits) ? digits : s;
    if (digits.length === 6) {                       // 040720 -> 14040720
      var guess = '14' + digits;
      return unpack(guess) ? guess : s;
    }
    return s;
  }

  /** YYYYMMDD -> «۱۴۰۴/۰۷/۲۰» */
  function format(value, opts) {
    var p = unpack(value);
    if (!p) return value || '';
    var out = p.jy + '/' + pad2(p.jm) + '/' + pad2(p.jd);
    if (opts && opts.long) {
      out = p.jd + ' ' + MONTHS[p.jm - 1] + ' ' + p.jy;
    }
    return (opts && opts.latin) ? out : window.U.toFaDigits(out);
  }

  function today() {
    var j = toJalali(new Date());
    return pack(j.jy, j.jm, j.jd);
  }

  /** مهر زمانی کامل برای تاریخچه: «۱۴۰۵/۰۲/۲۷ ساعت ۱۴:۰۳» */
  function stamp(dateObj) {
    var d = dateObj || new Date();
    var j = toJalali(d);
    return window.U.toFaDigits(
      pack(j.jy, j.jm, j.jd).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1/$2/$3') +
      ' ساعت ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
  }

  /* شنبه = ۰. تقویم فارسی از شنبه شروع می‌شود، پس همین ترتیب مبناست. */
  function weekdayIndex(jy, jm, jd) {
    return (toGregorian(jy, jm, jd).getDay() + 1) % 7;
  }

  function weekday(jy, jm, jd) {
    return WEEKDAYS[weekdayIndex(jy, jm, jd)];
  }

  /** تفاضل روز بین دو تاریخ ۸ رقمی (a - b) */
  function diffDays(a, b) {
    var pa = unpack(a), pb = unpack(b);
    if (!pa || !pb) return null;
    return j2d(pa.jy, pa.jm, pa.jd) - j2d(pb.jy, pb.jm, pb.jd);
  }

  /** n روز جلو (یا عقب) از یک تاریخ ۸ رقمی */
  function addDays(j8, n) {
    var p = unpack(j8);
    if (!p) return null;
    var g = toGregorian(p.jy, p.jm, p.jd);
    g.setDate(g.getDate() + n);
    var b = toJalali(g);
    return pack(b.jy, b.jm, b.jd);
  }

  w.J = {
    MONTHS: MONTHS, WEEKDAYS: WEEKDAYS, monthLength: monthLength, isLeap: isLeap,
    toJalali: toJalali, toGregorian: toGregorian, pack: pack, unpack: unpack,
    parse: parse, format: format, today: today, stamp: stamp, weekday: weekday,
    weekdayIndex: weekdayIndex,
    diffDays: diffDays, addDays: addDays, pad2: pad2
  };
})(window);

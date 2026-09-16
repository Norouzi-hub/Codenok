/*
 * لایهٔ تحلیل گزارش‌ها: همهٔ محاسبه‌ها اینجا انجام می‌شود و نما فقط رسم می‌کند.
 * هیچ‌کدام از این توابع DOM نمی‌سازند تا بشود مستقیم آزمایششان کرد.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  var MONTH_SHORT = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  // --------------------------------------------------------------- کمک‌تابع‌ها
  function addDays(j8, n) {
    var p = J.unpack(j8);
    if (!p) return null;
    var g = J.toGregorian(p.jy, p.jm, p.jd);
    g.setDate(g.getDate() + n);
    var b = J.toJalali(g);
    return J.pack(b.jy, b.jm, b.jd);
  }

  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  function mean(arr) {
    if (!arr.length) return null;
    return Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length);
  }

  function isClosed(rec) {
    return /مختومه/.test(rec.status || '');
  }

  /** تاریخ پایان پرونده: ابلاغ رأی، وگرنه تاریخ طرح در کمیته */
  function closeDate(rec) {
    if (!isClosed(rec)) return null;
    return rec.noticeLetterDate || rec.committeeDate || null;
  }

  function monthKey(j8) {
    return J.unpack(j8) ? j8.slice(0, 6) : null;
  }

  function monthLabel(key) {
    var jm = +key.slice(4, 6);
    return MONTH_SHORT[jm - 1] + ' ' + w.U.toFaDigits(key.slice(2, 4));
  }

  /** فهرست کلیدهای ماه بین دو تاریخ (شامل هر دو سر) */
  function monthRange(from, to) {
    var a = J.unpack(from), b = J.unpack(to);
    if (!a || !b) return [];
    var out = [], y = a.jy, m = a.jm;
    var guard = 0;
    while ((y < b.jy || (y === b.jy && m <= b.jm)) && guard++ < 400) {
      out.push(String(y) + J.pad2(m));
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  // ------------------------------------------------------------ بازهٔ گزارش
  var PRESETS = [
    { key: 'all', label: 'همهٔ پرونده‌ها' },
    { key: '30', label: '۳۰ روز اخیر', days: 30 },
    { key: '90', label: '۹۰ روز اخیر', days: 90 },
    { key: '180', label: '۶ ماه اخیر', days: 180 },
    { key: '365', label: 'یک سال اخیر', days: 365 }
  ];

  function rangeOf(preset, custom) {
    if (preset === 'custom') {
      return { from: (custom && custom.from) || '', to: (custom && custom.to) || '' };
    }
    var p = PRESETS.filter(function (x) { return x.key === preset; })[0];
    if (!p || !p.days) return { from: '', to: '' };
    var today = J.today();
    return { from: addDays(today, -p.days), to: today };
  }

  function previousRange(range) {
    if (!range.from || !range.to) return null;
    var span = J.diffDays(range.to, range.from);
    if (span == null) return null;
    return { from: addDays(range.from, -(span + 1)), to: addDays(range.from, -1) };
  }

  /** برش داده بر اساس بازه و فیلترهای گزارش */
  function scope(opts) {
    var range = opts.range || { from: '', to: '' };
    return M.state.cases.filter(function (c) {
      if (opts.expert && (c.expert || '') !== opts.expert) return false;
      if (opts.year && (c.year || '') !== opts.year) return false;
      if (opts.placeType && (c.servicePlaceType || '') !== opts.placeType) return false;
      if (!range.from && !range.to) return true;
      var d = c.intakeDate;
      if (!d || !J.unpack(d)) return false;
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return true;
    });
  }

  // ------------------------------------------------------------------ سنجه‌ها
  function kpis(cases, prevCases) {
    var closed = cases.filter(isClosed);
    var open = cases.filter(function (c) { return !isClosed(c); });
    var toCommittee = [];
    cases.forEach(function (c) {
      if (c.intakeDate && c.committeeDate) {
        var d = J.diffDays(c.committeeDate, c.intakeDate);
        if (d != null && d >= 0) toCommittee.push(d);
      }
    });
    var today = J.today();
    var oldestOpen = 0;
    open.forEach(function (c) {
      if (!c.intakeDate) return;
      var d = J.diffDays(today, c.intakeDate);
      if (d != null && d > oldestOpen) oldestOpen = d;
    });
    return {
      total: cases.length,
      open: open.length,
      closed: closed.length,
      closedPct: cases.length ? Math.round((closed.length / cases.length) * 100) : 0,
      medianToCommittee: median(toCommittee),
      meanToCommittee: mean(toCommittee),
      committeeSample: toCommittee.length,
      oldestOpen: oldestOpen,
      delta: prevCases ? cases.length - prevCases.length : null,
      prevTotal: prevCases ? prevCases.length : null
    };
  }

  /** روند ماهانه: پرونده‌های وارده در برابر مختومه‌شده */
  function monthlyTrend(cases) {
    var keys = {};
    cases.forEach(function (c) {
      var k = monthKey(c.intakeDate);
      if (k) keys[k] = true;
      var ck = monthKey(closeDate(c));
      if (ck) keys[ck] = true;
    });
    var all = Object.keys(keys).sort();
    if (!all.length) return { x: [], intake: [], closed: [], months: [] };
    var months = monthRange(all[0] + '01', all[all.length - 1] + '01');
    if (months.length > 24) months = months.slice(months.length - 24);

    var intake = months.map(function () { return 0; });
    var closed = months.map(function () { return 0; });
    var pos = {};
    months.forEach(function (k, i) { pos[k] = i; });
    cases.forEach(function (c) {
      var k = monthKey(c.intakeDate);
      if (k && pos[k] != null) intake[pos[k]]++;
      var ck = monthKey(closeDate(c));
      if (ck && pos[ck] != null) closed[pos[ck]]++;
    });
    return { x: months.map(monthLabel), intake: intake, closed: closed, months: months };
  }

  /** قیف گردش‌کار — مرحله‌ها از روی تاریخ‌ها استخراج می‌شوند، نه متن وضعیت */
  function funnel(cases) {
    var total = cases.length;
    var assigned = cases.filter(function (c) { return !!c.deliveryDate; }).length;
    var committee = cases.filter(function (c) { return !!c.committeeDate; }).length;
    var notified = cases.filter(function (c) { return !!c.noticeLetterDate; }).length;
    return [
      { label: 'ثبت‌شده در دبیرخانه', value: total, key: 'all' },
      { label: 'ارجاع به کارشناس', value: assigned, key: 'assigned' },
      { label: 'طرح در کمیته', value: committee, key: 'committee' },
      { label: 'ابلاغ رأی', value: notified, key: 'notified' }
    ].map(function (s) {
      s.pct = total ? Math.round((s.value / total) * 100) : 0;
      return s;
    });
  }

  /** فراوانی یک فیلد، با تجمیع دنبالهٔ کوچک در «سایر» */
  function byField(cases, key, limit) {
    var counts = {};
    cases.forEach(function (c) {
      var v = (c[key] || '').trim() || 'ثبت‌نشده';
      counts[v] = (counts[v] || 0) + 1;
    });
    var rows = Object.keys(counts).map(function (k) {
      return { label: k, value: counts[k], key: k };
    }).sort(function (a, b) { return b.value - a.value; });
    if (limit && rows.length > limit) {
      var head = rows.slice(0, limit - 1);
      var tail = rows.slice(limit - 1);
      head.push({
        label: 'سایر (' + w.U.toFaDigits(tail.length) + ' مورد)',
        value: tail.reduce(function (s, r) { return s + r.value; }, 0),
        key: '__other__', tail: tail
      });
      return head;
    }
    return rows;
  }

  /** میانه و میانگین روزهای هر گذرگاه از گردش‌کار */
  function durations(cases) {
    var legs = [
      { label: 'ورود ← ارجاع به کارشناس', from: 'intakeDate', to: 'deliveryDate' },
      { label: 'ورود ← طرح در کمیته', from: 'intakeDate', to: 'committeeDate' },
      { label: 'طرح در کمیته ← ابلاغ رأی', from: 'committeeDate', to: 'noticeLetterDate' },
      { label: 'ارسال استعلام ← پاسخ حراست',
        from: 'securityOutLetterDate', to: 'securityInLetterDate' }
    ];
    return legs.map(function (leg) {
      var days = [];
      cases.forEach(function (c) {
        if (!c[leg.from] || !c[leg.to]) return;
        var d = J.diffDays(c[leg.to], c[leg.from]);
        if (d != null && d >= 0 && d < 3000) days.push(d);
      });
      return {
        label: leg.label, value: median(days) || 0, mean: mean(days),
        sample: days.length, max: days.length ? Math.max.apply(null, days) : 0
      };
    }).filter(function (l) { return l.sample > 0; });
  }

  /** سن پرونده‌های باز — سطل‌های مرتب */
  function aging(cases) {
    var today = J.today();
    var buckets = [
      { label: 'تا ۳۰ روز', max: 30, value: 0, ids: [] },
      { label: '۳۱ تا ۶۰ روز', max: 60, value: 0, ids: [] },
      { label: '۶۱ تا ۹۰ روز', max: 90, value: 0, ids: [] },
      { label: '۹۱ تا ۱۸۰ روز', max: 180, value: 0, ids: [] },
      { label: 'بیش از ۱۸۰ روز', max: Infinity, value: 0, ids: [] }
    ];
    cases.forEach(function (c) {
      if (isClosed(c) || !c.intakeDate) return;
      var age = J.diffDays(today, c.intakeDate);
      if (age == null || age < 0) return;
      for (var i = 0; i < buckets.length; i++) {
        if (age <= buckets[i].max) {
          buckets[i].value++;
          buckets[i].ids.push(c.id);
          break;
        }
      }
    });
    return buckets;
  }

  /** کارکرد هر کارشناس: تعداد کل، باز، مختومه و میانهٔ زمان تا کمیته */
  function experts(cases) {
    var by = {};
    cases.forEach(function (c) {
      var k = (c.expert || '').trim() || 'ارجاع‌نشده';
      var e = by[k] || (by[k] = { label: k, value: 0, open: 0, closed: 0, days: [] });
      e.value++;
      if (isClosed(c)) e.closed++; else e.open++;
      if (c.intakeDate && c.committeeDate) {
        var d = J.diffDays(c.committeeDate, c.intakeDate);
        if (d != null && d >= 0) e.days.push(d);
      }
    });
    return Object.keys(by).map(function (k) {
      by[k].median = median(by[k].days);
      return by[k];
    }).sort(function (a, b) { return b.value - a.value; });
  }

  // ------------------------------------------------- یافته‌ها و پیشنهادها
  var SEV_ORDER = { critical: 0, serious: 1, warning: 2, good: 3 };

  /**
   * تحلیل خودکار: هر یافته شامل شدت، آیکن، عنوان، توضیح، تعداد و
   * شناسهٔ پرونده‌هاست تا بشود مستقیم در فهرست نشانشان داد.
   * (رنگ وضعیت هرگز تنها حامل معنا نیست؛ همیشه آیکن و برچسب همراهش است.)
   */
  function findings(cases) {
    var today = J.today();
    var out = [];

    function add(sev, icon, title, advice, list) {
      if (!list.length) return;
      out.push({
        severity: sev, icon: icon, title: title, advice: advice,
        count: list.length, ids: list.map(function (c) { return c.id; })
      });
    }

    // ۱) پرونده‌های باز که بیش از ۹۰ روز از ورودشان گذشته و هنوز به کمیته نرفته‌اند
    add('critical', '⏳', 'پرونده‌های راکد بالای ۹۰ روز',
      'اینها هنوز در کمیته طرح نشده‌اند. پیشنهاد: در دستور کار نزدیک‌ترین جلسه قرار بگیرند.',
      cases.filter(function (c) {
        if (isClosed(c) || c.committeeDate || !c.intakeDate) return false;
        var d = J.diffDays(today, c.intakeDate);
        return d != null && d > 90;
      }));

    // ۲) رأی صادر شده ولی بیش از ۳۰ روز ابلاغ نشده
    add('serious', '📨', 'رأی صادرشده بدون ابلاغ',
      'بیش از ۳۰ روز از طرح در کمیته گذشته و نامهٔ ابلاغ رأی ثبت نشده است.',
      cases.filter(function (c) {
        if (!c.committeeDate || c.noticeLetterDate) return false;
        var d = J.diffDays(today, c.committeeDate);
        return d != null && d > 30;
      }));

    // ۳) استعلام حراست بی‌پاسخ
    add('serious', '🔎', 'استعلام حراست بی‌پاسخ',
      'بیش از ۳۰ روز از ارسال استعلام گذشته و پاسخی ثبت نشده؛ پیگیری لازم است.',
      cases.filter(function (c) {
        if (!c.securityOutLetterDate || c.securityInLetterDate) return false;
        var d = J.diffDays(today, c.securityOutLetterDate);
        return d != null && d > 30;
      }));

    // ۴) پرونده‌های بدون کارشناس
    add('warning', '👤', 'پروندهٔ بدون کارشناس',
      'کارشناس پرونده تعیین نشده است؛ تا زمان ارجاع، گردش‌کار متوقف می‌ماند.',
      cases.filter(function (c) { return !isClosed(c) && !(c.expert || '').trim(); }));

    // ۵) ناسازگاری تاریخ‌ها
    add('critical', '📅', 'تاریخ‌های ناسازگار',
      'تاریخ یک مرحله جلوتر از مرحلهٔ بعدی ثبت شده؛ احتمالاً خطای ورود اطلاعات است.',
      cases.filter(function (c) {
        var bad = false;
        if (c.intakeDate && c.committeeDate &&
          J.diffDays(c.committeeDate, c.intakeDate) < 0) bad = true;
        if (c.committeeDate && c.noticeLetterDate &&
          J.diffDays(c.noticeLetterDate, c.committeeDate) < 0) bad = true;
        if (c.intakeDate && J.diffDays(today, c.intakeDate) < 0) bad = true;
        return bad;
      }));

    // ۶) شمارهٔ پروندهٔ تکراری
    var seen = {}, dupes = [];
    cases.forEach(function (c) {
      var n = w.U.normalize(c.caseNo || '');
      if (!n) return;
      if (seen[n]) dupes.push(c); else seen[n] = c;
    });
    add('critical', '⚠️', 'شمارهٔ پروندهٔ تکراری',
      'دو پرونده با یک شماره ثبت شده‌اند؛ یکی را اصلاح یا ادغام کنید.', dupes);

    // ۷) تکرار تخلف: افرادی با بیش از یک پرونده
    var byPerson = {};
    cases.forEach(function (c) {
      var k = (c.nationalId || '').trim();
      if (!k) return;
      (byPerson[k] = byPerson[k] || []).push(c);
    });
    var repeat = [];
    Object.keys(byPerson).forEach(function (k) {
      if (byPerson[k].length > 1) repeat = repeat.concat(byPerson[k]);
    });
    add('warning', '🔁', 'افراد با بیش از یک پرونده',
      'سابقهٔ تکرار تخلف در تعیین نوع تنبیه مؤثر است؛ پیش از رأی بررسی شود.', repeat);

    // ۸) کیفیت داده: فیلدهای کلیدی خالی
    var KEY_FIELDS = [
      { key: 'nationalId', label: 'کد ملی' },
      { key: 'intakeDate', label: 'تاریخ ورود به دبیرخانه' },
      { key: 'reporterOrg', label: 'مرجع گزارش‌دهنده' },
      { key: 'caseType', label: 'نوع پرونده' },
      { key: 'orgUnit', label: 'واحد سازمانی' }
    ];
    var incomplete = cases.filter(function (c) {
      return KEY_FIELDS.some(function (f) { return !(c[f.key] || '').trim(); });
    });
    add('warning', '📝', 'پرونده‌های ناقص',
      'دست‌کم یکی از فیلدهای کلیدی (کد ملی، تاریخ ورود، مرجع گزارش‌دهنده، ' +
      'نوع پرونده، واحد سازمانی) خالی است.', incomplete);

    // ۹) گلوگاه: اگر میانهٔ زمان تا کمیته بالاست
    var d = durations(cases).filter(function (l) {
      return l.label.indexOf('طرح در کمیته') > 0;
    })[0];
    if (d && d.value > 60) {
      out.push({
        severity: 'serious', icon: '⏱', title: 'میانهٔ زمان تا طرح در کمیته بالاست',
        advice: 'میانهٔ ' + w.U.toFaDigits(d.value) + ' روز از ورود تا طرح در کمیته؛ ' +
          'بیشترین مورد ' + w.U.toFaDigits(d.max) + ' روز. بازبینی فاصلهٔ جلسات پیشنهاد می‌شود.',
        count: d.sample, ids: null
      });
    }

    out.sort(function (a, b) {
      var s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      return s !== 0 ? s : b.count - a.count;
    });

    if (!out.length) {
      out.push({
        severity: 'good', icon: '✓', title: 'موردی برای هشدار پیدا نشد',
        advice: 'در این برش، پروندهٔ راکد، رأی بدون ابلاغ، استعلام بی‌پاسخ یا ' +
          'ناسازگاری تاریخ دیده نشد.', count: 0, ids: null
      });
    }
    return out;
  }

  /** همهٔ داده‌های یک گزارش، یکجا */
  function build(opts) {
    var range = rangeOf(opts.preset, opts.custom);
    var cases = scope({
      range: range, expert: opts.expert, year: opts.year, placeType: opts.placeType
    });
    var prev = null;
    var pr = previousRange(range);
    if (pr) {
      prev = scope({
        range: pr, expert: opts.expert, year: opts.year, placeType: opts.placeType
      });
    }
    return {
      range: range,
      cases: cases,
      kpis: kpis(cases, prev),
      trend: monthlyTrend(cases),
      funnel: funnel(cases),
      status: byField(cases, 'status', 8),
      caseTypes: byField(cases, 'caseType', 4),
      orgUnits: byField(cases, 'orgUnit', 8),
      reporters: byField(cases, 'reporterOrg', 8),
      placeTypes: byField(cases, 'servicePlaceType', 6),
      jobNature: byField(cases, 'jobNature', 4),
      durations: durations(cases),
      aging: aging(cases),
      experts: experts(cases),
      findings: findings(cases)
    };
  }

  w.Report = {
    PRESETS: PRESETS, build: build, rangeOf: rangeOf, previousRange: previousRange,
    scope: scope, kpis: kpis, monthlyTrend: monthlyTrend, funnel: funnel,
    byField: byField, durations: durations, aging: aging, experts: experts,
    findings: findings, isClosed: isClosed, closeDate: closeDate,
    addDays: addDays, median: median, mean: mean, monthLabel: monthLabel
  };
})(window);

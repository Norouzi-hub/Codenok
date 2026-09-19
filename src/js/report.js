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
  // همان ابزار تقویم است؛ اینجا فقط برای سازگاری با کدهای قبلی نگه داشته شده
  var addDays = J.addDays;

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

  /* ارجاع‌شده به کارشناس دیگر: از جریانِ کار ما بیرون است ولی مختومه نیست.
     در هیچ آماری نباید به‌جای «مختومه» یا «در جریان» شمرده شود. */
  function isTransferred(rec) { return !!rec.transferDate; }

  function isOut(rec) { return isClosed(rec) || isTransferred(rec); }

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

  /** فیلدهای تاریخی که بازه می‌تواند بر مبنای آنها اعمال شود */
  var DATE_BASES = [
    { key: 'intakeDate', label: 'تاریخ ورود به دبیرخانه' },
    { key: 'deliveryDate', label: 'تاریخ تحویل به کارشناس' },
    { key: 'committeeDate', label: 'تاریخ طرح در کمیته' },
    { key: 'noticeLetterDate', label: 'تاریخ ابلاغ رأی' },
    { key: 'letterDate', label: 'تاریخ نامهٔ گزارش' }
  ];

  var STATIC_PRESETS = [
    { key: 'all', label: 'همهٔ پرونده‌ها' },
    { key: 'month', label: 'ماه جاری' },
    { key: 'quarter', label: 'فصل جاری' },
    { key: 'ytd', label: 'از ابتدای سال جاری' },
    { key: '30', label: '۳۰ روز اخیر', days: 30 },
    { key: '90', label: '۹۰ روز اخیر', days: 90 },
    { key: '180', label: '۶ ماه اخیر', days: 180 },
    { key: '365', label: 'یک سال اخیر', days: 365 }
  ];

  var QUARTERS = ['بهار', 'تابستان', 'پاییز', 'زمستان'];

  /** سال‌هایی که واقعاً در داده وجود دارند، بر مبنای فیلد تاریخ انتخابی */
  function yearsInData(baseField) {
    var seen = {};
    M.state.cases.forEach(function (c) {
      var d = c[baseField || 'intakeDate'];
      if (d && J.unpack(d)) seen[d.slice(0, 4)] = true;
    });
    return Object.keys(seen).sort().reverse();
  }

  /**
   * فهرست کامل پیش‌تنظیم‌ها. پیش‌تنظیم‌های نسبی («۳۰ روز اخیر») روی دادهٔ
   * تاریخی کم‌فایده‌اند، پس سال‌ها و فصل‌های موجود در داده هم اضافه می‌شوند.
   */
  function presets(baseField) {
    var list = STATIC_PRESETS.slice();
    yearsInData(baseField).forEach(function (y) {
      list.push({ key: 'y' + y, label: 'سال ' + w.U.toFaDigits(y), year: y });
      QUARTERS.forEach(function (qLabel, qi) {
        list.push({
          key: 'q' + y + (qi + 1),
          label: qLabel + ' ' + w.U.toFaDigits(y),
          year: y, quarter: qi + 1
        });
      });
    });
    list.push({ key: 'custom', label: 'بازهٔ دلخواه…' });
    return list;
  }

  function lastDayOf(jy, jm) {
    return J.pack(jy, jm, J.monthLength(jy, jm));
  }

  function rangeOf(preset, custom, baseField) {
    if (preset === 'custom') {
      return { from: (custom && custom.from) || '', to: (custom && custom.to) || '' };
    }
    var t = J.unpack(J.today());
    var p = presets(baseField).filter(function (x) { return x.key === preset; })[0];
    if (!p) return { from: '', to: '' };

    if (p.days) {
      var today = J.today();
      return { from: addDays(today, -p.days), to: today };
    }
    if (p.key === 'month') {
      return { from: J.pack(t.jy, t.jm, 1), to: lastDayOf(t.jy, t.jm) };
    }
    if (p.key === 'quarter') {
      var q = Math.ceil(t.jm / 3);
      return { from: J.pack(t.jy, (q - 1) * 3 + 1, 1), to: lastDayOf(t.jy, q * 3) };
    }
    if (p.key === 'ytd') {
      return { from: J.pack(t.jy, 1, 1), to: J.today() };
    }
    if (p.quarter) {
      var y = +p.year;
      return {
        from: J.pack(y, (p.quarter - 1) * 3 + 1, 1),
        to: lastDayOf(y, p.quarter * 3)
      };
    }
    if (p.year) {
      return { from: J.pack(+p.year, 1, 1), to: lastDayOf(+p.year, 12) };
    }
    return { from: '', to: '' };
  }

  function previousRange(range) {
    if (!range.from || !range.to) return null;
    var span = J.diffDays(range.to, range.from);
    if (span == null) return null;
    return { from: addDays(range.from, -(span + 1)), to: addDays(range.from, -1) };
  }

  /**
   * برش داده بر اساس بازه و فیلترهای گزارش.
   * بازه روی «تاریخ مبنا» اعمال می‌شود؛ پرونده‌هایی که آن تاریخ را ندارند
   * قابل قضاوت نیستند و کنار گذاشته می‌شوند — تعدادشان در نتیجه برمی‌گردد
   * تا در رابط کاربری صادقانه نشان داده شود.
   */
  function scope(opts) {
    var range = opts.range || { from: '', to: '' };
    var baseField = opts.baseField || 'intakeDate';
    var undated = 0;
    var cases = M.state.cases.filter(function (c) {
      if (opts.expert && (c.expert || '') !== opts.expert) return false;
      if (opts.year && (c.year || '') !== opts.year) return false;
      if (opts.placeType && (c.servicePlaceType || '') !== opts.placeType) return false;
      if (!range.from && !range.to) return true;
      var d = c[baseField];
      if (!d || !J.unpack(d)) { undated++; return false; }
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      return true;
    });
    cases.undated = undated;
    return cases;
  }

  // ------------------------------------------------------------------ سنجه‌ها
  function kpis(cases, prevCases) {
    var closed = cases.filter(isClosed);
    var transferred = cases.filter(isTransferred);
    var open = cases.filter(function (c) { return !isOut(c); });
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
      transferred: transferred.length,
      closedPct: cases.length ? Math.round((closed.length / cases.length) * 100) : 0,
      medianToCommittee: median(toCommittee),
      meanToCommittee: mean(toCommittee),
      committeeSample: toCommittee.length,
      oldestOpen: oldestOpen,
      delta: prevCases ? cases.length - prevCases.length : null,
      prevTotal: prevCases ? prevCases.length : null
    };
  }

  var GRANULARITY = [
    { key: 'month', label: 'ماهانه' },
    { key: 'quarter', label: 'فصلی' },
    { key: 'year', label: 'سالانه' }
  ];

  /** کلید سطل زمانی یک تاریخ، بسته به تفکیک انتخابی */
  function bucketKey(j8, granularity) {
    if (!j8 || !J.unpack(j8)) return null;
    if (granularity === 'year') return j8.slice(0, 4);
    if (granularity === 'quarter') {
      return j8.slice(0, 4) + 'Q' + Math.ceil(+j8.slice(4, 6) / 3);
    }
    return j8.slice(0, 6);
  }

  function bucketLabel(key, granularity) {
    if (granularity === 'year') return w.U.toFaDigits(key);
    if (granularity === 'quarter') {
      var q = +key.slice(5);
      return QUARTERS[q - 1] + ' ' + w.U.toFaDigits(key.slice(2, 4));
    }
    return monthLabel(key);
  }

  /** همهٔ سطل‌های پیوستهٔ بین دو کلید (تا جای خالی در محور نیفتد) */
  function bucketRange(first, last, granularity) {
    var out = [], guard = 0;
    if (granularity === 'year') {
      for (var y = +first; y <= +last && guard++ < 200; y++) out.push(String(y));
      return out;
    }
    if (granularity === 'quarter') {
      var cy = +first.slice(0, 4), cq = +first.slice(5);
      var ey = +last.slice(0, 4), eq = +last.slice(5);
      while ((cy < ey || (cy === ey && cq <= eq)) && guard++ < 400) {
        out.push(String(cy) + 'Q' + cq);
        cq += 1;
        if (cq > 4) { cq = 1; cy += 1; }
      }
      return out;
    }
    return monthRange(first + '01', last + '01');
  }

  /**
   * روند ورود در برابر اختتام، با تفکیک زمانی دلخواه.
   * اگر تفکیک داده نشود، از طول بازه حدس زده می‌شود تا محور شلوغ نشود.
   */
  function trend(cases, granularity) {
    var keysSeen = {};
    var probe = [];
    cases.forEach(function (c) {
      if (c.intakeDate && J.unpack(c.intakeDate)) probe.push(c.intakeDate);
      var cd = closeDate(c);
      if (cd && J.unpack(cd)) probe.push(cd);
    });
    if (!probe.length) return { x: [], intake: [], closed: [], keys: [], granularity: 'month' };

    if (!granularity || granularity === 'auto') {
      probe.sort();
      var months = monthRange(probe[0].slice(0, 6) + '01',
        probe[probe.length - 1].slice(0, 6) + '01').length;
      granularity = months > 36 ? 'year' : (months > 18 ? 'quarter' : 'month');
    }

    cases.forEach(function (c) {
      var k = bucketKey(c.intakeDate, granularity);
      if (k) keysSeen[k] = true;
      var ck = bucketKey(closeDate(c), granularity);
      if (ck) keysSeen[ck] = true;
    });
    var all = Object.keys(keysSeen).sort();
    var keys = bucketRange(all[0], all[all.length - 1], granularity);
    if (keys.length > 24) keys = keys.slice(keys.length - 24);

    var pos = {};
    keys.forEach(function (k, i) { pos[k] = i; });
    var intake = keys.map(function () { return 0; });
    var closed = keys.map(function () { return 0; });
    cases.forEach(function (c) {
      var k = bucketKey(c.intakeDate, granularity);
      if (k && pos[k] != null) intake[pos[k]]++;
      var ck = bucketKey(closeDate(c), granularity);
      if (ck && pos[ck] != null) closed[pos[ck]]++;
    });
    return {
      x: keys.map(function (k) { return bucketLabel(k, granularity); }),
      intake: intake, closed: closed, keys: keys, granularity: granularity
    };
  }

  /**
   * قیف گردش‌کار. هر مرحله یعنی «به این مرحله رسیده یا از آن گذشته»، نه
   * «دقیقاً این تاریخ را دارد» — وگرنه پرونده‌ای که تاریخ ارجاعش ثبت نشده
   * ولی در کمیته مطرح شده، ترتیب قیف را می‌شکند.
   */
  var STAGES = [
    { key: 'all', label: 'ثبت‌شده در دبیرخانه', fields: [] },
    { key: 'assigned', label: 'ارجاع به کارشناس',
      fields: ['deliveryDate', 'committeeDate', 'noticeLetterDate'] },
    { key: 'committee', label: 'طرح در کمیته',
      fields: ['committeeDate', 'noticeLetterDate'] },
    { key: 'notified', label: 'ابلاغ رأی', fields: ['noticeLetterDate'] }
  ];

  function reachedStage(rec, stage) {
    if (!stage.fields.length) return true;
    return stage.fields.some(function (f) { return !!rec[f]; });
  }

  function funnel(cases) {
    var total = cases.length;
    return STAGES.map(function (stage) {
      var value = cases.filter(function (c) { return reachedStage(c, stage); }).length;
      return {
        label: stage.label, key: stage.key, value: value,
        pct: total ? Math.round((value / total) * 100) : 0
      };
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
      if (isOut(c) || !c.intakeDate) return;
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
      var e = by[k] || (by[k] = {
        label: k, value: 0, open: 0, closed: 0, transferred: 0, days: []
      });
      e.value++;
      if (isTransferred(c)) e.transferred++;
      else if (isClosed(c)) e.closed++;
      else e.open++;
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
        if (isOut(c) || c.committeeDate || !c.intakeDate) return false;
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
      cases.filter(function (c) { return !isOut(c) && !(c.expert || '').trim(); }));

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

    // ۷) تکرار تخلف: یک کارمند ممکن است چند پرونده داشته باشد
    var rp = w.Person.repeatStats(cases);
    if (rp.repeaters.length) {
      out.push({
        severity: 'warning', icon: '🔁', title: 'افراد با بیش از یک پرونده',
        advice: w.U.toFaDigits(rp.repeaters.length) + ' نفر مجموعاً ' +
          w.U.toFaDigits(rp.repeatCases) + ' پرونده دارند. سابقهٔ تکرار تخلف در ' +
          'تعیین نوع تنبیه مؤثر است؛ پیش از رأی بررسی شود.',
        count: rp.repeaters.length, people: rp.repeaters,
        ids: rp.repeaters.reduce(function (acc, p) {
          return acc.concat(p.cases.map(function (c) { return c.id; }));
        }, [])
      });
    }

    // ۷-ب) پرونده‌های باز هم‌زمانِ یک نفر — بهتر است با هم دیده شوند
    var concurrent = rp.repeaters.filter(function (p) {
      return p.cases.filter(function (c) { return !isOut(c); }).length > 1;
    });
    if (concurrent.length) {
      out.push({
        severity: 'serious', icon: '👥', title: 'اشخاص با چند پروندهٔ باز هم‌زمان',
        advice: 'این افراد بیش از یک پروندهٔ در جریان دارند؛ رسیدگی هم‌زمان و ' +
          'یکجا معمولاً درست‌تر از رأی جداگانه است.',
        count: concurrent.length, people: concurrent,
        ids: concurrent.reduce(function (acc, p) {
          return acc.concat(p.cases.filter(function (c) { return !isOut(c); })
            .map(function (c) { return c.id; }));
        }, [])
      });
    }

    // ۷-ج) ناسازگاری مشخصات هویتی بین پرونده‌های یک نفر
    var conflicted = rp.repeaters.filter(function (p) { return p.conflicts.length; });
    if (conflicted.length) {
      out.push({
        severity: 'critical', icon: '🪪', title: 'ناسازگاری مشخصات هویتی',
        advice: 'با یک کد ملی، در پرونده‌های مختلف مشخصات متفاوتی ثبت شده ' +
          '(نام، نام پدر، شماره شناسنامه…). احتمالاً خطای ورود اطلاعات است.',
        count: conflicted.length, people: conflicted,
        ids: conflicted.reduce(function (acc, p) {
          return acc.concat(p.cases.map(function (c) { return c.id; }));
        }, [])
      });
    }

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

    // ۹) مستندات — فقط وقتی اصلاً از مستندات استفاده می‌شود، وگرنه نویز است
    if (w.Docs && w.Docs.all().length) {
      var hasDoc = function (rec, kind) {
        return w.Docs.current(rec.id).some(function (d) { return d.kind === kind; });
      };
      add('serious', '📄', 'رأی صادرشده بدون سند رأی',
        'تاریخ طرح در کمیته ثبت شده ولی فایل رأی کمیته پیوست نشده است.',
        cases.filter(function (c) {
          return c.committeeDate && !hasDoc(c, 'رأی کمیته');
        }));
      add('warning', '📎', 'ابلاغ بدون سند ابلاغیه',
        'تاریخ ابلاغ رأی ثبت شده ولی نامهٔ ابلاغ پیوست نشده است.',
        cases.filter(function (c) {
          return c.noticeLetterDate && !hasDoc(c, 'نامهٔ ابلاغ رأی');
        }));
      add('warning', '🗂', 'پرونده‌های بدون هیچ سند',
        'هیچ مدرکی برای این پرونده‌ها بارگذاری نشده است.',
        cases.filter(function (c) {
          return !isOut(c) && !w.Docs.forCase(c.id).length;
        }));
    }

    // ۱۰) گلوگاه: اگر میانهٔ زمان تا کمیته بالاست
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

  /** فراوانی نوع سند در برش جاری */
  function docKinds(cases) {
    if (!w.Docs || !w.Docs.all().length) return [];
    var ids = {};
    cases.forEach(function (c) { ids[c.id] = true; });
    var counts = {};
    w.Docs.all().forEach(function (d) {
      if (d.superseded || !ids[d.caseId]) return;
      counts[d.kind] = (counts[d.kind] || 0) + 1;
    });
    return Object.keys(counts).map(function (k) {
      return { label: k, value: counts[k], key: k };
    }).sort(function (a, b) { return b.value - a.value; });
  }

  /** همهٔ داده‌های یک گزارش، یکجا */
  function build(opts) {
    var baseField = opts.baseField || 'intakeDate';
    var range = rangeOf(opts.preset, opts.custom, baseField);
    var scopeOpts = {
      range: range, baseField: baseField, expert: opts.expert,
      year: opts.year, placeType: opts.placeType
    };
    var cases = scope(scopeOpts);
    var prev = null;
    var pr = previousRange(range);
    if (pr) {
      prev = scope({
        range: pr, baseField: baseField, expert: opts.expert,
        year: opts.year, placeType: opts.placeType
      });
    }
    return {
      range: range,
      baseField: baseField,
      baseLabel: (DATE_BASES.filter(function (b) { return b.key === baseField; })[0] || {}).label,
      prevRange: pr,
      undated: cases.undated || 0,
      cases: cases,
      kpis: kpis(cases, prev),
      trend: trend(cases, opts.granularity),
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
      repeat: w.Person.repeatStats(cases),
      docKinds: docKinds(cases),
      findings: findings(cases)
    };
  }

  w.Report = {
    DATE_BASES: DATE_BASES, GRANULARITY: GRANULARITY, presets: presets,
    build: build, rangeOf: rangeOf, previousRange: previousRange,
    scope: scope, kpis: kpis, trend: trend, funnel: funnel,
    byField: byField, durations: durations, aging: aging, experts: experts,
    findings: findings, docKinds: docKinds, isClosed: isClosed,
    isTransferred: isTransferred, isOut: isOut, closeDate: closeDate,
    STAGES: STAGES, reachedStage: reachedStage,
    addDays: addDays, median: median, mean: mean, monthLabel: monthLabel,
    yearsInData: yearsInData
  };
})(window);

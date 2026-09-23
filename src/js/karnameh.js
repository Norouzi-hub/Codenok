/*
 * کارنامه — «این هفته چه کردم؟»
 *
 * همهٔ نماهای دیگر رو به جلو دارند: چه مانده، چه سررسید می‌شود، کدام
 * پرونده کجا ایستاده. ولی کسی که آخر هفته باید به مدیرش گزارش بدهد،
 * سؤال دیگری دارد — و تا امروز جوابش را باید از تاریخچهٔ تک‌تک
 * پرونده‌ها درمی‌آورد.
 *
 * این فایل هیچ دادهٔ تازه‌ای نمی‌سازد. همان چیزی که از قبل ثبت شده را
 * از چهار جا جمع می‌کند و بر حسب «کار» می‌چیند، نه بر حسب «پرونده»:
 *
 *   ۱) تاریخچه       — هر رویدادی که ثبت شده، با زمان و کاربرش
 *   ۲) تاریخ‌های پرونده — نامه‌ای که صادر شد، جلسه‌ای که تشکیل شد، رأیی
 *                        که صادر شد؛ اینها سنجهٔ واقعی کارِ دبیرخانه‌اند
 *   ۳) اسناد و دسته‌ها — چند سند بایگانی شد، در چند نوبت
 *   ۴) کارها          — چه کاری بسته شد، به تفکیک دسته
 *
 * و در پایان یک بند که در گزارش مدیریتی از همه مهم‌تر است: چه ماند.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  /* بازه‌های آماده. هفته از شنبه شروع می‌شود. */
  var RANGES = [
    { key: 'week', label: 'این هفته' },
    { key: 'lastWeek', label: 'هفتهٔ گذشته' },
    { key: 'month', label: 'این ماه' },
    { key: 'lastMonth', label: 'ماه گذشته' },
    { key: 'custom', label: 'بازهٔ دلخواه' }
  ];

  /** شنبهٔ همین هفته */
  function weekStart(day) {
    var p = J.unpack(day || J.today());
    if (!p) return day;
    return J.addDays(J.pack(p.jy, p.jm, p.jd), -J.weekdayIndex(p.jy, p.jm, p.jd));
  }

  function monthStart(day) {
    var p = J.unpack(day || J.today());
    return p ? J.pack(p.jy, p.jm, 1) : day;
  }

  function monthEnd(day) {
    var p = J.unpack(day || J.today());
    return p ? J.pack(p.jy, p.jm, J.monthLength(p.jy, p.jm)) : day;
  }

  /** بازهٔ یک کلید آماده → {from, to, label} */
  function range(key, custom) {
    var today = J.today();
    if (key === 'lastWeek') {
      var ws = J.addDays(weekStart(today), -7);
      return { from: ws, to: J.addDays(ws, 6), label: 'هفتهٔ گذشته' };
    }
    if (key === 'month') {
      return { from: monthStart(today), to: today, label: 'این ماه' };
    }
    if (key === 'lastMonth') {
      var prev = J.addDays(monthStart(today), -1);
      return { from: monthStart(prev), to: monthEnd(prev), label: 'ماه گذشته' };
    }
    if (key === 'custom') {
      var c = custom || {};
      return {
        from: c.from || weekStart(today), to: c.to || today, label: 'بازهٔ دلخواه'
      };
    }
    return { from: weekStart(today), to: today, label: 'این هفته' };
  }

  function inRange(d, from, to) { return !!d && d >= from && d <= to; }

  function jalaliOf(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var j = J.toJalali(d);
    return J.pack(j.jy, j.jm, j.jd);
  }

  function personOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام';
  }

  /*
   * تاریخِ اختتام یک پرونده.
   * صریح نوشته شده چون در گزارش مدیریتی «چند پرونده بستیم» عدد حساسی
   * است و باید معلوم باشد از کجا آمده: آخرین گامِ ثبت‌شدهٔ اختتام.
   */
  function closedOn(rec) {
    return rec.archiveDate || rec.noticeResultDate || rec.noticeLetterDate ||
      rec.verdictDate || '';
  }

  function sortCount(map) {
    return Object.keys(map).map(function (k) { return { key: k, label: k, n: map[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.key < b.key ? -1 : 1); });
  }

  /**
   * build(from, to, opts) — کارنامهٔ یک بازه.
   * opts.user: فقط کارهای یک نفر (خالی = همه)
   */
  function build(from, to, opts) {
    opts = opts || {};
    var who = opts.user || '';
    var cases = M.scoped();
    var inScope = {};
    cases.forEach(function (c) { inScope[c.id] = c; });

    // ---------------------------------------------------- ۱) تاریخچه
    var events = [], byKind = {}, touched = {};
    (M.state.history || []).forEach(function (h) {
      var d = jalaliOf(h.at);
      if (!inRange(d, from, to)) return;
      if (who && (h.user || '') !== who) return;
      var rec = inScope[h.caseId];
      if (h.caseId && !rec) return;         // بیرون از دامنهٔ کار
      events.push({ h: h, date: d, rec: rec });
      byKind[h.kind] = (byKind[h.kind] || 0) + 1;
      if (rec) {
        var t = touched[rec.id] || (touched[rec.id] = { rec: rec, kinds: {}, n: 0 });
        t.kinds[h.kind] = true;
        t.n++;
      }
    });

    // ------------------------------- ۲) گام‌های واقعی پرونده در این بازه
    var steps = {}, stepList = [];
    (w.MILESTONES || []).forEach(function (ms) {
      var n = 0, ids = [];
      cases.forEach(function (rec) {
        if (!inRange(rec[ms.key], from, to)) return;
        n++;
        ids.push(rec.id);
        var t = touched[rec.id] || (touched[rec.id] = { rec: rec, kinds: {}, n: 0 });
        t.n++;
      });
      if (n) {
        steps[ms.key] = n;
        stepList.push({ key: ms.key, label: ms.label, n: n, ids: ids });
      }
    });
    stepList.sort(function (a, b) { return b.n - a.n; });

    // --------------------------------------------- ۳) اسناد و دسته‌ها
    var docsIn = [], docKinds = {}, batchIds = {};
    (w.Docs && w.Docs.all ? w.Docs.all() : []).forEach(function (d) {
      if (d.superseded) return;
      var day = jalaliOf(d.addedAt);
      if (!inRange(day, from, to)) return;
      if (who && (d.user || '') !== who) return;
      if (d.caseId && !inScope[d.caseId]) return;
      docsIn.push(d);
      docKinds[d.kind] = (docKinds[d.kind] || 0) + 1;
      if (d.batchId) batchIds[d.batchId] = true;
    });
    var batchList = (w.Docs && w.Docs.batches ? w.Docs.batches() : [])
      .filter(function (b) { return batchIds[b.id]; });

    // ------------------------------------------------------ ۴) کارها
    var tasksDone = [], tasksCancelled = [], taskCats = {};
    (w.Notes && w.Notes.doneBetween ? w.Notes.doneBetween(from, to) : [])
      .forEach(function (t) {
        if (who && (t.owner || t.user || '') !== who) return;
        if (t.caseId && !inScope[t.caseId]) return;
        if (t.status === 'cancelled') { tasksCancelled.push(t); return; }
        tasksDone.push(t);
        var c = t.category || 'بدون دسته';
        taskCats[c] = (taskCats[c] || 0) + 1;
      });

    // ------------------------------------------- پرونده‌های تازه و مختومه
    var created = cases.filter(function (c) {
      return inRange(c.intakeDate, from, to);
    });
    var closed = cases.filter(function (c) {
      return w.Worklist.isClosed(c) && inRange(closedOn(c), from, to);
    });

    // ------------------------------------------------------- چه ماند
    var openNow = 0, overdueNow = 0;
    cases.forEach(function (c) {
      var a = w.Worklist.nextAction(c);
      if (!a || a.key === 'closed' || a.key === 'transferred') return;
      openNow++;
      if (a.overdue) overdueNow++;
    });
    var openTasks = w.Notes ? w.Notes.tasks({ status: 'open' }).length : 0;

    /* «نامه» را جدا می‌شمریم چون در گزارش اداری واحدِ کار همین است */
    var LETTER_KEYS = ['defectLetterDate', 'securityOutLetterDate',
      'invitationLetterDate', 'defenseChaseLetterDate', 'hearingLetterDate',
      'noticeLetterDate'];
    var letters = LETTER_KEYS.reduce(function (n, k) { return n + (steps[k] || 0); }, 0);

    var touchedList = Object.keys(touched).map(function (k) { return touched[k]; })
      .sort(function (a, b) { return b.n - a.n; });

    return {
      from: from, to: to,
      days: (J.diffDays(to, from) || 0) + 1,
      user: who,
      totals: {
        created: created.length,
        closed: closed.length,
        letters: letters,
        sessions: steps.committeeDate || 0,
        verdicts: steps.verdictDate || 0,
        docs: docsIn.length,
        batches: batchList.length,
        tasksDone: tasksDone.length,
        tasksCancelled: tasksCancelled.length,
        events: events.length,
        touched: touchedList.length
      },
      steps: stepList,
      byKind: sortCount(byKind),
      docs: { list: docsIn, byKind: sortCount(docKinds), batches: batchList },
      tasks: { done: tasksDone, cancelled: tasksCancelled, byCat: sortCount(taskCats) },
      cases: { created: created, closed: closed, touched: touchedList },
      rest: { open: openNow, overdue: overdueNow, openTasks: openTasks },
      events: events
    };
  }

  /** یک جملهٔ فارسی که سرِ گزارش می‌نشیند */
  function headline(k) {
    var t = k.totals;
    var bits = [];
    if (t.letters) bits.push(w.U.toFaDigits(t.letters) + ' نامه صادر شد');
    if (t.sessions) bits.push(w.U.toFaDigits(t.sessions) + ' پرونده در کمیته طرح شد');
    if (t.docs) bits.push(w.U.toFaDigits(t.docs) + ' سند بایگانی شد');
    if (t.tasksDone) bits.push(w.U.toFaDigits(t.tasksDone) + ' کار انجام شد');
    if (!bits.length) return 'در این بازه رویدادی ثبت نشده است.';
    return bits.join('، ') + '.';
  }

  function label(k) {
    return J.format(k.from, { long: true }) + ' تا ' + J.format(k.to, { long: true });
  }

  w.Karnameh = {
    RANGES: RANGES, range: range, build: build,
    headline: headline, label: label,
    weekStart: weekStart, monthStart: monthStart, closedOn: closedOn
  };
})(window);

/*
 * تقویم — همهٔ آنچه در یک روز افتاده یا قرار است بیفتد.
 *
 * برنامه تا امروز زمان را از پنج جای جدا نشان می‌داد: تاریخ‌های پرونده در
 * خودِ پرونده، سررسید کارها در «کارها»، قرارهای پیگیری در کارتابل، مهلت‌ها
 * در سطرهای کارتابل، و تاریخچه در تب خودش. هیچ‌جا نمی‌شد پرسید «پنجشنبهٔ
 * پیش چه خبر بود؟» یا «هفتهٔ آینده چه در راه است؟».
 *
 * این فایل فقط جمع می‌کند؛ نمایش با ui.calendar.js است. پنج لایه:
 *
 *   action  اقدام‌های ثبت‌شدهٔ پرونده — از فیلدهای تاریخ (MILESTONES)
 *   task    کارها، بر اساس سررسید
 *   follow  قرارهای پیگیریِ یادداشت‌ها
 *   due     مهلت اقدام بعدی هر پروندهٔ باز
 *   event   رویدادهای ثبت‌شده در تاریخچه — چه کسی چه کرد
 *
 * لایه‌ها جداشدنی‌اند چون جنسشان فرق دارد: سه‌تای اول «قرار»اند، «due»
 * هشدار است و «event» گزارشِ گذشته. یک‌کاسه کردنشان روز را شلوغ می‌کند
 * بی‌آنکه چیزی روشن شود.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  var LAYERS = [
    { key: 'due', label: 'مهلت‌ها', tone: 'late' },
    { key: 'task', label: 'کارها', tone: 'task' },
    { key: 'follow', label: 'پیگیری‌ها', tone: 'follow' },
    { key: 'action', label: 'اقدام‌های پرونده', tone: 'action' },
    { key: 'event', label: 'رویدادهای ثبت‌شده', tone: 'event' }
  ];

  /* «رویدادها» به‌طور پیش‌فرض خاموش است: هر ویرایشِ کوچک یک رویداد است و
     روشن بودنش تقویم را پر می‌کند از چیزی که کسی دنبالش نیست. هر وقت
     لازم شد، یک کلیک روشنش می‌کند. */
  var DEFAULT_ON = ['due', 'task', 'follow', 'action'];

  function personOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام';
  }

  function caseTag(rec) {
    return w.U.toLatinDigits(rec.caseNo || '') + ' — ' + personOf(rec);
  }

  /** تاریخ جلالیِ ۸ رقمی از یک زمانِ ISO */
  function jalaliOf(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var j = J.toJalali(d);
    return J.pack(j.jy, j.jm, j.jd);
  }

  /**
   * collect(from, to, layers) — همهٔ آیتم‌های بازه، هر دو سر شامل.
   * خروجی: آرایه‌ای از { layer, date, label, sub, caseId, taskId, urgent }
   */
  function collect(from, to, layers) {
    var on = {};
    (layers || DEFAULT_ON).forEach(function (k) { on[k] = true; });
    var out = [];
    function push(o) {
      if (!o.date || o.date < from || o.date > to) return;
      out.push(o);
    }

    if (on.action) {
      var stones = w.MILESTONES || [];
      M.state.cases.forEach(function (rec) {
        stones.forEach(function (ms) {
          var v = rec[ms.key];
          if (!v || !J.unpack(v)) return;
          push({
            layer: 'action', date: v, label: ms.label,
            sub: caseTag(rec), caseId: rec.id
          });
        });
      });
    }

    if (on.due) {
      var WL = w.Worklist;
      M.state.cases.forEach(function (rec) {
        var a = WL.nextAction(rec);
        if (!a || !a.due || a.key === 'closed' || a.key === 'transferred') return;
        push({
          layer: 'due', date: a.due, label: 'مهلت: ' + a.label,
          sub: caseTag(rec), caseId: rec.id, urgent: true
        });
      });
    }

    if (on.task || on.follow) {
      w.Notes.all().forEach(function (n) {
        if (!n.followUp) return;
        var isTask = n.kind === 'task';
        if (isTask && !on.task) return;
        if (!isTask && !on.follow) return;
        var rec = n.caseId ? M.get(n.caseId) : null;
        if (n.caseId && !rec) return;
        push({
          layer: isTask ? 'task' : 'follow',
          date: n.followUp,
          label: (n.status === 'done' ? '✓ ' : '') +
            (n.status === 'cancelled' ? '⦸ ' : '') +
            w.Notes.preview(w.Notes.textOf(n), 70),
          sub: rec ? caseTag(rec) : 'بیرون از پرونده‌ها',
          caseId: rec ? rec.id : '',
          taskId: n.id,
          done: n.status !== 'open',
          urgent: n.priority === 'urgent' && n.status === 'open'
        });
      });
    }

    if (on.event) {
      (M.state.history || []).forEach(function (h) {
        var rec = M.get(h.caseId);
        if (!rec) return;
        push({
          layer: 'event', date: jalaliOf(h.at),
          label: (w.UIForm ? w.UIForm.kindLabel(h.kind) : h.kind) +
            (h.note ? ' — ' + w.Notes.preview(h.note, 60) : ''),
          sub: caseTag(rec) + ' • ' + (h.user || ''),
          caseId: rec.id
        });
      });
    }

    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      var oa = LAYERS.findIndex(function (l) { return l.key === a.layer; });
      var ob = LAYERS.findIndex(function (l) { return l.key === b.layer; });
      return oa - ob;
    });
    return out;
  }

  /**
   * month(jy, jm, layers) — شبکهٔ یک ماه.
   *
   * هفته از شنبه شروع می‌شود و خانه‌های ابتدا و انتها از ماه قبل و بعد پر
   * می‌شوند تا شبکه کامل بماند؛ آنها inMonth=false دارند و کم‌رنگ‌اند.
   */
  function month(jy, jm, layers) {
    var len = J.monthLength(jy, jm);
    var first = J.pack(jy, jm, 1);
    var lead = J.weekdayIndex(jy, jm, 1);                 // شنبه = ۰
    var start = J.addDays(first, -lead);
    var cellCount = Math.ceil((lead + len) / 7) * 7;
    var end = J.addDays(start, cellCount - 1);

    var byDate = {};
    collect(start, end, layers).forEach(function (it) {
      (byDate[it.date] = byDate[it.date] || []).push(it);
    });

    var today = J.today();
    var cells = [];
    for (var i = 0; i < cellCount; i++) {
      var d = J.addDays(start, i);
      var p = J.unpack(d);
      cells.push({
        date: d, jd: p.jd, jm: p.jm, jy: p.jy,
        inMonth: p.jm === jm && p.jy === jy,
        today: d === today,
        friday: (i % 7) === 6,
        items: byDate[d] || []
      });
    }
    var weeks = [];
    for (var k = 0; k < cells.length; k += 7) weeks.push(cells.slice(k, k + 7));

    var inMonthItems = cells.filter(function (c) { return c.inMonth; })
      .reduce(function (n, c) { return n + c.items.length; }, 0);

    return {
      jy: jy, jm: jm, label: J.MONTHS[jm - 1] + ' ' + jy,
      weeks: weeks, byDate: byDate, total: inMonthItems,
      start: start, end: end
    };
  }

  /** ماه بعد / قبل، با سرریز سال */
  function shift(jy, jm, n) {
    var t = (jy * 12 + (jm - 1)) + n;
    return { jy: Math.floor(t / 12), jm: (t % 12) + 1 };
  }

  w.Calendar = {
    LAYERS: LAYERS, DEFAULT_ON: DEFAULT_ON,
    collect: collect, month: month, shift: shift, caseTag: caseTag
  };
})(window);

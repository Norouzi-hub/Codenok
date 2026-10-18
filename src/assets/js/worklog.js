/*
 * کارکرد — هرچه کاربر کرده، با زمانش، کنار هم.
 *
 * سه منبع، یک تصویر:
 *   زمان     — Timelog: چند دقیقه واقعاً روی هر پرونده و هر صفحه کار شد.
 *   رویداد   — تاریخچه: چه شد (ویرایش، فرم، مینوت، سند، یادداشت).
 *   کار       — Notes: کاری که تیک خورد، و زمانی که دستی برایش ثبت شد
 *               (کارِ بیرون از برنامه: تماس، جلسه، پروندهٔ کاغذی).
 *
 * روزهایی که پیش از زمان‌سنج بوده‌اند زمانِ ثبت‌شده ندارند؛ برای آن‌ها
 * زمان از فاصلهٔ رویدادها برآورد می‌شود و صریحاً «برآورد» نامیده می‌شود.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  /* رویدادهایی که کارِ کاربر نیستند (خودکارند) یا جای دیگری شمرده
     می‌شوند (تیکِ کار از خودِ کار خوانده می‌شود، با ساعتش). */
  var SKIP = {
    'import': 1, 'restore': 1, 'checklist': 1, 'doc-sync': 1,
    'task-done': 1, 'task-cancel': 1
  };

  /* جنسِ هر رویداد برای شمارش در گزارش */
  var SORT = {
    create: 'create', update: 'edit', bulk: 'edit', stage: 'edit', transfer: 'edit',
    form: 'form', minute: 'minute', session: 'session',
    'doc-add': 'doc', 'doc-batch': 'doc', 'doc-version': 'doc', 'doc-attach': 'doc',
    'doc-remove': 'doc', 'doc-person': 'doc', 'doc-folder': 'doc', 'doc-edit': 'doc',
    'note-add': 'note', 'note-done': 'note', 'note-remove': 'note',
    'task-add': 'task', 'task-skip': 'task', 'task-remove': 'task'
  };
  var SORTS = [
    { key: 'edit', label: 'ویرایش پرونده', short: 'ویرایش' },
    { key: 'create', label: 'ثبت پروندهٔ تازه', short: 'پروندهٔ تازه' },
    { key: 'form', label: 'فرم اداری', short: 'فرم' },
    { key: 'minute', label: 'مینوت نامه', short: 'مینوت' },
    { key: 'doc', label: 'سند و اسکن', short: 'سند' },
    { key: 'task', label: 'کار', short: 'کار' },
    { key: 'note', label: 'یادداشت', short: 'یادداشت' },
    { key: 'session', label: 'صورت‌جلسه', short: 'صورت‌جلسه' }
  ];

  var VIEWS = {
    work: 'کارتابل', list: 'فهرست پرونده‌ها', tasks: 'کارها', calendar: 'تقویم',
    archive: 'بایگانی', report: 'گزارش‌ها', people: 'اشخاص', person: 'پروندهٔ شخص',
    'case': 'پروندهٔ تازه (ذخیره‌نشده)'
  };

  /** برآورد برای روزِ بی‌زمان‌سنج: فاصلهٔ رویدادها، با سقف */
  var GAP = 25 * 60;          // بیش از این، دو نشستِ جدا
  var FIRST = 4 * 60;         // نخستین رویدادِ هر نشست

  var LABEL = {};
  (w.Activity ? w.Activity.ACTIONS : []).forEach(function (a) {
    if (a.source === 'history') LABEL[a.from] = a.label;
  });

  function jalaliOf(d) {
    if (isNaN(d.getTime())) return '';
    var j = J.toJalali(d);
    return J.pack(j.jy, j.jm, j.jd);
  }
  function hhmm(d) { return J.pad2(d.getHours()) + ':' + J.pad2(d.getMinutes()); }

  function nameOf(rec) {
    return rec ? [rec.firstName, rec.lastName].filter(Boolean).join(' ') : '';
  }

  /** «۱ ساعت و ۱۰ دقیقه» / «۴۵ دقیقه» / «کمتر از یک دقیقه» */
  function dur(sec, short) {
    var m = Math.round((sec || 0) / 60);
    if (!sec) return short ? '—' : 'بدون زمان';
    if (m < 1) return short ? '<۱ د' : 'کمتر از یک دقیقه';
    var h = Math.floor(m / 60), mm = m % 60;
    var fa = w.U.toFaDigits;
    if (short) return h ? fa(h) + ':' + fa(J.pad2(mm)) : fa(mm) + ' د';
    if (!h) return fa(mm) + ' دقیقه';
    return fa(h) + ' ساعت' + (mm ? ' و ' + fa(mm) + ' دقیقه' : '');
  }

  /* -------------------------------------------------------- رویدادها */
  /**
   * events(from, to) — همهٔ کارهای بازه، با ساعت. مرتب از قدیم به نو.
   * هر رویداد: { ms, day, time, caseId, kind, sort, label, detail, minutes }
   */
  function events(from, to) {
    var scoped = {};
    M.scoped().forEach(function (c) { scoped[c.id] = true; });
    var out = [];

    (M.state.history || []).forEach(function (h) {
      if (SKIP[h.kind]) return;
      if (h.caseId && !scoped[h.caseId] && M.get(h.caseId)) return;
      var d = new Date(h.at), day = jalaliOf(d);
      if (!day || day < from || day > to) return;
      var detail = h.note || '';
      if (h.kind === 'update' && h.changes && h.changes.length) {
        var names = h.changes.slice(0, 3).map(function (c) {
          return w.UIForm ? w.UIForm.cleanLabel(c.label) : c.label;
        });
        detail = w.U.toFaDigits(h.changes.length) + ' فیلد: ' + names.join('، ') +
          (h.changes.length > 3 ? '، …' : '');
      }
      out.push({
        ms: d.getTime(), day: day, time: hhmm(d), caseId: h.caseId || '',
        kind: h.kind, sort: SORT[h.kind] || 'edit',
        label: LABEL[h.kind] || h.kind, detail: detail,
        fields: h.kind === 'update' ? (h.changes || []).length : 0
      });
    });

    // کارهای بسته‌شده: با ساعتِ واقعی‌شان، و زمانِ دستی اگر ثبت شده
    (w.Notes ? w.Notes.all() : []).forEach(function (n) {
      if (n.kind !== 'task' || (n.status !== 'done' && n.status !== 'cancelled')) return;
      if (n.caseId && !scoped[n.caseId] && M.get(n.caseId)) return;
      var d = n.doneIso ? new Date(n.doneIso) : null;
      var day = d ? jalaliOf(d) : (n.doneAt || '');
      if (!day || day < from || day > to) return;
      out.push({
        ms: d ? d.getTime() : 0, day: day, time: d ? hhmm(d) : '',
        caseId: n.caseId || '', kind: n.status === 'done' ? 'task-done' : 'task-cancel',
        sort: 'task', label: (n.tpl ? 'چک‌لیست: ' : '') +
          (n.status === 'done' ? 'انجام شد' : 'لغو شد'),
        detail: n.title || '', minutes: n.minutes || 0, task: n
      });
    });

    out.sort(function (a, b) { return a.day === b.day ? a.ms - b.ms : (a.day < b.day ? -1 : 1); });
    return out;
  }

  /** نشست‌های یک روز: رویدادهای پشتِ سرِ هم با فاصلهٔ کمتر از GAP */
  function blocks(dayEvents) {
    var timed = dayEvents.filter(function (e) { return e.ms; });
    var out = [], cur = null;
    timed.forEach(function (e) {
      if (!cur || (e.ms - cur.endMs) / 1000 > GAP) {
        cur = { startMs: e.ms, endMs: e.ms, events: [], est: FIRST };
        out.push(cur);
      } else {
        cur.est += (e.ms - cur.endMs) / 1000;
      }
      cur.endMs = e.ms;
      cur.events.push(e);
    });
    out.forEach(function (b) {
      b.start = hhmm(new Date(b.startMs));
      b.end = hhmm(new Date(b.endMs));
      var byCase = {}, order = [];
      b.events.forEach(function (e) {
        var k = e.caseId || '';
        if (!byCase[k]) { byCase[k] = { caseId: k, n: 0, counts: {} }; order.push(k); }
        byCase[k].n++;
        byCase[k].counts[e.sort] = (byCase[k].counts[e.sort] || 0) + 1;
      });
      b.cases = order.map(function (k) { return byCase[k]; });
    });
    // رویدادهای بی‌ساعت (کارِ قدیمیِ تیک‌خورده) یک نشستِ جدا
    var untimed = dayEvents.filter(function (e) { return !e.ms; });
    if (untimed.length) {
      out.push({ start: '', end: '', events: untimed, est: 0, untimed: true,
        cases: [{ caseId: '', n: untimed.length, counts: { task: untimed.length } }] });
    }
    return out;
  }

  /* ---------------------------------------------------------- گزارش */
  /**
   * build(from, to) — کارکردِ بازه، آمادهٔ نمایش.
   */
  function build(from, to) {
    var evs = events(from, to);
    var tl = w.Timelog ? w.Timelog.range(from, to) : {};
    var byDay = {};
    evs.forEach(function (e) { (byDay[e.day] = byDay[e.day] || []).push(e); });

    var cases = {}, sorts = {}, views = {};
    function caseRow(id) {
      var key = id || '';
      if (!cases[key]) {
        var rec = id ? M.get(id) : null;
        cases[key] = {
          id: key, rec: rec, caseNo: rec ? rec.caseNo || '' : '',
          name: rec ? nameOf(rec) : '', unit: rec ? (rec.orgUnit || rec.servicePlace || '') : '',
          sec: 0, manualSec: 0, estSec: 0, events: [], counts: {}, fields: 0, last: 0
        };
      }
      return cases[key];
    }

    var days = [];
    var d = from, guard = 0;
    var T = { sec: 0, trackedSec: 0, estSec: 0, manualSec: 0, workedDays: 0, events: 0,
      tasksDone: 0, fields: 0 };
    while (d && d <= to && guard++ < 1500) {
      var p = J.unpack(d);
      var de = byDay[d] || [];
      var row = tl[d] || {};
      var tracked = 0;
      Object.keys(row).forEach(function (k) {
        if (k.charAt(0) === '_') return;
        tracked += row[k];
        if (k.indexOf('c:') === 0) caseRow(k.slice(2)).sec += row[k];
        else views[k] = (views[k] || 0) + row[k];
      });
      var bl = blocks(de);
      var est = 0;
      if (!tracked && de.length) {
        /* روزِ پیش از زمان‌سنج: برآورد از فاصلهٔ رویدادها، تقسیم بر
           پرونده‌ها به نسبتِ تعداد رویدادشان در هر نشست. */
        bl.forEach(function (b) {
          est += b.est;
          var n = b.events.length || 1;
          b.cases.forEach(function (c) { caseRow(c.caseId).estSec += b.est * c.n / n; });
        });
      }
      var manual = 0, done = 0, fields = 0;
      de.forEach(function (e) {
        var c = caseRow(e.caseId);
        c.events.push(e);
        c.counts[e.sort] = (c.counts[e.sort] || 0) + 1;
        c.fields += e.fields || 0;
        if (e.ms > c.last) c.last = e.ms;
        sorts[e.sort] = (sorts[e.sort] || 0) + 1;
        fields += e.fields || 0;
        if (e.kind === 'task-done') done++;
        if (e.minutes) { manual += e.minutes * 60; c.manualSec += e.minutes * 60; }
      });
      var caseIds = {};
      de.forEach(function (e) { if (e.caseId) caseIds[e.caseId] = 1; });
      Object.keys(row).forEach(function (k) { if (k.indexOf('c:') === 0) caseIds[k.slice(2)] = 1; });
      var total = tracked + est + manual;
      days.push({
        date: d, weekday: p ? J.weekday(p.jy, p.jm, p.jd) : '',
        holiday: p ? J.weekdayIndex(p.jy, p.jm, p.jd) === 6 : false,
        trackedSec: tracked, estSec: est, manualSec: manual, sec: total,
        estimated: !tracked && est > 0,
        start: row._s || (bl[0] && bl[0].start) || '',
        end: row._e || (bl.length && bl[bl.length - 1].end) || '',
        events: de.length, cases: Object.keys(caseIds).length, tasksDone: done,
        fields: fields, blocks: bl
      });
      if (total || de.length) T.workedDays++;
      T.sec += total; T.trackedSec += tracked; T.estSec += est; T.manualSec += manual;
      T.events += de.length; T.tasksDone += done; T.fields += fields;
      d = J.addDays(d, 1);
    }

    var caseList = Object.keys(cases).map(function (k) {
      var c = cases[k];
      c.total = c.sec + c.estSec + c.manualSec;
      return c;
    }).filter(function (c) { return c.total || c.events.length; })
      .sort(function (a, b) { return b.total - a.total || b.events.length - a.events.length; });

    T.cases = caseList.filter(function (c) { return c.id; }).length;
    SORTS.forEach(function (s) { T[s.key] = sorts[s.key] || 0; });

    return {
      from: from, to: to, days: days, totals: T,
      cases: caseList,
      sorts: SORTS.map(function (s) { return { key: s.key, label: s.label, n: sorts[s.key] || 0 }; })
        .filter(function (s) { return s.n; }).sort(function (a, b) { return b.n - a.n; }),
      views: Object.keys(views).map(function (k) {
        return { key: k, label: VIEWS[k.slice(2)] || k.slice(2), sec: views[k] };
      }).sort(function (a, b) { return b.sec - a.sec; }),
      tasks: taskStats(from, to)
    };
  }

  /* -------------------------------------------------- آمار کارها */
  /**
   * کارهای بازه، جزئی‌تر از گزارش قدیمی: ساخته‌شده، بسته‌شده، در مهلت یا
   * با تأخیر، میانگین روز تا انجام، زمانِ دستی، و همهٔ این‌ها به تفکیک
   * دسته و ارجاع‌دهنده.
   */
  function taskStats(from, to) {
    var all = (w.Notes ? w.Notes.all() : []).filter(function (n) {
      return n.kind === 'task' && !n.tpl;
    });
    var created = 0, done = 0, cancelled = 0, onTime = 0, late = 0, daysSum = 0, daysN = 0,
      minutes = 0, overdueNow = 0, openNow = 0;
    var byCat = {}, byFrom = {}, doneList = [];
    function bucket(map, key) {
      var k = key || '—';
      return map[k] || (map[k] = { key: k, created: 0, done: 0, cancelled: 0, onTime: 0,
        late: 0, minutes: 0, open: 0, overdue: 0 });
    }
    all.forEach(function (n) {
      var made = n.at ? jalaliOf(new Date(n.at)) : '';
      var cat = bucket(byCat, n.category), fr = bucket(byFrom, n.from);
      if (made >= from && made <= to) { created++; cat.created++; fr.created++; }
      if (n.status === 'open' && !n.archived) {
        var od = w.Notes.bucketOf(n) === 'overdue';
        if (od) { overdueNow++; cat.overdue++; fr.overdue++; }
        else { openNow++; cat.open++; fr.open++; }
        return;
      }
      var when = n.doneAt || '';
      if (!when || when < from || when > to) return;
      if (n.status === 'cancelled') { cancelled++; cat.cancelled++; fr.cancelled++; return; }
      if (n.status !== 'done') return;
      done++; cat.done++; fr.done++;
      doneList.push(n);
      if (n.minutes) { minutes += n.minutes; cat.minutes += n.minutes; fr.minutes += n.minutes; }
      if (n.followUp) {
        if (when <= n.followUp) { onTime++; cat.onTime++; fr.onTime++; }
        else { late++; cat.late++; fr.late++; }
      }
      if (made) {
        var dd = J.diffDays(when, made);
        if (dd != null && dd >= 0) { daysSum += dd; daysN++; }
      }
    });
    function rows(map) {
      return Object.keys(map).map(function (k) { return map[k]; })
        .filter(function (r) { return r.created || r.done || r.cancelled || r.open || r.overdue; })
        .sort(function (a, b) { return (b.done + b.open + b.overdue) - (a.done + a.open + a.overdue); });
    }
    doneList.sort(function (a, b) {
      return (b.doneIso || b.doneAt || '') < (a.doneIso || a.doneAt || '') ? -1 : 1;
    });
    return {
      created: created, done: done, cancelled: cancelled, onTime: onTime, late: late,
      onTimePct: (onTime + late) ? Math.round(onTime * 100 / (onTime + late)) : null,
      avgDays: daysN ? Math.round(daysSum * 10 / daysN) / 10 : null,
      minutes: minutes, overdueNow: overdueNow, openNow: openNow,
      byCategory: rows(byCat), byFrom: rows(byFrom), doneList: doneList
    };
  }

  /** کارکردِ امروز — برای صفحهٔ کارها */
  function today() { var t = J.today(); return build(t, t); }

  w.Worklog = {
    SORTS: SORTS, VIEWS: VIEWS, GAP: GAP,
    events: events, blocks: blocks, build: build, today: today,
    taskStats: taskStats, dur: dur, nameOf: nameOf
  };
})(window);

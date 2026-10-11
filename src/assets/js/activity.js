/*
 * کارکرد روزانه — خروجیِ ماشین‌خوان.
 *
 * کارنامه (karnameh.js) همین داده را برای *آدم* می‌چیند: یک بازه، چند
 * عدد درشت، و چند بند فارسی. این فایل همان را برای *برنامهٔ دیگر*
 * می‌چیند: روز به روز، با کلیدهای ثابت انگلیسی، تا جایی دیگر خوانده و
 * وارد شود.
 *
 * سه قاعده که این خروجی را قابل اتکا می‌کند:
 *
 *   ۱) روزِ خالی هم یک سطر است. «آن روز کاری نکردم» خودش داده است؛ اگر
 *      سطرش نباشد، برنامهٔ گیرنده نمی‌فهمد آن روز تعطیل بوده یا فقط
 *      داده‌اش نرسیده.
 *
 *   ۲) هر شمارنده می‌گوید از کجا آمده (source). سه منبع داریم و جمعِ
 *      کورشان غلط است:
 *        history — رویدادی که در برنامه ثبت شده («سند اضافه شد»)
 *        case    — تاریخی که در خودِ پرونده نشسته («نامهٔ دعوت ۱۴۰۵/۰۶/۱۰»)
 *        doc     — فایلی که روی دیسک بایگانی شده
 *        task    — کاری که تیک خورده
 *      یک بارگذاری، هم رویداد است هم فایل. پس جمعِ کل را نمی‌دهیم؛
 *      چهار جمعِ جدا می‌دهیم و می‌گوییم هرکدام چیست.
 *
 *   ۳) خودِ خروجی، فهرستِ کنش‌ها را با خودش می‌برد (actions). برنامهٔ
 *      گیرنده لازم نیست جدولِ معنیِ کلیدها را جای دیگری داشته باشد.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  /* نسخهٔ طرح‌واره. اگر روزی شکل خروجی عوض شد، این عدد بالا می‌رود تا
     برنامهٔ گیرنده بفهمد با چه چیزی طرف است. */
  var SCHEMA = 1;

  /*
   * فهرست کنش‌ها.
   *
   * key    — کلید ثابت و انگلیسی؛ همین است که در خروجی می‌آید و نباید
   *          عوض شود.
   * label  — همان چیز، به زبان آدم.
   * group  — برای دسته‌بندی در گزارش گیرنده.
   * source — از کدام لایه شمرده می‌شود (بالا توضیح داده شد).
   * from   — کلیدِ داخلی که این کنش از روی آن شمرده می‌شود.
   */
  var ACTIONS = [
    // ---------------------------------------------------------- پرونده
    { key: 'case.create', label: 'ثبت پروندهٔ تازه', group: 'case', source: 'history', from: 'create' },
    { key: 'case.update', label: 'ویرایش پرونده', group: 'case', source: 'history', from: 'update' },
    { key: 'case.delete', label: 'حذف پرونده', group: 'case', source: 'history', from: 'delete' },
    { key: 'case.bulk', label: 'اقدام دسته‌ای روی چند پرونده', group: 'case', source: 'history', from: 'bulk' },
    { key: 'case.stage', label: 'تنظیم دستی مرحلهٔ پرونده', group: 'case', source: 'history', from: 'stage' },
    { key: 'data.import', label: 'ورود داده از اکسل', group: 'data', source: 'history', from: 'import' },
    { key: 'data.restore', label: 'بازیابی از نسخهٔ پشتیبان', group: 'data', source: 'history', from: 'restore' },

    // ------------------------------------------------------- مستندات
    { key: 'doc.add', label: 'افزودن سند به پرونده', group: 'doc', source: 'history', from: 'doc-add' },
    { key: 'doc.batch', label: 'بارگذاری دسته‌ای (اسکن)', group: 'doc', source: 'history', from: 'doc-batch' },
    { key: 'doc.version', label: 'نسخهٔ تازهٔ یک سند', group: 'doc', source: 'history', from: 'doc-version' },
    { key: 'doc.attach', label: 'وصل سند بی‌پرونده به پرونده', group: 'doc', source: 'history', from: 'doc-attach' },
    { key: 'doc.sync', label: 'پر شدن فیلد پرونده از روی سند', group: 'doc', source: 'history', from: 'doc-sync' },
    { key: 'doc.remove', label: 'حذف سند', group: 'doc', source: 'history', from: 'doc-remove' },
    { key: 'doc.person', label: 'مدرک شخص', group: 'doc', source: 'history', from: 'doc-person' },
    { key: 'doc.folder', label: 'تغییر پوشهٔ مستندات', group: 'doc', source: 'history', from: 'doc-folder' },
    { key: 'doc.edit', label: 'ویرایش مشخصات سند', group: 'doc', source: 'history', from: 'doc-edit' },

    // ------------------------------------------- کارها و یادداشت‌ها
    { key: 'task.add', label: 'ثبت کار تازه', group: 'task', source: 'history', from: 'task-add' },
    { key: 'task.remove', label: 'حذف کار', group: 'task', source: 'history', from: 'task-remove' },
    { key: 'task.done', label: 'انجام شدن کار', group: 'task', source: 'task', from: 'done' },
    { key: 'task.cancel', label: 'لغو کار', group: 'task', source: 'task', from: 'cancelled' },
    { key: 'note.add', label: 'نوشتن یادداشت', group: 'task', source: 'history', from: 'note-add' },
    { key: 'note.done', label: 'بستن پیگیری یادداشت', group: 'task', source: 'history', from: 'note-done' },
    { key: 'note.remove', label: 'حذف یادداشت', group: 'task', source: 'history', from: 'note-remove' },
    { key: 'task.skip', label: 'کاری که لازم نبود', group: 'task', source: 'history', from: 'task-skip' },
    { key: 'checklist.make', label: 'ساخت چک‌لیست مرحله', group: 'task', source: 'history', from: 'checklist' },

    // ------------------------------------------------- فرم و صورت‌جلسه
    { key: 'form.make', label: 'ساختن فرم اداری (چاپ یا ورد)', group: 'letter', source: 'history', from: 'form' },
    { key: 'committee.minutes', label: 'ثبت صورت‌جلسهٔ کمیته', group: 'committee', source: 'history', from: 'session' },

    // ------------------- کارِ واقعیِ ثبت‌شده در خودِ پرونده (تاریخ‌ها)
    { key: 'case.intake', label: 'ورود پرونده به دبیرخانه', group: 'case', source: 'case', from: 'intakeDate' },
    { key: 'case.assign', label: 'تحویل پرونده به کارشناس', group: 'case', source: 'case', from: 'deliveryDate' },
    { key: 'doc.decree', label: 'بارگذاری آخرین حکم کارگزینی', group: 'doc', source: 'case', from: 'decreeDate' },
    { key: 'letter.defect', label: 'نامهٔ رفع نواقص', group: 'letter', source: 'case', from: 'defectLetterDate' },
    { key: 'letter.inquiryOut', label: 'نامهٔ استعلام حراست (صادره)', group: 'letter', source: 'case', from: 'securityOutLetterDate' },
    { key: 'letter.inquiryIn', label: 'پاسخ حراست (وارده)', group: 'letter', source: 'case', from: 'securityInLetterDate' },
    { key: 'letter.invite', label: 'نامهٔ دعوت به کمیته', group: 'letter', source: 'case', from: 'invitationLetterDate' },
    { key: 'letter.salaryStop', label: 'نامهٔ بستن حقوق', group: 'letter', source: 'case', from: 'salaryStopLetterDate' },
    { key: 'letter.chase', label: 'نامهٔ پیگیری دفاعیات', group: 'letter', source: 'case', from: 'defenseChaseLetterDate' },
    { key: 'defense.received', label: 'دریافت دفاعیهٔ کارمند', group: 'defense', source: 'case', from: 'defenseReceivedDate' },
    { key: 'case.docsComplete', label: 'تکمیل مستندات پرونده', group: 'case', source: 'case', from: 'docsCompleteDate' },
    { key: 'letter.hearing', label: 'نامهٔ دعوت به جلسهٔ کمیته', group: 'letter', source: 'case', from: 'hearingLetterDate' },
    { key: 'committee.hearing', label: 'طرح در کمیته / جلسهٔ دفاع', group: 'committee', source: 'case', from: 'committeeDate' },
    { key: 'verdict.issue', label: 'صدور رأی', group: 'verdict', source: 'case', from: 'verdictDate' },
    { key: 'verdict.sign', label: 'امضای رأی توسط اعضا', group: 'verdict', source: 'case', from: 'verdictSignedDate' },
    { key: 'letter.notice', label: 'نامهٔ ابلاغ رأی', group: 'letter', source: 'case', from: 'noticeLetterDate' },
    { key: 'notice.result', label: 'دریافت نتیجهٔ ابلاغ', group: 'verdict', source: 'case', from: 'noticeResultDate' },
    { key: 'letter.salaryResume', label: 'نامهٔ باز کردن حقوق', group: 'letter', source: 'case', from: 'salaryResumeLetterDate' },
    { key: 'enforce.dismissal', label: 'اخراج / خاتمهٔ همکاری', group: 'enforce', source: 'case', from: 'dismissalDate' },
    { key: 'enforce.undertaking', label: 'اخذ تعهد از کارمند', group: 'enforce', source: 'case', from: 'undertakingDate' },
    { key: 'case.archive', label: 'ارسال پرونده به بایگانی', group: 'case', source: 'case', from: 'archiveDate' },

    // ------------------------------------------------ فایل‌های بایگانی
    { key: 'file.scan', label: 'فایل بایگانی‌شده (اسکن یا بارگذاری)', group: 'doc', source: 'doc', from: 'file' },
    { key: 'file.batch', label: 'نوبت بارگذاری (دسته)', group: 'doc', source: 'doc', from: 'batch' }
  ];

  var GROUPS = [
    { key: 'case', label: 'پرونده' },
    { key: 'letter', label: 'مکاتبات' },
    { key: 'doc', label: 'مستندات و اسکن' },
    { key: 'defense', label: 'دفاعیات' },
    { key: 'committee', label: 'کمیته' },
    { key: 'verdict', label: 'رأی و ابلاغ' },
    { key: 'enforce', label: 'اجرای رأی' },
    { key: 'task', label: 'کارها و یادداشت‌ها' },
    { key: 'data', label: 'داده و پشتیبان' }
  ];

  var SOURCES = [
    { key: 'history', label: 'رویدادِ ثبت‌شده در برنامه' },
    { key: 'case', label: 'تاریخِ نشسته در خودِ پرونده' },
    { key: 'doc', label: 'فایلِ بایگانی‌شده روی دیسک' },
    { key: 'task', label: 'کارِ بسته‌شده' }
  ];

  /*
   * دو رویداد عمداً از تاریخچه شمرده نمی‌شوند.
   *
   * «کار انجام شد» و «کار لغو شد» هم در تاریخچه ثبت می‌شوند و هم در
   * خودِ کار (doneAt). تاریخِ درست، همان doneAt است — چون کاری که دیروز
   * تمام شده ولی امروز تیک خورده، مالِ دیروز است. شمردن از هر دو جا
   * یعنی دو بار شمردن، پس یکی را انتخاب کرده‌ایم و اینجا صریح
   * نوشته‌ایم تا «جا افتاده» به نظر نرسد.
   */
  var COUNTED_ELSEWHERE = {
    'task-done': 'task.done',
    'task-cancel': 'task.cancel'
  };

  var BY_HISTORY = {}, BY_FIELD = {};
  ACTIONS.forEach(function (a) {
    if (a.source === 'history') BY_HISTORY[a.from] = a.key;
    if (a.source === 'case') BY_FIELD[a.from] = a.key;
  });

  function jalaliOf(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var j = J.toJalali(d);
    return J.pack(j.jy, j.jm, j.jd);
  }

  /* بیش از این، خروجی از اندازهٔ یک فایل متنی بیرون می‌زند و هیچ برنامه‌ای
     هم روز به روزِ ده سال را نمی‌خواهد. */
  var MAX_DAYS = 1500;

  /**
   * daily(from, to, opts) — یک سطر برای هر روزِ بازه، حتی روزِ خالی.
   * opts: { user, all }  — all یعنی بیرون از دامنهٔ کار هم شمرده شود
   */
  function daily(from, to, opts) {
    opts = opts || {};
    var who = opts.user || '';
    var cases = opts.all ? M.state.cases : M.scoped();
    var inScope = {};
    cases.forEach(function (c) { inScope[c.id] = c; });

    var bag = {};        // تاریخ → { counts, cases:{}, sources }
    function day(d) {
      if (!d || d < from || d > to) return null;
      return bag[d] || (bag[d] = {
        counts: {}, cases: {},
        sources: { history: 0, 'case': 0, doc: 0, task: 0 }
      });
    }
    function add(d, actionKey, source, caseId) {
      var b = day(d);
      if (!b) return;
      b.counts[actionKey] = (b.counts[actionKey] || 0) + 1;
      b.sources[source] += 1;
      if (caseId) b.cases[caseId] = true;
    }

    // ۱) رویدادهای ثبت‌شده
    (M.state.history || []).forEach(function (h) {
      if (who && (h.user || '') !== who) return;
      if (h.caseId && !inScope[h.caseId]) return;
      var key = BY_HISTORY[h.kind];
      if (!key) return;
      add(jalaliOf(h.at), key, 'history', h.caseId);
    });

    // ۲) تاریخ‌هایی که در خودِ پرونده نشسته‌اند
    cases.forEach(function (rec) {
      Object.keys(BY_FIELD).forEach(function (field) {
        if (rec[field]) add(rec[field], BY_FIELD[field], 'case', rec.id);
      });
    });

    // ۳) فایل‌های بایگانی
    var batchSeen = {};
    (w.Docs && w.Docs.all ? w.Docs.all() : []).forEach(function (d) {
      if (d.superseded) return;
      if (who && (d.user || '') !== who) return;
      if (d.caseId && !inScope[d.caseId]) return;
      /* addedAtJalali یک رشتهٔ خواندنی است («۱۴۰۵/۰۶/۳۱ ساعت ۰۹:۱۲»)،
         نه تاریخِ ۸ رقمی. مبنا همان زمانِ ISO است. */
      var when = jalaliOf(d.addedAt);
      add(when, 'file.scan', 'doc', d.caseId);
      if (d.batchId && !batchSeen[d.batchId]) {
        batchSeen[d.batchId] = true;
        add(when, 'file.batch', 'doc', '');
      }
    });

    // ۴) کارهای بسته‌شده
    (w.Notes && w.Notes.doneBetween ? w.Notes.doneBetween(from, to) : [])
      .forEach(function (t) {
        if (who && (t.owner || t.user || '') !== who) return;
        if (t.caseId && !inScope[t.caseId]) return;
        // doneAt خودش تاریخ شمسیِ ۸ رقمی است، نه ISO
        var when = t.doneAt || t.followUp || '';
        add(when, t.status === 'cancelled' ? 'task.cancel' : 'task.done',
          'task', t.caseId);
      });

    // ---- ساختن سطرها، روز به روز؛ روزِ خالی هم سطر خودش را دارد
    var out = [];
    var d = from, guard = 0;
    while (d && d <= to && guard++ < MAX_DAYS) {
      var p = J.unpack(d);
      var b = bag[d];
      var total = 0;
      if (b) {
        Object.keys(b.counts).forEach(function (k) { total += b.counts[k]; });
      }
      out.push({
        date: d,
        dateText: J.format(d, { latin: true }),
        weekday: p ? J.weekday(p.jy, p.jm, p.jd) : '',
        weekdayIndex: p ? J.weekdayIndex(p.jy, p.jm, p.jd) : null,
        // جمعه تعطیلِ رسمی است؛ بقیهٔ تعطیلی‌ها را برنامه نمی‌داند
        holiday: p ? J.weekdayIndex(p.jy, p.jm, p.jd) === 6 : false,
        worked: total > 0,
        total: total,
        cases: b ? Object.keys(b.cases).length : 0,
        bySource: b ? b.sources : { history: 0, 'case': 0, doc: 0, task: 0 },
        counts: b ? b.counts : {}
      });
      d = J.addDays(d, 1);
    }
    return out;
  }

  /** جمعِ چند سطر روزانه در یک سطل */
  function fold(days, key, label) {
    var counts = {}, sources = { history: 0, 'case': 0, doc: 0, task: 0 };
    var total = 0, worked = 0;
    days.forEach(function (r) {
      total += r.total;
      if (r.worked) worked++;
      Object.keys(r.counts).forEach(function (k) {
        counts[k] = (counts[k] || 0) + r.counts[k];
      });
      Object.keys(sources).forEach(function (s) { sources[s] += r.bySource[s]; });
    });
    return {
      key: key, label: label,
      from: days[0].date, to: days[days.length - 1].date,
      days: days.length,
      workedDays: worked,
      idleDays: days.length - worked,
      total: total,
      bySource: sources,
      counts: counts
    };
  }

  /** هفته‌ها (از شنبه) از روی سطرهای روزانه */
  function weeks(rows) {
    var out = [], cur = [];
    rows.forEach(function (r) {
      // شنبه سرِ هفته است؛ اولین سطر هرچه باشد، هفتهٔ خودش را شروع می‌کند
      if (cur.length && r.weekdayIndex === 0) {
        out.push(cur); cur = [];
      }
      cur.push(r);
    });
    if (cur.length) out.push(cur);
    return out.map(function (g, i) {
      return fold(g, 'w' + (i + 1), 'هفتهٔ ' + w.U.toFaDigits(i + 1));
    });
  }

  /** ماه‌های شمسی از روی سطرهای روزانه */
  function months(rows) {
    var order = [], bag = {};
    rows.forEach(function (r) {
      var k = r.date.slice(0, 6);
      if (!bag[k]) { bag[k] = []; order.push(k); }
      bag[k].push(r);
    });
    return order.map(function (k) {
      var p = J.unpack(bag[k][0].date);
      return fold(bag[k], k, J.MONTHS[p.jm - 1] + ' ' + w.U.toFaDigits(p.jy));
    });
  }

  /**
   * bundle(from, to, opts) — کل بستهٔ خروجی، آمادهٔ JSON شدن.
   * خودش را توضیح می‌دهد: فهرست کنش‌ها، گروه‌ها و منبع‌ها همراهش است.
   */
  function bundle(from, to, opts) {
    opts = opts || {};
    var rows = daily(from, to, opts);
    var all = rows.length ? fold(rows, 'all', 'کل بازه') : null;
    return {
      meta: {
        app: 'نوکمان — کمیتهٔ انضباطی',
        schema: SCHEMA,
        generatedAt: new Date().toISOString(),
        generatedAtJalali: J.stamp(),
        calendar: 'jalali',
        dateFormat: 'YYYYMMDD',
        from: from, to: to,
        days: rows.length,
        user: opts.user || '',
        scope: opts.all ? 'all' : 'working',
        org: (M.state.settings || {}).orgName || '',
        note: 'هر سطرِ days یک روز است، حتی روزی که کاری نشده (worked=false). ' +
          'counts کلیدهای actions را دارد. جمعِ منبع‌های مختلف روی هم، ' +
          'یک کار را دوبار می‌شمارد؛ برای همین bySource جداست.'
      },
      actions: ACTIONS,
      groups: GROUPS,
      sources: SOURCES,
      totals: all,
      days: rows,
      weeks: weeks(rows),
      months: months(rows)
    };
  }

  /** همان بسته، به شکل CSV — یک سطر برای هر روز، یک ستون برای هر کنش */
  function csv(pack) {
    var keys = ACTIONS.map(function (a) { return a.key; });
    var head = ['date', 'weekday', 'holiday', 'worked', 'total', 'cases',
      'src_history', 'src_case', 'src_doc', 'src_task'].concat(keys);
    var lines = [head.join(',')];
    pack.days.forEach(function (r) {
      var row = [r.date, r.weekday, r.holiday ? 1 : 0, r.worked ? 1 : 0,
        r.total, r.cases,
        r.bySource.history, r.bySource['case'], r.bySource.doc, r.bySource.task];
      keys.forEach(function (k) { row.push(r.counts[k] || 0); });
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  w.Activity = {
    SCHEMA: SCHEMA, ACTIONS: ACTIONS, GROUPS: GROUPS, SOURCES: SOURCES,
    COUNTED_ELSEWHERE: COUNTED_ELSEWHERE,
    daily: daily, weeks: weeks, months: months, fold: fold,
    bundle: bundle, csv: csv
  };
})(window);

/*
 * چک‌لیست مرحله‌ای — «وقتی پرونده به این مرحله رسید، این کارها باید بشود».
 *
 * ریل گردش‌کار می‌گوید پرونده *کجاست*؛ کارها می‌گوید *چه* مانده. چیزی که
 * بین این دو جا خالی بود، همین است: کارِ تکراریِ هر مرحله، که هر بار از
 * حفظ انجام می‌شد و هر بار یکی‌اش از قلم می‌افتاد.
 *
 * چهار تصمیم که این فایل را شکل داده‌اند:
 *
 *   ۱) آیتم‌های چک‌لیست، خودشان «کار»ند — نه موجودیتی تازه. آن‌وقت
 *      کارتابل، تقویم، کارنامه، خروجی کارکرد، سررسید و بایگانی مجانی
 *      کار می‌کنند. سه فیلد به کار اضافه شده و بس: tpl (از کدام قالب)،
 *      step (ترتیب)، stage (مال کدام مرحله).
 *
 *   ۲) یک بار ساخته می‌شود، نه هر بار. پرونده در گردش‌کار عقب و جلو
 *      می‌رود؛ اگر هر بار بسازیم، چک‌لیستِ تکراری می‌بارد. معیارِ
 *      «ساخته شده»، خودِ وجودِ کارهاست — پس حذف هم به معنای «دوباره
 *      نساز» است.
 *
 *   ۳) کارِ اختیاری سه حالت دارد: انجام شد / لازم نبود / مانده. با دو
 *      حالت، «نامهٔ رفع نواقص» برای پرونده‌ای که نواقصی نداشته تا ابد
 *      قرمز می‌ماند. و «لازم نبود» خودش داده است، نه پاک کردنِ کار.
 *
 *   ۴) هر آیتم می‌تواند کارش را هم انجام بدهد. «فرم خلاصهٔ پرونده» را
 *      قبلاً ساخته‌ایم؛ آیتم باید همان را باز کند، نه فقط یادآوری‌اش.
 *      و وقتی آن کار انجام شد، تیکش خودش بخورد.
 */
(function (w) {
  'use strict';

  var M = w.Model;

  /*
   * قالب‌های پیش‌فرض.
   *
   * هر قالب به یک مرحلهٔ ریل بسته است، نه به «وضعیت پرونده»: وضعیت را
   * دست آدم می‌نویسد و گاهی عقب می‌ماند، ولی مرحله از تاریخ‌های واقعیِ
   * پرونده درمی‌آید و دروغ نمی‌گوید.
   *
   * item.cta همان سه جنسِ دکمهٔ آلارم است که در برنامه هست:
   *   upload — پنجرهٔ بارگذاری، با نوعِ از پیش انتخاب‌شده
   *   form   — یکی از فرم‌های اداری
   *   field  — پریدن سرِ همان فیلد در فرم پرونده
   * و هر سه، وقتی کارشان انجام شد، تیکِ آیتم را خودشان می‌زنند.
   */
  var TEMPLATES = [
    {
      key: 'intake', stage: 'assign', label: 'تشکیل پرونده',
      hint: 'از لحظه‌ای که پرونده ثبت می‌شود تا وقتی آمادهٔ مکاتبات است.',
      items: [
        { key: 'person', title: 'ثبت اطلاعات شخص',
          cta: { type: 'field', field: 'nationalId' } },
        { key: 'print', title: 'پرینت نامه‌ها و محتویات پرونده' },
        { key: 'letters', title: 'انجام مکاتبات اداری' },
        { key: 'defect', title: 'نامهٔ رفع نواقص', optional: true,
          cta: { type: 'upload', kind: 'نامهٔ رفع نواقص' } },
        { key: 'folder', title: 'پوشه کردن پرونده' }
      ]
    },
    {
      key: 'defense', stage: 'complete', label: 'پس از دریافت دفاعیه',
      hint: 'دفاعیه که رسید، تا پرونده آمادهٔ طرح در کمیته شود.',
      items: [
        { key: 'summary', title: 'نوشتن خلاصهٔ دفاعیات',
          cta: { type: 'field', field: 'defenseSummary' } },
        { key: 'scan', title: 'اسکن و بایگانی دفاعیه', optional: true,
          cta: { type: 'upload', kind: 'دفاعیهٔ کتبی' } }
      ]
    },
    {
      key: 'hearing', stage: 'hearing', label: 'دستور کار و جلسه',
      hint: 'وقتی پرونده در دستور کار قرار می‌گیرد، تا تحویل به کارشناس مسئول.',
      items: [
        { key: 'form', title: 'آماده کردن فرم خلاصهٔ پرونده',
          cta: { type: 'form', form: 'summary' } },
        { key: 'invite', title: 'نامهٔ دعوت به جلسهٔ کمیته',
          cta: { type: 'upload', kind: 'نامهٔ حضور در جلسهٔ دفاع' } },
        { key: 'extra', title: 'پرینت نامه‌های تکمیلی' },
        { key: 'label', title: 'لیبل زدن پرونده' },
        { key: 'handover', title: 'تحویل پرونده به کارشناس مسئول' }
      ]
    }
  ];

  var CATEGORY = 'چک‌لیست مرحله';

  /** قالب‌های جاری: آنچه کاربر ذخیره کرده، وگرنه پیش‌فرض‌ها */
  function templates() {
    var saved = (M.state.settings || {}).checklists;
    return (saved && saved.length) ? saved : TEMPLATES;
  }

  function saveTemplates(list) {
    return M.saveSettings({ checklists: list });
  }

  function byKey(key) {
    var found = null;
    templates().forEach(function (t) { if (t.key === key) found = t; });
    return found;
  }

  /*
   * آیتم‌های یک قالب برای یک پروندهٔ مشخص.
   * «بسته به نوع پرونده یکی دو کار کم یا زیاد می‌شود» — هر آیتم می‌تواند
   * بگوید فقط برای کدام نوع‌هاست؛ فهرست خالی یعنی برای همه.
   */
  function itemsFor(tpl, rec) {
    return (tpl.items || []).filter(function (it) {
      if (!it.types || !it.types.length) return true;
      return it.types.indexOf(rec.caseType || '') >= 0;
    });
  }

  /** قالبی که به مرحلهٔ جاری پرونده می‌خورد */
  function dueTemplate(rec) {
    var action = w.Worklist.nextAction(rec);
    if (!action || action.key === 'closed' || action.key === 'transferred') return null;
    var found = null;
    templates().forEach(function (t) { if (t.stage === action.key) found = t; });
    return found;
  }

  /** کارهای یک چک‌لیستِ ساخته‌شده (هر وضعیتی) */
  function tasksOf(caseId, tplKey) {
    return w.Notes.tasks({ caseId: caseId, status: null, archived: 'any' })
      .filter(function (t) { return t.tpl === tplKey; })
      .sort(function (a, b) { return (a.step || 0) - (b.step || 0); });
  }

  function exists(caseId, tplKey) { return tasksOf(caseId, tplKey).length > 0; }

  /**
   * ساختِ چک‌لیستِ مرحلهٔ جاری — اگر از قبل ساخته نشده باشد.
   * برمی‌گرداند: شمارِ کارهای تازه‌ساخته‌شده.
   */
  function ensureFor(rec, tplKey) {
    if (!rec || !rec.id) return Promise.resolve(0);
    var tpl = tplKey ? byKey(tplKey) : dueTemplate(rec);
    if (!tpl) return Promise.resolve(0);
    if (exists(rec.id, tpl.key)) return Promise.resolve(0);
    var items = itemsFor(tpl, rec);
    if (!items.length) return Promise.resolve(0);

    var chain = Promise.resolve();
    items.forEach(function (it, i) {
      chain = chain.then(function () {
        return w.Notes.create({
          /* «ارجاع‌دهنده» عمداً خالی است: این کار را کسی ارجاع نداده،
             خودِ مرحله آورده. پر کردنش یعنی «تشکیل پرونده» در فهرستِ
             ارجاع‌دهنده‌ها کنار «رئیس کمیته» بنشیند. */
          kind: 'task', caseId: rec.id, title: it.title,
          category: CATEGORY,
          tpl: tpl.key, step: i + 1, stage: tpl.stage,
          optional: !!it.optional, item: it.key,
          cta: it.cta || null,
          // یک سطر تاریخچه برای کل چک‌لیست، نه یکی به ازای هر کار
          quiet: true
        });
      });
    });
    return chain.then(function () {
      M.addHistory('checklist', rec, [],
        'چک‌لیست «' + tpl.label + '» ساخته شد — ' +
        w.U.toFaDigits(items.length) + ' کار');
      return items.length;
    });
  }

  /** همان کار، برای همهٔ پرونده‌های دامنهٔ کار — یک بار موقع بالا آمدن */
  function ensureAll() {
    var list = M.scoped();
    var chain = Promise.resolve();
    var made = 0;
    list.forEach(function (rec) {
      chain = chain.then(function () {
        return ensureFor(rec).then(function (n) { made += n; });
      });
    });
    return chain.then(function () { return made; });
  }

  /*
   * تیکِ خودکار.
   *
   * آیتمی که به یک فیلد وصل است، وقتی آن فیلد پر شد دیگر کار ندارد. اگر
   * منتظر بمانیم کاربر خودش تیک بزند، چک‌لیست از واقعیتِ پرونده عقب
   * می‌افتد — و چک‌لیستی که عقب است، بدتر از نداشتنش است.
   */
  function sync(rec) {
    if (!rec || !rec.id) return Promise.resolve(0);
    var open = w.Notes.tasks({ caseId: rec.id, status: 'open', archived: 'any' })
      .filter(function (t) {
        return t.tpl && t.cta && t.cta.type === 'field' && t.cta.field &&
          String(rec[t.cta.field] || '').trim();
      });
    if (!open.length) return Promise.resolve(0);
    var chain = Promise.resolve();
    open.forEach(function (t) {
      chain = chain.then(function () { return w.Notes.complete(t); });
    });
    return chain.then(function () { return open.length; });
  }

  /**
   * «این کار انجام شد» — از بیرون.
   * فرمی که ساخته شد یا سندی که بارگذاری شد، تیکِ آیتمِ متناظرش را
   * می‌زند؛ وگرنه کاربر باید یک کار را دو بار اعلام کند.
   */
  function hit(rec, type, value) {
    if (!rec || !rec.id || !type) return Promise.resolve(0);
    var open = w.Notes.tasks({ caseId: rec.id, status: 'open', archived: 'any' })
      .filter(function (t) {
        if (!t.tpl || !t.cta || t.cta.type !== type) return false;
        if (type === 'form') return t.cta.form === value;
        if (type === 'upload') return t.cta.kind === value;
        return false;
      });
    if (!open.length) return Promise.resolve(0);
    var chain = Promise.resolve();
    open.forEach(function (t) {
      chain = chain.then(function () { return w.Notes.complete(t); });
    });
    return chain.then(function () { return open.length; });
  }

  /** چک‌لیست‌های یک پرونده، با پیشرفتشان */
  function groups(caseId) {
    var rec = M.get(caseId);
    if (!rec) return [];
    var out = [];
    templates().forEach(function (tpl) {
      var list = tasksOf(caseId, tpl.key);
      if (!list.length) return;
      out.push(wrap(tpl, list, rec));
    });
    return out;
  }

  function wrap(tpl, list, rec) {
    var done = 0, skipped = 0, open = 0, openRequired = 0;
    list.forEach(function (t) {
      if (t.status === 'done') done++;
      else if (t.status === 'skipped') skipped++;
      else if (t.status === 'cancelled') skipped++;
      else {
        open++;
        if (!t.optional) openRequired++;
      }
    });
    var settled = done + skipped;
    return {
      key: tpl.key, label: tpl.label, hint: tpl.hint, stage: tpl.stage,
      tasks: list, rec: rec,
      done: done, skipped: skipped, open: open, openRequired: openRequired,
      total: list.length, settled: settled,
      complete: open === 0,
      pct: list.length ? Math.round((settled / list.length) * 100) : 0
    };
  }

  /** پیشرفتِ چک‌لیستِ مرحلهٔ جاری — برای نشان دادن روی ریل */
  function current(rec) {
    if (!rec) return null;
    var tpl = dueTemplate(rec);
    if (!tpl) return null;
    var list = tasksOf(rec.id, tpl.key);
    if (!list.length) return null;
    return wrap(tpl, list, rec);
  }

  /**
   * کارهای الزامیِ مانده — هشدار، نه سد.
   * کارِ اداری همیشه مرتب جلو نمی‌رود و سدِ سفت باعث می‌شود دورش بزنند.
   * پس فقط می‌گوییم چه مانده، و راه را نمی‌بندیم.
   */
  function pending(rec) {
    if (!rec) return [];
    var cur = dueTemplate(rec);
    var curKey = cur ? cur.key : '';
    var out = [];
    groups(rec.id).forEach(function (g) {
      if (g.key === curKey) return;        // مرحلهٔ جاری، هنوز وقت دارد
      g.tasks.forEach(function (t) {
        if (t.status === 'open' && !t.optional) out.push({ group: g, task: t });
      });
    });
    return out;
  }

  /** کلِ چک‌لیست را کنار بگذار — بدون اینکه دوباره ساخته شود */
  function dismiss(group) {
    var chain = Promise.resolve();
    group.tasks.forEach(function (t) {
      if (t.status !== 'open') return;
      chain = chain.then(function () {
        return w.Notes.skipTask(t, 'کل چک‌لیست کنار گذاشته شد');
      });
    });
    return chain;
  }

  function labelOf(tplKey) {
    var t = byKey(tplKey);
    return t ? t.label : tplKey;
  }

  /** آمارِ چک‌لیست‌ها در یک بازه — برای کارنامه و گزارش مدیر */
  function stats(from, to) {
    var byTpl = {};
    var done = 0, skipped = 0, open = 0;
    w.Notes.tasks({ status: null, archived: 'any' }).forEach(function (t) {
      if (!t.tpl) return;
      var row = byTpl[t.tpl] || (byTpl[t.tpl] = {
        key: t.tpl, label: labelOf(t.tpl), done: 0, skipped: 0, open: 0
      });
      if (t.status === 'open') { row.open++; open++; return; }
      var when = t.doneAt || '';
      if (from && (!when || when < from || when > to)) return;
      if (t.status === 'done') { row.done++; done++; }
      else { row.skipped++; skipped++; }
    });
    return {
      done: done, skipped: skipped, open: open,
      rows: Object.keys(byTpl).map(function (k) { return byTpl[k]; })
    };
  }

  w.Checklist = {
    TEMPLATES: TEMPLATES, CATEGORY: CATEGORY,
    templates: templates, saveTemplates: saveTemplates, byKey: byKey,
    itemsFor: itemsFor, dueTemplate: dueTemplate,
    ensureFor: ensureFor, ensureAll: ensureAll, sync: sync, hit: hit,
    groups: groups, current: current, pending: pending,
    tasksOf: tasksOf, dismiss: dismiss, stats: stats
  };
})(window);

/*
 * کارها و یادداشت‌ها.
 *
 * موتور «اقدام بعدی» از روی تاریخ‌ها حدس می‌زند چه کاری مانده، ولی همه‌چیز
 * از تاریخ‌ها درنمی‌آید. دو جنس چیز اینجا می‌نشیند:
 *
 *   یادداشت — ثبت واقعه. «نامبرده تلفنی گفت هفتهٔ آینده می‌آید.»
 *   کار     — چیزی که باید انجام شود. «اسکن مدارک»، «تشکیل پرونده».
 *
 * عمداً یک موجودیت‌اند، نه دو تا: هشتاد درصدشان یکی است (متن، سررسید،
 * انجام‌شده/نشده، تاریخچه) و دو فهرستِ شبیه هم یعنی کاربر هر بار باید
 * بپرسد «این را کجا بنویسم؟». فرقشان یک فیلد است: kind.
 *
 * کار می‌تواند به هیچ پرونده‌ای وصل نباشد (caseId خالی) — کارهایی که از
 * بیرون ارجاع می‌شوند و پرونده‌ای پشتشان نیست.
 *
 * نام انبار «notes» مانده و فیلد سررسید هم «followUp»، چون داده‌های قبلی
 * با همین نام‌ها روی دیسک کاربر نشسته‌اند و تغییرشان یعنی مهاجرت بی‌دلیل.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  var notes = [];
  var byCase = {};

  /* کارهای پرتکرار دبیرخانه. اینها دکمه می‌شوند تا تایپ نشوند؛ فهرست در
     تنظیمات قابل ویرایش است، مثل بقیهٔ لیست‌های برنامه. */
  var PRESETS_DEFAULT = [
    'تشکیل پرونده', 'اسکن مدارک', 'پرینت', 'تایپ نامه',
    'تماس تلفنی', 'پیگیری نامه', 'تحویل به کارشناس', 'بایگانی'
  ];

  /* دستهٔ کارهای بیرون از پرونده */
  var CATEGORIES_DEFAULT = [
    'مکاتبات اداری', 'گزارش‌دهی', 'جلسات', 'بایگانی و اسکن', 'سایر'
  ];

  var PRIORITIES = [
    { key: 'normal', label: 'عادی' },
    { key: 'urgent', label: 'فوری' }
  ];

  /* هر دو فهرست وارد لیست‌های برنامه می‌شوند تا همان ویرایشگرِ تنظیمات —
     که کاربر برای بقیهٔ فهرست‌ها می‌شناسد — اینها را هم نشان بدهد. */
  function seedLists() {
    var L = M.state.lists;
    if (!L) return;
    if (!L.TaskPresets) L.TaskPresets = PRESETS_DEFAULT.slice();
    if (!L.TaskCategories) L.TaskCategories = CATEGORIES_DEFAULT.slice();
  }

  /**
   * افزودن یک دسته یا میان‌بر تازه به همان فهرستی که تنظیمات هم ویرایشش
   * می‌کند. جای جدایی برایش نساختیم: دو منبعِ حقیقت برای یک فهرست، یعنی
   * کاربر یک‌جا چیزی اضافه می‌کند و جای دیگر نمی‌بیندش.
   */
  function addToList(name, value) {
    var v = String(value || '').trim();
    if (!v) return Promise.reject(new Error('نام خالی است'));
    var lists = M.state.lists || {};
    var cur = (lists[name] || (name === 'TaskCategories'
      ? CATEGORIES_DEFAULT : PRESETS_DEFAULT)).slice();
    if (cur.indexOf(v) >= 0) return Promise.resolve(v);
    cur.push(v);
    var next = {};
    Object.keys(lists).forEach(function (k) { next[k] = lists[k]; });
    next[name] = cur;
    return M.saveLists(next).then(function () { return v; });
  }

  /**
   * مقدارهایی که قبلاً در همین فیلد نوشته شده‌اند، پرتکرارترین اول.
   *
   * دبیرخانه چند ارجاع‌دهنده و چند مسئول بیشتر ندارد و هر بار تایپ کردنشان
   * یعنی «رئیس کمیته» و «رییس کمیته» و «ریاست کمیته» سه چیز جدا شوند و
   * گزارشِ به‌تفکیکِ ارجاع‌دهنده بی‌معنا بشود. پس همان‌ها پیشنهاد می‌شوند.
   */
  function usedValues(field) {
    var count = {};
    notes.forEach(function (n) {
      var v = String(n[field] || '').trim();
      if (v) count[v] = (count[v] || 0) + 1;
    });
    return Object.keys(count).sort(function (a, b) {
      return count[b] - count[a] || (a < b ? -1 : 1);
    });
  }

  function presets() { return (M.state.lists || {}).TaskPresets || PRESETS_DEFAULT; }
  function categories() {
    return (M.state.lists || {}).TaskCategories || CATEGORIES_DEFAULT;
  }

  /*
   * رکوردهای قدیمی نه kind دارند نه status. به‌جای مهاجرت روی دیسک، همان
   * لحظهٔ خواندن پر می‌شوند: داده دست‌نخورده می‌ماند و کد یک شکل می‌بیند.
   */
  function normalize(n) {
    if (!n.kind) n.kind = 'note';
    if (!n.status) n.status = n.done ? 'done' : 'open';
    if (n.caseId == null) n.caseId = '';
    if (!n.priority) n.priority = 'normal';
    return n;
  }

  function index() {
    byCase = {};
    notes.forEach(function (n) {
      normalize(n);
      if (!n.caseId) return;                    // کار بی‌پرونده جای خودش را دارد
      (byCase[n.caseId] = byCase[n.caseId] || []).push(n);
    });
    Object.keys(byCase).forEach(function (k) {
      byCase[k].sort(function (a, b) { return a.at < b.at ? 1 : -1; });   // تازه‌ترین بالا
      refreshSearchText(k);
    });
  }

  /** متن یادداشت‌ها به نمایهٔ جستجوی پرونده اضافه می‌شود */
  function refreshSearchText(caseId) {
    var rec = M.get(caseId);
    if (!rec) return;
    rec._noteText = (byCase[caseId] || []).map(function (n) {
      return n.text;
    }).join(' ');
    M.reindex(rec);
  }

  function forCase(caseId) { return byCase[caseId] || []; }

  /**
   * تازه‌ترین یادداشتِ باز یک پرونده.
   *
   * برای جایی که فقط یک سطر جا هست — بالای پرونده و کنار سطر کارتابل —
   * و باید در یک نگاه بگوید «اینجا چه خبر است». قرارِ پیگیری مقدم است،
   * چون سررسید دارد؛ وگرنه آخرین یادداشت.
   */
  function headline(caseId) {
    var open = forCase(caseId).filter(function (n) { return !n.done; });
    if (!open.length) return null;
    var withDue = open.filter(function (n) { return n.followUp; });
    if (withDue.length) {
      withDue.sort(function (a, b) { return a.followUp < b.followUp ? -1 : 1; });
      return withDue[0];
    }
    return open.slice().sort(function (a, b) {
      return (a.at || '') < (b.at || '') ? 1 : -1;
    })[0];
  }

  /** چند یادداشت باز دارد */
  function openCount(caseId) {
    return forCase(caseId).filter(function (n) { return !n.done; }).length;
  }

  /** پیگیری باز: یادداشتی با تاریخ پیگیری که هنوز انجام‌نشده علامت خورده */
  function openFollowUp(caseId) {
    var list = forCase(caseId).filter(function (n) {
      return n.followUp && !n.done;
    });
    list.sort(function (a, b) { return a.followUp < b.followUp ? -1 : 1; });
    return list[0] || null;
  }

  function add(rec, text, followUp) {
    return create({
      kind: 'note', caseId: rec ? rec.id : '', text: text, followUp: followUp
    });
  }

  /**
   * ساخت کار یا یادداشت.
   * o: { kind, caseId, title, text, followUp, priority, from, owner, category }
   */
  function create(o) {
    o = o || {};
    var kind = o.kind === 'task' ? 'task' : 'note';
    var title = String(o.title || '').trim();
    var text = String(o.text || '').trim();
    if (kind === 'task' && !title) {
      return Promise.reject(new Error('عنوان کار خالی است'));
    }
    if (kind === 'note' && !text) {
      return Promise.reject(new Error('متن یادداشت خالی است'));
    }
    var rec = o.caseId ? M.get(o.caseId) : null;
    var item = normalize({
      id: w.U.uid(),
      kind: kind,
      caseId: rec ? rec.id : '',
      caseNo: rec ? (rec.caseNo || '') : '',
      title: title,
      text: text,
      followUp: o.followUp || '',
      priority: o.priority === 'urgent' ? 'urgent' : 'normal',
      from: String(o.from || '').trim(),
      owner: String(o.owner || '').trim() || (M.state.settings.user || ''),
      category: String(o.category || '').trim(),
      status: 'open',
      done: false,
      at: new Date().toISOString(),
      atJalali: J.stamp(),
      user: M.state.settings.user || 'کاربر'
    });
    notes.push(item);
    index();
    return w.Store.put('notes', [item]).then(function () {
      if (rec) {
        M.addHistory(kind === 'task' ? 'task-add' : 'note-add', rec, [],
          (kind === 'task' ? 'کار: ' + title : 'یادداشت: ' + preview(text)) +
          (item.followUp ? ' — سررسید ' + J.format(item.followUp) : ''));
      }
      return item;
    });
  }

  /** متنی که باید نشان داده شود — کار عنوان دارد، یادداشت متن */
  function textOf(n) {
    if (!n) return '';
    return (n.kind === 'task' ? (n.title || n.text) : n.text) || '';
  }

  function preview(text, max) {
    var limit = max || 60;
    var t = String(text).replace(/\s+/g, ' ').trim();
    return t.length > limit ? t.slice(0, limit) + '…' : t;
  }

  function update(note, patch) {
    Object.keys(patch).forEach(function (k) { note[k] = patch[k]; });
    note.editedAt = new Date().toISOString();
    index();
    return w.Store.put('notes', [note]);
  }

  /** بستن یک کار یا پیگیری — انجام شد */
  function complete(note) {
    var rec = note.caseId ? M.get(note.caseId) : null;
    return update(note, { done: true, status: 'done', doneAt: J.today() })
      .then(function () {
        if (rec) {
          M.addHistory(note.kind === 'task' ? 'task-done' : 'note-done', rec, [],
            (note.kind === 'task' ? 'کار انجام شد: ' + (note.title || '')
              : 'پیگیری انجام شد: ' + preview(note.text)));
        }
        return note;
      });
  }

  /**
   * لغو کار.
   * «انجام نشد و دیگر لازم نیست» با «انجام شد» فرق دارد و در گزارش هم
   * نباید یکی شمرده شوند.
   */
  function cancelTask(note, why) {
    var rec = note.caseId ? M.get(note.caseId) : null;
    return update(note, {
      done: true, status: 'cancelled', doneAt: J.today(),
      cancelReason: String(why || '').trim()
    }).then(function () {
      if (rec) {
        M.addHistory('task-cancel', rec, [], 'کار لغو شد: ' + (note.title || '') +
          (why ? ' — ' + why : ''));
      }
      return note;
    });
  }

  function reopen(note) {
    return update(note, {
      done: false, status: 'open', doneAt: '', cancelReason: ''
    });
  }

  function remove(note) {
    var rec = note.caseId ? M.get(note.caseId) : null;
    notes = notes.filter(function (n) { return n.id !== note.id; });
    index();
    return w.Store.remove('notes', [note.id]).then(function () {
      if (!rec) return;
      M.addHistory(note.kind === 'task' ? 'task-remove' : 'note-remove', rec, [],
        note.kind === 'task' ? 'حذف کار: ' + (note.title || '')
          : 'حذف یادداشت: ' + preview(note.text));
    });
  }

  /**
   * همهٔ پیگیری‌های باز، مرتب بر اساس تاریخ.
   * onlyDue=true یعنی فقط آنهایی که سررسیدشان رسیده یا گذشته.
   */
  function dueFollowUps(onlyDue) {
    var today = J.today();
    var out = [];
    notes.forEach(function (n) {
      if (!n.followUp || n.done) return;
      /* کار بی‌پرونده هم سررسید دارد؛ rec خالی می‌ماند ولی حذف نمی‌شود —
         قبلاً همین‌جا از قلم می‌افتاد. ولی یادداشتی که پرونده‌اش پاک شده
         بی‌صاحب است و نمایش دادنش فقط گیج می‌کند. */
      var rec = n.caseId ? M.get(n.caseId) : null;
      if (n.caseId && !rec) return;
      var days = J.diffDays(today, n.followUp);
      if (onlyDue && days != null && days < 0) return;
      out.push({ note: n, rec: rec, days: days, overdue: days != null && days > 0 });
    });
    out.sort(function (a, b) {
      return (a.note.followUp || '') < (b.note.followUp || '') ? -1 : 1;
    });
    return out;
  }

  /* ================================================================
     کارها
     ----------------------------------------------------------------
     پرس‌وجوها همه از همین یک آرایه درمی‌آیند. تعداد کارهای دبیرخانه در
     مقیاس چندصدتاست، پس نمایهٔ جداگانه فقط کدِ بیشتر بود بی‌آنکه چیزی
     سریع‌تر شود.
     ================================================================ */

  function isTask(n) { return n.kind === 'task'; }

  /**
   * tasks(f) — کارها با صافی اختیاری.
   * f: { status:'open'|'done'|'cancelled', caseId, standalone:true, owner, category }
   */
  function tasks(f) {
    f = f || {};
    return notes.filter(function (n) {
      if (!isTask(n)) return false;
      if (f.status && n.status !== f.status) return false;
      if (f.standalone && n.caseId) return false;
      if (f.caseId != null && n.caseId !== f.caseId) return false;
      if (f.owner && n.owner !== f.owner) return false;
      if (f.category && n.category !== f.category) return false;
      /* کارِ وصل به پروندهٔ پاک‌شده را نشان نمی‌دهیم */
      if (n.caseId && !M.get(n.caseId)) return false;
      return true;
    }).sort(sortTasks);
  }

  /* فوری بالا، بعد سررسیدِ نزدیک‌تر، بی‌سررسید ته صف */
  function sortTasks(a, b) {
    if ((a.priority === 'urgent') !== (b.priority === 'urgent')) {
      return a.priority === 'urgent' ? -1 : 1;
    }
    if (!!a.followUp !== !!b.followUp) return a.followUp ? -1 : 1;
    if (a.followUp !== b.followUp) return a.followUp < b.followUp ? -1 : 1;
    return (a.at || '') < (b.at || '') ? -1 : 1;
  }

  /** کارهای بی‌پرونده — ارجاع‌های بیرونی */
  function standalone(status) {
    return tasks({ standalone: true, status: status || 'open' });
  }

  var BUCKETS = [
    { key: 'overdue', label: 'عقب‌افتاده' },
    { key: 'today', label: 'امروز' },
    { key: 'week', label: 'این هفته' },
    { key: 'later', label: 'بعداً' },
    { key: 'someday', label: 'بی‌سررسید' }
  ];

  function bucketOf(task) {
    if (!task.followUp) return 'someday';
    var d = J.diffDays(J.today(), task.followUp);   // مثبت یعنی گذشته
    if (d == null) return 'someday';
    if (d > 0) return 'overdue';
    if (d === 0) return 'today';
    return -d <= 7 ? 'week' : 'later';
  }

  /**
   * taskBuckets(f) — کارهای باز، دسته‌بندی‌شده بر اساس سررسید.
   * خروجی همیشه هر پنج سطل را دارد (حتی خالی) تا نما ترتیب ثابتی داشته باشد.
   */
  function taskBuckets(f) {
    var q = { status: 'open' };
    Object.keys(f || {}).forEach(function (k) { q[k] = f[k]; });
    q.status = 'open';
    var out = BUCKETS.map(function (b) {
      return { key: b.key, label: b.label, items: [] };
    });
    var byKey = {};
    out.forEach(function (b) { byKey[b.key] = b; });
    tasks(q).forEach(function (t) { byKey[bucketOf(t)].items.push(t); });
    return out;
  }

  /** کارهای امروز و عقب‌افتاده — همان چیزی که صبح باید دید */
  function todayTasks() {
    return tasks({ status: 'open' }).filter(function (t) {
      var b = bucketOf(t);
      return b === 'overdue' || b === 'today';
    });
  }

  function stats() {
    /* «پیگیری باز» فقط یادداشت‌هاست: کارها کارت آمار خودشان را دارند و
       شمردنشان در هر دو، یک عدد را دو بار نشان می‌دهد. */
    var open = notes.filter(function (n) {
      return n.kind !== 'task' && n.followUp && !n.done;
    });
    var openTasks = tasks({ status: 'open' });
    var due = todayTasks();
    return {
      total: notes.length,
      openFollowUps: open.length,
      openTasks: openTasks.length,
      dueTasks: due.length,
      overdueTasks: openTasks.filter(function (t) {
        return bucketOf(t) === 'overdue';
      }).length
    };
  }

  /**
   * گزارش کارها در یک بازه (تاریخ جلالی بسته‌بندی‌شده، هر دو سرِ بازه شامل).
   * بدون بازه: از اول ماه جاری.
   *
   * «انجام‌شده» بر اساس تاریخِ بستن شمرده می‌شود و «عقب‌افتاده» بر اساس
   * امروز — چون عقب‌افتادگی وضعیت است نه رویداد، و بازه به آن ربطی ندارد.
   */
  function report(from, to) {
    if (!from) {
      var t = J.unpack(J.today());
      from = t ? J.pack(t.jy, t.jm, 1) : J.today();
    }
    to = to || J.today();
    var byFrom = {};
    var byCategory = {};
    function bump(map, key, field) {
      var k = key || '—';
      var row = map[k] || (map[k] = { key: k, done: 0, cancelled: 0, open: 0, overdue: 0 });
      row[field]++;
    }
    var done = 0, cancelled = 0, open = 0, overdue = 0;
    notes.forEach(function (n) {
      if (!isTask(n)) return;
      if (n.caseId && !M.get(n.caseId)) return;
      var field = null;
      if (n.status === 'open') {
        field = bucketOf(n) === 'overdue' ? 'overdue' : 'open';
        if (field === 'overdue') overdue++; else open++;
      } else {
        var when = n.doneAt || '';
        if (!when || when < from || when > to) return;
        field = n.status === 'cancelled' ? 'cancelled' : 'done';
        if (field === 'cancelled') cancelled++; else done++;
      }
      bump(byFrom, n.from, field);
      bump(byCategory, n.category, field);
    });
    function rows(map) {
      return Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) {
          return (b.done + b.overdue + b.open) - (a.done + a.overdue + a.open);
        });
    }
    return {
      from: from, to: to,
      done: done, cancelled: cancelled, open: open, overdue: overdue,
      byFrom: rows(byFrom), byCategory: rows(byCategory)
    };
  }

  function load() {
    seedLists();
    return w.Store.getAll('notes').then(function (list) {
      notes = list || [];
      index();
    });
  }

  function clearMemory() {
    notes = [];
    byCase = {};
  }

  function all() { return notes; }

  w.Notes = {
    load: load, all: all, forCase: forCase, add: add, create: create,
    update: update, complete: complete, cancelTask: cancelTask,
    reopen: reopen, remove: remove,
    openFollowUp: openFollowUp, dueFollowUps: dueFollowUps, stats: stats,
    headline: headline, openCount: openCount, textOf: textOf,
    tasks: tasks, standalone: standalone, taskBuckets: taskBuckets,
    todayTasks: todayTasks, bucketOf: bucketOf, BUCKETS: BUCKETS,
    report: report, presets: presets, categories: categories,
    addToList: addToList, usedValues: usedValues,
    PRIORITIES: PRIORITIES,
    clearMemory: clearMemory, preview: preview
  };
})(window);

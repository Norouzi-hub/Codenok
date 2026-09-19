/*
 * یادداشت و پیگیری دستی.
 *
 * موتور «اقدام بعدی» از روی تاریخ‌ها حدس می‌زند چه کاری مانده، ولی همه‌چیز
 * از تاریخ‌ها درنمی‌آید: «با آقای الف تلفنی صحبت شد، هفتهٔ بعد پیگیری شود».
 * این لایه همان چیزهاست: یادداشت آزاد، با تاریخ پیگیری اختیاری.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  var notes = [];
  var byCase = {};

  function index() {
    byCase = {};
    notes.forEach(function (n) {
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
    text = String(text || '').trim();
    if (!text) return Promise.reject(new Error('متن یادداشت خالی است'));
    var note = {
      id: w.U.uid(),
      caseId: rec.id,
      caseNo: rec.caseNo || '',
      text: text,
      followUp: followUp || '',
      done: false,
      at: new Date().toISOString(),
      atJalali: J.stamp(),
      user: M.state.settings.user || 'کاربر'
    };
    notes.push(note);
    index();
    return w.Store.put('notes', [note]).then(function () {
      M.addHistory('note-add', rec, [], followUp
        ? 'یادداشت با پیگیری ' + J.format(followUp) + ': ' + preview(text)
        : 'یادداشت: ' + preview(text));
      return note;
    });
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

  /** بستن یک پیگیری — کار انجام شد */
  function complete(note) {
    var rec = M.get(note.caseId);
    return update(note, { done: true, doneAt: J.today() }).then(function () {
      if (rec) {
        M.addHistory('note-done', rec, [], 'پیگیری انجام شد: ' + preview(note.text));
      }
      return note;
    });
  }

  function reopen(note) {
    return update(note, { done: false, doneAt: '' });
  }

  function remove(note) {
    var rec = M.get(note.caseId);
    notes = notes.filter(function (n) { return n.id !== note.id; });
    index();
    return w.Store.remove('notes', [note.id]).then(function () {
      if (rec) M.addHistory('note-remove', rec, [], 'حذف یادداشت: ' + preview(note.text));
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
      var rec = M.get(n.caseId);
      if (!rec) return;
      var days = J.diffDays(today, n.followUp);
      if (onlyDue && days != null && days < 0) return;
      out.push({ note: n, rec: rec, days: days, overdue: days != null && days > 0 });
    });
    out.sort(function (a, b) {
      return (a.note.followUp || '') < (b.note.followUp || '') ? -1 : 1;
    });
    return out;
  }

  function stats() {
    var open = notes.filter(function (n) { return n.followUp && !n.done; });
    return { total: notes.length, openFollowUps: open.length };
  }

  function load() {
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
    load: load, all: all, forCase: forCase, add: add, update: update,
    complete: complete, reopen: reopen, remove: remove,
    openFollowUp: openFollowUp, dueFollowUps: dueFollowUps, stats: stats,
    headline: headline, openCount: openCount,
    clearMemory: clearMemory, preview: preview
  };
})(window);

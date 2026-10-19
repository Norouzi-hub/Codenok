/*
 * کیفیتِ پرونده — هر پرونده با چه وضعی بسته شد.
 *
 * نقصِ پروندهٔ در جریان «کار» است و جایش کارتابل است. نقصِ پروندهٔ مختومه
 * دیگر کار نیست؛ سابقهٔ کیفیت است. پس لحظه‌ای که پرونده مختومه می‌شود، یک
 * عکس گرفته می‌شود: کدام مرحله‌های الزامی تاریخ نداشتند. این عکس بعداً عوض
 * نمی‌شود — اگر نقصی بعد از ختم تکمیل شد، کنارش «تکمیل پس از ختم» می‌آید،
 * ولی پاک نمی‌شود. سابقه همان است که بود.
 *
 * پرونده‌ای که پیش از این نسخه مختومه شده (یا از اکسل مختومه آمده) عکس
 * ندارد: «پیش از سنجش کیفیت» است و در آمار کیفیت نمی‌آید. آمار فقط از
 * کاری ساخته می‌شود که واقعاً سنجیده شده.
 *
 * داده در meta (و با آن در فایل دیتابیس):
 *   quality = { since: '14050727',
 *               cases: { <id>: { at: '14050801', iso, missing: [{key, label}],
 *                                fixed: { <stageKey>: '14050803' } } } }
 */
(function (w) {
  'use strict';

  var KEY = 'quality';

  function J() { return w.J; }
  function WL() { return w.Worklist; }

  function data() {
    var d = w.Store && w.Store.metaGet ? w.Store.metaGet(KEY, null) : null;
    return d && typeof d === 'object' ? d : { since: '', cases: {} };
  }

  function save(d) {
    if (!w.Store || !w.Store.metaSet) return Promise.resolve();
    var p = w.Store.metaSet(KEY, d);
    if (w.Store.scheduleSave) w.Store.scheduleSave();
    return p;
  }

  /** از کِی سنجیده می‌شود؛ اولین بار که برنامه با این نسخه باز شد */
  function ensureSince() {
    var d = data();
    if (d.since) return Promise.resolve(d.since);
    d.since = J().today();
    d.cases = d.cases || {};
    return save(d).then(function () { return d.since; });
  }

  function missingNow(rec) {
    return WL().audit(rec).filter(function (a) { return a.missing; })
      .map(function (a) { return { key: a.key, label: a.label }; });
  }

  /*
   * هر ذخیرهٔ پرونده از اینجا می‌گذرد (Model.update و applyPatches).
   * گذارِ «در جریان → مختومه» عکس می‌گیرد؛ پروندهٔ مختومه‌ای که نقصش
   * تکمیل شد، تاریخِ تکمیلش ثبت می‌شود.
   */
  function observe(before, after) {
    if (!WL() || !after || !after.id) return;
    var was = before && WL().isClosed(before);
    var now = WL().isClosed(after);
    if (!now) return;
    var d = data(), dirty = false;
    d.cases = d.cases || {};
    if (!was) {
      d.cases[after.id] = {
        at: J().today(), iso: new Date().toISOString(),
        missing: missingNow(after), fixed: {}
      };
      dirty = true;
    } else {
      var snap = d.cases[after.id];
      if (snap && snap.missing.length) {
        var audit = WL().audit(after);
        snap.missing.forEach(function (m) {
          if (snap.fixed[m.key]) return;
          var a = audit.filter(function (x) { return x.key === m.key; })[0];
          if (a && a.recorded) { snap.fixed[m.key] = J().today(); dirty = true; }
        });
      }
    }
    if (dirty) save(d);
  }

  /** پروندهٔ حذف‌شده، عکسش هم می‌رود */
  function forget(id) {
    var d = data();
    if (!d.cases || !d.cases[id]) return Promise.resolve();
    delete d.cases[id];
    return save(d);
  }

  /*
   * وضعِ کیفیتِ یک پرونده، برای خودِ پرونده و گزارش:
   *   null — پرونده مختومه نیست
   *   { measured: false, now: [...] } — پیش از سنجش بسته شده
   *   { measured: true, at, missing: [{key, label, state, fixedAt}], complete,
   *     open, fixed }
   *   state: 'open' هنوز ناقص · 'fixed' تکمیل پس از ختم
   */
  function of(rec) {
    if (!rec || !WL().isClosed(rec) || WL().isTransferred(rec)) return null;
    var snap = (data().cases || {})[rec.id];
    if (!snap) return { measured: false, now: missingNow(rec) };
    var audit = WL().audit(rec);
    var list = snap.missing.map(function (m) {
      var a = audit.filter(function (x) { return x.key === m.key; })[0];
      var done = !!snap.fixed[m.key] || !!(a && a.recorded);
      return { key: m.key, label: m.label, state: done ? 'fixed' : 'open',
        fixedAt: snap.fixed[m.key] || '' };
    });
    return {
      measured: true, at: snap.at, missing: list,
      complete: !list.length,
      open: list.filter(function (m) { return m.state === 'open'; }).length,
      fixed: list.filter(function (m) { return m.state === 'fixed'; }).length
    };
  }

  /** آمارِ کیفیت برای گزارش */
  function stats(cases) {
    var closed = cases.filter(function (c) {
      return WL().isClosed(c) && !WL().isTransferred(c);
    });
    var measured = [], unmeasured = [], months = {}, stages = {}, experts = {};
    var T = { closed: closed.length, measured: 0, complete: 0, missing: 0, fixed: 0, open: 0 };
    closed.forEach(function (rec) {
      var q = of(rec);
      if (!q || !q.measured) { unmeasured.push(rec); return; }
      measured.push({ rec: rec, q: q });
      T.measured++;
      if (q.complete) T.complete++;
      T.missing += q.missing.length;
      T.fixed += q.fixed;
      T.open += q.open;
      var mk = String(q.at || '').slice(0, 6);
      var m = months[mk] || (months[mk] = { key: mk, n: 0, complete: 0 });
      m.n++;
      if (q.complete) m.complete++;
      q.missing.forEach(function (x) {
        var s = stages[x.key] || (stages[x.key] = { key: x.key, label: x.label, n: 0, fixed: 0 });
        s.n++;
        if (x.state === 'fixed') s.fixed++;
      });
      var ek = rec.expert || '—';
      var e = experts[ek] || (experts[ek] = { key: ek, n: 0, complete: 0 });
      e.n++;
      if (q.complete) e.complete++;
    });
    T.pct = T.measured ? Math.round(T.complete * 100 / T.measured) : null;
    function pct(x) { x.pct = x.n ? Math.round(x.complete * 100 / x.n) : 0; return x; }
    return {
      totals: T,
      since: data().since || '',
      months: Object.keys(months).sort().map(function (k) { return pct(months[k]); }),
      stages: Object.keys(stages).map(function (k) { return stages[k]; })
        .sort(function (a, b) { return b.n - a.n; }),
      experts: Object.keys(experts).map(function (k) { return pct(experts[k]); })
        .sort(function (a, b) { return b.n - a.n; }),
      // هنوز چیزی برای تکمیل دارند — برای وقتی که فرصتش هست
      pending: measured.filter(function (x) { return x.q.open; })
        .sort(function (a, b) { return (b.q.at || '') < (a.q.at || '') ? -1 : 1; }),
      measured: measured,
      unmeasured: unmeasured
    };
  }

  w.Quality = {
    KEY: KEY, observe: observe, forget: forget, of: of, stats: stats,
    ensureSince: ensureSince, data: data
  };
})(window);

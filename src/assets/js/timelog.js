/*
 * زمانِ کار — چقدر روی هر پرونده وقت گذاشته شد.
 *
 * تاریخچه می‌گوید *چه* شد (ذخیره، فرم، سند)، ولی نمی‌گوید *چقدر* طول
 * کشید: نیم ساعت خواندنِ یک پرونده و یک بار ذخیره، در تاریخچه یک لحظه
 * است. این فایل همان نیم ساعت را می‌شمارد.
 *
 * قاعده ساده و محافظه‌کار است:
 *   - هر ۱۵ ثانیه یک بار نگاه می‌کند: پنجره دیده می‌شود؟ فوکوس دارد؟ در
 *     دو دقیقهٔ گذشته کلیک یا تایپ یا اسکرولی بوده؟ اگر هر سه بله،
 *     همان ۱۵ ثانیه به «جایی که کاربر هست» نسبت داده می‌شود.
 *   - «جا»: اگر پرونده‌ای باز است، همان پرونده؛ وگرنه صفحه (کارتابل،
 *     فهرست، کارها، …).
 *   - قفل، صفحهٔ شروع و بی‌کاری شمرده نمی‌شوند. پس عدد کم‌برآورد است،
 *     نه بیش‌برآورد — زمانی که اینجا ثبت شده، واقعاً کار بوده.
 *
 * داده روز به روز در meta (و با آن در فایل دیتابیس) می‌ماند:
 *   timelog = { '14050722': { 'c:<id>': ثانیه, 'v:list': ثانیه, _s: '08:41', _e: '13:02' } }
 */
(function (w) {
  'use strict';

  var J = w.J;
  var KEY = 'timelog';
  var TICK = 15;            // ثانیه
  var IDLE = 120;           // بی‌کاریِ بیش از این، شمرده نمی‌شود
  var SAVE_EVERY = 60;      // نوشتن در انبار
  var FILE_EVERY = 300;     // فرستادن به فایل دیتابیس

  var lastInput = 0, sinceSave = 0, sinceFile = 0, timer = null, app = null;
  var data = null;

  function now() { return Date.now(); }
  function hhmm(d) { return J.pad2(d.getHours()) + ':' + J.pad2(d.getMinutes()); }

  function load() {
    var saved = w.Store && w.Store.metaGet ? w.Store.metaGet(KEY, null) : null;
    data = saved && typeof saved === 'object' ? saved : {};
    return data;
  }

  function all() { return data || load(); }

  function save(toFile) {
    if (!data || !w.Store || !w.Store.metaSet) return Promise.resolve();
    sinceSave = 0;
    var p = w.Store.metaSet(KEY, data);
    if (toFile && w.Store.scheduleSave) { sinceFile = 0; w.Store.scheduleSave(); }
    return p;
  }

  function context() {
    var st = app && app.state;
    if (!st) return '';
    if (st.view === 'case' && st.caseId) return 'c:' + st.caseId;
    return 'v:' + (st.view || 'work');
  }

  function active() {
    if (document.visibilityState !== 'visible') return false;
    if (document.hasFocus && !document.hasFocus()) return false;
    if (w.Store && w.Store.isLocked && w.Store.isLocked()) return false;
    if (w.UIStart && w.UIStart.isShowing && w.UIStart.isShowing()) return false;
    if (w.UILock && w.UILock.isShowing && w.UILock.isShowing()) return false;
    return now() - lastInput < IDLE * 1000;
  }

  /** یک تیک: اگر کار در جریان است، به جای فعلی اضافه کن */
  function tick() {
    if (!active()) return;
    var ctx = context();
    if (!ctx) return;
    add(J.today(), ctx, TICK, new Date());
    sinceSave += TICK;
    sinceFile += TICK;
    if (sinceSave >= SAVE_EVERY) save(sinceFile >= FILE_EVERY);
  }

  /** افزودنِ ثانیه به یک روز و یک جا (آزمون‌ها هم از همین استفاده می‌کنند) */
  function add(day, ctx, sec, at) {
    var d = all();
    var row = d[day] || (d[day] = {});
    row[ctx] = (row[ctx] || 0) + sec;
    if (at) {
      var t = hhmm(at);
      if (!row._s || t < row._s) row._s = t;
      if (!row._e || t > row._e) row._e = t;
    }
  }

  /** روزهای بازه → { day: { ctx: sec, _s, _e } } */
  function range(from, to) {
    var d = all(), out = {};
    Object.keys(d).forEach(function (k) {
      if (k >= from && k <= to) out[k] = d[k];
    });
    return out;
  }

  /** ثانیهٔ یک پرونده در بازه */
  function forCase(caseId, from, to) {
    var r = range(from || '00000000', to || '99999999'), n = 0;
    Object.keys(r).forEach(function (k) { n += r[k]['c:' + caseId] || 0; });
    return n;
  }

  function start(theApp) {
    app = theApp;
    load();
    lastInput = now();
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'].forEach(function (ev) {
      document.addEventListener(ev, function () { lastInput = now(); }, { passive: true, capture: true });
    });
    // رفتن از صفحه یا پنهان شدن: هرچه شمرده شده، نوشته شود
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && sinceSave) save(true);
    });
    w.addEventListener('pagehide', function () { if (sinceSave) save(true); });
    if (timer) clearInterval(timer);
    timer = setInterval(tick, TICK * 1000);
  }

  /** بعد از باز شدن دیتابیسِ دیگر، داده از نو خوانده می‌شود */
  function reload() { data = null; load(); }

  w.Timelog = {
    TICK: TICK, IDLE: IDLE,
    start: start, reload: reload, tick: tick, add: add, save: save,
    all: all, range: range, forCase: forCase, context: context,
    // برای آزمون: «آخرین کلیک» را به گذشته ببر تا بی‌کاری شبیه‌سازی شود
    _idle: function (sec) { lastInput = now() - sec * 1000; }
  };
})(window);

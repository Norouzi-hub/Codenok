/*
 * دفتر مقامات — چه کسی الان شهردارِ منطقهٔ ۵ است.
 *
 * مینوت تا امروز فقط سمت را می‌نوشت: «شهردار محترم منطقه ۵». نامهٔ اداری
 * نام هم می‌خواهد: «جناب آقای … شهردار محترم منطقه ۵». نام‌ها از یک فهرستِ
 * اکسل می‌آیند و ثابت نیستند — شهردار عوض می‌شود، مدیرعامل عوض می‌شود. پس
 * این دفتر هر بار که فهرستِ تازه برسد دوباره وارد می‌شود، و می‌گوید چه چیزی
 * عوض شد («شهردار منطقه ۵: الف ← ب»).
 *
 * جور شدنِ سمت با گیرندهٔ مینوت با «کلید» است: سمت و واحد، بی «محترم» و
 * «شهرداری»، با عددِ منطقه (پنج = ۵ = 5)، بی فاصله و نیم‌فاصله.
 *
 * داده در meta (و با آن در فایل دیتابیس):
 *   officials = { updatedAt, source, list: [{ id, honor, name, position, org, rank }],
 *                 log: [{ at, source, added, changed: [{ title, from, to }], removed }] }
 */
(function (w) {
  'use strict';

  var KEY = 'officials';
  var J = w.J;
  var HONORS = ['جناب آقای', 'سرکار خانم'];

  function data() {
    var d = w.Store && w.Store.metaGet ? w.Store.metaGet(KEY, null) : null;
    return d && typeof d === 'object' && Array.isArray(d.list) ? d : { updatedAt: '', source: '', list: [], log: [] };
  }
  function list() { return data().list; }

  function save(d) {
    var p = w.Store.metaSet(KEY, d);
    if (w.Store.scheduleSave) w.Store.scheduleSave();
    if (w.Spell && w.Spell.invalidate) w.Spell.invalidate();
    return p;
  }

  /* ------------------------------------------------------ کلید */
  var NUM = {
    'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9,
    'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15,
    'شانزده': 16, 'هفده': 17, 'هجده': 18, 'هیجده': 18, 'نوزده': 19, 'بیست': 20
  };

  /** برای نمایش و نامه: «ی/ک» فارسی، رقمِ فارسی، یک فاصله؛ نیم‌فاصله می‌ماند */
  function clean(s) {
    return w.U.toFaDigits(String(s == null ? '' : s))
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/ـ/g, '').replace(/[ \t ]+/g, ' ').trim();
  }
  /** برای مقایسه: بی‌اعراب، رقمِ لاتین، نیم‌فاصله مثلِ فاصله */
  function flat(s) {
    return w.U.toLatinDigits(clean(s)).replace(/[ً-ْٰٔ]/g, '')
      .replace(/‌/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** «منطقهٔ بیست و دو» ← «منطقه 22» */
  function regionNumbers(s) {
    return s.replace(/منطقه(?:ی)?\s*(بیست)\s*و\s*(یک|دو)(?![؀-ۿ])/g, function (_, a, b) {
      return 'منطقه ' + (20 + NUM[b]);
    }).replace(/منطقه(?:ی)?\s*([؀-ۿ]+)/g, function (m, word) {
      return NUM[word] ? 'منطقه ' + NUM[word] : m;
    }).replace(/منطقه\s*0*(\d+)/g, 'منطقه $1');
  }

  function key(title) {
    var s = regionNumbers(flat(title));
    return s.split(' ').filter(function (t) {
      return t && t !== 'محترم' && t !== 'شهرداری' && t !== 'محترمه';
    }).join('');
  }

  /* --------------------------------------------- سمت + «محترم» */
  var ROLE = /^(معاون|مدیرعامل|شهردار|مدیرکل|مدیر|رئیس|رییس|سرپرست|دبیر|قائم‌مقام|قائممقام|مشاور|بازرس|دادستان|نماینده|فرمانده|مسئول|دبیرکل)$/;

  /** «شهردار منطقه ۵» ← «شهردار محترم منطقه ۵»؛ «مدیر عامل سازمان …» ← «مدیرعامل محترم سازمان …» */
  function honorTitle(position, org) {
    var full = clean((position || '') + ' ' + (org || ''))
      .replace(/مدیر عامل/g, 'مدیرعامل').replace(/مدیر کل/g, 'مدیرکل').replace(/قائم مقام/g, 'قائم‌مقام');
    if (!full) return '';
    if (/(^|\s)محترم(ه)?(\s|$)/.test(full)) return full;
    var t = full.split(' ');
    for (var i = 0; i < t.length; i++) {
      if (ROLE.test(t[i])) { t.splice(i + 1, 0, 'محترم'); return t.join(' '); }
    }
    return clean(position) + ' محترم' + (org ? ' ' + clean(org) : '');
  }

  function titleOf(o) { return honorTitle(o.position, o.org); }

  /** «جناب آقای احمد احمدی شهردار محترم منطقه ۵» */
  function address(o, title) {
    var name = String(o.name || '').trim();
    var t = title || titleOf(o);
    return name ? (o.honor || HONORS[0]) + ' ' + name + ' ' + t : t;
  }

  /** رتبهٔ پیشنهادی برای فعلِ نامه (مقتضی/شایسته/خواهشمند) */
  function guessRank(position, org) {
    var s = flat(position + ' ' + org);
    if (/شهردار(?!ی)|معاون شهردار تهران|شهردار تهران|شورا/.test(s)) return 'high';
    if (/^مدیرعامل/.test(s) && /(شرکت|موسسه|مؤسسه)/.test(s)) return 'low';
    return 'peer';
  }

  /** واحد برای «از کارکنان آن …» */
  function unitOf(org) {
    var m = /(منطقه|سازمان|شرکت|موسسه|مؤسسه|معاونت|اداره|ستاد|مرکز|دفتر|بنیاد|حوزه)/.exec(flat(org));
    return m ? m[1].replace('مؤسسه', 'موسسه') : 'مجموعه';
  }

  /* ------------------------------------------------------ جست‌وجو */
  function find(title) {
    var k = key(title);
    if (!k) return null;
    var all = list();
    for (var i = 0; i < all.length; i++) {
      if (key(all[i].position + ' ' + all[i].org) === k) return all[i];
    }
    return null;
  }

  function get(id) { return list().filter(function (o) { return o.id === id; })[0] || null; }

  /** گیرندهٔ مینوت از روی یک نفر در دفتر */
  function asRecipient(o) {
    return {
      id: 'off:' + o.id, title: titleOf(o), rank: o.rank || guessRank(o.position, o.org),
      kind: 'workplace', unit: unitOf(o.org), match: '', official: o.id
    };
  }

  /* ------------------------------------------------------ ورود از اکسل */
  var COLS = [
    { k: 'name', label: 'نام و نام خانوادگی', re: /نام\s*و\s*نام|نام\s*کامل|مسئول|متصدی|نام\s*شخص|^نام$/ },
    { k: 'first', label: 'نام', re: /^نام$/ },
    { k: 'last', label: 'نام خانوادگی', re: /خانوادگی|فامیل/ },
    // پیش از «سمت»: «عنوان احترام» نباید سمت شمرده شود
    { k: 'honor', label: 'جنسیت / عنوان احترام', re: /جنسیت|جنس|پیشوند|احترام|آقا\s*\/\s*خانم/ },
    { k: 'position', label: 'سمت', re: /سمت|عنوان|پست|مقام|جایگاه|شغل/ },
    { k: 'org', label: 'واحد / منطقه / سازمان', re: /واحد|منطقه|سازمان|شرکت|حوزه|محل|معاونت|دستگاه|اداره/ },
    { k: 'rank', label: 'رتبه', re: /رتبه|سطح/ }
  ];

  /** سطرِ سرستون و نگاشتِ ستون‌ها، از روی نامِ سرستون‌ها */
  function detect(rows) {
    var best = -1, bestScore = 0;
    for (var r = 0; r < Math.min(rows.length, 10); r++) {
      var score = 0;
      (rows[r] || []).forEach(function (c) {
        var h = flat(c);
        if (h && h.length < 40 && COLS.some(function (x) { return x.re.test(h); })) score++;
      });
      if (score > bestScore) { bestScore = score; best = r; }
    }
    var map = {};
    if (best < 0 || bestScore < 2) return { header: -1, map: map };
    var head = rows[best].map(flat);
    // «نام» تنها کنارِ «نام خانوادگی» یعنی نامِ کوچک
    var hasLast = head.some(function (h) { return /خانوادگی|فامیل/.test(h); });
    head.forEach(function (h, i) {
      if (!h) return;
      for (var j = 0; j < COLS.length; j++) {
        var c = COLS[j];
        if (c.k === 'name' && /^نام$/.test(h) && hasLast) continue;
        if (c.k === 'first' && !hasLast) continue;
        if (map[c.k] == null && c.re.test(h)) { map[c.k] = i; return; }
      }
    });
    return { header: best, map: map };
  }

  function splitHonor(name, gender) {
    var n = clean(name), honor = '';
    var m = /^(جناب\s+آقای|جناب|آقای|آقا|سرکار\s+خانم|سرکار|خانم)\s+/.exec(n);
    if (m) {
      honor = /خانم|سرکار/.test(m[1]) ? HONORS[1] : HONORS[0];
      n = n.slice(m[0].length);
    }
    var g = flat(gender);
    if (!honor && g) honor = /زن|خانم|مونث|مؤنث/.test(g) ? HONORS[1] : (/مرد|آقا|مذکر/.test(g) ? HONORS[0] : '');
    return { name: n, honor: honor || HONORS[0] };
  }

  /** وقتی سمت و واحد در یک ستون‌اند: «شهردار منطقه ۵» */
  function splitTitle(t) {
    var s = clean(t);
    var m = /\s((?:شهرداری\s+)?(?:منطقه|سازمان|شرکت|موسسه|مؤسسه|ستاد|اداره|معاونت|حوزه|مرکز|دفتر|بنیاد|باشگاه)(?:\s|$).*)$/.exec(s);
    if (!m) return { position: s, org: '' };
    return { position: s.slice(0, m.index).trim(), org: m[1].trim() };
  }

  var RANK_WORDS = { 'بالادست': 'high', 'بالا': 'high', 'همتراز': 'peer', 'هم‌تراز': 'peer', 'پایین‌دست': 'low', 'پایین': 'low' };

  /** سطرهای اکسل ← فهرستِ افراد. map همان خروجیِ detect (یا دست‌کاری‌شدهٔ کاربر) است. */
  function parse(rows, header, map) {
    var out = [];
    rows.slice(header + 1).forEach(function (r) {
      function cell(k) { return map[k] == null ? '' : clean(r[map[k]]); }
      var name = cell('name') || [cell('first'), cell('last')].filter(Boolean).join(' ');
      var pos = cell('position'), org = cell('org');
      if (!pos && !org) return;
      if (!org) { var sp = splitTitle(pos); pos = sp.position; org = sp.org; }
      // «شهردار» + «شهرداری منطقه ۵» ← همان «منطقه ۵»
      org = org.replace(/^شهرداری\s+(?=منطقه)/, '');
      var h = splitHonor(name, cell('honor'));
      var rank = RANK_WORDS[flat(cell('rank'))] || guessRank(pos, org);
      out.push({ id: w.U.uid(), honor: h.honor, name: h.name, position: pos, org: org, rank: rank });
    });
    return out;
  }

  /** فرقِ فهرستِ تازه با فعلی: تازه، عوض‌شده (نامِ دیگر روی همان سمت)، حذف‌شده */
  function diff(next) {
    var cur = list(), byKey = {};
    cur.forEach(function (o) { byKey[key(o.position + ' ' + o.org)] = o; });
    var seen = {}, added = [], changed = [], same = 0;
    next.forEach(function (o) {
      var k = key(o.position + ' ' + o.org);
      seen[k] = 1;
      var old = byKey[k];
      if (!old) added.push(o);
      else if (flat(old.name) !== flat(o.name) || old.honor !== o.honor) changed.push({ from: old, to: o });
      else same++;
    });
    var removed = cur.filter(function (o) { return !seen[key(o.position + ' ' + o.org)]; });
    return { added: added, changed: changed, removed: removed, same: same };
  }

  /** جایگزینیِ دفتر با فهرستِ تازه (keepMissing: آنچه در فایل نیست، بماند) */
  function replace(next, opts) {
    opts = opts || {};
    var d = data(), dd = diff(next);
    var byKey = {};
    d.list.forEach(function (o) { byKey[key(o.position + ' ' + o.org)] = o; });
    var merged = next.map(function (o) {
      var old = byKey[key(o.position + ' ' + o.org)];
      // رتبه‌ای که کاربر دستی گذاشته، با فهرستِ تازه از دست نمی‌رود
      if (old && old.rankManual) { o.rank = old.rank; o.rankManual = true; }
      if (old) o.id = old.id;
      return o;
    });
    if (opts.keepMissing) merged = merged.concat(dd.removed);
    var log = (d.log || []).slice(-30);
    log.push({
      at: J.today(), source: opts.source || '',
      added: dd.added.length, removed: opts.keepMissing ? 0 : dd.removed.length,
      changed: dd.changed.map(function (c) {
        return { title: titleOf(c.to), from: c.from.name, to: c.to.name };
      })
    });
    return save({ updatedAt: J.today(), source: opts.source || d.source || '', list: merged, log: log })
      .then(function () { return dd; });
  }

  /** ویرایشِ دستی (از پنجرهٔ دفتر) */
  function setList(next) {
    var d = data();
    return save({ updatedAt: J.today(), source: d.source, list: next, log: d.log || [] });
  }

  /** چند روز از آخرین به‌روزرسانی گذشته */
  function age() {
    var d = data();
    if (!d.updatedAt) return null;
    return J.diffDays(J.today(), d.updatedAt);
  }

  /** برای خروجیِ اکسل — همان شکلی که دوباره وارد می‌شود */
  function rows() {
    return [['عنوان احترام', 'نام و نام خانوادگی', 'سمت', 'واحد / منطقه / سازمان', 'رتبه']].concat(list().map(function (o) {
      return [o.honor, o.name, o.position, o.org,
        { high: 'بالادست', peer: 'همتراز', low: 'پایین‌دست' }[o.rank] || ''];
    }));
  }

  w.Officials = {
    KEY: KEY, HONORS: HONORS, COLS: COLS,
    data: data, list: list, get: get, find: find, key: key, address: address, titleOf: titleOf,
    honorTitle: honorTitle, guessRank: guessRank, asRecipient: asRecipient,
    detect: detect, parse: parse, diff: diff, replace: replace, setList: setList, age: age, rows: rows
  };
})(window);

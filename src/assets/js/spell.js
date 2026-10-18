/*
 * غلط‌یابِ فارسی — بی‌شبکه.
 *
 * سه لایه، از قطعی به احتمالی:
 *   arabic — حرفِ عربی (ي، ك، …) به‌جای فارسی. همیشه غلط است.
 *   error  — واژه‌ای که در واژه‌نامه نیست (با پیشنهاد). واژه‌نامه «لیلک»
 *            است (Apache-2.0، vendor/fa-dict.js)، با قاعده‌های پسوند و
 *            پیشوندش: «نامه‌ها»، «انضباطی»، «بی‌توجهی» از ریشه ساخته می‌شوند.
 *   style  — درست هست، ولی در نامهٔ اداری شکلِ دیگرش جاافتاده است:
 *            رییس ← رئیس، هیات ← هیئت، احتراما ← احتراماً.
 *
 * نام‌ها و واحدهایی که در خودِ پرونده‌ها ثبت شده (و واژه‌هایی که کاربر به
 * واژه‌نامهٔ خودش افزوده) غلط شمرده نمی‌شوند؛ وگرنه هر نام خانوادگی قرمز
 * می‌شد و غلط‌یاب بعد از یک روز نادیده گرفته می‌شد.
 *
 * cleanup(text): «اصلاح نگارشی» — ویراستار (MIT، vendor/virastar.js) برای
 * نیم‌فاصله، حروف عربی، نشانه‌گذاری و فاصله‌ها؛ و بعد، با تأیید واژه‌نامه،
 * نیم‌فاصلهٔ «می/نمی/ها/تر» که ویراستار نمی‌گیرد («میشود» ← «می‌شود»).
 */
(function (w) {
  'use strict';

  var ZWNJ = '‌';
  var LETTER = '[ء-غف-ئپچژکگیۀكيەآأإؤئ]';
  var MARKS = '[ً-ْٰـ]';
  var TOKEN = new RegExp('(?:' + LETTER + '|' + MARKS + '|' + ZWNJ + ')+', 'g');
  var ARABIC = { 'ي': 'ی', 'ك': 'ک', 'ى': 'ی', 'ە': 'ه' };

  /* شکلِ جاافتادهٔ نامهٔ اداری. درست‌اند، ولی این‌طور نوشته نمی‌شوند. */
  var STYLE = {
    'رییس': 'رئیس', 'رییسه': 'رئیسه', 'هیات': 'هیئت', 'هیات‌مدیره': 'هیئت‌مدیره',
    'تایید': 'تأیید', 'تاییدیه': 'تأییدیه', 'تاکید': 'تأکید', 'تامین': 'تأمین',
    'تاسیس': 'تأسیس', 'تاخیر': 'تأخیر', 'تاثیر': 'تأثیر', 'ماموریت': 'مأموریت',
    'مامور': 'مأمور', 'ماموران': 'مأموران', 'متاسفانه': 'متأسفانه', 'تاسف': 'تأسف',
    'مساله': 'مسئله', 'مسایل': 'مسائل', 'مسوول': 'مسئول', 'مسوولیت': 'مسئولیت',
    'مسوولین': 'مسئولین', 'مسوولان': 'مسئولان', 'مسول': 'مسئول', 'جزییات': 'جزئیات',
    'جزیی': 'جزئی', 'شوون': 'شئون', 'رای': 'رأی', 'آرا': 'آراء', 'تالیف': 'تألیف',
    'تاهل': 'تأهل', 'متاهل': 'متأهل', 'تادیه': 'تأدیه', 'تاخیرات': 'تأخیرات',
    'احتراما': 'احتراماً', 'ضمنا': 'ضمناً', 'لطفا': 'لطفاً', 'قبلا': 'قبلاً',
    'بعدا': 'بعداً', 'فعلا': 'فعلاً', 'مجددا': 'مجدداً', 'نهایتا': 'نهایتاً',
    'حتما': 'حتماً', 'شخصا': 'شخصاً', 'کتبا': 'کتباً', 'رسما': 'رسماً',
    'اصولا': 'اصولاً', 'ظاهرا': 'ظاهراً', 'تقریبا': 'تقریباً', 'مستقیما': 'مستقیماً',
    'دقیقا': 'دقیقاً', 'صرفا': 'صرفاً', 'اساسا': 'اساساً', 'ذیلا': 'ذیلاً',
    'فورا': 'فوراً', 'تلفنا': 'تلفناً', 'شفاها': 'شفاهاً', 'متعاقبا': 'متعاقباً',
    'اکیدا': 'اکیداً', 'عینا': 'عیناً', 'نسبتا': 'نسبتاً', 'کاملا': 'کاملاً',
    'واقعا': 'واقعاً', 'معمولا': 'معمولاً', 'اخیرا': 'اخیراً', 'مضافا': 'مضافاً',
    'مشروحا': 'مشروحاً', 'موقتا': 'موقتاً', 'عمدتا': 'عمدتاً', 'احیانا': 'احیاناً',
    'اولا': 'اولاً', 'ثانیا': 'ثانیاً', 'ثالثا': 'ثالثاً', 'غالبا': 'غالباً',
    'اتفاقا': 'اتفاقاً', 'جدا': 'جداً', 'مثلا': 'مثلاً', 'اصلا': 'اصلاً',
    'بدینوسیله': 'بدین‌وسیله', 'علیهذا': 'علی‌هذا', 'علیرغم': 'علی‌رغم',
    'خواهشمنداست': 'خواهشمند است', 'مقتضیست': 'مقتضی است'
  };

  /* واژه‌های دبیرخانه که واژه‌نامهٔ عمومی ندارد */
  var BUILTIN = ('دبیرخانه دبیرخانهٔ انضباطی انضباطیِ رسیدگی‌کننده هادیان‌شهر نوکمان ' +
    'غیرموجه مستندات خدمات‌اداری بازپرداخت مزایا ابلاغیه سرپرست کارگزینی ' +
    'شهرداری شهرداری‌ها منطقه مناطق مینوت پیرو عطف فوق‌الذکر مشارالیه مشارالیها ' +
    'معظم‌له معزی‌الیه').split(' ');

  var D = null, dict = null, contOf = {}, memo = new Map(), MEMO_MAX = 40000;

  function load() {
    if (dict) return true;
    D = w.FA_DICT;
    if (!D) return false;
    dict = new Map();
    Object.keys(D.groups).forEach(function (fl) {
      D.groups[fl].split(' ').forEach(function (word) {
        var prev = dict.get(word);
        dict.set(word, prev == null ? fl : prev + fl);
      });
    });
    // پسوندِ دومی که بعد از کدام پسوندِ اول می‌آید
    D.sfx.forEach(function (r) {
      for (var i = 0; i < r[2].length; i += 2) {
        var f = r[2].slice(i, i + 2);
        (contOf[f] = contOf[f] || []).push(r);
      }
    });
    BUILTIN.forEach(function (x) { if (!dict.has(x)) dict.set(x, ''); });
    return true;
  }

  function hasFlag(flags, f) {
    for (var i = 0; i < flags.length; i += 2) if (flags.charAt(i) === f.charAt(0) && flags.charAt(i + 1) === f.charAt(1)) return true;
    return false;
  }

  function inDict(word, flag) {
    var f = dict.get(word);
    if (f == null) return false;
    if (flag) return hasFlag(f, flag);
    return !(D.needaffix && hasFlag(f, D.needaffix)) && !(D.onlycompound && hasFlag(f, D.onlycompound));
  }

  /** فقط واژه‌نامه — بی نام‌های پرونده */
  function lexical(word) {
    if (inDict(word)) return true;
    var i, j, r, stem, mid, list;
    for (i = 0; i < D.sfx.length; i++) {
      r = D.sfx[i];
      if (word.length > r[1].length && word.slice(-r[1].length) === r[1]) {
        stem = word.slice(0, -r[1].length);
        if (inDict(stem, r[0])) return true;
        // دو پسوند پشتِ سرِ هم: کارمند + ان + م
        list = contOf[r[0]];
        if (list) {
          for (j = 0; j < list.length; j++) {
            var r1 = list[j];
            if (stem.length > r1[1].length && stem.slice(-r1[1].length) === r1[1]) {
              mid = stem.slice(0, -r1[1].length);
              if (inDict(mid, r1[0])) return true;
            }
          }
        }
      }
    }
    for (i = 0; i < D.pfx.length; i++) {
      r = D.pfx[i];
      if (word.length > r[1].length && word.indexOf(r[1]) === 0 && inDict(word.slice(r[1].length), r[0])) return true;
    }
    return false;
  }

  function validCore(word) {
    if (lexical(word)) return true;
    // کسرهٔ اضافه با «ٔ» یا «ی»ِ پس از «ه»
    if (/ٔ$/.test(word) && lexical(word.slice(0, -1))) return true;
    // واژهٔ مرکب با نیم‌فاصله: هر جزء درست باشد
    if (word.indexOf(ZWNJ) > 0) {
      var parts = word.split(ZWNJ);
      if (parts.every(function (p) { return p && (lexical(p) || AFFIX[p]); })) return true;
    }
    return false;
  }
  // جزءهایی که بعد از نیم‌فاصله می‌آیند و خودشان واژه نیستند
  var AFFIX = { 'ها': 1, 'های': 1, 'هایی': 1, 'هایش': 1, 'هایشان': 1, 'تر': 1, 'ترین': 1,
    'ام': 1, 'ات': 1, 'اش': 1, 'ای': 1, 'ایم': 1, 'اید': 1, 'اند': 1, 'ی': 1, 'می': 1, 'نمی': 1 };

  function valid(word) {
    var hit = memo.get(word);
    if (hit !== undefined) return hit;
    var ok = validCore(word);
    if (memo.size > MEMO_MAX) memo.clear();
    memo.set(word, ok);
    return ok;
  }

  /* ------------------------------------------------ واژه‌های شناخته */
  var known = null, knownAt = 0;
  var NAME_FIELDS = ['firstName', 'lastName', 'fatherName', 'orgUnit', 'servicePlace', 'jobTitle',
    'expert', 'transferTo', 'transferFrom', 'deputy', 'region', 'unit'];

  function settings() { return (w.Model && w.Model.state.settings && w.Model.state.settings.spell) || {}; }
  function userWords() { return settings().words || []; }

  function knownWords() {
    var now = Date.now();
    if (known && now - knownAt < 20000) return known;
    known = new Set();
    function add(text) {
      String(text || '').replace(TOKEN, function (t) { known.add(strip(t)); return t; });
    }
    var M = w.Model;
    if (M && M.state) {
      (M.state.cases || []).forEach(function (c) { NAME_FIELDS.forEach(function (k) { if (c[k]) add(c[k]); }); });
      var lists = M.state.lists || {};
      Object.keys(lists).forEach(function (k) {
        (lists[k] || []).forEach(function (v) { add(typeof v === 'string' ? v : (v && (v.name || v.label))); });
      });
    }
    if (w.Minute && w.Minute.conf) {
      try {
        (w.Minute.conf().recipients || []).forEach(function (r) { add(r.title); add(r.name); add(r.short); add(r.unit); });
      } catch (e) { /* تنظیماتِ مینوت هنوز آماده نیست */ }
    }
    if (w.BRAND) { add(w.BRAND.app); add(w.BRAND.owner); add(w.BRAND.tagline); }
    userWords().forEach(add);
    knownAt = now;
    return known;
  }
  function invalidate() { known = null; }

  /* ------------------------------------------------------ وارسی */
  function strip(word) { return word.replace(new RegExp(MARKS, 'g'), ''); }

  /* «احتراماً» درست است؛ فقط «احتراما»ِ بی‌تنوین گفته می‌شود */
  function styleWrong(word, bare) {
    var target = STYLE[bare];
    if (strip(target) === bare) return word === bare;
    return true;
  }

  function arabicFix(word) {
    return word.replace(/[يكىە]/g, function (c) { return ARABIC[c]; });
  }

  /**
   * غلط‌های متن. خروجی: [{ start, end, word, kind, msg, suggestions }]
   * ignore: Set واژه‌هایی که کاربر در همین متن «نادیده» گرفته
   */
  function check(text, ignore) {
    if (!load()) return [];
    var kn = knownWords(), out = [], m, prev = null, lastStart = 0, lastEnd = 0;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      var raw = m[0];
      // نیم‌فاصلهٔ آغاز و پایان جزءِ واژه نیست
      var lead = raw.match(/^\u200c*/)[0].length, trail = raw.match(/\u200c*$/)[0].length;
      var word = raw.slice(lead, raw.length - trail);
      var start = m.index + lead, end = start + word.length;
      if (!word) continue;
      var bare = strip(word);
      var issue = null;
      if (ignore && ignore.has(bare)) {
        issue = null;
      } else if (/[\u064A\u0643\u0649\u06D5]/.test(word)) {
        issue = { key: bare, start: start, end: end, word: word, kind: 'arabic',
          msg: 'حرفِ عربی — در نامهٔ فارسی «ی» و «ک» فارسی می‌آید.', suggestions: [arabicFix(word)] };
      } else if (prev && bare === prev && bare.length > 1 && /^[ \t]+$/.test(text.slice(lastEnd, start))) {
        issue = { key: bare, start: lastStart, end: end, word: text.slice(lastStart, end), kind: 'error',
          msg: 'واژهٔ تکراری', suggestions: [word] };
      } else if (STYLE[bare] && styleWrong(word, bare)) {
        issue = { key: bare, start: start, end: end, word: word, kind: 'style',
          msg: 'در نامهٔ اداری این‌طور نوشته می‌شود.', suggestions: [STYLE[bare]] };
      } else if (bare.length > 1 && !kn.has(bare) && !valid(bare)) {
        issue = { key: bare, start: start, end: end, word: word, kind: 'error',
          msg: 'در واژه‌نامه نیست.', suggestions: suggest(bare) };
      }
      if (issue) out.push(issue);
      prev = bare; lastStart = start; lastEnd = end;
    }
    return out;
  }

  /* ------------------------------------------------------ پیشنهاد */
  function suggest(word, max) {
    max = max || 5;
    if (!load()) return [];
    var seen = {}, out = [];
    function ok(c) {
      if (!c || seen[c] || c === word) return;
      seen[c] = 1;
      var parts = c.split(' ');
      if (!parts.every(function (p) { return p && valid(p) && !nosuggest(p); })) return;
      out.push(c);
    }
    var i, j, ch, L = word.length;
    if (STYLE[word]) ok(STYLE[word]);
    ok(arabicFix(word));
    // نیم‌فاصلهٔ جاافتاده: میشود ← می‌شود، نامهها ← نامه‌ها
    /* فقط وقتی واژه‌نامه خودِ ترکیب را می‌شناسد یا جزءِ دوم پسوند است؛
       وگرنه «شهرتهران» ← «شهر‌تهران» می‌شد، نه «شهر تهران» */
    for (i = 1; i < L; i++) {
      if (word[i] === ZWNJ || word[i - 1] === ZWNJ) continue;
      var zc = word.slice(0, i) + ZWNJ + word.slice(i);
      if (lexical(zc) || AFFIX[word.slice(i)]) ok(zc);
    }
    // فاصلهٔ جاافتاده: خواهشمنداست ← خواهشمند است
    for (i = 2; i < L - 1; i++) ok(word.slice(0, i) + ' ' + word.slice(i));
    // نیم‌فاصلهٔ اضافه
    if (word.indexOf(ZWNJ) >= 0) ok(word.split(ZWNJ).join(''));
    // REP و MAP: حرف‌های هم‌آوا و هم‌شکل (ض/ظ، ت/ط، س/ص، ز/ذ، …)
    (D.rep || []).forEach(function (r) {
      var a = r[0], b = r[1] === '_' ? ' ' : r[1];
      [[a, b], [b, a]].forEach(function (pair) {
        var k = word.indexOf(pair[0]);
        while (k >= 0) { ok(word.slice(0, k) + pair[1] + word.slice(k + pair[0].length)); k = word.indexOf(pair[0], k + 1); }
      });
    });
    var groups = (D.map || []).concat(['سصث', 'زذضظ', 'تط', 'هح', 'اع', 'قغ', 'ئی', 'أا', 'ؤو']);
    for (i = 0; i < L; i++) {
      ch = word[i];
      groups.forEach(function (g) {
        if (g.indexOf(ch) < 0) return;
        for (var k = 0; k < g.length; k++) if (g[k] !== ch) ok(word.slice(0, i) + g[k] + word.slice(i + 1));
      });
    }
    // جابه‌جاییِ دو حرفِ کنار هم
    for (i = 0; i < L - 1; i++) ok(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
    // حرفِ اضافه
    for (i = 0; i < L; i++) ok(word.slice(0, i) + word.slice(i + 1));
    if (out.length >= max) return out.slice(0, max);
    // حرفِ جاافتاده یا عوضی
    var tryChars = D.try || '';
    for (i = 0; i <= L; i++) {
      for (j = 0; j < tryChars.length; j++) {
        ch = tryChars[j];
        if (i < L) ok(word.slice(0, i) + ch + word.slice(i + 1));
        ok(word.slice(0, i) + ch + word.slice(i));
      }
      if (out.length >= max * 2) break;
    }
    return out.slice(0, max);
  }

  function nosuggest(word) {
    var f = dict.get(word);
    return !!(f && D.nosuggest && hasFlag(f, D.nosuggest));
  }

  /* ------------------------------------------------------ اصلاح نگارشی */
  var VOPTS = {
    fix_english_numbers: false, normalize_dates: false, fix_numeral_symbols: false,
    markdown_normalize_lists: false, markdown_normalize_braces: false,
    cleanup_line_breaks: false, kashidas_as_parenthetic: false,
    skip_markdown_ordered_lists_numbers_conversion: true
  };
  var virastar = null;

  /**
   * متنِ پاکیزه + شمارِ تغییرها. جای خالیِ مینوت («......») دست نمی‌خورد.
   */
  function cleanup(text) {
    var src = String(text || '');
    var blanks = [];
    var work = src.replace(/\.{4,}/g, function (b) { blanks.push(b); return '' + (blanks.length - 1) + ''; });
    if (w.Virastar) {
      if (!virastar) virastar = new w.Virastar(VOPTS);
      work = virastar.cleanup(work);
    } else {
      work = work.replace(/[يكى]/g, function (c) { return ARABIC[c]; });
    }
    // نیم‌فاصله‌ای که فقط واژه‌نامه می‌داند: میشود، نمیباشد، نامهها
    if (load()) {
      var kn = knownWords();
      work = work.replace(TOKEN, function (t) {
        var bare = strip(t);
        // تنوین و فاصلهٔ جاافتاده‌ای که شکِ دیگری ندارد: احتراما ← احتراماً
        var st = STYLE[bare];
        if (st && (/اً$/.test(st) || st.indexOf(' ') > 0)) return st;
        if (bare.length < 4 || kn.has(bare) || valid(bare)) return t;
        var m = /^(ن?می)(.+)$/.exec(t);
        if (m && valid(m[2])) return m[1] + ZWNJ + m[2];
        var s = /^(.+?)(ها|های|هایی|تر|ترین)$/.exec(t);
        if (s && valid(s[1])) return s[1] + ZWNJ + s[2];
        return t;
      });
    }
    work = work.replace(/(\d+)/g, function (_, i) { return blanks[+i]; });
    return { text: work, changes: changes(src, work) };
  }

  /** شمارِ جاهایی که دو متن فرق دارند (بر اساسِ واژه) */
  function changes(a, b) {
    if (a === b) return 0;
    var x = a.split(/\s+/), y = b.split(/\s+/);
    if (x.length * y.length > 400000) return Math.abs(x.length - y.length) || 1;
    var prev = new Array(y.length + 1).fill(0), cur;
    for (var i = 1; i <= x.length; i++) {
      cur = [0];
      for (var j = 1; j <= y.length; j++) {
        cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      }
      prev = cur;
    }
    return Math.max(x.length, y.length) - prev[y.length];
  }

  /* ------------------------------------------------------ واژه‌نامهٔ کاربر */
  function addWord(word) {
    var bare = strip(String(word || '').trim());
    if (!bare || !w.Model) return Promise.resolve();
    var s = Object.assign({}, settings());
    var list = (s.words || []).slice();
    if (list.indexOf(bare) < 0) list.push(bare);
    s.words = list;
    invalidate();
    return w.Model.saveSettings({ spell: s });
  }

  function setWords(list) {
    var s = Object.assign({}, settings());
    s.words = list.map(function (x) { return strip(String(x).trim()); }).filter(Boolean)
      .filter(function (x, i, arr) { return arr.indexOf(x) === i; });
    invalidate();
    return w.Model.saveSettings({ spell: s });
  }

  function enabled() { return settings().off !== true; }
  function askBefore() { return settings().ask !== false; }
  function setOption(patch) {
    return w.Model.saveSettings({ spell: Object.assign({}, settings(), patch) });
  }

  w.Spell = {
    check: check, suggest: suggest, valid: function (x) { return load() && valid(strip(x)); },
    cleanup: cleanup, strip: strip, addWord: addWord, setWords: setWords, userWords: userWords,
    invalidate: invalidate, enabled: enabled, askBefore: askBefore, setOption: setOption,
    ready: function () { return !!w.FA_DICT; }, STYLE: STYLE
  };
})(window);

/* ابزارهای عمومی */
(function (w) {
  'use strict';

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  /** ارقام فارسی/عربی را به لاتین تبدیل می‌کند. */
  function toLatinDigits(s) {
    if (!s) return '';
    return String(s).replace(/[۰-۹٠-٩]/g, function (ch) {
      var i = FA_DIGITS.indexOf(ch);
      return String(i < 0 ? AR_DIGITS.indexOf(ch) : i);
    });
  }

  /** ارقام لاتین را برای نمایش به فارسی تبدیل می‌کند. */
  function toFaDigits(s) {
    return String(s == null ? '' : s).replace(/[0-9]/g, function (d) {
      return FA_DIGITS[+d];
    });
  }

  /**
   * متن را برای جستجو یکدست می‌کند: ی/ک عربی، همزه‌ها، نیم‌فاصله،
   * اعراب، ارقام و فاصله‌های اضافه.
   */
  function normalize(s) {
    if (!s) return '';
    return toLatinDigits(s)
      .replace(/[يى]/g, 'ی')            // ي ى -> ی
      .replace(/ك/g, 'ک')                    // ك -> ک
      .replace(/[آأإٱ]/g, 'ا')// آ أ إ -> ا
      .replace(/ة/g, 'ه')                    // ة -> ه
      .replace(/[ً-ْٰـ]/g, '')     // اعراب و کشیدگی
      .replace(/[​-‏‪-‮]/g, ' ')   // نویسه‌های کنترلی و نیم‌فاصله
      .replace(/[^\w؀-ۿ]+/g, ' ')            // نشانه‌گذاری -> فاصله
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  /** el('div.card', {title: 'x'}, [child, 'text']) */
  function el(spec, attrs, children) {
    var parts = String(spec).split(/(?=[.#])/);
    var node = document.createElement(parts[0] || 'div');
    for (var i = 1; i < parts.length; i++) {
      if (parts[i][0] === '.') node.classList.add(parts[i].slice(1));
      else node.id = parts[i].slice(1);
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else if (k === 'value') node.value = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  var toastTimer;
  function toast(msg, kind) {
    var box = $('#toast');
    box.textContent = msg;
    box.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = 'toast'; }, 3800);
  }

  /** پنجرهٔ ماژولار ساده. برمی‌گرداند: {root, close} */
  function modal(title, bodyNode, footerNodes) {
    var overlay = el('div.overlay');
    var close = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var box = el('div.modal', null, [
      el('div.modal-head', null, [
        el('h3', { text: title }),
        el('button.icon-btn', { type: 'button', title: 'بستن', onclick: close, text: '✕' })
      ]),
      el('div.modal-body', null, [bodyNode]),
      el('div.modal-foot', null, footerNodes || [])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    return { root: box, close: close };
  }

  function confirmBox(title, message, okLabel) {
    return new Promise(function (resolve) {
      var m;
      var ok = el('button.btn.danger', {
        type: 'button', text: okLabel || 'تأیید',
        onclick: function () { m.close(); resolve(true); }
      });
      var cancel = el('button.btn', {
        type: 'button', text: 'انصراف',
        onclick: function () { m.close(); resolve(false); }
      });
      m = modal(title, el('p', { text: message }), [cancel, ok]);
      ok.focus();
    });
  }

  /* روی  file://  کروم نام غیرلاتین را از  a[download]  نمی‌پذیرد: مبدأ
     opaque است و فایل «download» ذخیره می‌شود — بی‌پسوند، یعنی ورد و اکسل
     هم بازش نمی‌کنند. راهی برای نگه‌داشتن خطِ فارسی نیست، ولی دور ریختنش
     هم نامی مثل «۱۴۰۴-۰۷-۰۱ - - -.pdf» می‌سازد که به درد نمی‌خورد. پس
     حرف‌به‌حرف لاتین می‌شود: نام خوانا می‌ماند و فایل با برنامهٔ درست باز
     می‌شود. نام‌هایی که خودِ برنامه می‌سازد از اول لاتین‌اند و دست نمی‌خورند. */
  var TRANSLIT = {
    'ا': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'a', 'ٱ': 'a', 'ب': 'b', 'پ': 'p',
    'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd',
    'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'gh',
    'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v',
    'ؤ': 'v', 'ه': 'h', 'ة': 'h', 'ی': 'y', 'ي': 'y', 'ئ': 'y', 'ء': ''
  };

  function translit(s) {
    return toLatinDigits(s).replace(/[\u0600-\u06FF\u200c]/g, function (ch) {
      return TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ' ';
    });
  }

  function safeName(filename) {
    var name = String(filename || '').replace(/[\\/:*?"<>|]/g, '-');
    if (!/[^\x20-\x7E]/.test(name)) return name;
    var dot = name.lastIndexOf('.');
    var ext = dot > 0 ? name.slice(dot) : '';
    if (/[^\x20-\x7E]/.test(ext)) ext = '';   // پسوند فارسی به کار نمی‌آید
    var base = translit(dot > 0 ? name.slice(0, dot) : name)
      .replace(/[^\x20-\x7E]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/(?: -)+ /g, ' - ')             // خط تیره‌های پشت‌سرهم
      .trim()
      .replace(/^[-\s]+|[-\s.]+$/g, '');
    return (base || 'file-' + Date.now().toString(36)) + ext;
  }

  function download(filename, blob) {
    var name = safeName(filename);
    /* اگر خودِ Blob یک File با نام باشد، کروم همان نام را می‌گذارد؛
       این‌طور روی  file://  هم نام از دست نمی‌رود. */
    var named = blob;
    try {
      if (typeof File === 'function' && !(blob instanceof File)) {
        named = new File([blob], name,
          { type: blob.type || 'application/octet-stream' });
      }
    } catch (e) { named = blob; }
    var url = URL.createObjectURL(named);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /*
   * شمارشِ بالا رونده برای عددهای بزرگِ کارتابل و گزارش.
   *
   * کارش این نیست که «حرکت داشته باشد»؛ کارش این است که چشم را روی عدد
   * نگه دارد تا خوانده شود. پس کوتاه است (نیم‌ثانیه)، فقط برای عددهای
   * بزرگ، و اگر کاربر حرکت کمتر خواسته باشد اصلاً اجرا نمی‌شود.
   */
  function countUp(node, value, ms) {
    var target = Number(value) || 0;
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target < 2 || !window.requestAnimationFrame) {
      node.textContent = toFaDigits(target);
      return;
    }
    var dur = ms || 520;
    var start = 0;
    function step(now) {
      if (!start) start = now;
      var t = Math.min(1, (now - start) / dur);
      // آرام شدن در انتها: عدد به مقصد می‌رسد، نه اینکه ناگهان بایستد
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = toFaDigits(Math.round(target * eased));
      if (t < 1) window.requestAnimationFrame(step);
    }
    node.textContent = toFaDigits(0);
    window.requestAnimationFrame(step);
  }

  /**
   * فهرستِ نقطه‌دار — «۸ روز پیش • ۲ روز تا پایان مهلت».
   *
   * چرا تابع لازم است و چرا join(' • ') غلط است: در چیدمان راست‌به‌چپ،
   * نقطهٔ جداکننده به عددِ کنارش می‌چسبد و چون صفرِ فارسی خودش یک نقطه
   * است («۰»)، «• ۴» روی صفحه «۴۰» خوانده می‌شود. کاربر این را یک بار
   * در بایگانی دید و درست گفت. راهِ درست، رشته نیست: هر تکه یک span، و
   * جداکننده از CSS می‌آید که دیگر جزء متن نباشد.
   */
  function dots(parts, cls) {
    return el('span.dot-list' + (cls || ''), null,
      parts.filter(Boolean).map(function (t) {
        return typeof t === 'string' ? el('span', { text: t }) : t;
      }));
  }

  w.U = {
    toLatinDigits: toLatinDigits, toFaDigits: toFaDigits, normalize: normalize,
    dots: dots,
    debounce: debounce, el: el, $: $, $$: $$, clear: clear, toast: toast,
    modal: modal, confirmBox: confirmBox, download: download,
    safeName: safeName, uid: uid, countUp: countUp
  };
})(window);

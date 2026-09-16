/* موبایل: تشخیص صفحهٔ کوچک، شیت پایین، و قابلیت‌هایی که روی موبایل نیستند */
(function (w) {
  'use strict';

  var el = w.U.el;
  var PHONE = '(max-width: 720px)';
  var mq = w.matchMedia ? w.matchMedia(PHONE) : { matches: false, addListener: function () {} };
  var listeners = [];

  function isPhone() { return !!mq.matches; }

  /** لمسی بودن دستگاه — برای دکمه‌هایی که با hover ظاهر می‌شوند */
  function isTouch() {
    return ('ontouchstart' in w) || (navigator.maxTouchPoints > 0);
  }

  function onChange(fn) { listeners.push(fn); }

  var fire = w.U.debounce(function () {
    listeners.forEach(function (f) {
      try { f(isPhone()); } catch (e) { /* یک شنونده نباید بقیه را بخواباند */ }
    });
  }, 120);
  if (mq.addEventListener) mq.addEventListener('change', fire);
  else if (mq.addListener) mq.addListener(fire);

  /* --------------------------------------------------------- قابلیت‌های فایل
     مرورگرهای موبایل File System Access API ندارند: نه می‌شود به فایل دیتابیس
     روی دیسک وصل شد، نه پوشهٔ مستندات را باز کرد. به‌جای خطا، صریح می‌گوییم. */
  function canLinkFile() { return typeof w.showSaveFilePicker === 'function'; }
  function canPickFolder() { return typeof w.showDirectoryPicker === 'function'; }

  var NO_FILE_MSG = 'مرورگرهای موبایل اجازهٔ نوشتن روی فایل دیسک را نمی‌دهند. ' +
    'داده‌ها در خود مرورگر ذخیره می‌شود؛ برای انتقال یا نگه‌داری، از «پشتیبان» ' +
    'خروجی بگیرید.';
  var NO_FOLDER_MSG = 'روی موبایل، پوشهٔ مستندات روی دیسک در دسترس نیست. ' +
    'مستندات هر پرونده را روی رایانه اضافه کنید.';


  /* ------------------------------------------------------------- آیکن‌ها
     یک خانواده خط‌نازک، نه شکلک رنگی؛ همان زبان بصری بقیهٔ برنامه. */
  function svg(d) {
    return '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var ICONS = {
    plus: svg('<path d="M12 5.5v13M5.5 12h13"/>'),
    imp: svg('<path d="M12 15.5V4.5"/><path d="M8.5 8L12 4.5 15.5 8"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>'),
    exp: svg('<path d="M12 4.5v11"/><path d="M8.5 12l3.5 3.5L15.5 12"/><path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/>'),
    db: svg('<ellipse cx="12" cy="6.5" rx="6.5" ry="2.5"/><path d="M5.5 6.5v11c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-11"/><path d="M5.5 12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5"/>'),
    backup: svg('<path d="M12 3.5l6.5 2.6v5.2c0 3.8-2.7 7-6.5 8.2-3.8-1.2-6.5-4.4-6.5-8.2V6.1z"/><path d="M9.3 11.8l2 2 3.4-3.6"/>'),
    lock: svg('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
    gear: svg('<circle cx="12" cy="12" r="2.8"/><path d="M12 3.5l1.1 2.2 2.4-.5 1 2.2 2.2 1.1-.5 2.4.5 2.4-2.2 1.1-1 2.2-2.4-.5L12 20.5l-1.1-2.2-2.4.5-1-2.2-2.2-1.1.5-2.4-.5-2.4 2.2-1.1 1-2.2 2.4.5z"/>'),
    print: svg('<path d="M7 9.5V4.5h10v5"/><rect x="4.5" y="9.5" width="15" height="6.5" rx="1.5"/><path d="M7 14h10v5.5H7z"/>'),
    columns: svg('<rect x="4.5" y="5" width="15" height="14" rx="1.5"/><path d="M9.5 5v14M14.5 5v14"/>'),
    check: svg('<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/><path d="M8.3 12.2l2.6 2.6 4.8-5.2"/>'),
    filter: svg('<path d="M4.5 6h15l-5.8 6.6v5.2l-3.4 1.7v-6.9z"/>')
  };
  function icon(name) { return ICONS[name] || ''; }

  /** شیت پایین صفحه: فهرستی از اقدام‌ها، مخصوص لمس */
  function sheet(title, items) {
    var overlay = el('div.overlay.sheet-overlay');
    var close = function () {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };

    var list = el('div.sheet-list');
    (items || []).forEach(function (it) {
      if (!it) return;
      if (it.node) { list.appendChild(it.node); return; }
      if (it.sep) { list.appendChild(el('div.sheet-sep')); return; }
      list.appendChild(el('button.sheet-item' + (it.kind ? '.' + it.kind : ''), {
        type: 'button',
        onclick: function () { close(); if (it.onclick) it.onclick(); }
      }, [
        it.icon ? el('span.sheet-icon', { html: icon(it.icon), 'aria-hidden': 'true' })
          : el('span.sheet-icon'),
        el('span.sheet-text', null, [
          el('b', { text: it.label }),
          it.hint ? el('small', { text: it.hint }) : null
        ])
      ]));
    });

    var box = el('div.sheet', null, [
      el('div.sheet-head', null, [
        el('span.sheet-grip', { 'aria-hidden': 'true' }),
        el('h3', { text: title || '' })
      ]),
      list,
      el('button.btn.block.sheet-close', { type: 'button', text: 'بستن', onclick: close })
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    return { root: box, close: close };
  }

  w.Mobile = {
    isPhone: isPhone, isTouch: isTouch, onChange: onChange, sheet: sheet,
    canLinkFile: canLinkFile, canPickFolder: canPickFolder, icon: icon,
    NO_FILE_MSG: NO_FILE_MSG, NO_FOLDER_MSG: NO_FOLDER_MSG
  };
})(window);

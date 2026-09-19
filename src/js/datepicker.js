/* تقویم شمسی سبک، متصل به فیلدهای متنی تاریخ */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J;
  var open = null;

  function close() {
    if (open) { open.pop.remove(); open = null; }
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onDocKey, true);
  }

  function onDocDown(e) {
    if (!open) return;
    if (open.pop.contains(e.target) || e.target === open.input) return;
    close();
  }

  function onDocKey(e) {
    if (e.key !== 'Escape') return;
    // جلوی رسیدن Escape به میان‌برهای کلی برنامه گرفته می‌شود
    e.stopPropagation();
    e.preventDefault();
    close();
  }

  function render(pop, view, input, onPick) {
    w.U.clear(pop);
    var len = J.monthLength(view.jy, view.jm);
    var firstDow = (J.toGregorian(view.jy, view.jm, 1).getDay() + 1) % 7; // شنبه = 0
    var todayStr = J.today();
    var current = J.parse(input.value);

    var head = el('div.dp-head', null, [
      el('button.dp-nav', {
        type: 'button', text: '›', title: 'ماه بعد', onclick: function () {
          view.jm += 1;
          if (view.jm > 12) { view.jm = 1; view.jy += 1; }
          render(pop, view, input, onPick);
        }
      }),
      el('div.dp-title', null, [
        el('select.dp-month', {
          onchange: function () { view.jm = +this.value; render(pop, view, input, onPick); }
        }, J.MONTHS.map(function (m, i) {
          return el('option', { value: i + 1, text: m, selected: (i + 1) === view.jm });
        })),
        el('input.dp-year', {
          type: 'text', value: view.jy, inputmode: 'numeric',
          onchange: function () {
            var y = +w.U.toLatinDigits(this.value);
            if (y >= 1300 && y <= 1500) { view.jy = y; render(pop, view, input, onPick); }
          }
        })
      ]),
      el('button.dp-nav', {
        type: 'button', text: '‹', title: 'ماه قبل', onclick: function () {
          view.jm -= 1;
          if (view.jm < 1) { view.jm = 12; view.jy -= 1; }
          render(pop, view, input, onPick);
        }
      })
    ]);

    var grid = el('div.dp-grid');
    J.WEEKDAYS.forEach(function (d) {
      grid.appendChild(el('div.dp-dow', { text: d.slice(0, 1) === 'پ' ? d.slice(0, 4) : d.slice(0, 2) }));
    });
    for (var i = 0; i < firstDow; i++) grid.appendChild(el('div.dp-cell.empty'));
    for (var d = 1; d <= len; d++) {
      (function (day) {
        var val = J.pack(view.jy, view.jm, day);
        var cls = 'div.dp-cell';
        if (val === todayStr) cls += '.today';
        if (val === current) cls += '.selected';
        grid.appendChild(el(cls, {
          text: w.U.toFaDigits(day), role: 'button', tabindex: '0',
          onclick: function () { onPick(val); close(); }
        }));
      })(d);
    }

    var foot = el('div.dp-foot', null, [
      el('button.btn.small', {
        type: 'button', text: 'امروز',
        onclick: function () { onPick(todayStr); close(); }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'پاک کردن',
        onclick: function () { onPick(''); close(); }
      })
    ]);

    pop.appendChild(head);
    pop.appendChild(grid);
    pop.appendChild(foot);
  }

  function show(input, onPick) {
    close();
    var parsed = J.unpack(J.parse(input.value));
    var todayParts = J.unpack(J.today());
    var view = parsed ? { jy: parsed.jy, jm: parsed.jm } : { jy: todayParts.jy, jm: todayParts.jm };
    var pop = el('div.dp-pop');
    document.body.appendChild(pop);
    render(pop, view, input, onPick);

    var r = input.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 4;
    if (r.bottom + pop.offsetHeight > window.innerHeight && r.top > pop.offsetHeight) {
      top = r.top + window.scrollY - pop.offsetHeight - 4;
    }
    pop.style.top = top + 'px';
    var right = window.innerWidth - r.right;
    pop.style.right = Math.max(8, Math.min(right, window.innerWidth - pop.offsetWidth - 8)) + 'px';

    open = { pop: pop, input: input };
    setTimeout(function () {
      document.addEventListener('mousedown', onDocDown, true);
      document.addEventListener('keydown', onDocKey, true);
    }, 0);
  }

  /** فیلد تاریخ: ورودی متنی + دکمهٔ تقویم + نمایش فارسی */
  function field(value, onChange) {
    var input = el('input.input.date-input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off',
      placeholder: 'مثال: ۱۴۰۴/۰۷/۲۰',
      value: value ? J.format(value, { latin: true }) : ''
    });
    var hint = el('span.date-hint');

    /*
     * تاریخِ نادرست پاک نمی‌شود.
     *
     * قبلاً هر چیزی که J.parse نمی‌فهمید، بی‌صدا از فیلد پاک می‌شد: کاربر
     * یک رقم را اشتباه می‌زد و نوشته‌اش می‌پرید، بدون هیچ پیامی. حالا متن
     * سر جایش می‌ماند، فیلد قرمز می‌شود و زیرش می‌نویسد چه شکلی درست است.
     */
    /* J.parse وقتی چیزی را نفهمد، همان متن خام را برمی‌گرداند نه رشتهٔ
       خالی. پس «قابل تجزیه بودن» ملاک نیست؛ باید تاریخِ واقعی دربیاید —
       وگرنه «۱۴۰۴/۹۹/۹۹» بی‌صدا به‌عنوان متن در فیلد تاریخ ذخیره می‌شد. */
    function isBad() {
      return !!input.value.trim() && !J.unpack(J.parse(input.value));
    }

    function refreshHint() {
      var v = J.parse(input.value);
      var p = J.unpack(v);
      var bad = isBad();
      hint.textContent = p
        ? (J.weekday(p.jy, p.jm, p.jd) + '، ' + J.format(v, { long: true }))
        : (bad ? 'تاریخ خوانده نشد — به شکل ۱۴۰۴/۰۷/۲۰ بنویسید' : '');
      hint.classList.toggle('bad', bad);
      input.classList.toggle('invalid', bad);
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }

    /** v از تقویم یا از متنِ درست می‌آید؛ متنِ نادرست دست نمی‌خورد */
    function commit(v) {
      if (isBad()) {
        refreshHint();          // نوشتهٔ کاربر می‌ماند تا خودش درستش کند
        onChange('');
        return;
      }
      input.value = v ? J.format(v, { latin: true }) : '';
      refreshHint();
      onChange(v);
    }

    input.addEventListener('change', function () { commit(J.parse(input.value)); });
    input.addEventListener('input', refreshHint);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(J.parse(input.value)); }
    });

    var btn = el('button.icon-btn.date-btn', {
      type: 'button', title: 'انتخاب از تقویم', text: '📅',
      onclick: function (e) { e.preventDefault(); show(input, commit); }
    });

    refreshHint();
    var wrap = el('div.date-field', null, [el('div.date-row', null, [input, btn]), hint]);
    wrap.getValue = function () { return J.parse(input.value); };
    wrap.isInvalid = isBad;
    wrap.raw = function () { return input.value; };
    wrap.setValue = function (v) { input.value = v ? J.format(v, { latin: true }) : ''; refreshHint(); };
    wrap.input = input;
    return wrap;
  }

  w.DatePicker = { show: show, field: field, close: close };
})(window);

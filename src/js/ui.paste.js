/*
 * پنجرهٔ «چسباندن از سامانهٔ کارگزینی».
 *
 * متن را می‌چسبانید، همان لحظه پیش‌نمایش می‌آید: هر فیلد، مقداری که از
 * متن درآمد، و آنچه الان در فرم است. چیزی ذخیره نمی‌شود — مقدارها فقط در
 * فرم می‌نشینند و تا «ذخیره» نزنید، پرونده عوض نمی‌شود.
 *
 * پیش‌فرضِ تیک‌ها همان قاعدهٔ پر کردنِ خودکار از پروندهٔ قبلی است:
 * فیلدِ خالی پر می‌شود، دست‌نوشتهٔ کاربر نه. اگر فرم چیز دیگری دارد،
 * تیک نخورده می‌ماند و کنارش نوشته می‌شود — با یک تیک، جایگزین می‌شود.
 */
(function (w) {
  'use strict';

  var el = w.U.el, M = w.Model, J = w.J, P = w.Paste;

  function fa(n) { return w.U.toFaDigits(n); }

  function labelOf(key) {
    var f = M.FIELD_BY_KEY[key];
    return f ? String(f.label).replace(/\(\d[^)]*\)/g, '').replace(/\*/g, '').trim() : key;
  }

  function isDate(key) {
    var f = M.FIELD_BY_KEY[key];
    return !!(f && f.type === 'date');
  }

  function show(key, v) { return isDate(key) && v ? J.format(v) : (v || ''); }

  function same(a, b) {
    return P.squash(String(a || '')) === P.squash(String(b || ''));
  }

  /**
   * ctx: { current(key) → مقدارِ فعلیِ فرم, apply(values) }
   * text: متنِ از پیش چسبانده‌شده (اگر کاربر مستقیم در فرم چسبانده باشد)
   */
  function open(app, ctx, text) {
    var area = el('textarea.input.area.paste-area', {
      rows: 7, dir: 'rtl', spellcheck: false,
      placeholder: 'صفحهٔ «مشخصات» کارمند را در سامانهٔ کارگزینی انتخاب کنید ' +
        '(Ctrl+A)، کپی کنید (Ctrl+C) و اینجا بچسبانید (Ctrl+V).'
    });
    area.value = text || '';
    var preview = el('div.paste-preview');
    var applyBtn = el('button.btn.primary', { type: 'button', text: 'ریختن در فرم' });
    var picks = [];   // { key, box, input }
    var m;

    function draw() {
      w.U.clear(preview);
      picks = [];
      var res = P.parse(area.value);
      if (!area.value.trim()) {
        preview.appendChild(el('p.muted.tiny', {
          text: 'متن که بچسبد، همین‌جا معلوم می‌شود هر مقدار به کدام فیلد می‌رود.'
        }));
        sync();
        return;
      }
      if (!res.rows.length) {
        preview.appendChild(el('p.warn', {
          text: 'از این متن فیلدی شناخته نشد. متن باید برچسب‌هایی مثل «کد ملی»، ' +
            '«نام پدر» یا «تاریخ استخدام» داشته باشد.'
        }));
        sync();
        return;
      }

      var body = el('tbody');
      res.rows.forEach(function (r) {
        var cur = ctx.current(r.key) || '';
        var dup = cur && same(cur, r.value);
        var box = el('input', { type: 'checkbox' });
        box.checked = !cur && !r.bad;
        box.disabled = !!dup;
        var input = el('input.input.paste-val', { type: 'text', value: show(r.key, r.value) });
        input.addEventListener('input', function () {
          if (!dup) box.checked = !!input.value.trim();
          sync();
        });
        box.addEventListener('change', sync);
        picks.push({ key: r.key, box: box, input: input });

        var notes = [];
        if (dup) notes.push(el('span.paste-same', { text: 'فرم همین را دارد' }));
        else if (cur) {
          notes.push(el('span.paste-diff', {
            text: 'در فرم: ' + show(r.key, cur) + ' — با تیک جایگزین می‌شود'
          }));
        }
        if (r.inferred) notes.push(el('span.paste-guess', { text: 'برداشت از ' + r.from }));
        if (r.note) notes.push(el('span.paste-note', { text: r.note }));

        body.appendChild(el('tr' + (dup ? '.is-same' : '') + (cur && !dup ? '.is-diff' : ''), null, [
          el('td.paste-pick', null, [box]),
          el('th', { text: labelOf(r.key), scope: 'row' }),
          el('td', null, [input].concat(notes.length ? [el('div.paste-notes', null, notes)] : []))
        ]));
      });
      preview.appendChild(el('table.c-table.paste-table', null, [
        el('thead', null, [el('tr', null, [
          el('th', { text: '' }), el('th', { text: 'فیلد پرونده' }),
          el('th', { text: 'مقدار خوانده‌شده (ویرایش‌پذیر)' })
        ])]),
        body
      ]));

      if (res.skipped.length) {
        preview.appendChild(el('p.paste-skip', null, [
          el('b', { text: 'در پرونده نوشته نمی‌شود: ' }),
          el('span', { text: res.skipped.join('، ') }),
          el('span.muted', { text: ' — پروندهٔ انضباطی جایی برایشان ندارد.' })
        ]));
      }
      if (res.unknown.length) {
        preview.appendChild(el('p.paste-skip.muted', {
          text: fa(res.unknown.length) + ' سطر شناخته نشد و کنار گذاشته شد.'
        }));
      }
      sync();
    }

    function chosen() {
      var out = {};
      picks.forEach(function (p) {
        if (!p.box.checked || p.box.disabled) return;
        var v = p.input.value.trim();
        if (!v) return;
        out[p.key] = isDate(p.key) ? J.parse(v) : v;
      });
      return out;
    }

    function sync() {
      var n = Object.keys(chosen()).length;
      applyBtn.disabled = !n;
      applyBtn.textContent = n ? 'ریختن ' + fa(n) + ' فیلد در فرم' : 'ریختن در فرم';
    }

    applyBtn.addEventListener('click', function () {
      var vals = chosen();
      if (!Object.keys(vals).length) return;
      m.close();
      ctx.apply(vals);
    });

    area.addEventListener('input', w.U.debounce(draw, 180));
    area.addEventListener('paste', function () { setTimeout(draw, 0); });

    var body = el('div.paste-dialog', null, [
      el('p.set-note', {
        text: 'هر مقدار در فیلدِ خودش می‌نشیند. چیزی ذخیره نمی‌شود تا خودتان ' +
          '«ذخیره» بزنید. شمارهٔ حساب، شمارهٔ بیمه و امثالشان خوانده می‌شوند ' +
          'ولی در پرونده نوشته نمی‌شوند.'
      }),
      area,
      preview
    ]);
    m = w.U.modal('چسباندن از سامانهٔ کارگزینی', body, [
      el('button.btn', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      applyBtn
    ]);
    m.root.classList.add('wide-modal');
    draw();
    if (!text) setTimeout(function () { area.focus(); }, 30);
    return m;
  }

  w.UIPaste = { open: open };
})(window);

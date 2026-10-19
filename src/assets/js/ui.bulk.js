/*
 * اقدام دسته‌ای: یک تغییر روی چند پرونده با هم.
 * کار روزمره‌ای که بیشترین وقت را می‌گیرد: بعد از جلسه، ثبت یک تاریخ و یک
 * شمارهٔ جلسه برای همهٔ پرونده‌هایی که مطرح شدند.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }

  /** فیلدهایی که واقعاً دسته‌ای پر می‌شوند، به ترتیب کاربرد */
  var COMMON = ['committeeDate', 'session', 'year', 'status', 'expert',
    'deliveryDate', 'noticeLetterDate', 'noticeReturn', 'caseType'];

  function fieldOptions() {
    var seen = {};
    var head = COMMON.map(function (k) {
      seen[k] = 1;
      return M.FIELD_BY_KEY[k];
    }).filter(Boolean);
    var rest = M.FIELDS.filter(function (f) {
      // شماره پرونده و مشخصات هویتی دسته‌ای پر نمی‌شوند
      if (seen[f.key]) return false;
      if (f.hidden) return false;
      if (f.key === 'caseNo' || f.key === 'nationalId') return false;
      return true;
    });
    return { head: head, rest: rest };
  }

  /** یک ردیف «فیلد + مقدار» */
  function fieldRow(state, onChange, onRemove) {
    var opts = fieldOptions();
    var select = el('select.input.small');
    select.appendChild(el('option', { value: '', text: '— فیلد را انتخاب کنید —' }));
    var g1 = el('optgroup', { label: 'پرکاربرد' });
    opts.head.forEach(function (f) {
      g1.appendChild(el('option', { value: f.key, text: w.UIForm.cleanLabel(f.label) }));
    });
    select.appendChild(g1);
    var g2 = el('optgroup', { label: 'سایر فیلدها' });
    opts.rest.forEach(function (f) {
      g2.appendChild(el('option', { value: f.key, text: w.UIForm.cleanLabel(f.label) }));
    });
    select.appendChild(g2);
    select.value = state.key || '';

    var valueHost = el('div.bulk-value');

    function buildValue() {
      w.U.clear(valueHost);
      var field = M.FIELD_BY_KEY[state.key];
      if (!field) {
        valueHost.appendChild(el('span.muted.tiny', { text: 'اول فیلد را انتخاب کنید' }));
        return;
      }
      if (field.type === 'date') {
        var df = w.DatePicker.field(state.value, function (v) {
          state.value = v;
          onChange();
        });
        if (state.clear) df.input.disabled = true;
        valueHost.appendChild(df);
        valueHost.appendChild(clearToggle(state, onChange, buildValue));
        return;
      }
      if (field.type === 'select') {
        var sel = el('select.input.small');
        sel.appendChild(el('option', { value: '', text: '— انتخاب کنید —' }));
        M.optionsFor(field).forEach(function (o) {
          sel.appendChild(el('option', { value: o, text: o, selected: o === state.value }));
        });
        sel.appendChild(el('option', {
          value: '__clear__', text: '⨯ خالی کردن این فیلد'
        }));
        sel.value = state.clear ? '__clear__' : (state.value || '');
        sel.addEventListener('change', function () {
          state.clear = sel.value === '__clear__';
          state.value = state.clear ? '' : sel.value;
          onChange();
        });
        valueHost.appendChild(sel);
        return;
      }
      var input = el('input.input.small', {
        type: 'text', value: state.value || '',
        placeholder: 'مقدار تازه',
        disabled: state.clear || null
      });
      input.addEventListener('input', function () {
        state.value = input.value;
        onChange();
      });
      valueHost.appendChild(input);
      valueHost.appendChild(clearToggle(state, onChange, buildValue));
    }

    /**
     * پاک کردن باید صریح باشد.
     * وگرنه ردیفی که هنوز پر نشده، «این فیلد را روی همه خالی کن» معنا می‌دهد
     * و یک کلیک ناخواسته می‌تواند ده‌ها تاریخ را پاک کند.
     */
    function clearToggle(st, onChange, rebuild) {
      var cb = el('input', { type: 'checkbox', checked: !!st.clear });
      cb.addEventListener('change', function () {
        st.clear = cb.checked;
        if (st.clear) st.value = '';
        rebuild();
        onChange();
      });
      return el('label.bulk-clear', { title: 'مقدار این فیلد در همهٔ پرونده‌ها پاک شود' },
        [cb, el('span', { text: 'خالی کردن' })]);
    }

    select.addEventListener('change', function () {
      state.key = select.value;
      state.value = '';
      buildValue();
      onChange();
    });
    buildValue();

    return el('div.bulk-row', null, [
      select,
      valueHost,
      onRemove ? el('button.icon-btn.bulk-remove', {
        type: 'button', text: '✕', title: 'برداشتن این فیلد', onclick: onRemove
      }) : null
    ]);
  }

  /**
   * پنجرهٔ اقدام دسته‌ای.
   * ids: شناسهٔ پرونده‌ها · title: از کجا آمده‌اند، برای یادداشت تاریخچه
   */
  function dialog(app, ids, title, onDone) {
    if (!ids || !ids.length) {
      w.U.toast('اول چند پرونده را انتخاب کنید.', 'bad');
      return;
    }
    var rows = [{ key: 'committeeDate', value: '', clear: false }];
    var rowsHost = el('div.bulk-rows');
    var summary = el('div.bulk-summary');
    var m;

    function patchOf() {
      var patch = {};
      rows.forEach(function (r) {
        if (!r.key) return;
        // ردیف نیمه‌کاره نادیده گرفته می‌شود؛ پاک کردن فقط با تیک صریح
        if (r.clear) patch[r.key] = '';
        else if (String(r.value || '').trim() !== '') patch[r.key] = r.value;
      });
      return patch;
    }

    function refreshSummary() {
      var patch = patchOf();
      w.U.clear(summary);
      if (!Object.keys(patch).length) {
        var picked = rows.some(function (r) { return r.key; });
        summary.appendChild(el('span.muted', {
          text: picked
            ? 'مقدار تازه را وارد کنید، یا «خالی کردن» را بزنید.'
            : 'هنوز فیلدی انتخاب نشده است.'
        }));
        apply.disabled = true;
        apply.textContent = 'اعمال';
        return;
      }
      var pv = M.previewBulk(ids, patch);
      apply.disabled = pv.willChange === 0;
      summary.appendChild(el('b', {
        text: pv.willChange
          ? fa(pv.willChange) + ' پرونده تغییر می‌کند'
          : 'هیچ پرونده‌ای تغییر نمی‌کند'
      }));
      if (pv.already) {
        summary.appendChild(el('span.muted', {
          text: ' • ' + fa(pv.already) + ' پرونده از قبل همین مقدار را دارد'
        }));
      }
      apply.textContent = pv.willChange
        ? 'اعمال روی ' + fa(pv.willChange) + ' پرونده'
        : 'چیزی برای اعمال نیست';
    }

    function renderRows() {
      w.U.clear(rowsHost);
      rows.forEach(function (r, i) {
        rowsHost.appendChild(fieldRow(r, refreshSummary, rows.length > 1
          ? function () { rows.splice(i, 1); renderRows(); refreshSummary(); }
          : null));
      });
    }

    var apply = el('button.btn.primary', {
      type: 'button', text: 'اعمال',
      onclick: function () {
        var patch = patchOf();
        var pv = M.previewBulk(ids, patch);
        var names = Object.keys(patch).map(function (k) {
          var label = w.UIForm.cleanLabel(M.FIELD_BY_KEY[k].label);
          return patch[k] === '' ? label + ' (خالی می‌شود)' : label;
        }).join('، ');
        w.U.confirmBox('اعمال اقدام دسته‌ای',
          names + ' روی ' + fa(pv.willChange) + ' پرونده ثبت می‌شود. ' +
          'این کار برگشت خودکار ندارد، ولی تغییر هر پرونده در تاریخچهٔ خودش ' +
          'ثبت می‌شود. ادامه می‌دهید؟', 'اعمال کن').then(function (ok) {
            if (!ok) return;
            apply.disabled = true;
            apply.textContent = 'در حال ثبت…';
            return M.bulkUpdate(ids, patch, 'اقدام دسته‌ای' +
              (title ? ' — ' + title : '')).then(function (res) {
                m.close();
                w.U.toast(fa(res.changed) + ' پرونده به‌روز شد' +
                  (res.unchanged ? '، ' + fa(res.unchanged) + ' پرونده تغییری نداشت' : '') +
                  '.', 'good');
                if (onDone) onDone(res);
              });
          }).catch(function (e) {
            apply.disabled = false;
            w.U.toast('اعمال ناموفق بود: ' + e.message, 'bad');
          });
      }
    });

    var body = el('div.bulk-dialog', null, [
      el('p.bulk-scope', null, [
        el('b', { text: fa(ids.length) + ' پرونده' }),
        el('span', { text: title ? ' — ' + title : ' انتخاب شده‌اند' })
      ]),
      el('p.muted.tiny', {
        text: 'همان مقدار روی همهٔ این پرونده‌ها ثبت می‌شود. فیلدهایی که ' +
          'انتخاب نکنید دست‌نخورده می‌مانند.'
      }),
      rowsHost,
      el('button.btn.small.ghost.bulk-add', {
        type: 'button', text: '＋ افزودن فیلد دیگر',
        onclick: function () {
          rows.push({ key: '', value: '', clear: false });
          renderRows();
          refreshSummary();
        }
      }),
      summary
    ]);

    renderRows();
    m = w.U.modal('اقدام دسته‌ای', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف',
        onclick: function () { m.close(); } }),
      apply
    ]);
    refreshSummary();
  }

  w.UIBulk = { dialog: dialog };
})(window);

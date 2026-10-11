/*
 * ارجاع به کارشناس دیگر.
 *
 * گاهی پرونده از دست دبیرخانهٔ ما خارج می‌شود و به کارشناس بعدی می‌رود.
 * این نه «مختومه» است (رأیی صادر نشده) و نه «در جریان» (کاری از ما برنمی‌آید).
 * پس حالت سوم خودش را دارد: پرونده از کارتابل بیرون می‌رود، ولی در گزارش‌ها
 * جدا از مختومه‌ها شمرده می‌شود و معلوم است کِی، به که، و چرا رفته است.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }

  var STATUS_TRANSFERRED = 'ارجاع به کارشناس دیگر';

  function personOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام';
  }

  /** فهرست کارشناسان، از همان لیست کشویی خودِ برنامه */
  function expertOptions() {
    var list = (M.state.lists.Karshenas || []).slice();
    return list;
  }

  /**
   * پنجرهٔ ارجاع.
   * ids: یک یا چند پرونده · onDone: بعد از ثبت موفق
   */
  function dialog(app, ids, onDone) {
    var recs = ids.map(function (id) { return M.get(id); }).filter(Boolean);
    if (!recs.length) return null;

    var state = { to: '', date: J.today(), letterNo: '', reason: '' };
    var apply, m;

    var body = el('div.transfer');

    body.appendChild(el('p.transfer-lead', null, [
      el('b', { text: fa(recs.length) + ' پرونده' }),
      el('span', {
        text: ' به کارشناس دیگری ارجاع می‌شود. پس از ثبت، این پرونده‌ها از ' +
          'کارتابل شما بیرون می‌روند و دیگر «منتظر اقدام ما» شمرده نمی‌شوند.'
      })
    ]));

    // --- کارشناس مقصد: از لیست، یا نامی تازه ---
    var select = el('select.input.small');
    select.appendChild(el('option', { value: '', text: '— انتخاب کنید —' }));
    expertOptions().forEach(function (name) {
      select.appendChild(el('option', { value: name, text: name }));
    });
    select.appendChild(el('option', { value: '__new', text: '+ کارشناس تازه…' }));

    var newName = el('input.input.small', {
      type: 'text', placeholder: 'نام کارشناس یا واحد مقصد'
    });
    newName.style.display = 'none';
    newName.addEventListener('input', function () {
      state.to = newName.value.trim();
      refresh();
    });
    select.addEventListener('change', function () {
      if (select.value === '__new') {
        newName.style.display = '';
        state.to = newName.value.trim();
        newName.focus();
      } else {
        newName.style.display = 'none';
        state.to = select.value;
      }
      refresh();
    });

    var dateField = w.DatePicker.field(state.date, function (v) {
      state.date = v;
      refresh();
    });
    var letterInput = el('input.input.small.reg-input', {
      type: 'text', placeholder: 'اختیاری'
    });
    letterInput.addEventListener('input', function () {
      state.letterNo = letterInput.value.trim();
    });
    var reason = el('textarea.input.area', {
      rows: '2', placeholder: 'مثلاً: خارج از صلاحیت این کمیته / تجمیع با پروندهٔ مرتبط'
    });
    reason.addEventListener('input', function () { state.reason = reason.value; });

    body.appendChild(el('div.transfer-head', null, [
      el('label.field', null, [
        el('span.field-label', { text: 'ارجاع به' }), select, newName
      ]),
      el('label.field', null, [
        el('span.field-label', { text: 'تاریخ ارجاع' }), dateField
      ]),
      el('label.field', null, [
        el('span.field-label', { text: 'شمارهٔ نامهٔ ارجاع' }), letterInput
      ]),
      el('label.field.wide', null, [
        el('span.field-label', { text: 'علت ارجاع' }), reason
      ])
    ]));

    // --- فهرست پرونده‌ها ---
    body.appendChild(el('ul.transfer-list', null, recs.slice(0, 12).map(function (rec) {
      var action = w.Worklist.nextAction(rec);
      return el('li.transfer-row', null, [
        el('span.reg-no', { text: w.U.toLatinDigits(rec.caseNo || '—') }),
        el('span.transfer-name', { text: personOf(rec) }),
        el('span.transfer-stage', {
          text: action.key === 'closed' ? 'مختومه'
            : (action.key === 'transferred' ? 'قبلاً ارجاع شده' : action.label)
        })
      ]);
    }).concat(recs.length > 12
      ? [el('li.transfer-row.muted', { text: 'و ' + fa(recs.length - 12) + ' پروندهٔ دیگر' })]
      : [])));

    var summary = el('div.transfer-summary');
    body.appendChild(summary);

    function alreadyGone() {
      return recs.filter(function (r) { return w.Worklist.isTransferred(r); }).length;
    }

    function refresh() {
      w.U.clear(summary);
      var gone = alreadyGone();
      if (!state.to) {
        summary.appendChild(el('span.transfer-warn', {
          text: 'کارشناس مقصد را انتخاب کنید.'
        }));
      } else {
        summary.appendChild(el('span', {
          text: fa(recs.length - gone) + ' پرونده به «' + state.to + '» ارجاع می‌شود' +
            (state.date ? ' با تاریخ ' + J.format(state.date) : '') + '.'
        }));
      }
      if (gone) {
        summary.appendChild(el('span.transfer-warn', {
          text: ' ' + fa(gone) + ' پرونده از قبل ارجاع شده بود؛ ارجاعش به‌روز می‌شود.'
        }));
      }
      if (apply) apply.disabled = !(state.to && state.date);
    }

    function save() {
      var text = fa(recs.length) + ' پرونده به «' + state.to + '» ارجاع می‌شود و از ' +
        'کارتابل شما بیرون می‌رود. وضعیتشان «' + STATUS_TRANSFERRED + '» ثبت می‌شود ' +
        'و تغییر هر پرونده در تاریخچهٔ خودش می‌ماند. ادامه می‌دهید؟';
      return w.U.confirmBox('ارجاع به کارشناس دیگر', text, 'ارجاع بده')
        .then(function (ok) {
          if (!ok) return null;
          apply.disabled = true;
          apply.textContent = 'در حال ثبت…';
          var list = recs.map(function (rec) {
            var patch = {
              transferDate: state.date,
              transferTo: state.to,
              // کارشناس قبلی همان کسی است که تا امروز پرونده دستش بوده
              transferFrom: rec.expert || '',
              status: STATUS_TRANSFERRED
            };
            if (state.letterNo) patch.transferLetterNo = state.letterNo;
            if (state.reason.trim()) patch.transferReason = state.reason.trim();
            return { id: rec.id, patch: patch };
          });
          return M.applyPatches(list, {
            kind: 'transfer',
            note: 'ارجاع به ' + state.to + ' — ' + J.format(state.date)
          }).then(function (res) {
            m.close();
            w.U.toast(fa(res.changed) + ' پرونده به «' + state.to + '» ارجاع شد.', 'good');
            if (onDone) onDone(res);
            return res;
          });
        }).catch(function (e) {
          apply.disabled = false;
          apply.textContent = 'ثبت ارجاع';
          w.U.toast('ثبت ارجاع ناموفق بود: ' + e.message, 'bad');
        });
    }

    apply = el('button.btn.primary', {
      type: 'button', text: 'ثبت ارجاع', onclick: save
    });
    refresh();

    m = w.U.modal('ارجاع به کارشناس دیگر', body, [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      apply
    ]);
    m.root.classList.add('transfer-modal');
    setTimeout(function () { select.focus(); }, 60);
    return m;
  }

  /** بازگرداندن پرونده به جریان — اگر ارجاع اشتباه ثبت شده باشد */
  function undo(app, rec, onDone) {
    return w.U.confirmBox('برگرداندن پرونده',
      'ارجاع پروندهٔ ' + w.U.toFaDigits(rec.caseNo || '') + ' برداشته شود و ' +
      'دوباره به کارتابل برگردد؟', 'برگردان').then(function (ok) {
        if (!ok) return null;
        return M.applyPatches([{
          id: rec.id,
          patch: {
            transferDate: '', transferTo: '', transferFrom: '',
            transferLetterNo: '', transferReason: '',
            status: rec.transferFrom ? 'مفتوح رسیدگی' : (rec.status || 'مفتوح رسیدگی')
          }
        }], { kind: 'transfer', note: 'برگرداندن پرونده از ارجاع' })
          .then(function (res) {
            w.U.toast('پرونده به کارتابل برگشت.', 'good');
            if (onDone) onDone(res);
            return res;
          });
      });
  }

  w.UITransfer = { dialog: dialog, undo: undo, STATUS: STATUS_TRANSFERRED };
})(window);

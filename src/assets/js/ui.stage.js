/*
 * تنظیم دستی مرحلهٔ پرونده.
 *
 * موتور، مرحله را از روی تاریخ‌های خودِ پرونده حساب می‌کند و معمولاً درست
 * می‌گوید. ولی همیشه نه: پرونده‌ای که عملاً سرِ جلسهٔ دفاع است ممکن است
 * تاریخ‌های میانی‌اش هنوز وارد نشده باشد و کارتابل آن را چند مرحله عقب
 * نشان دهد. آن‌وقت کاربر باید بتواند بگوید «این پرونده اینجاست».
 *
 * دو چیز عمداً رعایت شده:
 *   ۱) تاریخ‌ها دست نمی‌خورند. این تنظیم فقط می‌گوید «الان کجاییم»، نه
 *      اینکه تاریخی را جعل کند. ریل همچنان تیکِ مرحله‌ها را از روی
 *      تاریخ‌های واقعی می‌زند.
 *   ۲) پنهان نمی‌ماند. هر جا مرحله دستی تنظیم شده باشد، گفته می‌شود که
 *      دستی است و محاسبهٔ خودکار چه می‌گفت، و با یک کلیک برمی‌گردد.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, WL = w.Worklist;

  function fa(n) { return w.U.toFaDigits(n); }

  /** پنجرهٔ انتخاب مرحله */
  function dialog(app, rec, onDone) {
    var auto = WL.nextAction(rec);
    var autoKey = auto.manual ? auto.autoKey : auto.key;
    var stages = WL.stages(rec);
    var state = {
      key: rec.stageOverride || autoKey,
      date: rec.stageOverrideDate || J.today(),
      note: rec.stageOverrideNote || ''
    };

    var body = el('div.stage-set');
    body.appendChild(el('p.muted.tiny', {
      text: 'بگویید پرونده الان در کدام مرحله است. تاریخ‌های ثبت‌شده دست ' +
        'نمی‌خورند؛ فقط کارتابل و آلارم‌ها از همین‌جا حساب می‌شوند.'
    }));

    var pick = el('div.stage-pick');
    var buttons = {};
    WL.STAGES.forEach(function (st, i) {
      var info = stages[i];
      var b = el('button.stage-opt', {
        type: 'button',
        onclick: function () {
          state.key = st.key;
          sync();
        }
      }, [
        el('span.stage-opt-n', { text: fa(i + 1) }),
        el('span.stage-opt-label', { text: st.label }),
        el('span.stage-opt-meta', {
          text: info.date ? J.format(info.date)
            : (info.done ? 'گذشته' : (st.optional ? 'اختیاری' : '—'))
        })
      ]);
      if (st.key === autoKey) b.appendChild(el('span.stage-opt-auto', { text: 'خودکار' }));
      buttons[st.key] = b;
      pick.appendChild(b);
    });
    body.appendChild(pick);

    var dateField = w.DatePicker.field(state.date, function (v) {
      state.date = v;
      sync();
    });
    var noteInput = el('input.input.small', {
      type: 'text', value: state.note,
      placeholder: 'مثلاً: تاریخ‌های میانی هنوز وارد نشده'
    });
    noteInput.addEventListener('input', function () { state.note = noteInput.value; });

    body.appendChild(el('div.stage-when', null, [
      el('label.field', null, [
        el('span.field-label', { text: 'از چه تاریخی در این مرحله است' }), dateField
      ]),
      el('label.field.wide', null, [
        el('span.field-label', { text: 'علت (اختیاری)' }), noteInput
      ])
    ]));

    var summary = el('div.stage-summary');
    body.appendChild(summary);

    function sync() {
      Object.keys(buttons).forEach(function (k) {
        buttons[k].classList.toggle('on', k === state.key);
      });
      w.U.clear(summary);
      var st = WL.stageByKey(state.key);
      if (!st) return;
      var days = state.date ? J.diffDays(J.today(), state.date) : null;
      summary.appendChild(el('span', {
        text: 'اقدام بعدی می‌شود: «' + (WL.MANUAL_LABEL[st.key] || st.label) + '»' +
          (days != null && days >= 0 ? ' — ' + fa(days) + ' روز است در این مرحله.' : '.')
      }));
      if (state.key === autoKey) {
        summary.appendChild(el('span.muted.tiny', {
          text: ' همین مرحله‌ای است که خودِ برنامه حساب کرده بود.'
        }));
      }
    }
    sync();

    var m;
    var foot = [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      })
    ];
    if (rec.stageOverride) {
      foot.push(el('button.btn.ghost', {
        type: 'button', text: 'برگشت به حالت خودکار',
        title: 'دوباره از روی تاریخ‌های خود پرونده حساب شود',
        onclick: function () { clear(app, rec, onDone, m); }
      }));
    }
    foot.push(el('button.btn.primary', {
      type: 'button', text: 'ثبت مرحله',
      onclick: function () {
        var st = WL.stageByKey(state.key);
        M.applyPatches([{
          id: rec.id,
          patch: {
            stageOverride: state.key,
            stageOverrideDate: state.date,
            stageOverrideNote: state.note.trim()
          }
        }], {
          kind: 'stage',
          note: 'مرحله دستی روی «' + (st ? st.label : state.key) + '» تنظیم شد' +
            (state.note.trim() ? ' — ' + state.note.trim() : '')
        }).then(function () {
          m.close();
          w.U.toast('مرحلهٔ پرونده روی «' + (st ? st.label : '') + '» تنظیم شد.', 'good');
          if (onDone) onDone();
        }).catch(function (e) {
          w.U.toast('ثبت مرحله ناموفق بود: ' + e.message, 'bad');
        });
      }
    }));

    m = w.U.modal('تنظیم دستی مرحلهٔ پرونده', body, foot);
    m.root.classList.add('stage-modal');
    return m;
  }

  /** برگرداندن به محاسبهٔ خودکار */
  function clear(app, rec, onDone, modal) {
    return M.applyPatches([{
      id: rec.id,
      patch: { stageOverride: '', stageOverrideDate: '', stageOverrideNote: '' }
    }], { kind: 'stage', note: 'مرحله به حالت خودکار برگشت' })
      .then(function () {
        if (modal) modal.close();
        w.U.toast('مرحله دوباره از روی تاریخ‌های پرونده حساب می‌شود.', 'good');
        if (onDone) onDone();
      }).catch(function (e) {
        w.U.toast('برگرداندن ناموفق بود: ' + e.message, 'bad');
      });
  }

  w.UIStage = { dialog: dialog, clear: clear };
})(window);

/* یادداشت و پیگیری — پنل داخل صفحهٔ پرونده */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, N = w.Notes;

  function fa(n) { return w.U.toFaDigits(n); }

  /** «۳ روز گذشته» / «فردا» / «۵ روز دیگر» */
  function relativeDay(date) {
    var days = J.diffDays(J.today(), date);
    if (days == null) return '';
    if (days === 0) return 'امروز';
    if (days === 1) return 'دیروز';
    if (days === -1) return 'فردا';
    return days > 0
      ? fa(days) + ' روز گذشته'
      : fa(-days) + ' روز دیگر';
  }

  function noteRow(app, note, refresh) {
    var overdue = note.followUp && !note.done &&
      J.diffDays(J.today(), note.followUp) > 0;

    var chip = null;
    if (note.followUp) {
      chip = el('span.note-due' + (note.done ? '.done' : (overdue ? '.late' : '')), {
        text: (note.done ? '✓ انجام شد — ' : 'پیگیری ') +
          J.format(note.followUp) +
          (note.done ? '' : ' • ' + relativeDay(note.followUp))
      });
    }

    var actions = el('div.note-actions');
    if (note.followUp && !note.done) {
      actions.appendChild(el('button.btn.small', {
        type: 'button', text: 'انجام شد',
        onclick: function () {
          N.complete(note).then(refresh).catch(function (e) {
            w.U.toast(e.message, 'bad');
          });
        }
      }));
    } else if (note.done) {
      actions.appendChild(el('button.btn.small.ghost', {
        type: 'button', text: 'باز کردن دوباره',
        onclick: function () { N.reopen(note).then(refresh); }
      }));
    }
    actions.appendChild(el('button.btn.small.ghost.danger', {
      type: 'button', text: 'حذف',
      onclick: function () {
        w.U.confirmBox('حذف یادداشت',
          'این یادداشت پاک شود؟ حذفش در تاریخچهٔ پرونده ثبت می‌شود.',
          'حذف کن').then(function (ok) {
            if (ok) N.remove(note).then(refresh);
          });
      }
    }));

    return el('li.note' + (note.done ? '.is-done' : '') + (overdue ? '.is-late' : ''), null, [
      el('div.note-body', null, [
        el('p.note-text', { text: note.text }),
        el('div.note-meta', null, [
          chip,
          el('span.note-stamp', { text: note.atJalali + ' • ' + (note.user || 'کاربر') })
        ])
      ]),
      actions
    ]);
  }

  /** پنل یادداشت‌های یک پرونده */
  function render(app, rec, refresh) {
    var panel = el('div.note-panel');

    if (!rec) {
      panel.appendChild(el('p.muted', {
        text: 'برای افزودن یادداشت، اول پرونده را ذخیره کنید.'
      }));
      return panel;
    }

    // --- فرم افزودن ---
    var text = el('textarea.input.area.note-input', {
      rows: 3,
      placeholder: 'چه شد؟ مثلاً: با واحد سازمانی تماس گرفته شد، پاسخ استعلام تا هفتهٔ آینده می‌رسد.'
    });
    var followUp = '';
    var dateField = w.DatePicker.field('', function (v) { followUp = v; });

    var save = el('button.btn.primary', {
      type: 'button', text: 'ثبت یادداشت',
      onclick: function () {
        if (!text.value.trim()) { text.focus(); return; }
        save.disabled = true;
        N.add(rec, text.value, followUp).then(function () {
          w.U.toast(followUp
            ? 'یادداشت ثبت شد؛ پیگیری برای ' + J.format(followUp) + ' گذاشته شد.'
            : 'یادداشت ثبت شد.', 'good');
          refresh();
        }).catch(function (e) {
          save.disabled = false;
          w.U.toast(e.message, 'bad');
        });
      }
    });

    // میان‌برهای تاریخ پیگیری — کار روزمره معمولاً همین چند فاصله است
    function quick(label, days) {
      return el('button.btn.small.ghost', {
        type: 'button', text: label,
        onclick: function () {
          var d = w.Report.addDays(J.today(), days);
          followUp = d;
          dateField.setValue(d);
        }
      });
    }

    panel.appendChild(el('div.note-form', null, [
      text,
      el('div.note-form-row', null, [
        el('span.field-label', { text: 'پیگیری در تاریخ' }),
        dateField,
        quick('۳ روز', 3), quick('یک هفته', 7), quick('دو هفته', 14), quick('یک ماه', 30),
        el('div.spacer'),
        save
      ])
    ]));

    // --- فهرست ---
    var list = N.forCase(rec.id);
    if (!list.length) {
      panel.appendChild(el('p.muted.tiny', {
        text: 'یادداشتی ثبت نشده است. هرچه از تاریخ‌ها درنمی‌آید — تماس‌ها، ' +
          'توافق‌ها، قرارهای پیگیری — جایش همین‌جاست.'
      }));
      return panel;
    }

    var open = list.filter(function (n) { return !n.done; });
    var done = list.filter(function (n) { return n.done; });

    panel.appendChild(el('ul.note-list', null, open.map(function (n) {
      return noteRow(app, n, refresh);
    })));

    if (done.length) {
      var box = el('details.note-done-box', null, [
        el('summary', { text: fa(done.length) + ' یادداشت بسته‌شده' })
      ]);
      box.appendChild(el('ul.note-list', null, done.map(function (n) {
        return noteRow(app, n, refresh);
      })));
      panel.appendChild(box);
    }
    return panel;
  }

  w.UINotes = { render: render, relativeDay: relativeDay };
})(window);

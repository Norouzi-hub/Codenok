/*
 * تب «کارها و یادداشت‌ها» — پنل داخل صفحهٔ پرونده.
 *
 * دو جنس چیز در یک تب می‌نشیند، چون در ذهن کاربر هم یکی است: «چه خبر
 * است و چه باید بکنم». بالا چک‌لیستِ کارها (تیک می‌خورد)، پایین دفترِ
 * یادداشت‌ها (ثبت واقعه). ترتیب عمدی است: اول کاری که مانده، بعد
 * چیزی که گذشته.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, N = w.Notes;

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

  /*
   * خلاصهٔ پرونده.
   *
   * پرونده سی‌ونه فیلد دارد و هیچ‌کدام در یک نگاه نمی‌گوید «قصه چیست».
   * این چند خط را خودِ کارشناس می‌نویسد و وقتی بعد از دو ماه پرونده را
   * باز می‌کند، همین اول صفحه می‌خواندش. جایش بالای «کارها و یادداشت‌ها»
   * است چون این تب، تبِ «چه خبر است» است.
   *
   * ویرایش درجاست: یک دکمه، همان کادر، ذخیره. فیلدِ واقعیِ پرونده است، پس
   * در تاریخچه، خروجی اکسل و جستجو هم می‌آید.
   */
  function summaryBlock(rec, refresh) {
    var box = el('section.note-summary');
    var text = (rec.caseSummary || '').trim();

    function view() {
      w.U.clear(box);
      box.classList.remove('editing');
      box.appendChild(el('div.note-summary-head', null, [
        el('h3', { text: 'خلاصهٔ پرونده' }),
        el('div.spacer'),
        el('button.btn.small.ghost', {
          type: 'button', text: text ? 'ویرایش' : '＋ نوشتن خلاصه',
          onclick: edit
        })
      ]));
      box.appendChild(text
        ? el('p.note-summary-text', { text: text })
        : el('p.note-summary-empty', {
          text: 'خلاصه‌ای نوشته نشده. در دو سه خط بنویسید این پرونده ' +
            'دربارهٔ چیست و کجای کار است؛ دفعهٔ بعد همین را می‌خوانید.'
        }));
    }

    function edit() {
      w.U.clear(box);
      box.classList.add('editing');
      var area = el('textarea.input.area.note-summary-input', {
        rows: 4, value: text,
        placeholder: 'مثلاً: گزارش بازرسی دربارهٔ غیبت غیرموجه ' +
          'مردادماه؛ دفاعیه گرفته شده، منتظر پاسخ حراست.'
      });
      var save = el('button.btn.small.primary', {
        type: 'button', text: 'ذخیرهٔ خلاصه',
        onclick: function () {
          var v = area.value.trim();
          if (v === text) { view(); return; }
          save.disabled = true;
          M.applyPatches([{ id: rec.id, patch: { caseSummary: v } }], {
            kind: 'update', note: v ? 'خلاصهٔ پرونده به‌روز شد' : 'خلاصهٔ پرونده پاک شد'
          }).then(function () {
            text = v;
            w.U.toast('خلاصهٔ پرونده ذخیره شد.', 'good');
            refresh();
          }).catch(function (e) {
            save.disabled = false;
            w.U.toast(e.message, 'bad');
          });
        }
      });
      box.appendChild(el('div.note-summary-head', null, [
        el('h3', { text: 'خلاصهٔ پرونده' }),
        el('div.spacer'),
        el('button.btn.small.ghost', {
          type: 'button', text: 'انصراف', onclick: view
        }),
        save
      ]));
      box.appendChild(area);
      setTimeout(function () { area.focus(); }, 40);
    }

    view();
    return box;
  }

  function noteRow(app, note, refresh) {
    var overdue = note.followUp && !note.done &&
      J.diffDays(J.today(), note.followUp) > 0;

    var chip = null;
    if (note.followUp) {
      chip = w.U.dots([
        (note.done ? '✓ انجام شد — ' : 'پیگیری ') + J.format(note.followUp),
        note.done ? '' : relativeDay(note.followUp)
      ], '.note-due' + (note.done ? '.done' : (overdue ? '.late' : '')));
    }

    var actions = el('div.note-actions');
    /*
     * ویرایش یادداشت.
     * تا امروز یادداشتِ نوشته‌شده فقط خواندنی بود و غلط تایپی یعنی
     * حذف و نوشتن دوباره — که تاریخچه را هم شلوغ می‌کرد. متن و تاریخ
     * پیگیری همان‌جا، درجا، ویرایش می‌شوند.
     */
    actions.appendChild(el('button.btn.small.ghost', {
      type: 'button', text: 'ویرایش',
      onclick: function () { editNote(note, refresh); }
    }));
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
        el('p.note-text', { text: N.textOf(note) }),
        el('div.note-meta', null, [
          chip,
          el('span.note-stamp', { text: note.atJalali + ' • ' + (note.user || 'کاربر') })
        ])
      ]),
      actions
    ]);
  }

  /** پنجرهٔ ویرایش یک یادداشت — متن و تاریخ پیگیری */
  function editNote(note, refresh) {
    var text = el('textarea.input.area', { rows: 4, value: note.text || '' });
    var due = note.followUp || '';
    var dateField = w.DatePicker.field(due, function (v) { due = v; });
    var m;
    var save = el('button.btn.primary', {
      type: 'button', text: 'ذخیره',
      onclick: function () {
        var v = text.value.trim();
        if (!v) { w.U.toast('متن یادداشت خالی است.', 'warn'); text.focus(); return; }
        save.disabled = true;
        N.update(note, { text: v, followUp: due }).then(function () {
          m.close();
          w.U.toast('یادداشت ویرایش شد.', 'good');
          refresh();
        }).catch(function (e) {
          save.disabled = false;
          w.U.toast(e.message, 'bad');
        });
      }
    });
    m = w.U.modal('ویرایش یادداشت', el('div.note-edit', null, [
      text,
      el('div.note-form-row', null, [
        el('span.field-label', { text: 'پیگیری در تاریخ' }),
        dateField,
        el('button.btn.small.ghost', {
          type: 'button', text: 'بدون پیگیری',
          onclick: function () { due = ''; dateField.setValue(''); }
        })
      ]),
      el('p.muted.tiny', {
        text: 'زمانِ ثبت اولیه و نویسنده‌اش دست نمی‌خورد؛ فقط متن و سررسید.'
      })
    ]), [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      save
    ]);
    m.root.classList.add('small-modal');
    setTimeout(function () { text.focus(); }, 50);
  }

  /** پنل یادداشت‌های یک پرونده */
  function render(app, rec, refresh) {
    var panel = el('div.note-panel');

    /* رکورد را تازه بخوان.
       صفحهٔ پرونده یک بار باز می‌شود و همان شیء را نگه می‌دارد، ولی هر
       نوشتنی روی پرونده — از جمله ذخیرهٔ همین خلاصه — نسخهٔ تازه‌ای در
       مدل می‌نشاند. بدون این، خلاصه ذخیره می‌شد و بلافاصله خالی نشان
       داده می‌شد؛ تا وقتی پرونده را نمی‌بستید و باز نمی‌کردید. */
    if (rec) rec = M.get(rec.id) || rec;

    if (!rec) {
      panel.appendChild(el('p.muted', {
        text: 'برای افزودن یادداشت، اول پرونده را ذخیره کنید.'
      }));
      return panel;
    }

    // خلاصهٔ پرونده، بالاتر از همه: اول «قصه چیست»، بعد «چه باید کرد»
    panel.appendChild(summaryBlock(rec, refresh));

    /* چک‌لیست کارهای همین پرونده — بعد از خلاصه، چون کارِ نکرده مهم‌تر از
       یادداشتِ نوشته‌شده است. */
    panel.appendChild(el('div.note-part', null, [
      el('h3.note-part-head', { text: 'کارهای این پرونده' }),
      w.UITasks.casePanel(app, rec, refresh)
    ]));

    panel.appendChild(el('h3.note-part-head', { text: 'یادداشت‌ها' }));

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

    /* بارگذاری سند از همین‌جا می‌ماند، ولی نمایش سندها نه.
       تا امروز چهار سندِ آخر همین‌جا هم تکرار می‌شدند و کاربر درست گفت که
       جایشان اینجا نیست: مدارک و تصاویر یک خانه دارند — تب «مستندات» — و
       دو جا نشان دادنشان یعنی دو جا دنبالشان گشتن. آنچه ماند فقط یک راهِ
       میان‌بر است: خیلی وقت‌ها یادداشت و سند با هم می‌آیند («نامه‌اش
       رسید» + خود نامه) و رفتن به تب دیگر یعنی نصفه رها کردن کار. سند،
       مثل همیشه، در تب مستندات می‌نشیند. */
    panel.appendChild(el('div.note-attach', null, [
      el('button.btn.small.ghost.note-attach-btn', {
        type: 'button',
        title: 'همان پنجرهٔ افزودن سند تب مستندات',
        onclick: function () { w.UIDocs.addFrom(rec, refresh); }
      }, [
        el('span.note-attach-icon', { html: w.Mobile.icon('paperclip') }),
        el('span', { text: 'بارگذاری سند برای این پرونده' })
      ]),
      el('span.muted.tiny', {
        text: 'عکس، PDF، ورد، اکسل یا زیپ — در تب «مستندات» همین پرونده می‌نشیند.'
      })
    ]));

    // --- فهرست یادداشت‌ها (کارها بالا، در چک‌لیست خودشان) ---
    var list = N.forCase(rec.id).filter(function (n) { return n.kind !== 'task'; });
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

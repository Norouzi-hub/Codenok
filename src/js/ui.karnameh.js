/*
 * نمای کارنامه — گزارش هفتگی و ماهانهٔ «چه کردم».
 *
 * مخاطبش دو نفر است و هر دو مهم‌اند: خودِ کارشناس که می‌خواهد ببیند
 * هفته چطور گذشت، و مدیری که باید در یک صفحه بفهمد. پس خروجی چاپ و
 * ورد از روز اول هست — گزارشی که باید دستی در ورد بازنویسی شود، همان
 * گزارشی است که نوشته نمی‌شود.
 *
 * ترتیب بندها عمدی است و از گزارش‌نویسی اداری آمده، نه از ساختار داده:
 * اول یک جمله، بعد عددهای درشت، بعد «چه کاری انجام شد» (نامه، جلسه،
 * رأی، ابلاغ)، بعد اسناد و کارها، بعد پرونده‌ها، و آخر — که مدیر بیشتر
 * از همه نگاهش می‌کند — «چه ماند».
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, K = w.Karnameh;

  function fa(n) { return w.U.toFaDigits(n); }

  function state(app) {
    if (!app.state.karnameh) {
      app.state.karnameh = { range: 'week', custom: { from: '', to: '' }, user: '' };
    }
    return app.state.karnameh;
  }

  function current(app) {
    var s = state(app);
    var r = K.range(s.range, s.custom);
    return K.build(r.from, r.to, { user: s.user });
  }

  // ------------------------------------------------------------- سربرگ
  function rangeBar(app, data) {
    var s = state(app);
    var bar = el('div.krn-range');

    K.RANGES.forEach(function (r) {
      bar.appendChild(el('button.chip-btn' + (s.range === r.key ? '.on' : ''), {
        type: 'button', text: r.label,
        onclick: function () { s.range = r.key; app.render(); }
      }));
    });

    if (s.range === 'custom') {
      bar.appendChild(el('span.arc-sep'));
      bar.appendChild(el('span.muted.tiny', { text: 'از' }));
      bar.appendChild(w.DatePicker.field(data.from, function (v) {
        s.custom.from = v;
        app.render();
      }));
      bar.appendChild(el('span.muted.tiny', { text: 'تا' }));
      bar.appendChild(w.DatePicker.field(data.to, function (v) {
        s.custom.to = v;
        app.render();
      }));
    }

    /* فیلتر «چه کسی» فقط وقتی معنا دارد که چند نفر با برنامه کار کرده
       باشند؛ وگرنه یک select با یک گزینه، فقط جا می‌گیرد. */
    var users = {};
    (M.state.history || []).forEach(function (h) { if (h.user) users[h.user] = 1; });
    var names = Object.keys(users);
    if (names.length > 1) {
      bar.appendChild(el('span.arc-sep'));
      var sel = el('select.input.small');
      sel.appendChild(el('option', { value: '', text: 'همهٔ کاربران' }));
      names.forEach(function (n) {
        sel.appendChild(el('option', { value: n, text: n }));
      });
      sel.value = s.user;
      sel.addEventListener('change', function () { s.user = sel.value; app.render(); });
      bar.appendChild(sel);
    }

    return bar;
  }

  function tally(items) {
    var row = el('div.wl-tally');
    items.filter(Boolean).forEach(function (t, i) {
      var num = el('span.tally-n');
      var node = el('div.tally' + (t.tone ? '.t-' + t.tone : '') +
        (t.value ? '' : '.is-zero'), { style: '--i:' + i, title: t.hint || '' },
      [num, el('span.tally-label', { text: t.label })]);
      w.U.countUp(num, t.value);
      row.appendChild(node);
    });
    return row;
  }

  function listBlock(title, sub, rows, empty) {
    if (!rows.length) {
      return el('section.krn-block', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: title }),
          sub ? el('p.wl-sub', { text: sub }) : null
        ]),
        el('p.muted.tiny', { text: empty })
      ]);
    }
    return el('section.krn-block', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: title }),
        el('span.wl-count', { text: fa(rows.length) + ' مورد' }),
        sub ? el('p.wl-sub', { text: sub }) : null
      ]),
      el('ul.krn-list', null, rows)
    ]);
  }

  /** سطر «عنوان … عدد» با نوار سهم — خواندنی‌تر از جدول برای ده سطر */
  function barRow(label, n, max, onclick) {
    var pct = max ? Math.round((n / max) * 100) : 0;
    return el(onclick ? 'li.krn-bar.clickable' : 'li.krn-bar', {
      onclick: onclick || null,
      title: onclick ? 'دیدن فهرست این پرونده‌ها' : ''
    }, [
      el('span.krn-bar-label', { text: label }),
      el('span.krn-bar-track', null, [
        el('span.krn-bar-fill', { style: 'width:' + pct + '%' })
      ]),
      el('b.krn-bar-n', { text: fa(n) })
    ]);
  }

  // -------------------------------------------------------------- صفحه
  function render(app, mount) {
    var data = current(app);
    var t = data.totals;
    var maxStep = data.steps.length ? data.steps[0].n : 0;

    var head = el('div.krn-plate', null, [
      el('div.wl-eyebrow', null, [
        el('span.wl-eyebrow-tag', { text: 'کارنامه' }),
        el('span.wl-eyebrow-date', { text: K.label(data) }),
        el('div.spacer'),
        el('button.btn.small.ghost', {
          type: 'button', text: 'چاپ',
          onclick: function () { w.UIPrint.printKarnameh(data); }
        }),
        el('button.btn.small.primary', {
          type: 'button', text: 'خروجی ورد',
          onclick: function () { wordOut(data); }
        })
      ]),
      el('h1.wl-hero-line', null, [
        el('span.wl-hero-text', { text: K.headline(data) })
      ]),
      rangeBar(app, data),
      tally([
        { value: t.letters, label: 'نامهٔ صادره',
          hint: 'نامه‌هایی که تاریخشان در این بازه ثبت شده' },
        { value: t.sessions, label: 'طرح در کمیته' },
        { value: t.verdicts, label: 'رأی صادره' },
        { value: t.docs, label: 'سند بایگانی‌شده',
          hint: t.batches ? 'در ' + fa(t.batches) + ' نوبت' : '' },
        { value: t.tasksDone, label: 'کار انجام‌شده', tone: 'done' },
        { value: t.created, label: 'پروندهٔ وارده' },
        { value: t.closed, label: 'پروندهٔ مختومه', tone: 'done' }
      ])
    ]);

    var sections = [];

    // ------------------------------------------------ گام‌های پرونده
    sections.push(el('section.krn-block', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: 'اقدام‌های انجام‌شده' }),
        el('p.wl-sub', {
          text: 'بر پایهٔ تاریخ‌هایی که در خودِ پرونده‌ها ثبت شده — نه ' +
            'شمارشِ جداگانه‌ای که باید دستی نگه داشته شود.'
        })
      ]),
      data.steps.length
        ? el('ul.krn-bars', null, data.steps.map(function (st) {
          return barRow(st.label, st.n, maxStep, function () {
            app.showCases(st.ids, st.label + ' — ' + K.label(data));
          });
        }))
        : el('p.muted.tiny', { text: 'در این بازه گامی روی پرونده‌ها ثبت نشده است.' })
    ]));

    // --------------------------------------------------- اسناد و دسته‌ها
    if (t.docs) {
      sections.push(el('section.krn-block', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'اسناد بایگانی‌شده' }),
          el('span.wl-count', { text: fa(t.docs) + ' سند در ' + fa(t.batches || 0) + ' نوبت' })
        ]),
        el('ul.krn-bars', null, data.docs.byKind.slice(0, 8).map(function (d) {
          return barRow(d.label, d.n, data.docs.byKind[0].n, null);
        })),
        data.docs.batches.length
          ? el('ul.krn-list', null, data.docs.batches.map(function (b) {
            return el('li.krn-row', null, [
              el('b', { text: b.name }),
              /* تکه‌تکه، نه یک رشته با «•» — دو عددِ فارسی با نویسهٔ خنثیِ
                 بینشان در چیدمان راست‌به‌چپ به هم می‌چسبند. */
              el('span.arc-batch-meta', null, [
                el('span', { text: J.format(b.date) }),
                el('span', { text: fa(b.docs.length) + ' سند' }),
                b.caseCount ? el('span', { text: fa(b.caseCount) + ' پرونده' }) : null
              ]),
              el('div.spacer'),
              el('button.linkish.tiny', {
                type: 'button', text: 'در بایگانی ←',
                onclick: function () {
                  app.state.archive = {
                    q: '', tags: [], batchId: b.id, scope: '', kind: ''
                  };
                  app.goArchive();
                }
              })
            ]);
          }))
          : null
      ]));
    }

    // ------------------------------------------------------------ کارها
    if (t.tasksDone || t.tasksCancelled) {
      sections.push(el('section.krn-block', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'کارهای انجام‌شده' }),
          el('span.wl-count', { text: fa(t.tasksDone) + ' کار' }),
          t.tasksCancelled ? el('span.wl-count', {
            text: fa(t.tasksCancelled) + ' لغوشده'
          }) : null
        ]),
        data.tasks.byCat.length
          ? el('ul.krn-bars', null, data.tasks.byCat.map(function (c) {
            return barRow(c.label, c.n, data.tasks.byCat[0].n, null);
          }))
          : null,
        el('ul.krn-list', null, data.tasks.done.slice(0, 30).map(function (task) {
          var rec = task.caseId ? M.get(task.caseId) : null;
          return el('li.krn-row', null, [
            el('span.krn-tick', { text: '✓' }),
            el('span', { text: task.title || '' }),
            rec ? el('button.linkish.tiny', {
              type: 'button',
              text: w.U.toLatinDigits(rec.caseNo || ''),
              onclick: function () { app.openCase(rec.id); }
            }) : null,
            el('div.spacer'),
            el('span.muted.tiny', { text: J.format(task.doneAt) })
          ]);
        }))
      ]));
    }

    // -------------------------------------------------------- پرونده‌ها
    sections.push(listBlock('پرونده‌های وارده',
      'پرونده‌هایی که تاریخ ورودشان در این بازه است.',
      data.cases.created.slice(0, 40).map(function (rec) {
        return caseRow(app, rec, rec.intakeDate);
      }), 'در این بازه پروندهٔ تازه‌ای وارد نشده است.'));

    sections.push(listBlock('پرونده‌های مختومه',
      'بر پایهٔ تاریخ بایگانی، یا در نبودش ابلاغ و رأی.',
      data.cases.closed.slice(0, 40).map(function (rec) {
        return caseRow(app, rec, K.closedOn(rec));
      }), 'در این بازه پرونده‌ای مختومه نشده است.'));

    if (data.cases.touched.length) {
      sections.push(el('section.krn-block', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'پرونده‌هایی که روی آنها کار شد' }),
          el('span.wl-count', { text: fa(data.cases.touched.length) + ' پرونده' }),
          el('div.spacer'),
          el('button.btn.small.ghost', {
            type: 'button', text: 'دیدن در فهرست',
            onclick: function () {
              app.showCases(data.cases.touched.map(function (x) { return x.rec.id; }),
                'کارشده در ' + K.label(data));
            }
          })
        ]),
        el('ul.krn-list', null, data.cases.touched.slice(0, 40).map(function (x) {
          return el('li.krn-row', null, [
            w.UIWorklist.caseNumber(x.rec),
            el('span', { text: personOf(x.rec) }),
            el('div.spacer'),
            el('span.muted.tiny', { text: fa(x.n) + ' اقدام' }),
            el('button.linkish.tiny', {
              type: 'button', text: 'باز کن',
              onclick: function () { app.openCase(x.rec.id); }
            })
          ]);
        }))
      ]));
    }

    // ---------------------------------------------------------- چه ماند
    sections.push(el('section.krn-block.krn-rest', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: 'چه ماند' }),
        el('p.wl-sub', {
          text: 'وضعیتِ امروز، نه این بازه — گزارشی که فقط بگوید چه شد و ' +
            'نگوید چه مانده، نصفِ گزارش است.'
        })
      ]),
      tally([
        { value: data.rest.open, label: 'پروندهٔ در جریان' },
        { value: data.rest.overdue, label: 'از مهلت گذشته',
          tone: data.rest.overdue ? 'late' : '' },
        { value: data.rest.openTasks, label: 'کار باز' }
      ])
    ]));

    var box = el('div.krn-view', null, [head].concat(sections));
    w.U.clear(mount);
    mount.appendChild(box);
  }

  function personOf(rec) {
    return [rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام';
  }

  function caseRow(app, rec, date) {
    return el('li.krn-row', null, [
      w.UIWorklist.caseNumber(rec),
      el('span', { text: personOf(rec) }),
      el('span.muted.tiny', { text: rec.orgUnit || '' }),
      el('div.spacer'),
      el('span.muted.tiny', { text: date ? J.format(date) : '' }),
      el('button.linkish.tiny', {
        type: 'button', text: 'باز کن',
        onclick: function () { app.openCase(rec.id); }
      })
    ]);
  }

  // --------------------------------------------------------- خروجی ورد
  /*
   * گزارشی که باید دستی در ورد بازنویسی شود، همان گزارشی است که نوشته
   * نمی‌شود. پس خروجی ورد از روز اول هست و همان چیدمانِ صفحه را دارد.
   */
  function wordOut(data) {
    var D = w.Docx;
    var t = data.totals;
    var body = [];

    body.push(D.para('کارنامهٔ عملکرد — دبیرخانهٔ کمیتهٔ انضباط کار',
      { bold: true, size: 15, align: 'center', after: 40 }));
    body.push(D.para(K.label(data) + (data.user ? ' — ' + data.user : ''),
      { size: 11, align: 'center' }));
    body.push(D.para(K.headline(data), { size: 11, before: 80 }));
    body.push(D.emptyPara());

    function section(title) {
      body.push(D.para(title, { bold: true, size: 12, before: 120, after: 60 }));
    }
    function twoCol(rows) {
      body.push(D.table(rows.map(function (r) {
        return [
          D.cell(r[0], { size: 10, width: 6000 }),
          D.cell({ text: r[1], bold: true }, { size: 10, width: 3638 })
        ];
      }), 2));
      body.push(D.emptyPara());
    }

    section('خلاصه');
    twoCol([
      ['نامهٔ صادره', fa(t.letters)],
      ['پروندهٔ طرح‌شده در کمیته', fa(t.sessions)],
      ['رأی صادره', fa(t.verdicts)],
      ['سند بایگانی‌شده',
        fa(t.docs) + (t.batches ? ' (در ' + fa(t.batches) + ' نوبت)' : '')],
      ['کار انجام‌شده', fa(t.tasksDone)],
      ['پروندهٔ وارده', fa(t.created)],
      ['پروندهٔ مختومه', fa(t.closed)],
      ['پرونده‌هایی که روی آنها کار شد', fa(t.touched)]
    ]);

    if (data.steps.length) {
      section('اقدام‌های انجام‌شده');
      twoCol(data.steps.map(function (st) { return [st.label, fa(st.n)]; }));
    }

    if (data.docs.batches.length) {
      section('نوبت‌های بارگذاری سند');
      twoCol(data.docs.batches.map(function (b) {
        return [b.name + ' — ' + J.format(b.date), fa(b.docs.length) + ' سند'];
      }));
    }

    if (data.tasks.byCat.length) {
      section('کارها به تفکیک دسته');
      twoCol(data.tasks.byCat.map(function (c) { return [c.label, fa(c.n)]; }));
    }

    if (data.cases.closed.length) {
      section('پرونده‌های مختومه در این بازه');
      body.push(D.table([[
        D.cell({ text: 'شماره', bold: true }, { size: 10, width: 2200 }),
        D.cell({ text: 'نام', bold: true }, { size: 10, width: 4200 }),
        D.cell({ text: 'تاریخ اختتام', bold: true }, { size: 10, width: 3238 })
      ]].concat(data.cases.closed.slice(0, 60).map(function (rec) {
        return [
          D.cell(w.U.toLatinDigits(rec.caseNo || ''), { size: 10, width: 2200 }),
          D.cell(personOf(rec), { size: 10, width: 4200 }),
          D.cell(J.format(K.closedOn(rec)), { size: 10, width: 3238 })
        ];
      })), 3));
      body.push(D.emptyPara());
    }

    if (data.cases.created.length) {
      section('پرونده‌های وارده در این بازه');
      body.push(D.table([[
        D.cell({ text: 'شماره', bold: true }, { size: 10, width: 2200 }),
        D.cell({ text: 'نام', bold: true }, { size: 10, width: 4200 }),
        D.cell({ text: 'تاریخ ورود', bold: true }, { size: 10, width: 3238 })
      ]].concat(data.cases.created.slice(0, 60).map(function (rec) {
        return [
          D.cell(w.U.toLatinDigits(rec.caseNo || ''), { size: 10, width: 2200 }),
          D.cell(personOf(rec), { size: 10, width: 4200 }),
          D.cell(J.format(rec.intakeDate), { size: 10, width: 3238 })
        ];
      })), 3));
      body.push(D.emptyPara());
    }

    section('چه ماند');
    twoCol([
      ['پروندهٔ در جریان', fa(data.rest.open)],
      ['از مهلت گذشته', fa(data.rest.overdue)],
      ['کار باز', fa(data.rest.openTasks)]
    ]);

    body.push(D.para('تهیه‌شده در ' + J.stamp(), { size: 9, before: 160 }));

    var blob = D.build(body.join(''), { topMm: 16, sideMm: 16 });
    w.U.download('karnameh-' + w.U.toLatinDigits(data.from) + '-' +
      w.U.toLatinDigits(data.to) + '.docx', blob);
    w.U.toast('کارنامه در قالب ورد ذخیره شد.', 'good');
  }

  w.UIKarnameh = { render: render, current: current, wordOut: wordOut };
})(window);

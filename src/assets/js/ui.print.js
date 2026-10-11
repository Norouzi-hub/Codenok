/* چاپ: برگ پروندهٔ A4 و فهرست پرونده‌ها */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  // عرض مفید یک صفحهٔ A4 با حاشیه‌های تعریف‌شده، به پیکسل CSS
  var PRINT_WIDTH = 680;

  function area() {
    var node = document.getElementById('print-area');
    w.U.clear(node);
    return node;
  }

  function run(titleForTab) {
    var prev = document.title;
    document.title = titleForTab;
    document.body.classList.add('printing');
    var restore = function () {
      document.body.classList.remove('printing');
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1500);
  }

  function header(title, subtitle) {
    return el('div.p-header', null, [
      el('div.p-org', { text: w.Store.metaGet('orgName', '') ||
        M.state.settings.orgName || 'کمیتهٔ انضباطی' }),
      el('h1', { text: title }),
      subtitle ? el('div.p-sub', { text: subtitle }) : null,
      el('div.p-printed', { text: 'تاریخ چاپ: ' + J.stamp() })
    ]);
  }

  /** برگ کامل یک پرونده، گروه‌بندی‌شده، با تاریخچه */
  function printCase(rec) {
    var node = area();
    var name = [rec.firstName, rec.lastName].filter(Boolean).join(' ');
    node.appendChild(header('برگ پروندهٔ ' + w.U.toFaDigits(rec.caseNo || ''), name));

    w.GROUPS.forEach(function (g) {
      var fields = M.FIELDS.filter(function (f) {
        return f.group === g.key && rec[f.key];
      });
      if (!fields.length) return;
      var table = el('table.p-table');
      fields.forEach(function (f) {
        var v = f.type === 'date' ? J.format(rec[f.key]) : rec[f.key];
        table.appendChild(el('tr', null, [
          el('th', { text: w.UIForm.cleanLabel(f.label) }),
          el('td', { text: v })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: g.label }), table
      ]));
    });

    var attached = w.Docs ? w.Docs.current(rec.id) : [];
    if (attached.length) {
      var docTable = el('table.p-table.p-list.p-docs', null, [
        el('tr', null, [
          el('th', { text: 'نوع سند' }), el('th', { text: 'تاریخ' }),
          el('th', { text: 'شمارهٔ نامه' }), el('th', { text: 'نام فایل' })
        ])
      ]);
      attached.forEach(function (d) {
        docTable.appendChild(el('tr', null, [
          el('td', { text: d.kind }),
          el('td', { text: d.docDate ? J.format(d.docDate) : '' }),
          el('td', { text: d.letterNo || '' }),
          el('td', { text: d.fileName })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: 'مستندات پیوست' }),
        el('p.p-sub', {
          text: 'پوشه: ' + (rec.docFolder || '—')
        }),
        docTable
      ]));
    }

    var items = M.timelineFor(rec);
    if (items.length) {
      var list = el('table.p-table.p-history', null, [
        el('tr', null, [
          el('th', { text: 'تاریخ' }), el('th', { text: 'رویداد' }), el('th', { text: 'شرح' })
        ])
      ]);
      items.forEach(function (it) {
        if (it.type === 'milestone') {
          list.appendChild(el('tr', null, [
            el('td', { text: J.format(it.date) }),
            el('td', { text: 'گردش‌کار' }),
            el('td', { text: it.label })
          ]));
        } else {
          var h = it.entry;
          var desc = (h.changes || []).map(function (c) {
            return w.UIForm.cleanLabel(c.label) + ': ' + (c.from || '—') + ' ← ' + (c.to || '—');
          }).join(' | ') || h.note || '';
          list.appendChild(el('tr', null, [
            el('td', { text: h.atJalali }),
            el('td', { text: w.UIForm.kindLabel(h.kind) + ' (' + (h.user || '') + ')' }),
            el('td', { text: desc })
          ]));
        }
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: 'تاریخچهٔ پرونده' }), list
      ]));
    }

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای کارشناس پرونده' }),
      el('div', { text: 'امضای دبیر کمیته' })
    ]));

    run('برگ پرونده ' + (rec.caseNo || ''));
  }

  /** فهرست پرونده‌ها با ستون‌های جاری */
  function printList(rows) {
    var node = area();
    node.appendChild(header('فهرست پرونده‌ها',
      w.U.toFaDigits(rows.length) + ' پرونده'));
    var fields = M.state.columns.map(function (k) { return M.FIELD_BY_KEY[k]; }).filter(Boolean);
    var table = el('table.p-table.p-list');
    var head = el('tr', null, [el('th', { text: 'ردیف' })]);
    fields.forEach(function (f) {
      head.appendChild(el('th', { text: w.UIForm.cleanLabel(f.label) }));
    });
    table.appendChild(head);
    rows.forEach(function (rec, i) {
      var tr = el('tr', null, [el('td', { text: w.U.toFaDigits(i + 1) })]);
      fields.forEach(function (f) {
        tr.appendChild(el('td', { text: w.UIList.cellText(rec, f) }));
      });
      table.appendChild(tr);
    });
    node.appendChild(table);
    run('فهرست پرونده‌ها');
  }

  /** گزارش مدیریتی: سنجه‌ها، یافته‌ها، و هر نمودار به همراه جدولش */
  function printReport(data, scopeText) {
    var node = area();
    node.appendChild(header('گزارش عملکرد کمیتهٔ انضباطی', scopeText));

    var k = data.kpis;
    var kpiTable = el('table.p-table.p-kpi');
    [
      ['کل پرونده‌های این برش', w.U.toFaDigits(k.total)],
      ['در جریان', w.U.toFaDigits(k.open)],
      ['مختومه‌شده', w.U.toFaDigits(k.closed) + ' (' + w.U.toFaDigits(k.closedPct) + '٪)'],
      ['میانهٔ روز از ورود تا طرح در کمیته',
        k.medianToCommittee == null ? '—' : w.U.toFaDigits(k.medianToCommittee) + ' روز'],
      ['میانگین روز تا طرح در کمیته',
        k.meanToCommittee == null ? '—' : w.U.toFaDigits(k.meanToCommittee) + ' روز'],
      ['قدیمی‌ترین پروندهٔ باز',
        k.oldestOpen ? w.U.toFaDigits(k.oldestOpen) + ' روز' : '—']
    ].forEach(function (r) {
      kpiTable.appendChild(el('tr', null, [
        el('th', { text: r[0] }), el('td', { text: r[1] })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'سنجه‌های کلیدی' }), kpiTable
    ]));

    // یافته‌ها — شدت همیشه با برچسب متنی می‌آید، نه فقط رنگ
    var fTable = el('table.p-table.p-list', null, [
      el('tr', null, [
        el('th', { text: 'شدت' }), el('th', { text: 'یافته' }),
        el('th', { text: 'تعداد' }), el('th', { text: 'پیشنهاد' })
      ])
    ]);
    data.findings.forEach(function (f) {
      var sev = (w.UIReport.SEV[f.severity] || {}).label || '';
      fTable.appendChild(el('tr', null, [
        el('td', { text: sev }),
        el('td', { text: f.title }),
        el('td', { text: f.count ? w.U.toFaDigits(f.count) : '—' }),
        el('td', { text: f.advice })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'یافته‌ها و پیشنهادها' }), fTable
    ]));

    // نمودارها: تصویر SVG از صفحه کپی می‌شود و جدول همزادش زیرش می‌آید
    var cards = w.U.$$('#main .chart-card:not(.findings)');
    cards.forEach(function (cardNode) {
      var title = (cardNode.querySelector('h3') || {}).textContent || '';
      var section = el('section.p-section', null, [el('h2', { text: title })]);
      var svg = cardNode.querySelector('svg.chart');
      if (svg) {
        // راهنما هم کپی می‌شود؛ روی کاغذ هویت سری نباید فقط با رنگ بماند
        var lg = cardNode.querySelector('.c-legend');
        if (lg) section.appendChild(lg.cloneNode(true));
        // viewBox روی صفحه به عرض کارت بسته است؛ برای کاغذ با عرض A4
        // دوباره رسم و سپس به حالت قبل برگردانده می‌شود، وگرنه چند برابر
        // بزرگ چاپ می‌شود.
        var onScreenWidth = svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0;
        if (svg.draw) svg.draw(PRINT_WIDTH);
        var clone = svg.cloneNode(true);
        if (svg.draw && onScreenWidth > 0) svg.draw(onScreenWidth);
        clone.removeAttribute('style');
        clone.setAttribute('width', '100%');
        section.appendChild(el('div.p-chart', null, [clone]));
      }
      var tbl = cardNode.querySelector('.c-table');
      if (!tbl && cardNode.repaint) {
        // کارت در حالت نمودار است؛ جدولش را موقتاً می‌سازیم
        var probe = cardNode.querySelector('.card-head .btn');
        if (probe) {
          probe.click();
          tbl = cardNode.querySelector('.c-table');
          if (tbl) tbl = tbl.cloneNode(true);
          probe.click();
        }
      } else if (tbl) {
        tbl = tbl.cloneNode(true);
      }
      if (tbl) {
        tbl.classList.add('p-table', 'p-list');
        section.appendChild(tbl);
      }
      node.appendChild(section);
    });

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای دبیر کمیته' }),
      el('div', { text: 'امضای رئیس کمیته' })
    ]));

    run('گزارش عملکرد کمیتهٔ انضباطی');
  }

  /** پروندهٔ یکپارچهٔ یک شخص: همهٔ پرونده‌ها، مدارک و گردش‌کار */
  function printPerson(person) {
    var node = area();
    node.appendChild(header('پروندهٔ شخص — ' + person.name,
      person.nationalId ? 'کد ملی ' + w.U.toFaDigits(person.nationalId) : ''));

    var info = el('table.p-table');
    [
      ['تعداد پرونده', w.U.toFaDigits(person.caseCount)],
      ['در جریان', w.U.toFaDigits(person.openCount)],
      ['مختومه', w.U.toFaDigits(person.closedCount)],
      ['کد پرسنلی', person.personnelCode ? w.U.toFaDigits(person.personnelCode) : '—'],
      ['نام پدر', person.fatherName || '—'],
      ['واحد سازمانی', person.profile.orgUnit || '—'],
      ['نام شغل', person.profile.jobTitle || '—'],
      ['نوع قرارداد', person.profile.contractType || '—']
    ].forEach(function (r) {
      info.appendChild(el('tr', null, [
        el('th', { text: r[0] }), el('td', { text: r[1] })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'مشخصات فرد' }), info
    ]));

    if (person.conflicts.length) {
      var cTable = el('table.p-table.p-list', null, [
        el('tr', null, [el('th', { text: 'فیلد' }), el('th', { text: 'مقادیر ناسازگار' })])
      ]);
      person.conflicts.forEach(function (c) {
        cTable.appendChild(el('tr', null, [
          el('td', { text: c.label }),
          el('td', {
            text: c.values.map(function (v) {
              return v.value + ' (پروندهٔ ' +
                v.caseNos.map(function (n) { return w.U.toFaDigits(n); }).join('، ') + ')';
            }).join(' — ')
          })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: 'ناسازگاری مشخصات هویتی' }), cTable
      ]));
    }

    var cases = el('table.p-table.p-list', null, [
      el('tr', null, ['شماره پرونده', 'وضعیت', 'نوع', 'تاریخ ورود',
        'طرح در کمیته', 'کارشناس'].map(function (h) { return el('th', { text: h }); }))
    ]);
    person.cases.forEach(function (rec) {
      cases.appendChild(el('tr', null, [
        el('td', { text: w.U.toFaDigits(rec.caseNo || '—') }),
        el('td', { text: rec.status || '—' }),
        el('td', { text: rec.caseType || '—' }),
        el('td', { text: rec.intakeDate ? J.format(rec.intakeDate) : '—' }),
        el('td', { text: rec.committeeDate ? J.format(rec.committeeDate) : '—' }),
        el('td', { text: rec.expert || '—' })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'پرونده‌های این فرد' }), cases
    ]));

    var shared = w.Docs ? w.Docs.currentForPerson(person.key) : [];
    if (shared.length) {
      var dTable = el('table.p-table.p-list', null, [
        el('tr', null, [el('th', { text: 'نوع مدرک' }), el('th', { text: 'تاریخ' }),
          el('th', { text: 'نام فایل' })])
      ]);
      shared.forEach(function (d) {
        dTable.appendChild(el('tr', null, [
          el('td', { text: d.kind }),
          el('td', { text: d.docDate ? J.format(d.docDate) : '' }),
          el('td', { text: d.fileName })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: 'مدارک شخص' }), dTable
      ]));
    }

    var items = w.Person.timeline(person);
    if (items.length) {
      var tl = el('table.p-table.p-list', null, [
        el('tr', null, [el('th', { text: 'تاریخ' }), el('th', { text: 'پرونده' }),
          el('th', { text: 'رویداد' })])
      ]);
      items.forEach(function (it) {
        var what;
        if (it.type === 'milestone') what = it.label;
        else if (it.type === 'doc') what = it.doc.kind + ' — ' + it.doc.fileName;
        else {
          what = w.UIForm.kindLabel(it.entry.kind) +
            (it.entry.note ? ' — ' + it.entry.note : '');
        }
        tl.appendChild(el('tr', null, [
          el('td', {
            text: it.type === 'history' ? it.entry.atJalali : J.format(it.date)
          }),
          el('td', { text: w.U.toFaDigits(it.caseNo) }),
          el('td', { text: what })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: 'گردش‌کار یکپارچه' }), tl
      ]));
    }

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای کارشناس پرونده' }),
      el('div', { text: 'امضای دبیر کمیته' })
    ]));

    run('پروندهٔ شخص ' + person.name);
  }

  /** دستور کار جلسهٔ کمیته: پرونده‌هایی که آمادهٔ طرح‌اند */
  function printAgenda(cases) {
    var node = area();
    node.appendChild(header('دستور کار جلسهٔ کمیتهٔ انضباطی',
      w.U.toFaDigits(cases.length) + ' پرونده'));

    var table = el('table.p-table.p-list', null, [
      el('tr', null, ['ردیف', 'شماره پرونده', 'نام و نام خانوادگی', 'واحد سازمانی',
        'نوع پرونده', 'تاریخ ورود', 'دفاعیه', 'رأی جلسه'].map(function (h) {
          return el('th', { text: h });
        }))
    ]);
    cases.forEach(function (rec, i) {
      table.appendChild(el('tr', null, [
        el('td', { text: w.U.toFaDigits(i + 1) }),
        el('td', { text: w.U.toFaDigits(rec.caseNo || '—') }),
        el('td', { text: [rec.firstName, rec.lastName].filter(Boolean).join(' ') }),
        el('td', { text: rec.orgUnit || '—' }),
        el('td', { text: rec.caseType || '—' }),
        el('td', { text: rec.intakeDate ? J.format(rec.intakeDate) : '—' }),
        el('td', { text: rec.invitationLetterDate ? J.format(rec.invitationLetterDate) : '—' }),
        el('td', { text: '' })      // جای خالی برای نوشتن رأی در جلسه
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'پرونده‌های آمادهٔ طرح' }), table
    ]));

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای دبیر کمیته' }),
      el('div', { text: 'امضای رئیس کمیته' })
    ]));
    run('دستور کار جلسه');
  }

  /**
   * صورت‌جلسه: همان دستور کار، ولی با نتیجهٔ هر پرونده.
   * این برگه چیزی است که امضا می‌شود و در پرونده می‌ماند.
   */
  function printMinutes(head, rows) {
    var node = area();
    node.appendChild(header('صورت‌جلسهٔ کمیتهٔ انضباطی',
      'جلسهٔ ' + w.U.toFaDigits(head.session || '—') +
      ' — ' + (head.date ? J.format(head.date, { long: true }) : '—')));

    if (head.regNo) {
      node.appendChild(el('div.p-sub', {
        text: 'شمارهٔ ثبت دبیرخانهٔ کمیته: ' + w.U.toFaDigits(head.regNo)
      }));
    }

    var table = el('table.p-table.p-list', null, [
      el('tr', null, ['ردیف', 'شماره پرونده', 'نام و نام خانوادگی', 'واحد سازمانی',
        'نوع پرونده', 'نتیجهٔ جلسه', 'رأی'].map(function (h) {
          return el('th', { text: h });
        }))
    ]);
    rows.forEach(function (r, i) {
      table.appendChild(el('tr', null, [
        el('td', { text: w.U.toFaDigits(i + 1) }),
        el('td', { text: w.U.toFaDigits(r.rec.caseNo || '—') }),
        el('td', { text: [r.rec.firstName, r.rec.lastName].filter(Boolean).join(' ') }),
        el('td', { text: r.rec.orgUnit || '—' }),
        el('td', { text: r.rec.caseType || '—' }),
        el('td', { text: r.outcomeLabel || '—' }),
        // اگر متن رأی وارد نشده، جای خالی می‌ماند تا در جلسه دستی نوشته شود
        el('td', { text: r.verdict || '' })
      ]));
    });
    node.appendChild(el('section.p-section', null, [
      el('h2', { text: 'پرونده‌های مطرح‌شده' }), table
    ]));

    node.appendChild(el('div.p-sign', null, [
      el('div', { text: 'امضای دبیر کمیته' }),
      el('div', { text: 'امضای رئیس کمیته' }),
      el('div', { text: 'امضای اعضا' })
    ]));
    run('صورت‌جلسهٔ کمیته');
  }

  /**
   * کارنامه روی کاغذ.
   * همان چیدمان صفحه، چون گزارشی که روی کاغذ شکل دیگری داشته باشد،
   * موقع ارائه سؤال می‌سازد به‌جای اینکه جواب بدهد.
   */
  function printKarnameh(data) {
    var K = w.Karnameh;
    var node = area();
    var t = data.totals;
    node.appendChild(header('کارنامهٔ عملکرد',
      K.label(data) + (data.user ? ' — ' + data.user : '')));

    node.appendChild(el('p.p-lead', { text: K.headline(data) }));

    function twoCol(title, rows) {
      if (!rows.length) return;
      var tbl = el('table.p-table.p-kpi');
      rows.forEach(function (r) {
        tbl.appendChild(el('tr', null, [
          el('th', { text: r[0] }), el('td', { text: r[1] })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: title }), tbl
      ]));
    }

    twoCol('خلاصه', [
      ['نامهٔ صادره', w.U.toFaDigits(t.letters)],
      ['پروندهٔ طرح‌شده در کمیته', w.U.toFaDigits(t.sessions)],
      ['رأی صادره', w.U.toFaDigits(t.verdicts)],
      ['سند بایگانی‌شده', w.U.toFaDigits(t.docs) +
        (t.batches ? ' (در ' + w.U.toFaDigits(t.batches) + ' نوبت)' : '')],
      ['کار انجام‌شده', w.U.toFaDigits(t.tasksDone)],
      ['پروندهٔ وارده', w.U.toFaDigits(t.created)],
      ['پروندهٔ مختومه', w.U.toFaDigits(t.closed)],
      ['پرونده‌هایی که روی آنها کار شد', w.U.toFaDigits(t.touched)]
    ]);

    twoCol('اقدام‌های انجام‌شده', data.steps.map(function (st) {
      return [st.label, w.U.toFaDigits(st.n)];
    }));

    twoCol('نوبت‌های بارگذاری سند', data.docs.batches.map(function (b) {
      return [b.name + ' — ' + J.format(b.date),
        w.U.toFaDigits(b.docs.length) + ' سند'];
    }));

    twoCol('کارها به تفکیک دسته', data.tasks.byCat.map(function (c) {
      return [c.label, w.U.toFaDigits(c.n)];
    }));

    function caseTable(title, list, dateOf) {
      if (!list.length) return;
      var tbl = el('table.p-table.p-list', null, [
        el('tr', null, [
          el('th', { text: 'شماره' }), el('th', { text: 'نام' }),
          el('th', { text: 'واحد سازمانی' }), el('th', { text: 'تاریخ' })
        ])
      ]);
      list.slice(0, 80).forEach(function (rec) {
        tbl.appendChild(el('tr', null, [
          el('td', { text: w.U.toLatinDigits(rec.caseNo || '') }),
          el('td', { text: [rec.firstName, rec.lastName].filter(Boolean).join(' ') }),
          el('td', { text: rec.orgUnit || '' }),
          el('td', { text: J.format(dateOf(rec)) })
        ]));
      });
      node.appendChild(el('section.p-section', null, [
        el('h2', { text: title }), tbl
      ]));
    }

    caseTable('پرونده‌های مختومه در این بازه', data.cases.closed,
      function (r) { return K.closedOn(r); });
    caseTable('پرونده‌های وارده در این بازه', data.cases.created,
      function (r) { return r.intakeDate; });

    twoCol('چه ماند', [
      ['پروندهٔ در جریان', w.U.toFaDigits(data.rest.open)],
      ['از مهلت گذشته', w.U.toFaDigits(data.rest.overdue)],
      ['کار باز', w.U.toFaDigits(data.rest.openTasks)]
    ]);

    run('کارنامه — ' + K.label(data));
  }

  w.UIPrint = {
    printCase: printCase, printList: printList, printReport: printReport,
    printPerson: printPerson, printAgenda: printAgenda, printMinutes: printMinutes,
    printKarnameh: printKarnameh
  };
})(window);

/* نمای اشخاص: فهرست کارمندان و پروندهٔ یکپارچهٔ هر شخص */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, P = w.Person, D = w.Docs;

  function fa(n) { return w.U.toFaDigits(n); }

  // ------------------------------------------------------------ فهرست اشخاص
  function renderList(app, mount) {
    var q = w.U.normalize(app.state.q || '');
    var tokens = q ? q.split(' ').filter(Boolean) : [];
    var people = P.all().filter(function (p) {
      return tokens.every(function (t) { return p.searchText.indexOf(t) >= 0; });
    });

    var repeaters = people.filter(function (p) { return p.caseCount > 1; });
    var conflicted = people.filter(function (p) { return p.conflicts.length; });

    var summary = el('div.result-bar', null, [
      el('span.result-count', {
        html: '<b>' + fa(people.length) + '</b> نفر' +
          (repeaters.length
            ? ' — <b>' + fa(repeaters.length) + '</b> نفر بیش از یک پرونده دارند' : '')
      }),
      el('div.spacer'),
      conflicted.length ? el('span.pill.st-verdict', {
        text: fa(conflicted.length) + ' مورد ناسازگاری مشخصات'
      }) : null
    ]);

    var rows = el('div.person-grid');
    people.forEach(function (p) {
      rows.appendChild(el('button.person-card' + (p.caseCount > 1 ? '.repeat' : ''), {
        type: 'button',
        onclick: function () { app.openPerson(p.key); }
      }, [
        el('div.person-card-head', null, [
          el('b.person-name', { text: p.name }),
          p.caseCount > 1 ? el('span.badge', { text: fa(p.caseCount) + ' پرونده' }) : null
        ]),
        el('div.person-meta', {
          text: [p.nationalId ? 'کد ملی ' + fa(p.nationalId) : null,
            p.profile.orgUnit || null].filter(Boolean).join(' • ')
        }),
        p.aliases.length > 1 ? el('div.person-meta', {
          text: 'ثبت‌شده با: ' + p.aliases.join(' / ')
        }) : null,
        el('div.person-meta', null, [w.U.dots([
          p.openCount ? fa(p.openCount) + ' در جریان' : 'بدون پروندهٔ باز',
          p.closedCount ? fa(p.closedCount) + ' مختومه' : ''
        ])]),
        p.conflicts.length ? el('div.person-conflict', {
          text: '⚠ ناسازگاری در ' + p.conflicts.map(function (c) { return c.label; }).join('، ')
        }) : null
      ]));
    });

    w.U.clear(mount);
    mount.appendChild(el('div.people-view', null, [
      summary,
      people.length ? rows : el('div.empty-state', null, [
        el('p', { text: 'شخصی پیدا نشد.' })
      ])
    ]));
  }

  // ------------------------------------------------------------- یک شخص
  function conflictBox(app, person) {
    if (!person.conflicts.length) return null;
    return el('div.warn', null, [
      el('div', null, [
        el('b', { text: 'مشخصات هویتی بین پرونده‌ها یکسان نیست. ' }),
        el('span', {
          text: 'با یک کد ملی نباید چند مقدار متفاوت ثبت شده باشد؛ ' +
            'احتمالاً خطای ورود اطلاعات است.'
        }),
        el('ul.conflict-list', null, person.conflicts.map(function (c) {
          return el('li', null, [
            el('b', { text: c.label + ': ' }),
            el('span', {
              text: c.values.map(function (v) {
                return '«' + v.value + '» در پروندهٔ ' +
                  v.caseNos.map(function (n) { return fa(n); }).join('، ');
              }).join(' — ')
            })
          ]);
        }))
      ])
    ]);
  }

  function casesTable(app, person) {
    var table = el('table.c-table.person-cases', null, [
      el('thead', null, [el('tr', null,
        ['شماره پرونده', 'وضعیت', 'نوع', 'تاریخ ورود', 'طرح در کمیته', 'کارشناس', 'مستندات']
          .map(function (h) { return el('th', { text: h }); }))])
    ]);
    var body = el('tbody');
    person.cases.forEach(function (rec) {
      var docCount = D.current(rec.id).length;
      var tr = el('tr.person-case-row', {
        tabindex: '0',
        onclick: function () { app.openCase(rec.id); },
        onkeydown: function (e) {
          if (e.key === 'Enter') { e.preventDefault(); app.openCase(rec.id); }
        }
      }, [
        el('td', null, [el('b', { text: fa(rec.caseNo || '—') })]),
        el('td', null, [el('span.pill.' + (w.UIList.statusClass(rec.status) || 'st-none'),
          { text: rec.status || '—' })]),
        el('td', { text: rec.caseType || '—' }),
        el('td', { text: rec.intakeDate ? J.format(rec.intakeDate) : '—' }),
        el('td', { text: rec.committeeDate ? J.format(rec.committeeDate) : '—' }),
        el('td', { text: rec.expert || '—' }),
        el('td', { text: docCount ? fa(docCount) : '—' })
      ]);
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function profileCard(person) {
    var pairs = [
      ['کد ملی', person.nationalId ? fa(person.nationalId) : '—'],
      ['کد پرسنلی', person.personnelCode ? fa(person.personnelCode) : '—'],
      ['نام پدر', person.fatherName || '—'],
      ['شماره شناسنامه', person.idNumber ? fa(person.idNumber) : '—'],
      ['واحد سازمانی', person.profile.orgUnit || '—'],
      ['محل خدمت', person.profile.servicePlace || '—'],
      ['نام شغل', person.profile.jobTitle || '—'],
      ['ماهیت شغل', person.profile.jobNature || '—'],
      ['نوع قرارداد', person.profile.contractType || '—'],
      ['وضعیت اشتغال', person.profile.employmentStatus || '—']
    ];
    return el('div.person-profile', null, pairs.map(function (p) {
      return el('div.pp-item', null, [
        el('span.pp-label', { text: p[0] }),
        el('span.pp-value', { text: p[1] })
      ]);
    }));
  }

  function sharedDocs(app, person) {
    var shared = D.currentForPerson(person.key);
    var box = el('section.chart-card', null, [
      el('div.card-head', null, [
        el('div', null, [
          el('h3', { text: 'مدارک شخص' }),
          el('p.card-sub', {
            text: 'مدارکی که به خود فرد تعلق دارند و در همهٔ پرونده‌هایش دیده می‌شوند.'
          })
        ])
      ])
    ]);
    if (!shared.length) {
      box.appendChild(el('p.muted.tiny', {
        text: 'مدرکی در سطح شخص ثبت نشده است. از تب «مستندات» هر پرونده می‌توانید ' +
          'مدرک شخص اضافه کنید.'
      }));
      return box;
    }
    var docs = shared;
    box.appendChild(el('ul.doc-list', null, shared.map(function (doc) {
      return el('li.doc-item.person-doc', null, [
        el('span.doc-icon', { html: w.UIDocs.iconFor(doc.fileName) }),
        el('div.doc-body', null, [
          el('div.doc-head', null, [
            el('span.doc-kind', { text: doc.kind }),
            el('b.doc-title', { text: doc.title || doc.letterNo || doc.originalName })
          ]),
          el('div.doc-meta', {
            text: [doc.docDate ? J.format(doc.docDate) : null,
              w.UIDocs.sizeText(doc.size)].filter(Boolean).join(' • ')
          })
        ]),
        el('div.doc-actions', null, [
          el('button.btn.small', {
            /* دیدن، نه دانلود: عکس و PDF همین‌جا باز می‌شوند و دکمهٔ
               دانلود داخل نمایشگر است — همان قاعده‌ای که در پرونده
               داریم و باید همه‌جای برنامه یکی باشد. */
            type: 'button', text: 'دیدن',
            onclick: function () {
              w.UIViewer.open(docs, docs.indexOf(doc));
            }
          })
        ])
      ]);
    })));
    return box;
  }

  function mergedTimeline(app, person) {
    var items = P.timeline(person);
    if (!items.length) return el('p.muted', { text: 'رویدادی ثبت نشده است.' });
    var box = el('ol.timeline.person-timeline');
    items.forEach(function (it) {
      var caseTag = el('button.case-tag', {
        type: 'button', text: fa(it.caseNo),
        title: 'رفتن به پروندهٔ ' + fa(it.caseNo),
        onclick: function (e) { e.stopPropagation(); app.openCase(it.caseId); }
      });
      var bodyNodes;
      if (it.type === 'milestone') {
        bodyNodes = [caseTag, el('b', { text: it.label })];
      } else if (it.type === 'doc') {
        bodyNodes = [caseTag,
          el('span.doc-icon', { html: w.UIDocs.iconFor(it.doc.fileName) }),
          el('b', { text: it.doc.kind }),
          el('span.muted', {
            text: ' — ' + (it.doc.title || it.doc.letterNo || it.doc.originalName) + ' '
          }),
          el('button.linkish', {
            type: 'button', text: 'دیدن',
            onclick: function () {
              w.UIViewer.open([it.doc], 0);
            }
          })];
      } else {
        var h = it.entry;
        bodyNodes = [caseTag,
          el('b', { text: w.UIForm.kindLabel(h.kind) }),
          el('span.muted', { text: ' — ' + (h.user || 'کاربر') }),
          h.note ? el('span.muted', { text: ' • ' + h.note }) : null];
        if (h.changes && h.changes.length) {
          bodyNodes.push(el('div.tl-changes', null, h.changes.map(function (ch) {
            return el('div.tl-change', null, [
              el('span.tl-field', { text: w.UIForm.cleanLabel(ch.label) + ': ' }),
              el('span.tl-from', { text: ch.from || '(خالی)' }),
              el('span.tl-arrow', { text: ' ← ' }),
              el('span.tl-to', { text: ch.to || '(خالی)' })
            ]);
          })));
        }
      }
      box.appendChild(el('li.tl-item.tl-' +
        (it.type === 'milestone' ? 'milestone' : (it.type === 'doc' ? 'doc' : 'history')),
        null, [
          el('span.tl-date', {
            text: it.type === 'history' ? (it.entry.atJalali || '') : J.format(it.date)
          }),
          el('span.tl-body', null, bodyNodes)
        ]));
    });
    return box;
  }

  function renderOne(app, mount, key) {
    var person = P.get(key);
    if (!person) {
      w.U.clear(mount);
      mount.appendChild(el('div.empty-state', null, [
        el('p', { text: 'این شخص دیگر پرونده‌ای ندارد.' }),
        el('button.btn', { type: 'button', text: 'بازگشت به فهرست اشخاص',
          onclick: function () { app.goPeople(); } })
      ]));
      return;
    }

    var gaps = P.intervals(person);
    var summaryBits = [
      fa(person.caseCount) + ' پرونده',
      person.openCount ? fa(person.openCount) + ' در جریان' : null,
      person.closedCount ? fa(person.closedCount) + ' مختومه' : null,
      gaps.length ? 'کوتاه‌ترین فاصله بین دو پرونده ' +
        fa(Math.min.apply(null, gaps)) + ' روز' : null
    ].filter(Boolean).join(' • ');

    w.U.clear(mount);
    mount.appendChild(el('div.person-view', null, [
      el('div.case-head', null, [
        el('h2.case-title', { text: person.name }),
        el('div.case-actions', null, [
          el('button.btn.ghost', {
            type: 'button', text: '← فهرست اشخاص',
            onclick: function () { app.goPeople(); }
          }),
          el('div.spacer'),
          el('button.btn.ghost', {
            type: 'button', text: 'چاپ پروندهٔ شخص',
            onclick: function () { w.UIPrint.printPerson(person); }
          })
        ])
      ]),
      el('p.person-summary', { text: summaryBits }),
      conflictBox(app, person),
      // جدول پرونده‌ها تمام‌عرض است؛ ستون‌هایش از یک کارت باریک بیرون می‌زند
      el('section.chart-card.person-cases-card', null, [
        el('div.card-head', null, [el('div', null, [
          el('h3', { text: 'پرونده‌های این فرد' }),
          el('p.card-sub', { text: 'به ترتیب تاریخ ورود؛ روی هر سطر بزنید تا باز شود.' })
        ])]),
        el('div.table-scroll', null, [casesTable(app, person)])
      ]),
      el('div.person-layout', null, [
        el('section.chart-card', null, [
          el('div.card-head', null, [el('div', null, [
            el('h3', { text: 'مشخصات فرد' }),
            el('p.card-sub', { text: 'پرتکرارترین مقدار ثبت‌شده در پرونده‌های این فرد.' })
          ])]),
          profileCard(person)
        ]),
        sharedDocs(app, person)
      ]),
      el('section.chart-card.person-timeline-card', null, [
        el('div.card-head', null, [el('div', null, [
          el('h3', { text: 'گردش‌کار یکپارچه' }),
          el('p.card-sub', {
            text: 'رویدادهای همهٔ پرونده‌های این فرد، کنار هم و به ترتیب زمان.'
          })
        ])]),
        mergedTimeline(app, person)
      ])
    ]));
  }

  w.UIPerson = { renderList: renderList, renderOne: renderOne };
})(window);

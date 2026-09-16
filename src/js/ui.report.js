/* نمای گزارش‌ها: ردیف فیلتر، سنجه‌ها، یافته‌ها و نمودارها */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, R = w.Report, Ch = w.Charts;

  var SEV = {
    critical: { label: 'بحرانی', color: Ch.C.status.critical },
    serious: { label: 'نیازمند پیگیری', color: Ch.C.status.serious },
    warning: { label: 'هشدار', color: Ch.C.status.warning },
    good: { label: 'بی‌اشکال', color: Ch.C.status.good }
  };

  function fa(n) { return w.U.toFaDigits(n); }

  function num(v, suffix) {
    if (v == null) return '—';
    return fa(v) + (suffix ? ' ' + suffix : '');
  }

  // ------------------------------------------------------------------- کارت
  /**
   * کارت نمودار با همزاد جدولی. هر مقداری که روی نمودار هست، بدون هاور هم
   * از راه جدول در دسترس است.
   */
  function card(opts) {
    var showTable = false;
    var body = el('div.card-body');
    var toggle = el('button.btn.small.ghost', { type: 'button', text: 'جدول' });

    function paint() {
      w.U.clear(body);
      if (showTable) {
        body.appendChild(opts.table());
      } else {
        var chart = opts.chart();
        if (opts.legend) body.appendChild(opts.legend());
        var holder = el('div.chart-holder');
        body.appendChild(holder);
        Ch.mount(holder, chart);
        if (opts.footer) body.appendChild(opts.footer());
      }
      toggle.textContent = showTable ? 'نمودار' : 'جدول';
    }

    toggle.addEventListener('click', function () { showTable = !showTable; paint(); });

    var node = el('section.chart-card' + (opts.wide ? '.wide' : ''), null, [
      el('div.card-head', null, [
        el('div', null, [
          el('h3', { text: opts.title }),
          opts.subtitle ? el('p.card-sub', { text: opts.subtitle }) : null
        ]),
        opts.control ? opts.control() : null,
        toggle
      ]),
      body
    ]);
    paint();
    node.repaint = paint;
    return node;
  }

  // -------------------------------------------------------------- ردیف فیلتر
  function filterRow(app, data) {
    var s = app.state.report;

    function sel(label, value, options, onChange, title) {
      var select = el('select.input.small', { title: title || label });
      if (label) select.appendChild(el('option', { value: '', text: label }));
      options.forEach(function (o) {
        select.appendChild(el('option', {
          value: o.value, text: o.label, selected: o.value === value
        }));
      });
      select.value = value || '';
      select.addEventListener('change', function () { onChange(select.value); });
      return select;
    }

    var row = el('div.report-filters');

    // تاریخ مبنا — بازه روی همین فیلد اعمال می‌شود
    row.appendChild(el('span.filter-lead', { text: 'بازه بر پایهٔ' }));
    row.appendChild(sel('', s.baseField || 'intakeDate',
      R.DATE_BASES.map(function (b) { return { value: b.key, label: b.label }; }),
      function (v) {
        s.baseField = v;
        // اگر پیش‌تنظیم سال/فصل بود و در فیلد جدید وجود ندارد، به «همه» برگرد
        var keys = R.presets(v).map(function (p) { return p.key; });
        if (keys.indexOf(s.preset) < 0) s.preset = 'all';
        app.render();
      }, 'بازهٔ زمانی روی این فیلد تاریخ اعمال می‌شود'));

    var presetList = R.presets(s.baseField || 'intakeDate');
    row.appendChild(el('span.filter-lead', { text: 'در بازهٔ' }));
    row.appendChild(sel('', s.preset,
      presetList.map(function (p) { return { value: p.key, label: p.label }; }),
      function (v) { s.preset = v; app.render(); }));

    if (s.preset === 'custom') {
      row.appendChild(el('span.filter-lead', { text: 'از' }));
      row.appendChild(w.DatePicker.field(s.custom.from || '', function (v) {
        s.custom.from = v; app.render();
      }));
      row.appendChild(el('span.filter-lead', { text: 'تا' }));
      row.appendChild(w.DatePicker.field(s.custom.to || '', function (v) {
        s.custom.to = v; app.render();
      }));
    }

    row.appendChild(sel('همهٔ کارشناسان', s.expert,
      M.distinct('expert').map(function (v) { return { value: v, label: v }; }),
      function (v) { s.expert = v; app.render(); }));

    row.appendChild(sel('همهٔ سال‌های رسیدگی', s.year,
      M.distinct('year').map(function (v) { return { value: v, label: fa(v) }; }),
      function (v) { s.year = v; app.render(); }));

    row.appendChild(sel('همهٔ محل‌های خدمت', s.placeType,
      M.distinct('servicePlaceType').map(function (v) { return { value: v, label: v }; }),
      function (v) { s.placeType = v; app.render(); }));

    row.appendChild(el('div.spacer'));
    row.appendChild(el('button.btn.small.ghost', {
      type: 'button', text: 'چاپ گزارش',
      onclick: function () { w.UIPrint.printReport(data, describe(s, data)); }
    }));
    row.appendChild(el('button.btn.small', {
      type: 'button', text: 'خروجی اکسل گزارش',
      onclick: function () { w.UIMisc.exportReportExcel(data, describe(s, data)); }
    }));

    // خط دوم: بازهٔ حل‌شده و پرونده‌های کنارگذاشته‌شده، شفاف و قابل خواندن
    var resolved = el('div.range-line');
    if (data.range.from || data.range.to) {
      resolved.appendChild(el('span.range-chip', {
        text: 'از ' + (data.range.from ? J.format(data.range.from) : 'ابتدا') +
          ' تا ' + (data.range.to ? J.format(data.range.to) : 'امروز') +
          ' • ' + data.baseLabel
      }));
      if (data.prevRange) {
        resolved.appendChild(el('span.range-note', {
          text: 'مقایسه با دورهٔ قبل: ' + J.format(data.prevRange.from) +
            ' تا ' + J.format(data.prevRange.to)
        }));
      }
      if (data.undated) {
        resolved.appendChild(el('span.range-note.warn-text', {
          text: fa(data.undated) + ' پرونده «' + data.baseLabel +
            '» ندارند و در این برش نیامده‌اند.'
        }));
      }
    } else {
      resolved.appendChild(el('span.range-note', {
        text: 'بدون محدودیت زمانی — همهٔ ' + fa(data.cases.length) + ' پرونده.'
      }));
    }

    return el('div.filter-block', null, [row, resolved]);
  }

  function describe(s, data) {
    var parts = [];
    var preset = R.presets(data.baseField)
      .filter(function (p) { return p.key === s.preset; })[0];
    parts.push(preset ? preset.label : 'همهٔ پرونده‌ها');
    if (data.range.from || data.range.to) {
      parts.push('از ' + (data.range.from ? J.format(data.range.from) : '—') +
        ' تا ' + (data.range.to ? J.format(data.range.to) : '—') +
        ' بر پایهٔ ' + data.baseLabel);
    }
    if (s.expert) parts.push('کارشناس: ' + s.expert);
    if (s.year) parts.push('سال رسیدگی: ' + fa(s.year));
    if (s.placeType) parts.push('محل خدمت: ' + s.placeType);
    return parts.join(' • ');
  }

  // ------------------------------------------------------------ سنجه‌های سرآمد
  function heroRow(app, k) {
    var tiles = [
      {
        label: 'پروندهٔ در جریان', value: fa(k.open),
        note: k.total ? fa(100 - k.closedPct) + '٪ از کل' : ''
      },
      {
        label: 'مختومه‌شده', value: fa(k.closed),
        note: k.total ? fa(k.closedPct) + '٪ از کل' : ''
      },
      {
        label: 'میانهٔ روز تا طرح در کمیته',
        value: k.medianToCommittee == null ? '—' : fa(k.medianToCommittee),
        note: k.committeeSample
          ? 'میانگین ' + fa(k.meanToCommittee) + ' روز، بر پایهٔ ' +
            fa(k.committeeSample) + ' پرونده'
          : 'دادهٔ کافی نیست'
      },
      {
        label: 'قدیمی‌ترین پروندهٔ باز',
        value: k.oldestOpen ? fa(k.oldestOpen) : '—',
        note: k.oldestOpen ? 'روز از تاریخ ورود' : ''
      }
    ];

    var delta = null;
    if (k.delta != null) {
      var up = k.delta > 0;
      delta = el('div.hero-delta' + (up ? '.up' : (k.delta < 0 ? '.down' : '')), {
        text: (k.delta === 0 ? 'بدون تغییر' :
          (up ? '▲ ' : '▼ ') + fa(Math.abs(k.delta))) + ' نسبت به دورهٔ قبل'
      });
    }

    return el('div.hero-row', null, [
      el('div.hero-figure', null, [
        el('div.hero-label', { text: 'پروندهٔ این برش' }),
        el('div.hero-value', { text: fa(k.total) }),
        delta
      ]),
      el('div.stat-tiles', null, tiles.map(function (t) {
        return el('div.stat-tile', null, [
          el('div.tile-label', { text: t.label }),
          el('div.tile-value', { text: t.value }),
          t.note ? el('div.tile-note', { text: t.note }) : null
        ]);
      }))
    ]);
  }

  // ------------------------------------------------------------- کارت یافته‌ها
  function findingsCard(app, findings) {
    return el('section.chart-card.wide.findings', null, [
      el('div.card-head', null, [
        el('div', null, [
          el('h3', { text: 'یافته‌ها و پیشنهادها' }),
          el('p.card-sub', {
            text: 'تحلیل خودکار روی همین برش؛ روی هر مورد بزنید تا پرونده‌هایش را ببینید.'
          })
        ])
      ]),
      el('ul.finding-list', null, findings.map(function (f) {
        var sev = SEV[f.severity] || SEV.warning;
        return el('li.finding.sev-' + f.severity, null, [
          el('span.finding-icon', { text: f.icon, 'aria-hidden': 'true' }),
          el('div.finding-body', null, [
            el('div.finding-head', null, [
              el('b', { text: f.title }),
              el('span.sev-tag', { text: sev.label }),
              f.count ? el('span.finding-count', { text: fa(f.count) + ' پرونده' }) : null
            ]),
            el('p.finding-advice', { text: f.advice })
          ]),
          el('div.finding-actions', null, [
            f.people && f.people.length === 1 ? el('button.btn.small.ghost', {
              type: 'button', text: 'پروندهٔ شخص',
              onclick: function () { app.openPerson(f.people[0].key); }
            }) : null,
            f.people && f.people.length > 1 ? el('button.btn.small.ghost', {
              type: 'button', text: 'فهرست اشخاص',
              onclick: function () { app.goPeople(); }
            }) : null,
            f.ids && f.ids.length ? el('button.btn.small.ghost', {
              type: 'button', text: 'نمایش پرونده‌ها',
              onclick: function () { app.showCases(f.ids, f.title); }
            }) : null
          ])
        ]);
      }))
    ]);
  }

  // ------------------------------------------------------------------- نماها
  function render(app, mount) {
    Ch.reset();
    var s = app.state.report;
    var data = R.build(s);
    var pick = function (field) {
      return function (d) {
        if (d.key === '__other__' || d.label === 'ثبت‌نشده') return;
        app.showCasesByField(field, d.key || d.label, d.label);
      };
    };

    var grid = el('div.chart-grid');

    // روند زمانی — دو سری، یک محور، راهنما همیشه حاضر
    if (data.trend.x.length) {
      var granLabel = (R.GRANULARITY.filter(function (g) {
        return g.key === data.trend.granularity;
      })[0] || {}).label;
      grid.appendChild(card({
        wide: true,
        title: 'روند ' + granLabel + ' ورود و اختتام پرونده',
        subtitle: 'محور زمان از راست (قدیمی‌تر) به چپ (تازه‌تر). ' +
          'دورهٔ اختتام بر پایهٔ تاریخ ابلاغ رأی یا در نبودش تاریخ طرح در کمیته است.',
        control: function () {
          var g = el('select.input.small', { title: 'تفکیک زمانی نمودار' });
          g.appendChild(el('option', { value: 'auto', text: 'تفکیک خودکار' }));
          R.GRANULARITY.forEach(function (o) {
            g.appendChild(el('option', {
              value: o.key, text: o.label,
              selected: o.key === app.state.report.granularity
            }));
          });
          g.value = app.state.report.granularity || 'auto';
          g.addEventListener('change', function () {
            app.state.report.granularity = g.value;
            app.render();
          });
          return g;
        },
        legend: function () {
          return Ch.legend([
            { name: 'وارده', color: Ch.C.series[0] },
            { name: 'مختومه', color: Ch.C.series[1] }
          ], 'line');
        },
        chart: function () {
          return Ch.lines({
            x: data.trend.x, unit: 'پرونده', height: 240,
            series: [
              { name: 'وارده', values: data.trend.intake },
              { name: 'مختومه', values: data.trend.closed }
            ]
          });
        },
        table: function () {
          return Ch.table(['دوره', 'وارده', 'مختومه', 'تراز'],
            data.trend.x.map(function (label, i) {
              var diff = data.trend.intake[i] - data.trend.closed[i];
              return [label, fa(data.trend.intake[i]), fa(data.trend.closed[i]),
                (diff > 0 ? '+' : '') + fa(diff)];
            }));
        }
      }));
    }

    // قیف گردش‌کار — رستهٔ ترتیبی، رمپ تک‌رنگ
    grid.appendChild(card({
      title: 'قیف گردش‌کار',
      subtitle: 'مرحله‌ها از روی تاریخ‌های ثبت‌شده استخراج می‌شوند، نه از متن وضعیت. ' +
        'هر عدد یعنی «به این مرحله رسیده یا از آن گذشته».',
      chart: function () {
        return Ch.hbar({
          data: data.funnel.map(function (f) {
            return { label: f.label, value: f.value, key: f.key, note: 'پرونده' };
          }),
          ramp: true, labelWidth: 150,
          onPick: function (d) { app.showCasesByStage(d.key, d.label); }
        });
      },
      footer: function () {
        return el('p.card-note', {
          text: data.funnel.map(function (f) {
            return f.label + ' ' + fa(f.pct) + '٪';
          }).join(' • ')
        });
      },
      table: function () {
        return Ch.table(['مرحله', 'تعداد', 'درصد از کل'],
          data.funnel.map(function (f) {
            return [f.label, fa(f.value), fa(f.pct) + '٪'];
          }));
      }
    }));

    // نوع پرونده — سهم از کل
    grid.appendChild(card({
      title: 'نوع پروندهٔ مطروحه',
      subtitle: 'سهم هر نوع از کل پرونده‌های این برش.',
      legend: function () {
        return Ch.legend(data.caseTypes.map(function (t, i) {
          return { name: t.label, value: t.value, color: Ch.C.series[i] };
        }));
      },
      chart: function () {
        return Ch.stacked100({ data: data.caseTypes, onPick: pick('caseType') });
      },
      table: function () {
        var total = data.caseTypes.reduce(function (a, b) { return a + b.value; }, 0) || 1;
        return Ch.table(['نوع پرونده', 'تعداد', 'سهم'],
          data.caseTypes.map(function (t) {
            return [t.label, fa(t.value), fa(Math.round(t.value / total * 100)) + '٪'];
          }));
      }
    }));

    // وضعیت پرونده‌ها — رستهٔ اسمی، یک رنگ برای همه
    grid.appendChild(card({
      title: 'وضعیت پرونده‌ها',
      subtitle: 'روی هر میله بزنید تا همان پرونده‌ها در فهرست باز شوند.',
      chart: function () {
        return Ch.hbar({ data: data.status, labelWidth: 185, onPick: pick('status') });
      },
      table: function () {
        return Ch.table(['وضعیت', 'تعداد'], data.status.map(function (d) {
          return [d.label, fa(d.value)];
        }));
      }
    }));

    // سن پرونده‌های باز — سطل‌های مرتب، رمپ ترتیبی
    grid.appendChild(card({
      title: 'سن پرونده‌های باز',
      subtitle: 'فاصلهٔ امروز تا تاریخ ورود، فقط برای پرونده‌های مختومه‌نشده.',
      chart: function () {
        return Ch.hbar({
          data: data.aging, ramp: true, labelWidth: 120,
          onPick: function (d) {
            if (d.value) app.showCases(d.ids, 'پرونده‌های باز — ' + d.label);
          }
        });
      },
      table: function () {
        return Ch.table(['بازهٔ سنی', 'تعداد پروندهٔ باز'], data.aging.map(function (d) {
          return [d.label, fa(d.value)];
        }));
      }
    }));

    // زمان مراحل
    if (data.durations.length) {
      grid.appendChild(card({
        title: 'میانهٔ زمان هر مرحله',
        subtitle: 'میانه مقاوم‌تر از میانگین است و با یکی دو پروندهٔ طولانی جابه‌جا نمی‌شود.',
        chart: function () {
          return Ch.hbar({
            data: data.durations.map(function (d) {
              return { label: d.label, value: d.value, note: 'روز (میانه)' };
            }),
            labelWidth: 205, unit: 'روز'
          });
        },
        table: function () {
          return Ch.table(['مرحله', 'میانه (روز)', 'میانگین (روز)', 'بیشینه (روز)', 'تعداد نمونه'],
            data.durations.map(function (d) {
              return [d.label, fa(d.value), num(d.mean), fa(d.max), fa(d.sample)];
            }));
        }
      }));
    }

    // کارکرد کارشناسان
    grid.appendChild(card({
      title: 'کارکرد کارشناسان',
      subtitle: 'تعداد پروندهٔ هر کارشناس؛ جزئیات باز/مختومه در نمای جدول.',
      chart: function () {
        return Ch.hbar({
          data: data.experts.map(function (e) {
            return { label: e.label, value: e.value, key: e.label, note: 'پرونده' };
          }),
          labelWidth: 130, onPick: pick('expert')
        });
      },
      table: function () {
        return Ch.table(['کارشناس', 'کل', 'در جریان', 'مختومه', 'میانهٔ روز تا کمیته'],
          data.experts.map(function (e) {
            return [e.label, fa(e.value), fa(e.open), fa(e.closed), num(e.median)];
          }));
      }
    }));

    // واحد سازمانی
    grid.appendChild(card({
      title: 'پراکندگی واحدهای سازمانی',
      subtitle: 'هشت واحد پرتکرار؛ مابقی در «سایر» جمع شده‌اند.',
      chart: function () {
        return Ch.hbar({ data: data.orgUnits, labelWidth: 200, onPick: pick('orgUnit') });
      },
      table: function () {
        return Ch.table(['واحد سازمانی', 'تعداد'], data.orgUnits.map(function (d) {
          return [d.label, fa(d.value)];
        }));
      }
    }));

    // مرجع گزارش‌دهنده
    grid.appendChild(card({
      title: 'مراجع گزارش‌دهنده',
      subtitle: 'هشت مرجع پرتکرار؛ مابقی در «سایر» جمع شده‌اند.',
      chart: function () {
        return Ch.hbar({
          data: data.reporters, labelWidth: 210, onPick: pick('reporterOrg')
        });
      },
      table: function () {
        return Ch.table(['مرجع گزارش‌دهنده', 'تعداد'], data.reporters.map(function (d) {
          return [d.label, fa(d.value)];
        }));
      }
    }));

    // تکرار تخلف — یک کارمند ممکن است چند پرونده داشته باشد
    if (data.repeat.people) {
      grid.appendChild(card({
        title: 'تکرار تخلف',
        subtitle: fa(data.repeat.people) + ' نفر در این برش؛ گروه‌بندی بر پایهٔ ' +
          'کد ملی و در نبودش کد پرسنلی.',
        chart: function () {
          return Ch.hbar({
            data: data.repeat.buckets, ramp: true, labelWidth: 160,
            valueLabel: 'نفر'
          });
        },
        footer: function () {
          if (!data.repeat.repeaters.length) return null;
          return el('p.card-note', null, [
            el('span', { text: 'پرتکرارترین: ' }),
            el('span', null, data.repeat.repeaters.slice(0, 5).map(function (p, i) {
              return el('span', null, [
                i ? el('span', { text: '، ' }) : null,
                el('button.linkish', {
                  type: 'button',
                  text: p.name + ' (' + fa(p.caseCount) + ')',
                  onclick: function () { app.openPerson(p.key); }
                })
              ]);
            }))
          ]);
        },
        table: function () {
          return Ch.table(['تعداد پرونده', 'تعداد نفر'],
            data.repeat.buckets.map(function (b) {
              return [b.label, fa(b.value)];
            }));
        }
      }));
    }

    // مستندات — فقط وقتی سندی ثبت شده باشد
    if (data.docKinds.length) {
      grid.appendChild(card({
        title: 'مستندات به تفکیک نوع',
        subtitle: 'فقط نسخه‌های جاری شمرده می‌شوند؛ نسخه‌های بایگانی نه.',
        chart: function () {
          return Ch.hbar({ data: data.docKinds, labelWidth: 175 });
        },
        table: function () {
          return Ch.table(['نوع سند', 'تعداد'], data.docKinds.map(function (d) {
            return [d.label, fa(d.value)];
          }));
        }
      }));
    }

    // ترکیب استخدامی
    grid.appendChild(card({
      title: 'نوع محل خدمت و ماهیت شغل',
      subtitle: 'ترکیب پرونده‌ها بر اساس جایگاه سازمانی فرد.',
      chart: function () {
        return Ch.hbar({
          data: data.placeTypes, labelWidth: 175, onPick: pick('servicePlaceType')
        });
      },
      table: function () {
        return Ch.table(['دسته', 'تعداد'],
          data.placeTypes.map(function (d) { return [d.label, fa(d.value)]; })
            .concat([['—', '—']])
            .concat(data.jobNature.map(function (d) { return [d.label, fa(d.value)]; })));
      }
    }));

    w.U.clear(mount);
    mount.appendChild(el('div.report-view', null, [
      filterRow(app, data),
      data.cases.length
        ? el('div', null, [
          heroRow(app, data.kpis),
          findingsCard(app, data.findings),
          grid
        ])
        : el('div.empty-state', null, [
          el('p', { text: 'در این بازه پرونده‌ای پیدا نشد. بازه یا فیلترها را تغییر دهید.' })
        ])
    ]));

    app.state.reportData = data;
    Ch.settle();          // حالا که نما به صفحه وصل شده، با عرض واقعی رسم می‌شود
  }

  w.UIReport = { render: render, describe: describe, SEV: SEV };
})(window);

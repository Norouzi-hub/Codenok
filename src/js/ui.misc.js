/* پنل آمار، ستون‌ها، خروجی‌ها، پشتیبان‌گیری، ورود از اکسل و تنظیمات */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  function fa(n) { return w.U.toFaDigits(n); }

  // -------------------------------------------------------------- پنل آمار
  function statsPanel(app) {
    var s = M.stats();
    var box = el('div.stats');
    box.appendChild(el('h3', { text: 'یک نگاه' }));
    box.appendChild(el('div.stat-total', null, [
      el('b', { text: w.U.toFaDigits(s.total) }), el('span', { text: ' پرونده' })
    ]));

    var order = Object.keys(s.byStatus).sort(function (a, b) {
      return s.byStatus[b] - s.byStatus[a];
    });
    var max = order.length ? s.byStatus[order[0]] : 1;
    order.forEach(function (k) {
      var pct = Math.round((s.byStatus[k] / max) * 100);
      box.appendChild(el('button.stat-row', {
        type: 'button', title: 'فیلتر بر اساس ' + k,
        onclick: function () {
          app.state.filters = { status: [k] };
          app.refresh(true);
        }
      }, [
        el('span.stat-bar', null, [
          el('span.stat-fill.' + (w.UIList.statusClass(k) || 'st-none'),
            { style: 'width:' + pct + '%' })
        ]),
        el('span.stat-label', { text: k }),
        el('span.stat-num', { text: w.U.toFaDigits(s.byStatus[k]) })
      ]));
    });

    var late = M.stale(90);
    if (late.length) {
      box.appendChild(el('div.alert', null, [
        el('b', { text: w.U.toFaDigits(late.length) + ' پرونده' }),
        el('span', { text: ' بیش از ۹۰ روز از ورودشان گذشته و هنوز در کمیته طرح نشده‌اند. ' }),
        el('button.btn.small.ghost', {
          type: 'button', text: 'نمایش',
          onclick: function () {
            app.state.q = '';
            app.state.filters = {};
            app.state.filters._to = (function () {
              var t = J.unpack(J.today());
              var d = J.toGregorian(t.jy, t.jm, t.jd);
              d.setDate(d.getDate() - 90);
              var j = J.toJalali(d);
              return J.pack(j.jy, j.jm, j.jd);
            })();
            app.refresh(true);
          }
        })
      ]));
    }
    return box;
  }

  // ---------------------------------------------------------- انتخاب ستون‌ها
  function columnsDialog(app) {
    var chosen = M.state.columns.slice();
    var body = el('div.cols-dialog');
    body.appendChild(el('p.muted', { text: 'ستون‌هایی که در جدول فهرست دیده می‌شوند:' }));
    var grid = el('div.cols-grid');
    w.GROUPS.forEach(function (g) {
      var col = el('div.cols-group', null, [el('h4', { text: g.label })]);
      M.FIELDS.filter(function (f) { return f.group === g.key; }).forEach(function (f) {
        var cb = el('input', {
          type: 'checkbox', checked: chosen.indexOf(f.key) >= 0,
          onchange: function () {
            if (this.checked) { if (chosen.indexOf(f.key) < 0) chosen.push(f.key); }
            else chosen = chosen.filter(function (k) { return k !== f.key; });
          }
        });
        col.appendChild(el('label.col-opt', null, [cb,
          el('span', { text: w.UIForm.cleanLabel(f.label) })]));
      });
      grid.appendChild(col);
    });
    body.appendChild(grid);

    var m = w.U.modal('ستون‌های جدول', body, [
      el('button.btn.ghost', {
        type: 'button', text: 'بازگشت به پیش‌فرض',
        onclick: function () {
          M.saveColumns(w.DEFAULT_COLUMNS.slice()).then(function () {
            m.close(); app.refresh();
          });
        }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'اعمال',
        onclick: function () {
          if (!chosen.length) { w.U.toast('حداقل یک ستون انتخاب کنید.', 'bad'); return; }
          // ترتیب را بر اساس ترتیب فیلدها نگه می‌داریم
          var ordered = M.FIELDS.map(function (f) { return f.key; })
            .filter(function (k) { return chosen.indexOf(k) >= 0; });
          M.saveColumns(ordered).then(function () { m.close(); app.refresh(); });
        }
      })
    ]);
  }

  // ------------------------------------------------------------- خروجی اکسل
  function excelSheets(rows) {
    var header = M.FIELDS.map(function (f) { return f.label; });
    var body = rows.map(function (rec) {
      return M.FIELDS.map(function (f) {
        var v = rec[f.key] || '';
        return f.type === 'date' ? J.format(v, { latin: true }) : v;
      });
    });
    var widths = M.FIELDS.map(function (f) { return w.UIList.colWidth(f) / 7; });

    var hHeader = ['شماره پرونده', 'تاریخ و ساعت', 'کاربر', 'نوع رویداد', 'فیلد',
      'مقدار قبلی', 'مقدار جدید', 'توضیح'];
    var hBody = [];
    M.state.history.slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; })
      .forEach(function (h) {
        var kind = w.UIForm.kindLabel(h.kind);
        if (h.changes && h.changes.length) {
          h.changes.forEach(function (c) {
            hBody.push([h.caseNo, h.atJalali, h.user, kind,
              w.UIForm.cleanLabel(c.label), c.from, c.to, h.note]);
          });
        } else {
          hBody.push([h.caseNo, h.atJalali, h.user, kind, '', '', '', h.note]);
        }
      });

    return [
      { name: 'پرونده‌ها', rows: [header].concat(body), widths: widths },
      { name: 'تاریخچه تغییرات', rows: [hHeader].concat(hBody),
        widths: [14, 20, 12, 14, 26, 26, 26, 22] }
    ];
  }

  function exportExcel(rows) {
    try {
      var blob = w.XLSX.build(excelSheets(rows || M.state.cases));
      w.U.download('parvandeha-' + J.today() + '.xlsx', blob);
      w.U.toast('فایل اکسل ساخته شد.', 'good');
    } catch (e) {
      w.U.toast('ساخت فایل اکسل ناموفق بود: ' + e.message, 'bad');
    }
  }

  function exportSqlite() {
    if (!w.SQLiteOut.available()) {
      w.U.toast('موتور SQLite در این نسخه در دسترس نیست.', 'bad');
      return;
    }
    w.U.toast('در حال ساخت فایل SQLite…');
    w.SQLiteOut.build(M.state.cases.map(M.strip), M.state.history, M.FIELDS)
      .then(function (blob) {
        w.U.download('parvandeha-' + J.today() + '.sqlite', blob);
        w.U.toast('فایل SQLite ساخته شد.', 'good');
      })
      .catch(function (e) {
        w.U.toast('ساخت فایل SQLite ناموفق بود: ' + e.message, 'bad');
      });
  }

  /** خروجی اکسل گزارش: هر جدول در یک شیت جدا */
  function exportReportExcel(data, scopeText) {
    var k = data.kpis;
    var sheets = [];

    sheets.push({
      name: 'خلاصهٔ گزارش',
      rows: [
        ['سنجه', 'مقدار'],
        ['برش گزارش', scopeText || 'همهٔ پرونده‌ها'],
        ['تاریخ تهیه', J.stamp()],
        ['کل پرونده‌ها', fa(k.total)],
        ['در جریان', fa(k.open)],
        ['مختومه‌شده', fa(k.closed)],
        ['درصد مختومه', fa(k.closedPct) + '٪'],
        ['میانهٔ روز تا طرح در کمیته',
          k.medianToCommittee == null ? '—' : fa(k.medianToCommittee)],
        ['میانگین روز تا طرح در کمیته',
          k.meanToCommittee == null ? '—' : fa(k.meanToCommittee)],
        ['قدیمی‌ترین پروندهٔ باز (روز)', k.oldestOpen ? fa(k.oldestOpen) : '—']
      ],
      widths: [34, 30]
    });

    sheets.push({
      name: 'یافته‌ها و پیشنهادها',
      rows: [['شدت', 'یافته', 'تعداد پرونده', 'پیشنهاد']].concat(
        data.findings.map(function (f) {
          return [(w.UIReport.SEV[f.severity] || {}).label || '', f.title,
            f.count ? fa(f.count) : '—', f.advice];
        })),
      widths: [16, 34, 14, 70]
    });

    sheets.push({
      name: 'روند ماهانه',
      rows: [['ماه', 'وارده', 'مختومه', 'تراز']].concat(
        data.trend.x.map(function (label, i) {
          var diff = data.trend.intake[i] - data.trend.closed[i];
          return [label, fa(data.trend.intake[i]), fa(data.trend.closed[i]),
            (diff > 0 ? '+' : '') + fa(diff)];
        })),
      widths: [18, 12, 12, 12]
    });

    sheets.push({
      name: 'قیف گردش‌کار',
      rows: [['مرحله', 'تعداد', 'درصد از کل']].concat(
        data.funnel.map(function (f) {
          return [f.label, fa(f.value), fa(f.pct) + '٪'];
        })),
      widths: [30, 12, 14]
    });

    sheets.push({
      name: 'زمان مراحل',
      rows: [['مرحله', 'میانه (روز)', 'میانگین (روز)', 'بیشینه (روز)', 'تعداد نمونه']]
        .concat(data.durations.map(function (d) {
          return [d.label, fa(d.value), d.mean == null ? '—' : fa(d.mean),
            fa(d.max), fa(d.sample)];
        })),
      widths: [34, 14, 14, 14, 14]
    });

    sheets.push({
      name: 'کارکرد کارشناسان',
      rows: [['کارشناس', 'کل', 'در جریان', 'مختومه', 'میانهٔ روز تا کمیته']].concat(
        data.experts.map(function (e) {
          return [e.label, fa(e.value), fa(e.open), fa(e.closed),
            e.median == null ? '—' : fa(e.median)];
        })),
      widths: [26, 10, 12, 12, 20]
    });

    if (data.repeat && data.repeat.repeaters.length) {
      sheets.push({
        name: 'تکرار تخلف',
        rows: [['نام', 'کد ملی', 'تعداد پرونده', 'در جریان', 'مختومه',
          'شماره پرونده‌ها']].concat(
          data.repeat.repeaters.map(function (p) {
            return [p.name, fa(p.nationalId), fa(p.caseCount), fa(p.openCount),
              fa(p.closedCount),
              p.cases.map(function (c) { return fa(c.caseNo || '—'); }).join('، ')];
          })),
        widths: [26, 16, 14, 12, 12, 40]
      });
    }

    if (data.docKinds && data.docKinds.length) {
      sheets.push({
        name: 'مستندات',
        rows: [['نوع سند', 'تعداد']].concat(data.docKinds.map(function (d) {
          return [d.label, fa(d.value)];
        })),
        widths: [34, 12]
      });
    }

    [['وضعیت پرونده‌ها', data.status, 'وضعیت'],
     ['نوع پرونده', data.caseTypes, 'نوع پرونده'],
     ['سن پرونده‌های باز', data.aging, 'بازهٔ سنی'],
     ['واحدهای سازمانی', data.orgUnits, 'واحد سازمانی'],
     ['مراجع گزارش‌دهنده', data.reporters, 'مرجع'],
     ['نوع محل خدمت', data.placeTypes, 'دسته']].forEach(function (t) {
      sheets.push({
        name: t[0],
        rows: [[t[2], 'تعداد']].concat(t[1].map(function (d) {
          return [d.label, fa(d.value)];
        })),
        widths: [34, 12]
      });
    });

    try {
      w.U.download('gozaresh-' + J.today() + '.xlsx', w.XLSX.build(sheets));
      w.U.toast('خروجی اکسل گزارش ساخته شد.', 'good');
    } catch (e) {
      w.U.toast('ساخت خروجی گزارش ناموفق بود: ' + e.message, 'bad');
    }
  }

  function exportJson() {
    // اگر رمز فعال باشد، نسخهٔ پشتیبان هم رمزشده بیرون می‌رود
    w.Vault.sealSnapshot(w.Store.snapshot()).then(function (payload) {
      var blob = new Blob([JSON.stringify(payload, null, payload.encrypted ? 0 : 1)],
        { type: 'application/json' });
      w.U.download('parvandeha-backup-' + J.today() + '.json', blob);
      M.saveSettings({ changesSinceBackup: 0 });
      w.U.toast(payload.encrypted
        ? 'نسخهٔ پشتیبان رمزشده ذخیره شد.'
        : 'نسخهٔ پشتیبان ذخیره شد.', 'good');
    }).catch(function (e) {
      w.U.toast('ساخت پشتیبان ناموفق بود: ' + e.message, 'bad');
    });
  }

  // ------------------------------------------------------- بازیابی و ورودی
  function pickFile(accept) {
    return new Promise(function (resolve) {
      var input = el('input', { type: 'file', accept: accept });
      input.style.display = 'none';
      input.addEventListener('change', function () {
        resolve(input.files && input.files[0]);
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  function restoreJson(app) {
    pickFile('.json,application/json').then(function (file) {
      if (!file) return;
      return w.U.confirmBox('بازیابی پشتیبان',
        'همهٔ داده‌های فعلی با محتوای فایل «' + file.name + '» جایگزین می‌شود. ادامه می‌دهید؟',
        'جایگزین کن').then(function (ok) {
          if (!ok) return;
          return file.text().then(function (text) {
            var payload = JSON.parse(text);
            if (!payload.encrypted) return payload;
            // نسخهٔ پشتیبان رمزشده: رمزِ زمانِ ساختنش لازم است
            return w.UILock.askBackupPassword(file.name).then(function (pw) {
              if (!pw) return null;
              return w.Vault.openSnapshot(payload, pw).catch(function () {
                throw new Error('رمز نادرست است یا فایل آسیب دیده');
              });
            });
          }).then(function (snap) {
            if (!snap) return null;
            return w.Store.restore(snap).then(function () {
              return M.reload();
            }).then(function () {
              return w.Docs.load();
            }).then(function () {
              w.U.toast('داده‌ها بازیابی شد.', 'good');
              app.goList();
            });
          });
        });
    }).catch(function (e) {
      w.U.toast('بازیابی ناموفق بود: ' + e.message, 'bad');
    });
  }

  /** ستون‌های فایل را به فیلدهای برنامه نگاشت می‌کند */
  function mapColumns(headerRow) {
    var header = headerRow.map(function (h) { return w.U.normalize(h); });
    var map = {}, matched = [], usedCols = {};
    M.FIELDS.forEach(function (f) {
      var i = header.indexOf(w.U.normalize(f.label));
      if (i < 0) i = header.indexOf(w.U.normalize(w.UIForm.cleanLabel(f.label)));
      if (i < 0 || usedCols[i]) return;
      usedCols[i] = true;
      map[f.key] = i;
      matched.push({ field: f, col: i, header: headerRow[i] });
    });
    var ignored = [];
    headerRow.forEach(function (h, i) {
      if (!usedCols[i] && String(h || '').trim()) ignored.push(String(h).trim());
    });
    return { map: map, matched: matched, ignored: ignored };
  }

  function rowsToRecords(rows, map) {
    return rows.slice(1).map(function (r) {
      var rec = {};
      Object.keys(map).forEach(function (k) {
        var v = r[map[k]];
        if (v != null && String(v).trim() !== '') rec[k] = String(v).trim();
      });
      return rec;
    }).filter(function (r) { return Object.keys(r).length; });
  }

  function countLine(label, n, cls) {
    return el('div.imp-row' + (cls ? '.' + cls : ''), null, [
      el('b.imp-num', { text: fa(n) }),
      el('span', { text: label })
    ]);
  }

  /**
   * پنجرهٔ ورود از اکسل: پیش از هر تغییری نشان می‌دهد چه چیزی وارد می‌شود،
   * چه ستون‌هایی شناسایی نشده‌اند و با پرونده‌های تکراری چه می‌کند.
   */
  function importDialog(app, fileName, rows) {
    var cols = mapColumns(rows[0] || []);
    // شمارهٔ پرونده معمولاً ستون صفر است؛ بررسی باید با null مقایسه شود نه !
    if (cols.map.caseNo == null) {
      w.U.toast('ستون «شماره پرونده» در فایل پیدا نشد؛ ورود ممکن نیست.', 'bad');
      return;
    }
    var records = rowsToRecords(rows, cols.map);
    var an = M.analyzeImport(records);
    var policy = 'skip';

    var body = el('div.import-dialog');
    body.appendChild(el('p.muted.tiny', {
      text: 'فایل: ' + fileName + ' — ' + fa(rows.length - 1) + ' ردیف داده'
    }));

    // شناسایی ستون‌ها
    var colBox = el('details.imp-block', { open: cols.ignored.length > 0 });
    colBox.appendChild(el('summary', null, [
      el('b', { text: 'ستون‌ها: ' + fa(cols.matched.length) + ' شناسایی شد' }),
      cols.ignored.length
        ? el('span.imp-warn', { text: ' • ' + fa(cols.ignored.length) + ' ستون ناشناس' })
        : el('span.imp-ok', { text: ' • همه شناسایی شدند' })
    ]));
    if (cols.ignored.length) {
      colBox.appendChild(el('p.muted.tiny', {
        text: 'این ستون‌ها با هیچ فیلدی نخواندند و نادیده گرفته می‌شوند: ' +
          cols.ignored.join('، ')
      }));
    }
    var missing = M.FIELDS.filter(function (f) { return cols.map[f.key] == null; });
    if (missing.length) {
      colBox.appendChild(el('p.muted.tiny', {
        text: fa(missing.length) + ' فیلد برنامه در فایل نبود و خالی می‌ماند: ' +
          missing.slice(0, 12).map(function (f) {
            return w.UIForm.cleanLabel(f.label);
          }).join('، ') + (missing.length > 12 ? ' …' : '')
      }));
    }
    body.appendChild(colBox);

    // جمع‌بندی رکوردها
    var counts = el('div.imp-counts', null, [
      countLine('پروندهٔ تازه — ثبت می‌شود', an.fresh.length, 'good'),
      an.existing.length
        ? countLine('شمارهٔ پرونده از قبل در برنامه هست', an.existing.length, 'dup') : null,
      an.insideFile.length
        ? countLine('ردیف تکراری داخل خود فایل — همیشه رد می‌شود',
          an.insideFile.length, 'dup') : null,
      an.noCaseNo.length
        ? countLine('ردیف بدون شمارهٔ پرونده — رد می‌شود', an.noCaseNo.length, 'dup') : null
    ]);
    body.appendChild(counts);

    // سیاست برخورد با تکراری‌ها
    if (an.existing.length) {
      var skipRadio = el('input', { type: 'radio', name: 'imp-policy', checked: true });
      var updateRadio = el('input', { type: 'radio', name: 'imp-policy' });
      skipRadio.addEventListener('change', function () { policy = 'skip'; });
      updateRadio.addEventListener('change', function () { policy = 'update'; });

      body.appendChild(el('div.imp-block', null, [
        el('b', { text: 'با پرونده‌های تکراری چه شود؟' }),
        el('label.imp-choice', null, [skipRadio, el('span', null, [
          el('b', { text: 'رد شوند (پیشنهاد) — ' }),
          el('span', { text: 'پروندهٔ موجود دست‌نخورده می‌ماند و نسخهٔ تکراری ساخته نمی‌شود.' })
        ])]),
        el('label.imp-choice', null, [updateRadio, el('span', null, [
          el('b', { text: 'به‌روزرسانی شوند — ' }),
          el('span', {
            text: 'مقادیر تازه روی پروندهٔ موجود می‌نشیند و هر تغییر در تاریخچه ثبت می‌شود' +
              (an.changed.length
                ? ' (' + fa(an.changed.length) + ' پرونده واقعاً تغییر می‌کند).' : '.')
          })
        ])]),
        el('details.imp-dup-list', null, [
          el('summary', { text: 'دیدن شماره‌های تکراری' }),
          el('p.muted.tiny', {
            text: an.existing.map(function (r) { return fa(r.caseNo); }).join('، ')
          })
        ])
      ]));
    }

    var m, busy = false;
    var go = el('button.btn.primary', {
      type: 'button', text: 'شروع ورود',
      onclick: function () {
        if (busy) return;
        busy = true;
        go.textContent = 'در حال ورود…';
        M.bulkImport(records, { onDuplicate: policy, note: 'ورود از ' + fileName })
          .then(function (res) {
            m.close();
            w.U.toast(fa(res.added) + ' پروندهٔ تازه' +
              (res.updated ? '، ' + fa(res.updated) + ' به‌روزرسانی' : '') +
              (res.skipped ? '، ' + fa(res.skipped) + ' رد شد' : '') + '.', 'good');
            app.goList();
          }).catch(function (e) {
            busy = false;
            go.textContent = 'تلاش دوباره';
            w.U.toast('ورود ناموفق بود: ' + e.message, 'bad');
          });
      }
    });
    if (!an.fresh.length && !an.existing.length) {
      go.disabled = true;
      go.textContent = 'چیزی برای ورود نیست';
    }

    m = w.U.modal('ورود اطلاعات از اکسل', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف',
        onclick: function () { m.close(); } }),
      go
    ]);
  }

  function importExcel(app) {
    pickFile('.xlsx').then(function (file) {
      if (!file) return;
      return file.arrayBuffer().then(w.XLSX.read).then(function (rows) {
        if (rows.length < 2) throw new Error('فایل داده‌ای ندارد');
        importDialog(app, file.name, rows);
      });
    }).catch(function (e) {
      w.U.toast('خواندن فایل اکسل ناموفق بود: ' + e.message, 'bad');
    });
  }

  /**
   * حذف کامل دیتابیس از مرورگر — تنها راه «شروع از نو»ی واقعی روی file://
   * چون فایل تازه هم همان دیتابیس قبلی را می‌بیند.
   */
  function wipeDialog(app, parentModal) {
    var confirmInput = el('input.input', {
      type: 'text', placeholder: 'حذف', autocomplete: 'off'
    });
    var body = el('div', null, [
      el('div.warn', null, [
        el('span', null, [
          el('b', { text: 'این کار برگشت‌پذیر نیست. ' }),
          el('span', {
            text: 'دیتابیس «' + w.Store.dbName() + '» به‌طور کامل از این مرورگر ' +
              'حذف می‌شود: همهٔ پرونده‌ها، تاریخچه، فهرست مستندات، تنظیمات، ' +
              'لیست‌ها و رمز عبور.'
          })
        ])
      ]),
      el('p.muted.tiny', {
        text: 'فایل‌های پیوست داخل پوشهٔ مستندات و فایل پشتیبان روی دیسک ' +
          'دست‌نخورده می‌مانند؛ فقط حافظهٔ مرورگر پاک می‌شود.'
      }),
      el('label.field', null, [
        el('span.field-label', { text: 'برای تأیید، واژهٔ «حذف» را تایپ کنید' }),
        confirmInput
      ])
    ]);

    var m;
    var go = el('button.btn.danger', {
      type: 'button', text: 'پاک کن و صفحه را تازه کن',
      onclick: function () {
        if (confirmInput.value.trim() !== 'حذف') {
          w.U.toast('برای تأیید، دقیقاً واژهٔ «حذف» را تایپ کنید.', 'bad');
          return;
        }
        go.textContent = 'در حال پاک کردن…';
        w.Store.wipeBrowser().then(function () {
          w.location.reload();
        });
      }
    });
    if (parentModal) parentModal.close();
    m = w.U.modal('پاک کردن کامل از مرورگر', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف',
        onclick: function () { m.close(); } }),
      go
    ]);
    setTimeout(function () { confirmInput.focus(); }, 50);
  }

  // ---------------------------------------------------------------- تنظیمات
  function listsEditor() {
    var lists = JSON.parse(JSON.stringify(M.state.lists));
    var wrap = el('div.lists-editor');
    var names = Object.keys(lists);
    var titleByList = {};
    M.FIELDS.forEach(function (f) {
      if (f.list) titleByList[f.list] = w.UIForm.cleanLabel(f.label);
    });
    titleByList.DocKinds = 'نوع سند (مستندات)';

    names.forEach(function (name) {
      var ta = el('textarea.input.area', {
        rows: Math.min(10, lists[name].length + 1),
        value: lists[name].join('\n')
      });
      ta.addEventListener('input', function () {
        lists[name] = ta.value.split('\n').map(function (s) { return s.trim(); })
          .filter(Boolean);
      });
      wrap.appendChild(el('div.list-block', null, [
        el('h4', { text: titleByList[name] || name }),
        el('p.muted.tiny', { text: 'هر گزینه در یک سطر' }),
        ta
      ]));
    });
    wrap.getLists = function () { return lists; };
    return wrap;
  }

  function settingsDialog(app) {
    var body = el('div.settings');
    var st = w.Store.status();

    var userInput = el('input.input', { type: 'text', value: M.state.settings.user || '' });
    var orgInput = el('input.input', {
      type: 'text', value: M.state.settings.orgName || 'کمیتهٔ انضباطی'
    });

    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'هویت' }),
      el('label.field', null, [
        el('span.field-label', { text: 'نام کاربر (در تاریخچهٔ تغییرات ثبت می‌شود)' }), userInput
      ]),
      el('label.field', null, [
        el('span.field-label', { text: 'عنوان سازمان (در سربرگ چاپ)' }), orgInput
      ])
    ]));

    var storageInfo = el('div.storage-info');
    function refreshStorage() {
      var s = w.Store.status();
      w.U.clear(storageInfo);
      storageInfo.appendChild(el('p', {
        text: 'انبار داده: ' + ({ idb: 'IndexedDB (پیشنهادی)',
          localStorage: 'localStorage (محدود)', memory: 'فقط حافظه — داده ذخیره نمی‌شود!' })[s.mode]
      }));
      // چرا «فایل را حذف کردم ولی داده‌ها هنوز هستند»
      storageInfo.appendChild(el('div.info-note', null, [
        el('b', { text: 'داده‌ها به مرورگر بسته‌اند، نه به فایل. ' }),
        el('span', {
          text: 'همهٔ صفحه‌هایی که با file:// باز می‌شوند یک «مبدأ» مشترک دارند، ' +
            'پس دیتابیس «' + w.Store.dbName() + '» در کروم می‌ماند. ' +
            'اگر این فایل را حذف کنید و نسخهٔ تازه‌ای بگذارید، همان داده‌های قبلی ' +
            'دوباره نشان داده می‌شوند. برای شروع واقعاً تازه، از دکمهٔ زیر استفاده کنید.'
        })
      ]));
      storageInfo.appendChild(el('p', {
        text: s.linked
          ? 'ذخیرهٔ خودکار روی فایل: ' + s.fileName +
            (s.lastSavedAt ? ' — آخرین ذخیره ' + J.stamp(s.lastSavedAt) : '')
          : (s.canLink
            ? 'هنوز به هیچ فایلی روی دیسک وصل نیست. توصیه می‌شود وصل کنید.'
            : (w.Mobile.isPhone()
              ? 'روی موبایل، مرورگر اجازهٔ نوشتن روی فایل دیسک را نمی‌دهد. ' +
                'داده‌ها در خود مرورگر می‌ماند؛ تنها راهِ بیرون بردن یا نگه‌داشتنش، ' +
                'گرفتن «نسخهٔ پشتیبان» است — و اگر داده‌های مرورگر پاک شود، ' +
                'بدون پشتیبان چیزی باقی نمی‌ماند.'
              : 'این مرورگر از ذخیرهٔ مستقیم روی فایل پشتیبانی نمی‌کند؛ از «نسخهٔ پشتیبان» استفاده کنید.'))
      }));
      if (!s.canLink) {
        storageInfo.appendChild(el('div.btn-row', null, [
          el('button.btn.small.primary', {
            type: 'button', text: 'گرفتن نسخهٔ پشتیبان', onclick: exportJson
          }),
          el('button.btn.small', {
            type: 'button', text: 'بازگرداندن از پشتیبان',
            onclick: function () { m.close(); restoreJson(app); }
          })
        ]));
      }
      if (s.canLink) {
        if (!s.linked && s.hasStored) {
          storageInfo.appendChild(el('button.btn.small.primary', {
            type: 'button', text: 'تأیید دسترسی به ' + s.storedName,
            onclick: function () {
              w.Store.relinkFile(true).then(function (ok) {
                if (ok) {
                  w.U.toast('دسترسی برقرار شد.', 'good');
                  w.Store.flushNow();
                } else {
                  w.U.toast('دسترسی داده نشد.', 'bad');
                }
                refreshStorage();
              });
            }
          }));
        }
        storageInfo.appendChild(el('button.btn.small', {
          type: 'button',
          text: s.linked ? 'تغییر فایل دیتابیس'
            : (s.hasStored ? 'انتخاب فایل دیگر' : 'اتصال به فایل دیتابیس'),
          onclick: function () {
            w.Store.linkFile().then(function () {
              w.U.toast('از این پس تغییرات خودکار روی فایل ذخیره می‌شود.', 'good');
              refreshStorage();
            }).catch(function (e) {
              if (e && e.name === 'AbortError') return;
              w.U.toast('اتصال ناموفق بود: ' + e.message, 'bad');
            });
          }
        }));
      }
    }
    refreshStorage();
    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'ذخیره‌سازی' }), storageInfo
    ]));

    // امنیت
    var secInfo = el('div.storage-info');
    function refreshSec() {
      var st = w.Store.status();
      w.U.clear(secInfo);
      if (!w.Vault.available()) {
        secInfo.appendChild(el('p', {
          text: 'این مرورگر از رمزنگاری پشتیبانی نمی‌کند.'
        }));
        return;
      }
      secInfo.appendChild(el('p', {
        text: st.encrypted
          ? 'رمز عبور فعال است. پرونده‌ها، تاریخچه و فهرست مستندات با AES-256 ' +
            'رمزنگاری شده‌اند و بدون رمز خوانده نمی‌شوند.'
          : 'رمزی تعیین نشده؛ هر کسی که این فایل را باز کند اطلاعات را می‌بیند.'
      }));
      secInfo.appendChild(el('div.btn-row', null, [
        el('button.btn.small' + (st.encrypted ? '' : '.primary'), {
          type: 'button', text: st.encrypted ? 'تغییر یا برداشتن رمز' : 'تعیین رمز عبور',
          onclick: function () {
            m.close();
            w.UILock.passwordDialog(app, function () { app.render(); });
          }
        }),
        st.encrypted ? el('button.btn.small.ghost', {
          type: 'button', text: 'قفل کردن همین حالا',
          onclick: function () { m.close(); app.lockNow(false); }
        }) : null
      ]));
      if (st.encrypted) {
        secInfo.appendChild(el('p.muted.tiny', {
          text: 'برنامه پس از ۱۵ دقیقه بی‌کاری خودکار قفل می‌شود. ' +
            'فایل‌های پیوست و خروجی اکسل رمز ندارند.'
        }));
      }
    }
    refreshSec();
    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'امنیت و رمز عبور' }), secInfo
    ]));

    // پوشهٔ مستندات
    var docsInfo = el('div.storage-info');
    function refreshDocs() {
      var ds = w.Docs.status();
      w.U.clear(docsInfo);
      if (!ds.supported) {
        docsInfo.appendChild(el('p', {
          text: 'این مرورگر از ذخیرهٔ مستندات در پوشه پشتیبانی نمی‌کند (فقط کروم و اج).'
        }));
        return;
      }
      docsInfo.appendChild(el('p', {
        text: ds.linked
          ? 'پوشهٔ مستندات: ' + ds.folderName +
            ' — برای هر پرونده یک زیرپوشه به نام «شمارهٔ پرونده - نام و نام خانوادگی» ساخته می‌شود.'
          : (ds.hasStored
            ? 'پوشهٔ «' + ds.storedName + '» انتخاب شده ولی مرورگر تأیید تازه می‌خواهد.'
            : 'هنوز پوشه‌ای انتخاب نشده است.')
      }));
      var st = w.Docs.stats();
      if (st.total) {
        docsInfo.appendChild(el('p.muted.tiny', {
          text: w.U.toFaDigits(st.total) + ' سند در ' +
            w.U.toFaDigits(st.casesWithDocs) + ' پرونده ثبت شده است.'
        }));
      }
      if (!ds.linked && ds.hasStored) {
        docsInfo.appendChild(el('button.btn.small.primary', {
          type: 'button', text: 'تأیید دسترسی به پوشهٔ ' + ds.storedName,
          onclick: function () {
            w.Docs.relinkFolder(true).then(function (ok) {
              w.U.toast(ok ? 'دسترسی برقرار شد.' : 'دسترسی داده نشد.', ok ? 'good' : 'bad');
              refreshDocs();
            });
          }
        }));
      }
      docsInfo.appendChild(el('button.btn.small', {
        type: 'button',
        text: ds.linked ? 'تغییر پوشهٔ مستندات'
          : (ds.hasStored ? 'انتخاب پوشهٔ دیگر' : 'انتخاب پوشهٔ مستندات'),
        onclick: function () {
          w.Docs.linkFolder().then(function () {
            w.U.toast('پوشهٔ مستندات وصل شد.', 'good');
            refreshDocs();
          }).catch(function (e) {
            if (e && e.name === 'AbortError') return;
            w.U.toast('اتصال پوشه ناموفق بود: ' + e.message, 'bad');
          });
        }
      }));
      if (ds.linked) {
        docsInfo.appendChild(el('button.btn.small.ghost', {
          type: 'button', text: 'قطع اتصال',
          onclick: function () {
            w.Docs.unlinkFolder().then(function () {
              w.U.toast('اتصال پوشه قطع شد؛ فایل‌ها سر جایشان هستند.', 'good');
              refreshDocs();
            });
          }
        }));
      }
    }
    refreshDocs();
    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'پوشهٔ مستندات' }), docsInfo
    ]));

    /* مهلت‌ها: همهٔ «دیرکرد»های کارتابل از همین عددها درمی‌آیند، پس باید
       قابل تنظیم باشند — وگرنه اگر همه‌چیز قرمز شود، قرمز معنایش را
       از دست می‌دهد و کارتابل به درد نمی‌خورد.
       فهرست مرحله‌ها از خود موتور گردش‌کار می‌آید، نه از یک کپی اینجا. */
    var SLA_LABELS = w.Worklist.SLA_LABELS;
    var slaInputs = {};
    var slaBox = el('div.sla-editor');
    var currentSla = w.Worklist.sla();
    Object.keys(SLA_LABELS).forEach(function (k) {
      var input = el('input.input.small.sla-input', {
        type: 'number', min: '1', max: '365', value: String(currentSla[k])
      });
      slaInputs[k] = input;
      slaBox.appendChild(el('label.sla-row', null, [
        el('span.sla-label', { text: SLA_LABELS[k] }),
        input,
        el('span.sla-unit', { text: 'روز' })
      ]));
    });
    slaBox.appendChild(el('button.btn.small.ghost', {
      type: 'button', text: 'بازگرداندن به مقدارهای پیش‌فرض',
      onclick: function () {
        Object.keys(SLA_LABELS).forEach(function (k) {
          slaInputs[k].value = String(w.Worklist.SLA[k]);
        });
      }
    }));

    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'مهلت اقدام‌ها' }),
      el('p.muted.tiny', {
        text: 'کارتابل از روی همین مهلت‌ها می‌گوید چه پرونده‌ای از مهلت گذشته. ' +
          'اگر با رویهٔ واقعی کمیته نمی‌خواند، همین‌جا عوضش کنید.'
      }),
      slaBox
    ]));

    /* سربرگ و فرم‌های اداری: چیزهایی که هر بار یکی‌اند و نباید هر بار
       پرسیده شوند — اندازهٔ سربرگ، امضاکننده، اعضای کمیته و رونوشت‌ها. */
    var lconf = w.UILetters.conf();
    var lInputs = {};
    function lField(key, label, hint, type) {
      var input = type === 'area'
        ? el('textarea.input.area', { rows: '3' })
        : el('input.input.small', { type: type || 'text' });
      input.value = type === 'lines' ? (lconf[key] || []).join('\n') : (lconf[key] || '');
      lInputs[key] = input;
      return el('label.field' + (type === 'area' || type === 'lines' ? '.wide' : ''), null, [
        el('span.field-label', { text: label, title: hint || '' }), input
      ]);
    }
    var ccInput = el('textarea.input.area', { rows: '5' });
    ccInput.value = (lconf.cc || []).join('\n');
    lInputs.cc = ccInput;

    var membersBox = el('div.members-editor');
    var memberInputs = [];
    (lconf.members || []).forEach(function (mb, i) {
      var name = el('input.input.small', { type: 'text', value: mb.name || '' });
      var role = el('input.input.small', { type: 'text', value: mb.role || '' });
      memberInputs.push({ name: name, role: role });
      membersBox.appendChild(el('div.member-row', null, [
        el('span.member-num', { text: w.U.toFaDigits(i + 1) }), name, role
      ]));
    });

    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'سربرگ و فرم‌های اداری' }),
      el('p.muted.tiny', {
        text: 'فرم تفهیم اتهام، رأی و ابلاغ روی سربرگ ساخته می‌شوند؛ دو ' +
          'اندازهٔ زیر خالی می‌ماند تا متن روی چاپِ سازمان نیفتد. هر دو را ' +
          'با خط‌کش از لبهٔ خودِ کاغذ اندازه بگیرید. بقیهٔ این‌ها هر بار ' +
          'یکسان‌اند و در فرم‌ها می‌نشینند.'
      }),
      el('div.letters-settings', null, [
        lField('letterheadTop', 'فاصله از بالای سربرگ (میلی‌متر)',
          'از لبهٔ بالای کاغذ تا جایی که چاپ سربرگ تمام می‌شود', 'number'),
        lField('letterheadRight', 'فاصله از سمت راست سربرگ (میلی‌متر)',
          'از لبهٔ راست کاغذ تا جایی که متن می‌تواند شروع شود', 'number'),
        lField('orgTitle', 'عنوان کمیته در سربرگ فرم‌ها'),
        lField('signerName', 'نام امضاکنندهٔ نامهٔ ابلاغ'),
        lField('signerRole', 'سمت امضاکننده'),
        lField('preparedBy', 'تهیه‌کننده (پای نامهٔ ابلاغ)')
      ]),
      el('div.field.wide', null, [
        el('span.field-label', { text: 'اعضای کمیته (نام و سمت) — پای فرم رأی' }),
        membersBox
      ]),
      el('div.field.wide', null, [
        el('span.field-label', { text: 'رونوشت‌های نامهٔ ابلاغ — هر سطر یک مورد' }),
        ccInput
      ])
    ]));

    var editor = listsEditor();
    body.appendChild(el('section.set-block', null, [
      el('h4', { text: 'لیست‌های کشویی' }), editor
    ]));

    body.appendChild(el('section.set-block.danger-zone', null, [
      el('h4', { text: 'داده‌ها' }),
      el('div.btn-row', null, [
        el('button.btn.small', {
          type: 'button', text: 'ورود از فایل اکسل',
          onclick: function () { m.close(); importExcel(app); }
        }),
        el('button.btn.small', {
          type: 'button', text: 'ذخیرهٔ نسخهٔ پشتیبان (JSON)',
          onclick: exportJson
        }),
        el('button.btn.small.ghost', {
          type: 'button', text: 'بازیابی از نسخهٔ پشتیبان',
          onclick: function () { m.close(); restoreJson(app); }
        }),
        el('button.btn.small.ghost.danger', {
          type: 'button', text: 'حذف پرونده‌ها',
          title: 'پرونده‌ها و تاریخچه پاک می‌شوند؛ تنظیمات و رمز می‌مانند',
          onclick: function () {
            w.U.confirmBox('حذف همهٔ پرونده‌ها',
              'تمام پرونده‌ها و تاریخچه پاک می‌شود. تنظیمات، لیست‌ها و رمز عبور ' +
              'دست‌نخورده می‌مانند. پیش از این کار حتماً نسخهٔ پشتیبان بگیرید.',
              'پرونده‌ها را حذف کن').then(function (ok) {
                if (!ok) return;
                w.Store.clearAll().then(function () { return M.reload(); }).then(function () {
                  m.close();
                  w.U.toast('همهٔ پرونده‌ها حذف شد.', 'good');
                  app.goList();
                });
              });
          }
        }),
        el('button.btn.small.danger', {
          type: 'button', text: 'پاک کردن کامل از مرورگر',
          title: 'حذف خودِ دیتابیس؛ برای شروع واقعاً تازه',
          onclick: function () { wipeDialog(app, m); }
        })
      ])
    ]));

    var m = w.U.modal('تنظیمات', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      el('button.btn.primary', {
        type: 'button', text: 'ذخیرهٔ تنظیمات',
        onclick: function () {
          var sla = {};
          Object.keys(slaInputs).forEach(function (k) {
            var v = parseInt(w.U.toLatinDigits(slaInputs[k].value), 10);
            sla[k] = (isFinite(v) && v > 0) ? Math.min(v, 365) : w.Worklist.SLA[k];
          });
          var mmOf = function (key, max) {
            var v = parseInt(w.U.toLatinDigits(lInputs[key].value), 10);
            return (isFinite(v) && v >= 0) ? Math.min(v, max)
              : w.UILetters.DEFAULTS[key];
          };
          w.UILetters.saveConf({
            letterheadTop: mmOf('letterheadTop', 120),
            letterheadRight: mmOf('letterheadRight', 80),
            orgTitle: lInputs.orgTitle.value.trim(),
            signerName: lInputs.signerName.value.trim(),
            signerRole: lInputs.signerRole.value.trim(),
            preparedBy: lInputs.preparedBy.value.trim(),
            members: memberInputs.map(function (mi) {
              return { name: mi.name.value.trim(), role: mi.role.value.trim() };
            }),
            cc: ccInput.value.split('\n').map(function (t) { return t.trim(); })
              .filter(Boolean)
          });
          M.saveSettings({
            user: userInput.value.trim(), orgName: orgInput.value.trim(), sla: sla
          });
          M.saveLists(editor.getLists()).then(function () {
            m.close();
            w.U.toast('تنظیمات ذخیره شد.', 'good');
            app.refresh();
          });
        }
      })
    ]);
  }

  w.UIMisc = {
    statsPanel: statsPanel, columnsDialog: columnsDialog, exportExcel: exportExcel,
    exportSqlite: exportSqlite, exportJson: exportJson, restoreJson: restoreJson,
    exportReportExcel: exportReportExcel,
    importExcel: importExcel, settingsDialog: settingsDialog, mapColumns: mapColumns,
    importDialog: importDialog, wipeDialog: wipeDialog
  };
})(window);

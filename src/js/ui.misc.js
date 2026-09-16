/* پنل آمار، ستون‌ها، خروجی‌ها، پشتیبان‌گیری، ورود از اکسل و تنظیمات */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

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

  function exportJson() {
    var blob = new Blob([JSON.stringify(w.Store.snapshot(), null, 1)],
      { type: 'application/json' });
    w.U.download('parvandeha-backup-' + J.today() + '.json', blob);
    M.saveSettings({ changesSinceBackup: 0 });
    w.U.toast('نسخهٔ پشتیبان ذخیره شد.', 'good');
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
            return w.Store.restore(JSON.parse(text));
          }).then(function () {
            return M.reload();
          }).then(function () {
            w.U.toast('داده‌ها بازیابی شد.', 'good');
            app.goList();
          });
        });
    }).catch(function (e) {
      w.U.toast('بازیابی ناموفق بود: ' + e.message, 'bad');
    });
  }

  function importExcel(app) {
    pickFile('.xlsx').then(function (file) {
      if (!file) return;
      return file.arrayBuffer().then(w.XLSX.read).then(function (rows) {
        if (!rows.length) throw new Error('فایل خالی است');
        var header = rows[0].map(function (h) { return w.U.normalize(h); });
        var map = {};
        M.FIELDS.forEach(function (f) {
          var i = header.indexOf(w.U.normalize(f.label));
          if (i < 0) i = header.indexOf(w.U.normalize(w.UIForm.cleanLabel(f.label)));
          if (i >= 0) map[f.key] = i;
        });
        var known = Object.keys(map).length;
        if (!map.caseNo) throw new Error('ستون «شماره پرونده» در فایل پیدا نشد');
        var records = rows.slice(1).map(function (r) {
          var rec = {};
          Object.keys(map).forEach(function (k) {
            var v = r[map[k]];
            if (v != null && String(v).trim() !== '') rec[k] = String(v).trim();
          });
          return rec;
        }).filter(function (r) { return r.caseNo; });

        return w.U.confirmBox('ورود از اکسل',
          w.U.toFaDigits(records.length) + ' ردیف و ' + w.U.toFaDigits(known) +
          ' ستون شناسایی شد. پرونده‌های با شمارهٔ تکراری به‌روزرسانی می‌شوند و تغییرشان ' +
          'در تاریخچه ثبت می‌شود. ادامه می‌دهید؟', 'وارد کن')
          .then(function (ok) {
            if (!ok) return;
            return M.bulkImport(records).then(function (res) {
              w.U.toast(w.U.toFaDigits(res.added) + ' پروندهٔ جدید و ' +
                w.U.toFaDigits(res.updated) + ' به‌روزرسانی انجام شد.', 'good');
              app.goList();
            });
          });
      });
    }).catch(function (e) {
      w.U.toast('ورود از اکسل ناموفق بود: ' + e.message, 'bad');
    });
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
      storageInfo.appendChild(el('p', {
        text: s.linked
          ? 'ذخیرهٔ خودکار روی فایل: ' + s.fileName +
            (s.lastSavedAt ? ' — آخرین ذخیره ' + J.stamp(s.lastSavedAt) : '')
          : (s.canLink
            ? 'هنوز به هیچ فایلی روی دیسک وصل نیست. توصیه می‌شود وصل کنید.'
            : 'این مرورگر از ذخیرهٔ مستقیم روی فایل پشتیبانی نمی‌کند؛ از «نسخهٔ پشتیبان» استفاده کنید.')
      }));
      if (s.canLink) {
        storageInfo.appendChild(el('button.btn.small', {
          type: 'button', text: s.linked ? 'تغییر فایل دیتابیس' : 'اتصال به فایل دیتابیس',
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
          type: 'button', text: 'حذف همهٔ داده‌ها',
          onclick: function () {
            w.U.confirmBox('حذف همهٔ داده‌ها',
              'تمام پرونده‌ها و تاریخچه پاک می‌شود. پیش از این کار حتماً نسخهٔ پشتیبان بگیرید.',
              'همه را حذف کن').then(function (ok) {
                if (!ok) return;
                w.Store.clearAll().then(function () { return M.reload(); }).then(function () {
                  m.close();
                  w.U.toast('همهٔ داده‌ها حذف شد.', 'good');
                  app.goList();
                });
              });
          }
        })
      ])
    ]));

    var m = w.U.modal('تنظیمات', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      el('button.btn.primary', {
        type: 'button', text: 'ذخیرهٔ تنظیمات',
        onclick: function () {
          M.saveSettings({ user: userInput.value.trim(), orgName: orgInput.value.trim() });
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
    importExcel: importExcel, settingsDialog: settingsDialog
  };
})(window);

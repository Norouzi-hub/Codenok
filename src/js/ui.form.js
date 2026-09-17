/* نمای پرونده: فرم چندمرحله‌ای، تاریخچه و پرونده‌های مرتبط */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model;

  var PERSON_COPY = ['nationalId', 'firstName', 'lastName', 'fatherName', 'idNumber',
    'personnelCode', 'gender', 'maritalStatus', 'education', 'phone', 'postTitle',
    'jobTitle', 'jobGrade', 'jobNature', 'payrollPlace', 'orgUnit', 'servicePlace',
    'servicePlaceType', 'contractType', 'employmentStatus'];

  /* فیلدهایی که «شناسه»‌اند نه متن؛ با قلم داده خوانده و مقایسه می‌شوند */
  var REGISTER_FIELDS = {
    caseNo: 1, letterNo: 1, committeeRegNo: 1, noticeLetterNo: 1,
    invitationLetterNo: 1, securityOutLetterNo: 1, securityInLetterNo: 1,
    nationalId: 1, personnelCode: 1, idNumber: 1, phone: 1
  };

  function cleanLabel(label) {
    return String(label).replace(/\(\d[^)]*\)/g, '').replace(/\*/g, '').trim();
  }

  function makeInput(field, value, onChange, app) {
    if (field.type === 'date') {
      return w.DatePicker.field(value, onChange);
    }
    if (field.type === 'textarea') {
      var ta = el('textarea.input.area', { rows: 3, value: value || '' });
      ta.addEventListener('input', function () { onChange(ta.value); });
      return ta;
    }
    if (field.type === 'select') {
      var sel = el('select.input');
      var options = M.optionsFor(field);
      sel.appendChild(el('option', { value: '', text: '— انتخاب کنید —' }));
      options.forEach(function (o) {
        sel.appendChild(el('option', { value: o, text: o, selected: o === value }));
      });
      if (value && options.indexOf(value) < 0) {
        sel.appendChild(el('option', { value: value, text: value, selected: true }));
      }
      sel.appendChild(el('option', { value: '__new__', text: '＋ افزودن گزینهٔ جدید…' }));
      sel.value = value || '';
      sel.addEventListener('change', function () {
        if (sel.value === '__new__') {
          var v = window.prompt('گزینهٔ جدید برای «' + cleanLabel(field.label) + '»:', '');
          v = (v || '').trim();
          if (!v) { sel.value = value || ''; return; }
          var lists = M.state.lists;
          lists[field.list] = (lists[field.list] || []).concat([v]);
          M.saveLists(lists);
          sel.insertBefore(el('option', { value: v, text: v }), sel.lastChild);
          sel.value = v;
        }
        value = sel.value;
        onChange(sel.value);
      });
      return sel;
    }

    // متنی: با تکمیل خودکار از مقادیر موجود
    var listId = 'dl-' + field.key;
    var input = el('input.input' + (REGISTER_FIELDS[field.key] ? '.reg-input' : ''), {
      type: field.type === 'tel' ? 'tel' : 'text',
      value: value || '', autocomplete: 'off', list: listId,
      inputmode: field.type === 'tel' ? 'tel' : undefined
    });
    input.addEventListener('input', function () { onChange(input.value); });
    var wrap = el('span.input-wrap', null, [input]);
    var suggestions = M.distinct(field.key);
    if (suggestions.length > 1 && suggestions.length < 400) {
      wrap.appendChild(el('datalist', { id: listId }, suggestions.map(function (s) {
        return el('option', { value: s });
      })));
    }
    if (field.key === 'nationalId' && app) {
      input.addEventListener('change', function () { app.checkPerson(); });
    }
    if (field.key === 'caseNo' && app) {
      input.addEventListener('change', function () { app.checkDuplicate(); });
    }
    return wrap;
  }

  var KIND_LABELS = {
    create: 'ثبت پرونده', update: 'ویرایش', delete: 'حذف',
    import: 'ورود از فایل', restore: 'بازیابی پشتیبان',
    'doc-add': 'افزودن سند', 'doc-version': 'نسخهٔ تازهٔ سند',
    'doc-remove': 'حذف سند', 'doc-folder': 'تغییر پوشهٔ مستندات',
    'doc-person': 'مدرک شخص', 'note-add': 'یادداشت', 'note-done': 'پیگیری انجام شد',
    'note-remove': 'حذف یادداشت', 'bulk': 'اقدام دسته‌ای', 'session': 'صورت‌جلسه'
  };

  function kindLabel(kind) {
    return KIND_LABELS[kind] || kind;
  }

  function renderTimeline(rec) {
    var items = M.timelineFor(rec);
    if (!items.length) return el('p.muted', { text: 'هنوز رویدادی ثبت نشده است.' });
    var box = el('ol.timeline');
    items.forEach(function (it) {
      if (it.type === 'milestone') {
        box.appendChild(el('li.tl-item.tl-milestone', null, [
          el('span.tl-date', { text: J.format(it.date) }),
          el('span.tl-body', null, [el('b', { text: it.label })])
        ]));
        return;
      }
      if (it.type === 'doc') {
        var d = it.doc;
        box.appendChild(el('li.tl-item.tl-doc', null, [
          el('span.tl-date', { text: J.format(it.date) }),
          el('span.tl-body', null, [
            el('span.doc-icon', { text: w.UIDocs.iconFor(d.fileName) }),
            el('b', { text: d.kind }),
            el('span.muted', {
              text: ' — ' + (d.title || d.letterNo || d.originalName || d.fileName) + ' '
            }),
            el('button.linkish', {
              type: 'button', text: 'باز کردن',
              onclick: function () {
                w.Docs.openDoc(d).catch(function (e) { w.U.toast(e.message, 'bad'); });
              }
            })
          ])
        ]));
        return;
      }
      var h = it.entry;
      var lines = el('div.tl-changes');
      (h.changes || []).forEach(function (ch) {
        lines.appendChild(el('div.tl-change', null, [
          el('span.tl-field', { text: cleanLabel(ch.label) + ': ' }),
          ch.from ? el('span.tl-from', { text: ch.from }) : el('span.tl-empty', { text: '(خالی)' }),
          el('span.tl-arrow', { text: ' ← ' }),
          ch.to ? el('span.tl-to', { text: ch.to }) : el('span.tl-empty', { text: '(خالی)' })
        ]));
      });
      box.appendChild(el('li.tl-item.tl-history', null, [
        el('span.tl-date', { text: h.atJalali }),
        el('span.tl-body', null, [
          el('div.tl-head', null, [
            el('b', { text: kindLabel(h.kind) }),
            el('span.muted', { text: ' — ' + (h.user || 'کاربر') }),
            h.note ? el('span.muted', { text: ' • ' + h.note }) : null
          ]),
          (h.changes && h.changes.length) ? lines : null
        ])
      ]));
    });
    return box;
  }

  var RELATED_LIMIT = 25;

  function renderRelated(app, rec) {
    var related = M.relatedCases(rec);
    if (!related.length) return null;
    var shown = related.slice(0, RELATED_LIMIT);
    var list = el('ul.related-list', null, shown.map(function (r) {
      return el('li', null, [
        el('a', {
          href: '#', text: 'پروندهٔ ' + w.U.toFaDigits(r.caseNo || '—'),
          onclick: function (e) { e.preventDefault(); app.openCase(r.id); }
        }),
        el('span.muted', {
          text: ' — ' + (r.status || 'بدون وضعیت') +
            (r.intakeDate ? ' • ورود ' + J.format(r.intakeDate) : '')
        })
      ]);
    }).concat(related.length > RELATED_LIMIT ? [
      el('li.muted', {
        text: 'و ' + w.U.toFaDigits(related.length - RELATED_LIMIT) + ' پروندهٔ دیگر…'
      })
    ] : []));

    // وقتی تعداد زیاد است، جمع‌شده نمایش داده می‌شود تا تایم‌لاین پنهان نشود
    var box = el('details.related', { open: related.length <= 5 });
    box.appendChild(el('summary', null, [
      el('b', { text: 'پرونده‌های دیگر همین فرد' }),
      el('span.badge', { text: w.U.toFaDigits(related.length) })
    ]));
    box.appendChild(list);
    return box;
  }

  /**
   * ساخت نمای پرونده.
   * app: شیء برنامه، id: شناسهٔ پرونده یا null برای پروندهٔ جدید.
   */
  function render(app, mount, id) {
    var existing = id ? M.get(id) : null;
    var draft = existing ? JSON.parse(JSON.stringify(M.strip(existing))) : {};
    var dirty = false;
    var activeTab = app.state.formTab || w.GROUPS[0].key;

    var saveBtn, warnBox, headTitle;

    function markDirty() {
      if (dirty) return;
      dirty = true;
      app.setDirty(true);
      saveBtn.classList.add('primary');
      saveBtn.textContent = 'ذخیرهٔ تغییرات *';
    }

    function setField(key, value) {
      if (value === '') delete draft[key]; else draft[key] = value;
      markDirty();
      if (key === 'firstName' || key === 'lastName' || key === 'caseNo') updateTitle();
    }

    function updateTitle() {
      var name = [draft.firstName, draft.lastName].filter(Boolean).join(' ');
      w.U.clear(headTitle);
      if (draft.caseNo) {
        headTitle.appendChild(document.createTextNode('پروندهٔ '));
        headTitle.appendChild(el('span.reg-no', {
          text: w.U.toLatinDigits(draft.caseNo)
        }));
      } else {
        headTitle.appendChild(document.createTextNode('پروندهٔ جدید'));
      }
      if (name) headTitle.appendChild(document.createTextNode(' — ' + name));
    }

    function warn(node) {
      w.U.clear(warnBox);
      if (node) warnBox.appendChild(node);
      warnBox.style.display = node ? 'block' : 'none';
    }

    app.checkDuplicate = function () {
      var dup = M.duplicateCaseNo(draft.caseNo, id);
      if (!dup) { warn(null); return; }
      warn(el('div.warn', null, [
        el('span', { text: 'شمارهٔ پرونده تکراری است؛ پروندهٔ دیگری با همین شماره ثبت شده. ' }),
        el('a', {
          href: '#', text: 'مشاهدهٔ آن پرونده',
          onclick: function (e) { e.preventDefault(); app.openCase(dup.id); }
        })
      ]));
    };

    app.checkPerson = function () {
      if (!draft.nationalId) return;
      var prior = M.state.cases.filter(function (c) {
        return c.id !== id && c.nationalId === draft.nationalId;
      });
      if (!prior.length) return;
      var src = prior[prior.length - 1];
      warn(el('div.warn.info', null, [
        el('span', {
          text: 'این کد ملی در ' + w.U.toFaDigits(prior.length) + ' پروندهٔ دیگر ثبت شده است. '
        }),
        el('button.btn.small', {
          type: 'button', text: 'پر کردن مشخصات از پروندهٔ قبلی',
          onclick: function () {
            PERSON_COPY.forEach(function (k) {
              if (!draft[k] && src[k]) draft[k] = src[k];
            });
            markDirty();
            app.state.formTab = activeTab;
            app.render();
          }
        })
      ]));
    };

    function collect() { return draft; }

    function doSave() {
      var data = collect();
      if (!data.caseNo) {
        w.U.toast('شمارهٔ پرونده الزامی است.', 'bad');
        app.state.formTab = 'case';
        app.render();
        return;
      }
      // جلوی ساخته شدن نسخهٔ تکراری از یک پرونده گرفته می‌شود
      var dup = M.duplicateCaseNo(data.caseNo, existing ? existing.id : null);
      if (dup) {
        var name = [dup.firstName, dup.lastName].filter(Boolean).join(' ');
        w.U.confirmBox('شمارهٔ پرونده تکراری است',
          'پروندهٔ ' + w.U.toFaDigits(dup.caseNo) +
          (name ? ' («' + name + '»)' : '') + ' از قبل ثبت شده است. ' +
          'اگر واقعاً پروندهٔ جداگانه‌ای است، شماره را یکتا کنید (مثلاً ' +
          w.U.toFaDigits(dup.caseNo) + '/۲). باز هم ذخیره شود؟',
          'باز هم ذخیره کن').then(function (ok) {
            if (ok) persist(data);
          });
        return;
      }
      persist(data);
    }

    function persist(data) {
      var p = existing ? M.update(existing.id, data) : M.create(data);
      p.then(function (res) {
        dirty = false;
        app.setDirty(false);
        var rec = res.record || res;
        var n = res.changes ? res.changes.length : 0;
        w.U.toast(existing
          ? (n ? w.U.toFaDigits(n) + ' تغییر ثبت و در تاریخچه درج شد.' : 'تغییری برای ذخیره نبود.')
          : 'پرونده ثبت شد.', 'good');
        app.state.formTab = activeTab;
        app.openCase(rec.id);
      }).catch(function (err) {
        w.U.toast('ذخیره ناموفق بود: ' + err.message, 'bad');
      });
    }

    app.saveCurrentForm = doSave;

    // ---------------------------------------------------------------- ساخت DOM
    headTitle = el('h2.case-title');

    var tabs = el('div.tabs');

    function makeTab(key, label, count) {
      var tab = el('button.tab' + (key === activeTab ? '.active' : ''), {
        type: 'button',
        onclick: function () {
          activeTab = key;
          app.state.formTab = key;
          renderPanel();
          w.U.$$('.tab', tabs).forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
        }
      }, [
        el('span', { text: label }),
        count ? el('span.badge', { text: w.U.toFaDigits(count) }) : null
      ]);
      tab.dataset.tab = key;
      tabs.appendChild(tab);
      return tab;
    }

    w.GROUPS.forEach(function (g) {
      makeTab(g.key, g.label, M.FIELDS.filter(function (f) {
        return f.group === g.key && draft[f.key];
      }).length);
    });
    makeTab('__notes', 'یادداشت و پیگیری',
      existing ? w.Notes.forCase(existing.id).filter(function (n) {
        return !n.done;
      }).length : 0);
    makeTab('__docs', 'مستندات',
      existing ? w.Docs.current(existing.id).length : 0);
    makeTab('__history', 'تاریخچه و رویدادها',
      existing ? M.historyFor(existing.id).length : 0);

    /** شمارندهٔ یک تب را بدون رندر دوبارهٔ کل صفحه به‌روز می‌کند */
    function setTabCount(key, n) {
      var tab = tabs.querySelector('[data-tab="' + key + '"]');
      if (!tab) return;
      var badge = tab.querySelector('.badge');
      if (n) {
        if (badge) badge.textContent = w.U.toFaDigits(n);
        else tab.appendChild(el('span.badge', { text: w.U.toFaDigits(n) }));
      } else if (badge) {
        badge.remove();
      }
    }

    var panel = el('div.form-panel');

    function renderPanel() {
      w.U.clear(panel);
      if (activeTab === '__notes') {
        panel.appendChild(w.UINotes.render(app, existing, function () {
          renderPanel();
          if (existing) {
            setTabCount('__notes', w.Notes.forCase(existing.id).filter(function (n) {
              return !n.done;
            }).length);
          }
        }));
        return;
      }
      if (activeTab === '__docs') {
        panel.appendChild(w.UIDocs.render(app, existing, function () {
          renderPanel();
          if (existing) setTabCount('__docs', w.Docs.current(existing.id).length);
        }));
        return;
      }
      if (activeTab === '__history') {
        if (!existing) {
          panel.appendChild(el('p.muted', { text: 'پس از ذخیرهٔ پرونده، تاریخچه اینجا نمایش داده می‌شود.' }));
          return;
        }
        panel.appendChild(el('div.history-wrap', null, [
          renderRelated(app, existing),
          el('h4', { text: 'گردش‌کار و تغییرات' }),
          renderTimeline(existing)
        ]));

        return;
      }
      var fields = M.FIELDS.filter(function (f) { return f.group === activeTab; });
      var grid = el('div.field-grid');
      fields.forEach(function (f) {
        var input = makeInput(f, draft[f.key] || '', function (v) { setField(f.key, v); }, app);
        grid.appendChild(el('label.field' + (f.type === 'textarea' ? '.wide' : ''), null, [
          el('span.field-label', { text: cleanLabel(f.label), title: f.label }),
          input
        ]));
      });
      panel.appendChild(grid);
    }

    warnBox = el('div.warn-box');
    warnBox.style.display = 'none';

    saveBtn = el('button.btn', { type: 'button', text: 'ذخیرهٔ تغییرات', onclick: doSave });

    var actions = el('div.case-actions', null, [
      el('button.btn.ghost', {
        type: 'button', text: '← بازگشت به فهرست',
        onclick: function () { app.goList(); }
      }),
      el('div.spacer'),
      existing ? el('button.btn.ghost', {
        type: 'button', text: 'چاپ برگ پرونده',
        onclick: function () { w.UIPrint.printCase(existing); }
      }) : null,
      existing ? el('button.btn.ghost.danger', {
        type: 'button', text: 'حذف پرونده',
        onclick: function () {
          w.U.confirmBox('حذف پرونده',
            'پروندهٔ ' + (existing.caseNo || '') + ' حذف شود؟ رکورد حذف در تاریخچه باقی می‌ماند.',
            'حذف کن').then(function (ok) {
              if (!ok) return;
              M.remove(existing.id).then(function () {
                app.setDirty(false);
                w.U.toast('پرونده حذف شد.', 'good');
                app.goList();
              });
            });
        }
      }) : null,
      saveBtn
    ]);

    /** ریل گردش‌کار و اقدام بعدی — فقط برای پروندهٔ ذخیره‌شده معنا دارد */
    function railCard() {
      if (!existing) return null;
      var action = w.Worklist.nextAction(existing);
      var next = null;
      if (action.key !== 'closed') {
        var meta = [];
        if (action.days != null) meta.push('از ' + w.U.toFaDigits(action.days) + ' روز پیش');
        if (action.limit != null) {
          meta.push(action.overdue
            ? w.U.toFaDigits(action.days - action.limit) + ' روز بیش از مهلت'
            : w.U.toFaDigits(action.limit - action.days) + ' روز تا پایان مهلت');
        }
        if (action.owner && action.owner !== '—') meta.push('مسئول: ' + action.owner);
        next = el('div.case-next' + (action.overdue ? '.late' : ''), null, [
          el('span.case-next-label', { text: action.label }),
          el('span.case-next-meta', { text: meta.join(' • ') })
        ]);
      } else {
        // مختومه‌ای که مرحله‌هایش ناقص مانده، یعنی ثبت کار عقب است
        var missing = w.Worklist.stages(existing).filter(function (st) {
          return !st.done && !st.optional;
        });
        next = el('div.case-next', null, [
          el('span.case-next-label', { text: 'مختومه' }),
          el('span.case-next-meta', {
            text: missing.length
              ? 'مختومه ثبت شده، ولی ' +
                missing.map(function (st) { return st.label; }).join(' و ') +
                ' در پرونده ثبت نشده است.'
              : 'اقدام بازی روی این پرونده نمانده است.'
          })
        ]);
      }
      // پیگیری دستی، اگر گذاشته شده، کنار اقدام خودکار می‌آید
      var followUp = w.Notes.openFollowUp(existing.id);
      var followNode = null;
      if (followUp) {
        var late = J.diffDays(J.today(), followUp.followUp) > 0;
        followNode = el('div.case-next.follow' + (late ? '.late' : ''), null, [
          el('span.case-next-label', {
            text: 'پیگیری ' + J.format(followUp.followUp)
          }),
          el('span.case-next-meta', {
            text: w.Notes.preview(followUp.text) + ' • ' +
              w.UINotes.relativeDay(followUp.followUp)
          }),
          el('div.spacer'),
          el('button.btn.small', {
            type: 'button', text: 'انجام شد',
            onclick: function () {
              w.Notes.complete(followUp).then(function () {
                app.state.formTab = activeTab;
                app.render();
              });
            }
          })
        ]);
      }
      return el('div.case-rail', null, [
        w.UIWorklist.rail(existing, 'full'),
        next,
        followNode
      ]);
    }

    w.U.clear(mount);
    mount.appendChild(el('div.case-view', null, [
      el('div.case-head', null, [headTitle, actions]),
      railCard(),
      warnBox, tabs, panel
    ]));

    updateTitle();
    renderPanel();
    if (!existing) {
      setTimeout(function () {
        var first = mount.querySelector('.field-grid input');
        if (first) first.focus();
      }, 30);
    }
  }

  w.UIForm = { render: render, cleanLabel: cleanLabel, kindLabel: kindLabel };
})(window);

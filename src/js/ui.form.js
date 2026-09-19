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

  /**
   * رفتن به پروندهٔ بعدی/قبلیِ همین نتیجهٔ جستجو.
   * کار دبیرخانه اغلب «یکی‌یکی رد کردن یک فهرست» است؛ بدون این، برای هر
   * پرونده باید به فهرست برگشت و دوباره جای خود را پیدا کرد.
   */
  function neighbourNav(app, existing) {
    if (!existing) return null;
    var list = app.state.lastResult || [];
    var i = -1;
    for (var k = 0; k < list.length; k++) {
      if (list[k].id === existing.id) { i = k; break; }
    }
    if (i < 0 || list.length < 2) return null;

    function go(step) {
      var t = list[i + step];
      if (t) app.openCase(t.id);
    }
    // در RTL، «بعدی» سمت چپ است و «قبلی» سمت راست
    return el('div.case-nav', null, [
      el('button.icon-btn.case-nav-btn', {
        type: 'button', text: '›', disabled: i === 0,
        title: 'پروندهٔ قبلی در همین فهرست',
        'aria-label': 'پروندهٔ قبلی',
        onclick: function () { go(-1); }
      }),
      el('span.case-nav-pos', {
        text: w.U.toFaDigits(i + 1) + ' از ' + w.U.toFaDigits(list.length)
      }),
      el('button.icon-btn.case-nav-btn', {
        type: 'button', text: '‹', disabled: i === list.length - 1,
        title: 'پروندهٔ بعدی در همین فهرست',
        'aria-label': 'پروندهٔ بعدی',
        onclick: function () { go(1); }
      })
    ]);
  }

  /**
   * تب‌های فرم. یک تب می‌تواند چند گروه فیلد را کنار هم بگذارد — «پرونده و
   * شخص» سه بخش دارد ولی یک تب است، چون در عمل هر سه را با هم پر می‌کنید.
   */
  var FORM_TABS = [
    { key: 'case', label: 'پرونده و شخص', groups: ['case', 'person', 'job'] },
    { key: 'defense', label: 'دعوت، دفاعیات و استعلام', groups: ['defense'] },
    { key: 'verdict', label: 'جلسه و رأی', groups: ['verdict'] },
    { key: 'enforce', label: 'ابلاغ، نتیجه و بایگانی', groups: ['enforce'] },
    { key: 'violation', label: 'دسته‌بندی تخلف و توضیحات', groups: ['violation'] }
  ];

  var GROUP_LABEL = {};
  (w.GROUPS || []).forEach(function (g) { GROUP_LABEL[g.key] = g.label; });

  function tabOf(groupKey) {
    var found = FORM_TABS[0];
    FORM_TABS.forEach(function (t) {
      if (t.groups.indexOf(groupKey) >= 0) found = t;
    });
    return found;
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
            el('span.doc-icon', { html: w.UIDocs.iconFor(d.fileName) }),
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

    var saveBtn, warnBox, headTitle, dirtyChip;

    function markDirty() {
      if (dirty) return;
      dirty = true;
      app.setDirty(true);
      saveBtn.classList.add('primary');
      saveBtn.disabled = false;
      if (dirtyChip) dirtyChip.style.display = '';
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
        app.state.formTab = tabOf('case').key;
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

    FORM_TABS.forEach(function (t) {
      makeTab(t.key, t.label, M.FIELDS.filter(function (f) {
        return t.groups.indexOf(f.group) >= 0 && draft[f.key];
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
      var tab = null;
      FORM_TABS.forEach(function (t) { if (t.key === activeTab) tab = t; });
      if (!tab) tab = FORM_TABS[0];
      var many = tab.groups.length > 1;

      tab.groups.forEach(function (gk) {
        var fields = M.FIELDS.filter(function (f) { return f.group === gk; });
        if (!fields.length) return;
        // وقتی چند گروه در یک تب‌اند، هرکدام سربرگ خودش را دارد
        if (many) {
          var filled = fields.filter(function (f) { return draft[f.key]; }).length;
          panel.appendChild(el('div.form-section-head', null, [
            el('h4', { text: GROUP_LABEL[gk] || gk }),
            el('span.form-section-count', {
              text: w.U.toFaDigits(filled) + ' از ' + w.U.toFaDigits(fields.length) + ' پرشده'
            })
          ]));
        }
        var grid = el('div.field-grid');
        fields.forEach(function (f) {
          var input = makeInput(f, draft[f.key] || '',
            function (v) { setField(f.key, v); }, app);
          grid.appendChild(el('label.field' + (f.type === 'textarea' ? '.wide' : ''),
            { 'data-field': f.key }, [
              el('span.field-label', { text: cleanLabel(f.label), title: f.label }),
              input
            ]));
        });
        panel.appendChild(grid);
      });
    }

    /**
     * رفتن به یک فیلد مشخص: تبِ درست را باز می‌کند، صفحه را تا آن فیلد
     * می‌برد و یک لحظه روشنش می‌کند. آلارم‌های «تاریخ فلان را ثبت کنید»
     * از همین استفاده می‌کنند تا کاربر دنبال فیلد نگردد.
     */
    function jumpToField(key) {
      var field = null;
      M.FIELDS.forEach(function (f) { if (f.key === key) field = f; });
      if (!field) return;
      var target = tabOf(field.group);
      if (target.key !== activeTab) {
        activeTab = target.key;
        app.state.formTab = activeTab;
        w.U.$$('.tab', tabs).forEach(function (t) {
          t.classList.toggle('active', t.dataset.tab === activeTab);
        });
        renderPanel();
      }
      setTimeout(function () {
        var node = panel.querySelector('[data-field="' + key + '"]');
        if (!node) return;
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        node.classList.add('field-flash');
        setTimeout(function () { node.classList.remove('field-flash'); }, 1400);
        var input = node.querySelector('input, select, textarea, button');
        if (input) input.focus({ preventScroll: true });
      }, 60);
    }

    /** دکمهٔ آلارم: همان کاری که اقدام بعدی می‌خواهد، با یک کلیک */
    function ctaButton(action) {
      var c = w.Worklist.cta(action);
      if (!c || !existing) return null;
      return el('button.btn.small.primary.case-cta', {
        type: 'button', text: c.label,
        title: 'همین‌جا انجامش بدهید',
        onclick: function () {
          if (c.type === 'upload') {
            w.UIDocs.addFrom(existing, function () {
              app.state.formTab = activeTab;
              app.render();
            }, { kind: c.kind });
          } else if (c.type === 'form') {
            var form = null;
            w.UILetters.FORMS.forEach(function (f) { if (f.key === c.form) form = f; });
            if (form) w.UILetters.formDialog(app, existing, form);
          } else {
            jumpToField(c.field);
          }
        }
      });
    }

    warnBox = el('div.warn-box');
    warnBox.style.display = 'none';

    saveBtn = el('button.btn.case-save', {
      type: 'button', text: 'ذخیرهٔ تغییرات', onclick: doSave, disabled: true
    });
    dirtyChip = el('span.dirty-chip', { text: 'تغییر ذخیره‌نشده' });
    dirtyChip.style.display = 'none';

    function askDelete() {
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

    /* نوار اقدام‌ها روی هر دستگاه کوتاه است: «ذخیره» و «فرم‌ها» بیرون،
       بقیه پشت «⋯». پنج دکمهٔ کنار هم — که یکی‌شان قرمزِ «حذف پرونده» بود —
       هم چشم را خسته می‌کرد و هم خطرناک بود. */
    var moreBtn = existing ? el('button.icon-btn.case-more', {
      type: 'button', text: '⋯', title: 'کارهای دیگر این پرونده',
      'aria-label': 'کارهای دیگر این پرونده',
      onclick: function () {
        w.Mobile.sheet('پروندهٔ ' + w.U.toLatinDigits(existing.caseNo || ''), [
          {
            icon: 'fileText', label: 'فرم‌های اداری',
            hint: 'خلاصهٔ پرونده، تفهیم اتهام، رأی، ابلاغ رأی',
            onclick: function () { w.UILetters.chooser(app, existing); }
          },
          {
            icon: 'print', label: 'چاپ برگ پرونده',
            onclick: function () { w.UIPrint.printCase(existing); }
          },
          {
            icon: 'exp', label: 'بازگشت به فهرست',
            onclick: function () { app.goList(); }
          },
          { sep: true },
          {
            icon: 'handoff', label: 'ارجاع به کارشناس دیگر',
            hint: 'پرونده از کارتابل شما بیرون می‌رود',
            onclick: function () {
              w.UITransfer.dialog(app, [existing.id], function () {
                app.state.formTab = activeTab;
                app.render();
              });
            }
          },
          { sep: true },
          {
            icon: 'trash', label: 'حذف پرونده', kind: 'danger',
            hint: 'برگشت‌ناپذیر است',
            onclick: askDelete
          }
        ]);
      }
    }) : null;

    var formsBtn = existing ? el('button.btn.ghost.case-forms', {
      type: 'button', text: 'فرم‌ها',
      title: 'خلاصهٔ پرونده، تفهیم اتهام، رأی و ابلاغ رأی',
      onclick: function () { w.UILetters.chooser(app, existing); }
    }) : null;

    var actions = el('div.case-actions', null, [
      el('button.btn.ghost.case-back', {
        type: 'button', text: '← بازگشت به فهرست',
        onclick: function () { app.goList(); }
      }),
      neighbourNav(app, existing),
      el('div.spacer'),
      formsBtn,
      dirtyChip,
      saveBtn,
      moreBtn
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
          el('div.case-next-text', null, [
            el('span.case-next-label', { text: action.label }),
            el('span.case-next-meta', { text: meta.join(' • ') })
          ]),
          el('div.spacer'),
          ctaButton(action)
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
      // پرونده‌ای که از دست ما خارج شده، باید همان بالا معلوم باشد
      var transferNode = null;
      if (w.Worklist.isTransferred(existing)) {
        transferNode = el('div.case-next.transferred', null, [
          el('span.case-next-label', { text: 'ارجاع‌شده' }),
          el('span.case-next-meta', {
            text: 'در ' + J.format(existing.transferDate) + ' به «' +
              (existing.transferTo || 'کارشناس دیگر') + '» ارجاع شد' +
              (existing.transferFrom ? ' (پیش از آن: ' + existing.transferFrom + ')' : '') +
              '. این پرونده در کارتابل شما نمی‌آید.'
          }),
          el('div.spacer'),
          el('button.btn.small.ghost', {
            type: 'button', text: 'برگرداندن به کارتابل',
            onclick: function () {
              w.UITransfer.undo(app, existing, function () {
                app.state.formTab = activeTab;
                app.render();
              });
            }
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
        transferNode || next,
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

/* راه‌اندازی برنامه، نوار بالا، مسیریابی و میان‌برها */
(function (w) {
  'use strict';

  var el = w.U.el, $ = w.U.$, J = w.J, M = w.Model;

  var app = {
    state: {
      view: 'list',      // list | case | report
      caseId: null,
      q: '',
      filters: {},
      filterNote: '',
      sortKey: 'caseNo',
      sortDir: 'desc',
      formTab: null,
      dirty: false,
      lastResult: [],
      report: {
        preset: 'all', custom: { from: '', to: '' },
        baseField: 'intakeDate', granularity: 'auto',
        expert: '', year: '', placeType: ''
      },
      reportData: null
    }
  };

  var mount, searchInput, statusChip, navButtons;

  app.setDirty = function (v) { app.state.dirty = v; };

  app.goList = function () {
    app.state.view = 'list';
    app.state.caseId = null;
    app.state.dirty = false;
    app.state.formTab = null;
    app.render();
  };

  app.goReport = function () {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'report';
    app.state.caseId = null;
    app.render();
  };

  /** رفتن به فهرست با مجموعه‌ای مشخص از پرونده‌ها (از دل گزارش) */
  app.showCases = function (ids, note) {
    app.state.q = '';
    app.state.filters = { _idSet: M.idSet(ids) };
    app.state.filterNote = note || '';
    app.state.view = 'list';
    app.state.caseId = null;
    app.refresh(true);
  };

  /** رفتن به فهرست با فیلتر یک فیلد مشخص */
  app.showCasesByField = function (field, value, note) {
    app.state.q = '';
    var f = {};
    f[field] = [value];
    applyReportScope(f);
    app.state.filters = f;
    app.state.filterNote = note || '';
    app.state.view = 'list';
    app.state.caseId = null;
    app.refresh(true);
  };

  /** رفتن به فهرست با فیلتر مرحلهٔ گردش‌کار */
  app.showCasesByStage = function (stage, note) {
    app.state.q = '';
    var f = { _stage: stage };
    applyReportScope(f);
    app.state.filters = f;
    app.state.filterNote = note || '';
    app.state.view = 'list';
    app.state.caseId = null;
    app.refresh(true);
  };

  /** بازهٔ زمانی گزارش را هم به فیلتر فهرست منتقل می‌کند تا اعداد بخوانند */
  function applyReportScope(filters) {
    var data = app.state.reportData;
    if (!data || !data.range) return;
    if (!data.range.from && !data.range.to) return;
    if (data.range.from) filters._from = data.range.from;
    if (data.range.to) filters._to = data.range.to;
    filters._dateField = data.baseField || 'intakeDate';
  }

  app.clearFilterNote = function () {
    app.state.filters = {};
    app.state.filterNote = '';
    app.refresh(true);
  };

  app.openCase = function (id) {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'case';
    app.state.caseId = id;
    app.render();
    window.scrollTo(0, 0);
  };

  app.newCase = function () {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'case';
    app.state.caseId = null;
    app.state.formTab = 'case';
    app.render();
  };

  /** رندر دوباره؛ با resetSearch مقدار جعبهٔ جستجو هم به‌روز می‌شود. */
  app.refresh = function (resetSearch) {
    if (resetSearch && searchInput) searchInput.value = app.state.q;
    app.render();
  };

  app.render = function () {
    w.Charts.hideTip();
    if (app.state.view === 'case') {
      w.UIForm.render(app, mount, app.state.caseId);
    } else if (app.state.view === 'report') {
      w.UIReport.render(app, mount);
    } else {
      w.UIList.render(app, mount);
    }
    updateNav();
    updateStatusChip();
  };

  function updateNav() {
    if (!navButtons) return;
    Object.keys(navButtons).forEach(function (k) {
      var active = (k === 'report') === (app.state.view === 'report');
      navButtons[k].classList.toggle('active', active);
    });
  }

  // ------------------------------------------------------------- نوار وضعیت
  function updateStatusChip() {
    if (!statusChip) return;
    var s = w.Store.status();
    var text, cls;
    if (s.mode === 'memory') {
      text = '⚠ داده ذخیره نمی‌شود';
      cls = 'chip bad';
    } else if (s.linked) {
      text = '💾 ' + s.fileName +
        (s.lastSavedAt ? ' • ' + J.stamp(s.lastSavedAt).split('ساعت')[1].trim() : '');
      cls = 'chip good';
    } else if (s.hasStored) {
      // فایل از نشست قبل هست و فقط اجازه‌اش لازم است — یک کلیک، نه انتخاب دوباره
      text = '🔓 تأیید دسترسی به ' + s.storedName;
      cls = 'chip warn';
    } else if (s.canLink) {
      text = '⚠ به فایلی روی دیسک وصل نیست';
      cls = 'chip warn';
    } else {
      text = '🗄 ذخیره در مرورگر';
      cls = 'chip';
    }
    statusChip.textContent = text;
    statusChip.className = cls;
    statusChip.title = s.error ? ('خطای ذخیره: ' + s.error)
      : (s.hasStored && !s.linked
        ? 'برای ادامهٔ ذخیرهٔ خودکار روی همان فایل، یک بار کلیک کنید'
        : 'برای مدیریت ذخیره‌سازی کلیک کنید');
  }

  /** کلیک روی چیپ: اگر فقط اجازه لازم است همان‌جا بگیر، وگرنه تنظیمات */
  function onChipClick() {
    var s = w.Store.status();
    if (!s.linked && s.hasStored) {
      w.Store.relinkFile(true).then(function (ok) {
        if (ok) {
          w.U.toast('دسترسی برقرار شد؛ تغییرات دوباره خودکار ذخیره می‌شوند.', 'good');
          w.Store.flushNow();
        } else {
          w.UIMisc.settingsDialog(app);
        }
      });
      return;
    }
    w.UIMisc.settingsDialog(app);
  }

  function topBar() {
    searchInput = el('input.search', {
      type: 'search', placeholder: 'جستجو در همهٔ فیلدها… (Ctrl+F)',
      autocomplete: 'off', value: app.state.q
    });
    var onSearch = w.U.debounce(function () {
      app.state.q = searchInput.value;
      if (app.state.view !== 'list') { app.state.view = 'list'; app.state.caseId = null; }
      app.render();
    }, 150);
    searchInput.addEventListener('input', onSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchInput.value = ''; app.state.q = ''; app.render(); }
    });

    statusChip = el('button.chip', { type: 'button', onclick: onChipClick });

    navButtons = {
      list: el('button.nav-btn.active', {
        type: 'button', text: 'فهرست پرونده‌ها',
        onclick: function () { app.goList(); }
      }),
      report: el('button.nav-btn', {
        type: 'button', text: 'گزارش‌ها',
        onclick: function () { app.goReport(); }
      })
    };

    return el('header.topbar', null, [
      el('div.brand', {
        onclick: function () { app.goList(); }, title: 'بازگشت به فهرست'
      }, [
        el('span.logo', { text: '📁' }),
        el('span.brand-text', null, [
          el('b', { text: 'سامانهٔ پرونده‌ها' }),
          el('small', { text: 'کمیتهٔ انضباطی' })
        ])
      ]),
      el('nav.main-nav', null, [navButtons.list, navButtons.report]),
      el('div.search-wrap', null, [searchInput]),
      el('div.top-actions', null, [
        el('button.btn.primary', {
          type: 'button', text: '＋ پروندهٔ جدید', title: 'Ctrl+N',
          onclick: function () { app.newCase(); }
        }),
        el('button.btn.ghost', {
          type: 'button', text: 'اکسل',
          title: 'خروجی اکسل از همهٔ پرونده‌ها',
          onclick: function () { w.UIMisc.exportExcel(M.state.cases); }
        }),
        el('button.btn.ghost', {
          type: 'button', text: 'SQLite',
          title: 'خروجی فایل دیتابیس SQLite',
          onclick: function () { w.UIMisc.exportSqlite(); }
        }),
        el('button.btn.ghost', {
          type: 'button', text: 'پشتیبان',
          title: 'ذخیرهٔ نسخهٔ پشتیبان',
          onclick: function () { w.UIMisc.exportJson(); }
        }),
        el('button.icon-btn', {
          type: 'button', text: '⚙', title: 'تنظیمات',
          onclick: function () { w.UIMisc.settingsDialog(app); }
        }),
        statusChip
      ])
    ]);
  }

  // ------------------------------------------------------------- میان‌برها
  function bindShortcuts() {
    document.addEventListener('keydown', function (e) {
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      } else if (ctrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        app.newCase();
      } else if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (app.state.view === 'case' && app.saveCurrentForm) app.saveCurrentForm();
        else w.UIMisc.exportJson();
      } else if (ctrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        app.goReport();
      } else if (e.key === 'Escape' && app.state.view === 'case' && !app.state.dirty) {
        app.goList();
      }
    });

    window.addEventListener('beforeunload', function (e) {
      if (app.state.dirty || w.Store.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // پیش از بسته شدن، آخرین تغییرات روی فایل نوشته شود
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') w.Store.flushNow();
    });
  }

  // ------------------------------------------------------------- یادآور پشتیبان
  function backupReminder() {
    var s = w.Store.status();
    var n = M.state.settings.changesSinceBackup || 0;
    var every = M.state.settings.autoBackupEvery || 25;
    if (s.linked || n < every) return;
    w.U.toast('از آخرین پشتیبان ' + w.U.toFaDigits(n) +
      ' تغییر ثبت شده؛ بهتر است نسخهٔ پشتیبان بگیرید.', 'warn');
  }

  // ----------------------------------------------------------------- شروع
  function boot() {
    mount = $('#main');
    document.body.insertBefore(topBar(), mount);

    w.Store.onStatusChange(updateStatusChip);

    w.Store.init().then(function () {
      return M.load();
    }).then(function () {
      if (!M.state.cases.length) {
        return M.seed().then(function (n) {
          if (n) w.U.toast(w.U.toFaDigits(n) + ' پروندهٔ نمونه از فایل اکسل وارد شد.', 'good');
          return M.load();
        });
      }
    }).then(function () {
      return w.Docs.load();
    }).then(function () {
      bindShortcuts();
      app.render();
      setTimeout(backupReminder, 2500);
      var s = w.Store.status();
      if (s.mode === 'memory') {
        w.U.toast('مرورگر اجازهٔ ذخیره‌سازی نداده است؛ داده‌ها با بستن صفحه از بین می‌رود.', 'bad');
      }
    }).catch(function (err) {
      mount.appendChild(el('div.fatal', null, [
        el('h2', { text: 'راه‌اندازی ناموفق بود' }),
        el('p', { text: err && err.message ? err.message : String(err) })
      ]));
    });
  }

  w.App = app;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);

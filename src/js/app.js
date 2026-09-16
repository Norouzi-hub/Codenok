/* راه‌اندازی برنامه، نوار بالا، مسیریابی و میان‌برها */
(function (w) {
  'use strict';

  var el = w.U.el, $ = w.U.$, J = w.J, M = w.Model;

  var app = {
    state: {
      view: 'list',      // list | case
      caseId: null,
      q: '',
      filters: {},
      sortKey: 'caseNo',
      sortDir: 'desc',
      formTab: null,
      dirty: false,
      lastResult: []
    }
  };

  var mount, searchInput, statusChip;

  app.setDirty = function (v) { app.state.dirty = v; };

  app.goList = function () {
    app.state.view = 'list';
    app.state.caseId = null;
    app.state.dirty = false;
    app.state.formTab = null;
    app.render();
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
    if (app.state.view === 'case') {
      w.UIForm.render(app, mount, app.state.caseId);
    } else {
      w.UIList.render(app, mount);
    }
    updateStatusChip();
  };

  // ------------------------------------------------------------- نوار وضعیت
  function updateStatusChip() {
    if (!statusChip) return;
    var s = w.Store.status();
    var text, cls;
    if (s.mode === 'memory') {
      text = '⚠ داده ذخیره نمی‌شود';
      cls = 'chip bad';
    } else if (s.linked) {
      text = '💾 ' + s.fileName + (s.lastSavedAt ? ' • ' + J.stamp(s.lastSavedAt).split('ساعت')[1].trim() : '');
      cls = 'chip good';
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
      : 'برای مدیریت ذخیره‌سازی کلیک کنید';
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

    statusChip = el('button.chip', {
      type: 'button', onclick: function () { w.UIMisc.settingsDialog(app); }
    });

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

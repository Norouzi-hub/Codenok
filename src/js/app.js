/* راه‌اندازی برنامه، نوار بالا، مسیریابی و میان‌برها */
(function (w) {
  'use strict';

  var el = w.U.el, $ = w.U.$, J = w.J, M = w.Model;

  var app = {
    state: {
      view: 'work',      // work | list | case | report | people | person
      caseId: null,
      q: '',
      filters: {},
      filterNote: '',
      sortKey: 'caseNo',
      sortDir: 'desc',
      formTab: null,
      dirty: false,
      lastResult: [],
      selected: {},
      report: {
        preset: 'all', custom: { from: '', to: '' },
        baseField: 'intakeDate', granularity: 'auto',
        expert: '', year: '', placeType: ''
      },
      reportData: null,
      personKey: null
    }
  };

  var mount, searchInput, statusChip, navButtons, scopeChip;

  /* ================================================================
     نشانی صفحه
     ----------------------------------------------------------------
     تا امروز رفرش کردن یعنی برگشتن به خانهٔ اول، و دکمهٔ «قبلی» مرورگر
     از کل برنامه بیرون می‌انداخت. حالا هر نما نشانی خودش را دارد:

       #/                    کارتابل
       #/list                فهرست پرونده‌ها
       #/case/1404308        یک پرونده، با شمارهٔ خودش
       #/case/new            پروندهٔ تازه
       #/person/<کلید>       پروندهٔ شخص
       #/tasks               کارها
       #/calendar            تقویم
       #/report              گزارش‌ها

     شمارهٔ پرونده در نشانی می‌آید نه شناسهٔ داخلی، چون نشانی را آدم
     می‌خواند و شاید برای همکارش بفرستد.
     ================================================================ */
  var applyingRoute = false;

  function routeOf() {
    var st = app.state;
    if (st.view === 'case') {
      if (!st.caseId) return '#/case/new';
      var rec = M.get(st.caseId);
      var no = rec && rec.caseNo ? w.U.toLatinDigits(rec.caseNo) : '';
      return no ? '#/case/' + encodeURIComponent(no) : '#/list';
    }
    if (st.view === 'person') {
      return st.personKey ? '#/person/' + encodeURIComponent(st.personKey) : '#/people';
    }
    if (st.view === 'people') return '#/people';
    if (st.view === 'tasks') return '#/tasks';
    if (st.view === 'calendar') return '#/calendar';
    if (st.view === 'report') return '#/report';
    if (st.view === 'list') return '#/list';
    return '#/';
  }

  /** نشانی را با نمای فعلی هم‌خط می‌کند، بدون اینکه دوباره رندر شود */
  function syncRoute(replace) {
    if (applyingRoute) return;
    var want = routeOf();
    if (w.location.hash === want) return;
    applyingRoute = true;
    try {
      if (replace) w.history.replaceState(null, '', want);
      else w.history.pushState(null, '', want);
    } catch (e) {
      w.location.hash = want;          // file:// در بعضی مرورگرها pushState ندارد
    }
    applyingRoute = false;
  }

  /** پرونده را با شمارهٔ خودش پیدا می‌کند */
  function caseByNo(no) {
    var want = w.U.toLatinDigits(no || '').trim();
    var found = null;
    M.state.cases.forEach(function (c) {
      if (w.U.toLatinDigits(c.caseNo || '').trim() === want) found = c;
    });
    return found;
  }

  /** نشانی فعلی را روی نما می‌نشاند. از boot و از دکمهٔ «قبلی» صدا می‌شود. */
  function applyRoute() {
    var hash = String(w.location.hash || '').replace(/^#\/?/, '');
    var parts = hash.split('/').filter(function (x) { return x !== ''; });
    var st = app.state;
    st.dirty = false;

    if (!parts.length) { st.view = 'work'; st.caseId = null; }
    else if (parts[0] === 'list') { st.view = 'list'; st.caseId = null; }
    else if (parts[0] === 'report') { st.view = 'report'; st.caseId = null; }
    else if (parts[0] === 'tasks') { st.view = 'tasks'; st.caseId = null; }
    else if (parts[0] === 'calendar') { st.view = 'calendar'; st.caseId = null; }
    else if (parts[0] === 'people') { st.view = 'people'; st.personKey = null; }
    else if (parts[0] === 'person' && parts[1]) {
      st.view = 'person';
      st.personKey = decodeURIComponent(parts[1]);
      st.caseId = null;
    } else if (parts[0] === 'case' && parts[1] === 'new') {
      st.view = 'case'; st.caseId = null; st.formTab = 'case';
    } else if (parts[0] === 'case' && parts[1]) {
      var rec = caseByNo(decodeURIComponent(parts[1]));
      if (rec) { st.view = 'case'; st.caseId = rec.id; }
      else {
        // پرونده‌ای با این شماره نیست — شاید پاک شده یا نشانی دستی خورده
        st.view = 'list'; st.caseId = null;
        w.U.toast('پرونده‌ای با شمارهٔ ' + w.U.toFaDigits(parts[1]) + ' پیدا نشد.', 'warn');
      }
    } else { st.view = 'work'; st.caseId = null; }

    applyingRoute = true;
    app.render();
    applyingRoute = false;
    // نشانی خالی («فایل را همین‌طور باز کرده») به  #/  تبدیل شود، بدون
    // اینکه یک ورودی الکی در تاریخچهٔ مرورگر بسازد
    syncRoute(true);
  }

  function bindRouting() {
    w.addEventListener('popstate', function () {
      if (w.Store.isLocked && w.Store.isLocked()) return;
      applyRoute();
    });
    w.addEventListener('hashchange', function () {
      if (applyingRoute) return;
      if (w.Store.isLocked && w.Store.isLocked()) return;
      if (w.location.hash !== routeOf()) applyRoute();
    });
  }

  app.setDirty = function (v) { app.state.dirty = v; };

  app.goList = function () {
    app.state.view = 'list';
    app.state.caseId = null;
    app.state.dirty = false;
    app.state.formTab = null;
    app.render();
  };

  app.goWork = function () {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'work';
    app.state.caseId = null;
    app.render();
  };

  app.goPeople = function () {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'people';
    app.state.caseId = null;
    app.state.personKey = null;
    app.render();
  };

  app.openPerson = function (key) {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'person';
    app.state.personKey = key;
    app.state.caseId = null;
    app.render();
    window.scrollTo(0, 0);
  };

  app.goTasks = function () {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'tasks';
    app.state.caseId = null;
    app.render();
  };

  app.goCalendar = function () {
    if (app.state.dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) {
      return;
    }
    app.state.dirty = false;
    app.state.view = 'calendar';
    app.state.caseId = null;
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

  /** انتخاب چندتایی برای اقدام دسته‌ای */
  app.selectedIds = function () {
    return Object.keys(app.state.selected).filter(function (k) {
      return app.state.selected[k];
    });
  };

  app.toggleSelect = function (id, on) {
    if (on) app.state.selected[id] = true;
    else delete app.state.selected[id];
  };

  app.clearSelection = function () {
    app.state.selected = {};
  };

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

  /*
   * به‌روزرسانی کامل، بدون بستن و باز کردن برنامه.
   *
   * تا امروز تنها راهِ «تازه کن»، رفرش مرورگر بود — و رفرش یعنی صفحهٔ
   * شروع، انتخاب دوبارهٔ فایل و رمز. این دکمه همان کار را بدون آن
   * می‌کند: اول هرچه ننوشته مانده روی فایل می‌نویسد (وگرنه خواندنِ
   * دوباره کارِ نوشته‌نشده را می‌بلعد)، بعد اگر فایلِ روی دیسک تازه‌تر
   * است آن را می‌خوانَد، و در پایان همهٔ لایه‌ها را دوباره بار می‌کند.
   *
   * ترتیب عمدی است و «نوشتن قبل از خواندن» مهم‌ترین بندش.
   */
  app.refreshAll = function (silent) {
    if (app.state.dirty &&
      !window.confirm('در این پرونده تغییر ذخیره‌نشده دارید. با به‌روزرسانی از بین می‌رود. ادامه می‌دهید؟')) {
      return Promise.resolve(false);
    }
    var chip = statusChip;
    if (chip) chip.classList.add('busy');
    return Promise.resolve()
      .then(function () { return w.Store.flushNow(); })
      .then(function () {
        // اگر به فایلی وصل نیستیم، چیزی برای خواندن از دیسک نیست
        return w.Store.status().linked ? w.Store.adoptFile() : false;
      })
      .then(function (took) {
        return M.reload().then(function () { return took; });
      })
      .then(function (took) {
        return w.Docs.load().then(function () { return took; });
      })
      .then(function (took) {
        return w.Notes.load().then(function () { return took; });
      })
      .then(function (took) {
        app.state.dirty = false;
        app.render();
        renderAccessBar();
        if (!silent) {
          w.U.toast(took
            ? 'از فایل روی دیسک خوانده شد — ' +
              w.U.toFaDigits(M.state.cases.length) + ' پرونده.'
            : 'به‌روز شد — ' + w.U.toFaDigits(M.state.cases.length) + ' پرونده.',
          'good');
        }
        return true;
      })
      .catch(function (e) {
        w.U.toast('به‌روزرسانی ناموفق بود: ' + (e && e.message ? e.message : e), 'bad');
        return false;
      })
      .then(function (ok) {
        if (chip) chip.classList.remove('busy');
        return ok;
      });
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
    } else if (app.state.view === 'work') {
      w.UIWorklist.render(app, mount);
    } else if (app.state.view === 'tasks') {
      w.UITasks.render(app, mount);
    } else if (app.state.view === 'calendar') {
      w.UICalendar.render(app, mount);
    } else if (app.state.view === 'report') {
      w.UIReport.render(app, mount);
    } else if (app.state.view === 'people') {
      w.UIPerson.renderList(app, mount);
    } else if (app.state.view === 'person') {
      w.UIPerson.renderOne(app, mount, app.state.personKey);
    } else {
      w.UIList.render(app, mount);
    }
    updateNav();
    updateStatusChip();
    if (scopeChip) scopeChip.refresh();
    syncRoute(applyingRoute);
  };

  var NAV_FOR_VIEW = {
    work: 'work', list: 'list', case: 'list', report: 'report',
    tasks: 'tasks', calendar: 'calendar', people: 'people', person: 'people'
  };

  function updateNav() {
    var active = NAV_FOR_VIEW[app.state.view] || 'list';
    w.U.$$('[data-nav]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === active);
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
      type: 'search', placeholder: 'جستجو در همهٔ فیلدها…',
      title: 'جستجو در همهٔ فیلدها (Ctrl+F)',
      autocomplete: 'off', value: app.state.q
    });
    var onSearch = w.U.debounce(function () {
      app.state.q = searchInput.value;
      if (app.state.view === 'person') app.state.view = 'people';
      else if (app.state.view !== 'list' && app.state.view !== 'people') {
        app.state.view = 'list';
        app.state.caseId = null;
      }
      app.render();
    }, 150);
    searchInput.addEventListener('input', onSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchInput.value = ''; app.state.q = ''; app.render(); }
    });

    statusChip = el('button.chip', { type: 'button', onclick: onChipClick });
    scopeChip = w.UIScope.chip(app);

    navButtons = {
      work: el('button.nav-btn.active', {
        type: 'button', text: 'کارتابل', 'data-nav': 'work',
        title: 'چه کاری شده و چه کاری مانده',
        onclick: function () { app.goWork(); }
      }),
      list: el('button.nav-btn', {
        type: 'button', text: 'پرونده‌ها', 'data-nav': 'list',
        onclick: function () { app.goList(); }
      }),
      tasks: el('button.nav-btn', {
        type: 'button', text: 'کارها', 'data-nav': 'tasks',
        title: 'کارهای روزمره — روی پرونده‌ها و بیرون از آنها',
        onclick: function () { app.goTasks(); }
      }),
      calendar: el('button.nav-btn', {
        type: 'button', text: 'تقویم', 'data-nav': 'calendar',
        title: 'هر روز چه افتاده و چه در راه است',
        onclick: function () { app.goCalendar(); }
      }),
      people: el('button.nav-btn', {
        type: 'button', text: 'اشخاص', 'data-nav': 'people',
        title: 'یک کارمند ممکن است چند پرونده داشته باشد',
        onclick: function () { app.goPeople(); }
      }),
      report: el('button.nav-btn', {
        type: 'button', text: 'گزارش‌ها', 'data-nav': 'report',
        onclick: function () { app.goReport(); }
      })
    };

    return el('header.topbar', null, [
      el('div.brand', {
        onclick: function () { app.goWork(); }, title: 'بازگشت به کارتابل'
      }, [
        el('span.logo', { text: '📁' }),
        el('span.brand-text', null, [
          el('b', { text: 'سامانهٔ پرونده‌ها' }),
          el('small', { text: 'کمیتهٔ انضباطی' })
        ])
      ]),
      el('nav.main-nav', null, [navButtons.work, navButtons.list,
        navButtons.tasks, navButtons.calendar, navButtons.people,
        navButtons.report]),
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
        scopeChip,
        el('button.icon-btn.refresh-btn', {
          type: 'button', title: 'به‌روزرسانی از روی فایل — بدون بستن برنامه (F5)',
          'aria-label': 'به‌روزرسانی',
          html: w.Mobile.icon('refresh'),
          onclick: function () { app.refreshAll(); }
        }),
        el('button.icon-btn', {
          type: 'button', text: '🔒', title: 'قفل کردن برنامه (Ctrl+L)',
          onclick: function () {
            if (w.Store.status().encrypted) lockNow(false);
            else w.UILock.passwordDialog(app);
          }
        }),
        el('button.icon-btn', {
          type: 'button', text: '⚙', title: 'تنظیمات',
          onclick: function () { w.UIMisc.settingsDialog(app); }
        }),
        statusChip
      ]),
      // روی موبایل همهٔ اقدام‌های بالا در یک شیت جمع می‌شوند
      el('button.icon-btn.more-btn', {
        type: 'button', text: '⋯', title: 'اقدام‌ها',
        'aria-label': 'اقدام‌ها',
        onclick: openActionSheet
      })
    ]);
  }

  /** شیت اقدام‌ها روی موبایل — همان کارهای نوار بالا */
  function openActionSheet() {
    var s = w.Store.status();
    w.Mobile.sheet('اقدام‌ها', [
      {
        icon: 'plus', label: 'پروندهٔ جدید',
        onclick: function () { app.newCase(); }
      },
      {
        icon: 'filter', label: 'دامنهٔ کار',
        hint: 'کدام پرونده‌ها شمرده شوند',
        onclick: function () { w.UIScope.dialog(app); }
      },
      {
        icon: 'refresh', label: 'به‌روزرسانی',
        hint: 'خواندن دوبارهٔ داده‌ها از فایل، بدون بستن برنامه',
        onclick: function () { app.refreshAll(); }
      },
      { sep: true },
      {
        /* گزارش‌ها روی گوشی در نوار پایین جا نشد — «کارها» جایش را گرفت،
           چون هر روز لازم است و گزارش گاه‌به‌گاه. پس اینجا می‌ماند. */
        icon: 'cal', label: 'تقویم',
        onclick: function () { app.goCalendar(); }
      },
      {
        icon: 'chart', label: 'گزارش‌ها',
        onclick: function () { app.goReport(); }
      },
      { sep: true },
      {
        icon: 'imp', label: 'ورود از اکسل',
        hint: 'خواندن فایل اکسل با همین قالب',
        onclick: function () { w.UIMisc.importExcel(app); }
      },
      { sep: true },
      {
        icon: 'exp', label: 'خروجی اکسل',
        hint: 'همهٔ پرونده‌ها',
        onclick: function () { w.UIMisc.exportExcel(M.state.cases); }
      },
      {
        icon: 'db', label: 'خروجی SQLite',
        onclick: function () { w.UIMisc.exportSqlite(); }
      },
      {
        icon: 'backup', label: 'نسخهٔ پشتیبان',
        hint: w.Mobile.canLinkFile() ? 'ذخیرهٔ فایل پشتیبان'
          : 'روی موبایل تنها راه نگه‌داشتن داده بیرون از مرورگر',
        onclick: function () { w.UIMisc.exportJson(); }
      },
      { sep: true },
      {
        icon: 'lock', label: 'قفل کردن برنامه',
        hint: s.encrypted ? '' : 'اول یک رمز عبور تعیین کنید',
        onclick: function () {
          if (w.Store.status().encrypted) lockNow(false);
          else w.UILock.passwordDialog(app);
        }
      },
      {
        icon: 'gear', label: 'تنظیمات',
        onclick: function () { w.UIMisc.settingsDialog(app); }
      },
      { sep: true },
      {
        node: el('button.sheet-status', {
          type: 'button',
          text: statusChip ? statusChip.textContent : '',
          onclick: function () {
            var ov = document.querySelector('.sheet-overlay');
            if (ov) ov.remove();
            onChipClick();
          }
        })
      }
    ]);
  }

  /* آیکن‌های نوار پایین — خطی و هم‌خانواده، نه شکلک */
  function svg(d) {
    return '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" ' +
      'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var TAB_ICONS = {
    work: svg('<path d="M9 4h6v3H9z"/><path d="M15 5.5h2.5A1.5 1.5 0 0 1 19 7v11.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5V7a1.5 1.5 0 0 1 1.5-1.5H9"/><path d="M8.6 13.2l2 2 3.8-4"/>'),
    list: svg('<path d="M4.5 6h15M4.5 10.5h15M4.5 15h15M4.5 19.5h9"/>'),
    people: svg('<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.2 14.9c2 .6 3.3 2.3 3.3 4.6"/>'),
    tasks: svg('<path d="M4.2 7.6l1.9 1.9 3.3-3.5"/><path d="M4.2 16.6l1.9 1.9 3.3-3.5"/><path d="M12.6 8h7.2"/><path d="M12.6 17h7.2"/>'),
    report: svg('<path d="M4.5 19.5h15"/><rect x="6" y="11" width="3" height="6" rx="1"/><rect x="11" y="7.5" width="3" height="9.5" rx="1"/><rect x="16" y="13.5" width="3" height="3.5" rx="1"/>')
  };

  /** نوار پایین مخصوص موبایل — چهار مقصد و دکمهٔ پروندهٔ جدید */
  function tabBar() {
    function tab(key, label, go) {
      return el('button.tab-btn', {
        type: 'button', 'data-nav': key, 'aria-label': label,
        onclick: go
      }, [
        el('span.tab-icon', { html: TAB_ICONS[key] }),
        el('span.tab-label', { text: label })
      ]);
    }
    return el('nav.tabbar', { 'aria-label': 'مسیرهای اصلی' }, [
      tab('work', 'کارتابل', function () { app.goWork(); }),
      tab('list', 'پرونده‌ها', function () { app.goList(); }),
      el('button.tab-new', {
        type: 'button', text: '＋', 'aria-label': 'پروندهٔ جدید',
        title: 'پروندهٔ جدید',
        onclick: function () { app.newCase(); }
      }),
      tab('tasks', 'کارها', function () { app.goTasks(); }),
      tab('people', 'اشخاص', function () { app.goPeople(); })
    ]);
  }

  // ------------------------------------------------------------- میان‌برها
  function isTyping(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }

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
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        app.goWork();
      } else if (ctrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (w.Store.status().encrypted) lockNow(false);
        else w.U.toast('اول از تنظیمات یک رمز عبور تعیین کنید.', 'warn');
      } else if (ctrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        app.goTasks();
      } else if (e.key === 'F5' && !ctrl) {
        /* رفرش مرورگر یعنی صفحهٔ شروع و رمز دوباره؛ همان کلید، اینجا
           معنای درستش را می‌دهد: داده‌ها تازه شوند، نشست بماند. */
        e.preventDefault();
        app.refreshAll();
      } else if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        app.goCalendar();
      } else if (ctrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.goPeople();
      } else if (ctrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        app.goReport();
      } else if (ctrl && e.key.toLowerCase() === 'a' && app.state.view === 'list'
        && !isTyping(e.target)) {
        // انتخاب همهٔ نتیجه‌های همین جستجو، برای اقدام دسته‌ای
        e.preventDefault();
        (app.state.lastResult || []).forEach(function (r) { app.toggleSelect(r.id, true); });
        app.render();
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

  // ------------------------------------------------------------- قفل خودکار
  var IDLE_MS = 15 * 60 * 1000;
  var idleTimer = null;

  function resetIdle() {
    if (!w.Store.status().encrypted) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (w.UILock.isShowing()) return;
      lockNow(true);
    }, IDLE_MS);
  }

  var unlocking = false;

  function lockNow(automatic) {
    // اگر همین حالا در حال باز شدن قفل هستیم یا صفحهٔ قفل بالاست، دوباره
    // قفل نکن؛ وگرنه صفحهٔ قفلِ تازه را همان باز شدنِ در جریان پاک می‌کند.
    if (unlocking || w.UILock.isShowing()) return;
    clearTimeout(idleTimer);
    w.Store.lock().then(function () {
      // داده‌های رمزگشایی‌شده باید از حافظهٔ صفحه هم پاک شوند، نه فقط از انبار
      M.clearMemory();
      w.Docs.clearMemory();
      w.Notes.clearMemory();
      w.Charts.reset();
      if (w.UIDocs) w.UIDocs.releaseThumbs();
      app.state.reportData = null;
      app.state.lastResult = [];
      app.state.view = 'work';
      app.state.caseId = null;
      app.state.personKey = null;
      app.state.dirty = false;
      app.state.q = '';
      app.state.filters = {};
      w.U.clear(mount);
      if (tabBarNode) tabBarNode.style.display = 'none';
      w.UILock.showLock(afterUnlock);
      if (automatic) {
        setTimeout(function () {
          w.U.toast('به‌خاطر بی‌کاری، برنامه قفل شد.', 'warn');
        }, 400);
      }
    });
  }

  app.lockNow = lockNow;

  function bindIdle() {
    ['mousedown', 'keydown', 'wheel', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, resetIdle, { passive: true });
    });
    resetIdle();
  }

  // ----------------------------------------------------------------- شروع
  /**
   * آیا باید صفحهٔ شروع بیاید؟
   *
   * وقتی نه داده‌ای هست، نه فایلی وصل است و نه فایلی از نشست قبل ذخیره
   * شده. در این حالت ساختن خودکارِ دادهٔ نمونه، برنامه را بی‌رمز و
   * بی‌صاحب بالا می‌آورد — همان چیزی که در مرورگر تازه دیده می‌شود.
   */
  function needsDatabase() {
    var s = w.Store.status();
    if (s.linked || s.hasStored) return false;
    if (w.Store.metaGet('demoMode', false)) return false;
    return !M.state.cases.length;
  }

  function afterUnlock() {
    unlocking = true;
    return M.load().then(function () {
      if (needsDatabase()) {
        unlocking = false;
        topBarNode.style.display = 'none';
        if (tabBarNode) tabBarNode.style.display = 'none';
        return w.UIStart.show(function () {
          afterUnlock();
        });
      }
      if (!M.state.cases.length) {
        return M.seed().then(function (n) {
          if (n) w.U.toast(w.U.toFaDigits(n) + ' پروندهٔ نمونه از فایل اکسل وارد شد.', 'good');
          return M.load();
        });
      }
      return null;
    }).then(function (res) {
      if (w.UIStart.isShowing()) return null;
      return started();
    }).catch(function (err) {
      unlocking = false;
      throw err;
    });
  }

  function started() {
    return Promise.resolve().then(function () {
      return w.Docs.load();
    }).then(function () {
      return w.Notes.load();
    }).then(function () {
      if (topBarNode.parentNode !== document.body) {
        document.body.insertBefore(topBarNode, mount);
      }
      topBarNode.style.display = '';
      if (tabBarNode) tabBarNode.style.display = '';
      // نشانی فعلی مبناست: رفرش و دکمهٔ «قبلی» همان‌جا برمی‌گردند
      applyRoute();
      renderAccessBar();
      resetIdle();
      setTimeout(backupReminder, 2500);
      // پشتیبان خودکار روزانه، اگر پوشهٔ مستندات وصل باشد
      setTimeout(function () {
        if (w.Docs.status().linked) w.Docs.backupNow(false);
      }, 4000);
      var s = w.Store.status();
      if (s.mode === 'memory') {
        w.U.toast('مرورگر اجازهٔ ذخیره‌سازی نداده است؛ داده‌ها با بستن صفحه از بین می‌رود.', 'bad');
      }
      unlocking = false;
    }).catch(function (err) {
      unlocking = false;
      throw err;
    });
  }

  var topBarNode = null;
  var tabBarNode = null;
  var accessBar = null;

  /*
   * نوار دسترسی.
   *
   * مرورگر اجازهٔ فایل و پوشه را با بستن صفحه فراموش می‌کند — قاعدهٔ امنیتی
   * خود کروم است و دور زدنی نیست. کاری که از ما برمی‌آید این است که هر بار
   * یک کلیک باشد، نه گشتن در تنظیمات و تب مستندات. این نوار هر دو را با هم
   * می‌گیرد و وقتی چیزی لازم نیست، اصلاً دیده نمی‌شود.
   */
  function needsAccess() {
    var s = w.Store.status();
    var d = w.Docs.status();
    return {
      file: !!(s.canLink && !s.linked && s.hasStored),
      folder: !!(d.supported && !d.linked && d.hasStored),
      fileName: s.storedName, folderName: d.storedName
    };
  }

  function renderAccessBar() {
    var need = needsAccess();
    if (!need.file && !need.folder) {
      if (accessBar) { accessBar.remove(); accessBar = null; }
      return;
    }
    var what = [];
    if (need.file) what.push('دیتابیس «' + need.fileName + '»');
    if (need.folder) what.push('پوشهٔ مستندات «' + need.folderName + '»');

    var btn = el('button.btn.small.primary', {
      type: 'button', text: 'اجازه بده',
      onclick: function () {
        btn.disabled = true;
        btn.textContent = 'در حال گرفتن اجازه…';
        var chain = need.file
          ? w.Store.relinkFile(true).then(function (ok) {
            if (ok) w.Store.flushNow();
            return ok;
          })
          : Promise.resolve(true);
        chain.then(function () {
          return need.folder ? w.Docs.relinkFolder(true) : true;
        }).then(function () {
          var left = needsAccess();
          renderAccessBar();
          app.render();
          if (!left.file && !left.folder) {
            w.U.toast('دسترسی برقرار شد؛ داده‌ها از روی فایل خوانده شدند.', 'good');
          } else {
            w.U.toast('یک مورد باقی ماند؛ دوباره «اجازه بده» را بزنید.', 'warn');
          }
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = 'اجازه بده';
          renderAccessBar();
        });
      }
    });

    var node = el('div.access-bar', null, [
      el('span.access-icon', { html: w.Mobile.icon('lock') }),
      el('span.access-text', null, [
        el('b', { text: 'برای ادامه، یک بار اجازه لازم است: ' }),
        el('span', { text: what.join(' و ') + '.' }),
        el('span.access-why', {
          text: ' مرورگر این اجازه را با بستن صفحه فراموش می‌کند؛ ' +
            'داده‌ها سر جایشان هستند.'
        })
      ]),
      el('div.spacer'),
      btn
    ]);
    if (accessBar) accessBar.replaceWith(node); else mount.parentNode.insertBefore(node, mount);
    accessBar = node;
  }

  app.refreshAccessBar = renderAccessBar;

  function boot() {
    mount = $('#main');
    topBarNode = topBar();
    document.body.insertBefore(topBarNode, mount);
    tabBarNode = tabBar();
    document.body.appendChild(tabBarNode);

    // با چرخاندن گوشی یا تغییر اندازه، نما باید دوباره ساخته شود:
    // فهرست روی موبایل کارت است و روی دسکتاپ جدول.
    w.Mobile.onChange(function () {
      if (w.Store.isLocked && w.Store.isLocked()) return;
      app.render();
    });

    w.Store.onStatusChange(updateStatusChip);

    w.Store.init().then(function () {
      bindShortcuts();
      bindIdle();
      bindRouting();
      // پرسیدن رمزِ یک فایل، کار رابط کاربری است نه لایهٔ داده
      w.Store.onPasswordNeeded(w.UILock.askBackupPassword);
      if (w.Store.isLocked()) {
        topBarNode.style.display = 'none';
        tabBarNode.style.display = 'none';
        w.UILock.showLock(afterUnlock);
        return null;
      }
      return afterUnlock();
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

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
    'note-remove': 'حذف یادداشت', 'task-add': 'کار', 'task-done': 'کار انجام شد',
    'task-cancel': 'کار لغو شد', 'task-remove': 'حذف کار',
    'doc-batch': 'دستهٔ اسکن', 'doc-attach': 'وصل سند به پرونده',
    'doc-sync': 'هم‌خوان‌سازی از سند', 'stage': 'تنظیم مرحله',
    'bulk': 'اقدام دسته‌ای', 'session': 'صورت‌جلسه'
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
    { key: 'enforce', label: 'ابلاغ، نتیجه و بایگانی', groups: ['enforce'] }
  ];

  /*
   * بخش‌های اختیاری پرونده.
   *
   * هر پرونده استعلام حراست ندارد، هر پرونده به کارشناس دیگری ارجاع
   * نمی‌شود، و برای هر پرونده نامهٔ رفع نواقص نمی‌رود. تا امروز فیلدهای
   * هر سه، خالی و بی‌ربط، در فرمِ همهٔ پرونده‌ها می‌نشستند — هم شلوغ،
   * هم گمراه‌کننده («یعنی باید پرش کنم؟»).
   *
   * حالا هر خوشه یک بخش است که وقتی داده دارد باز و پررنگ دیده می‌شود،
   * و وقتی ندارد به یک سطرِ «دارد/ندارد» جمع می‌شود. تصمیم پنهان نیست:
   * سطر همیشه هست، فقط جا نمی‌گیرد.
   *
   * همین چهار خوشه دقیقاً همان مرحله‌های optional ریل گردش‌کارند، پس
   * کلیک روی گرهِ ریل هم همین بخش را باز می‌کند.
   */
  /*
   * جای هر بخش در تب: بالای همهٔ گروه‌ها، یا پایین همه. بدون این، بخش
   * همان‌جایی می‌نشیند که گروهش است — و برای بخشی مثل «نوع پرونده» که باید
   * ته صفحه باشد یا «نامهٔ دعوت به جلسهٔ کمیته» که باید سرِ صفحه باشد،
   * کافی نیست.
   *
   * always یعنی بخشی که همیشه باز است: خوشه‌ای از فیلدهای همیشگی که فقط
   * دور خودش قاب می‌خواهد، نه سؤالِ «دارد/ندارد».
   */
  var OPTIONAL_BLOCKS = [
    {
      key: 'transfer', group: 'case', label: 'ارجاع به کارشناس دیگر',
      ask: 'این پرونده به کارشناس دیگری ارجاع شده',
      hint: 'نامهٔ ارجاع، کارشناس تازه و علتش.',
      fields: ['transferDate', 'transferTo', 'transferFrom',
        'transferLetterNo', 'transferReason']
    },
    {
      key: 'defect', group: 'defense', label: 'نامهٔ رفع نواقص',
      ask: 'برای این پرونده نامهٔ رفع نواقص رفته',
      hint: 'شماره و تاریخ نامه‌ای که برای تکمیل مدارک صادر شده.',
      fields: ['defectLetterNo', 'defectLetterDate']
    },
    {
      key: 'inquiry', group: 'defense', label: 'استعلام حراست',
      ask: 'برای این پرونده استعلام حراست رفته',
      hint: 'نامهٔ صادره، پاسخ وارده و موضوع پاسخ.',
      fields: ['securityOutLetterNo', 'securityOutLetterDate',
        'securityInLetterNo', 'securityInLetterDate', 'securityAnswerSubject']
    },
    {
      key: 'salaryStop', group: 'defense', label: 'نامهٔ بستن حقوق',
      ask: 'برای این پرونده نامهٔ بستن حقوق صادر شده',
      hint: 'بعد از دعوت اولیه به دفاعیه می‌آید. اگر رأی تبرئه شود، ' +
        'کارتابل تا صدور نامهٔ باز کردن حقوق دست برنمی‌دارد.',
      fields: ['salaryStopLetterNo', 'salaryStopLetterDate']
    },
    {
      /* نامهٔ دعوت به جلسهٔ کمیته، سرِ تبِ «جلسه و رأی» — پیش از خودِ
         جلسه و رأی، چون در واقعیت هم اول این نامه می‌رود. */
      key: 'hearingLetter', group: 'verdict', place: 'tabTop',
      label: 'نامهٔ دعوت به جلسهٔ کمیته',
      ask: 'برای این پرونده نامهٔ دعوت به جلسهٔ کمیته صادر شده',
      hint: 'شماره و تاریخ نامهٔ دعوت/حضور در جلسهٔ کمیته.',
      fields: ['hearingLetterNo', 'hearingLetterDate']
    },
    {
      key: 'salaryResume', group: 'enforce', label: 'نامهٔ باز کردن حقوق',
      ask: 'نامهٔ باز کردن حقوق صادر شده',
      hint: 'برای کسی که حقوقش بسته شده و رأی تبرئه گرفته، الزامی است.',
      fields: ['salaryResumeLetterNo', 'salaryResumeLetterDate']
    },
    {
      key: 'outcome', group: 'enforce', place: 'tabBottom',
      label: 'پس از ابلاغ رأی: اخراج یا تعهد',
      ask: 'بعد از ابلاغ رأی، اقدامی روی کارمند انجام شده',
      hint: 'یکی اخراج می‌شود، از یکی تعهد گرفته می‌شود؛ هرکدام شد، همین‌جا.',
      fields: ['enforceOutcome', 'dismissalLetterNo', 'dismissalDate',
        'undertakingDate', 'undertakingNote']
    },
    {
      /* «نوع پرونده» یک فیلد تنها نیست: نوع، موضوع گزارش، سابقه، مراجع و
         توضیحات با هم یک چیز را می‌گویند — این پرونده دربارهٔ چیست. جایشان
         ته صفحه است، چون متن‌اند و بلند، و بالای صفحه باید شماره و تاریخ و
         نام باشد. */
      key: 'subject', group: 'case', place: 'tabBottom', always: true,
      label: 'نوع پرونده و موضوع گزارش',
      hint: 'نوع پرونده، موضوع گزارش، سابقه، مراجع و توضیحات.',
      fields: ['caseType', 'reportSubject', 'priorRecord',
        'pastReporters', 'notes']
    }
  ];

  var BLOCK_OF_FIELD = {};
  OPTIONAL_BLOCKS.forEach(function (b) {
    b.fields.forEach(function (k) { BLOCK_OF_FIELD[k] = b; });
  });

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
                w.UIViewer.open([d], 0);
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
    /* کلیدهایی که کاربر در همین نشست دست زده. لازم است چون پرونده ممکن
       است «از بیرونِ فرم» هم عوض شود — هم‌خوان‌سازی سند، تنظیم دستی
       مرحله، اقدام دسته‌ای — و آن‌وقت باید بدانیم کدام مقدار حرفِ کاربر
       است و کدام را می‌شود از رکورد تازه گرفت. */
    var edited = {};
    /* بخش‌های اختیاری‌ای که کاربر در همین نشست باز کرده (بخشی که داده
       دارد، خودبه‌خود باز است و اینجا نمی‌آید). */
    var openBlocks = {};
    var dirty = false;
    var activeTab = app.state.formTab || w.GROUPS[0].key;

    var saveBtn, warnBox, errBox, headTitle, dirtyChip;

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
      edited[key] = true;
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

    /*
     * خواندن دوبارهٔ پرونده در فرمِ باز.
     *
     * تا امروز draft یک بار — موقع باز شدن پرونده — ساخته می‌شد و دیگر
     * عوض نمی‌شد. ولی وسط کار، خودِ برنامه هم روی پرونده می‌نویسد: سندی
     * که بارگذاری می‌شود شمارهٔ نامه و تاریخش را در پرونده می‌نشاند
     * (applyToCase). نتیجه این بود که آن فیلدها در فرم خالی می‌ماندند —
     * و بدتر، ذخیرهٔ بعدی همان خالی را روی داده می‌نوشت.
     *
     * پس هر بار که پنل رندر می‌شود یا فرم ذخیره می‌شود، رکورد تازه خوانده
     * می‌شود؛ ولی فقط برای فیلدهایی که کاربر دست نزده. دست‌نوشتهٔ کاربر
     * هیچ‌وقت بازنویسی نمی‌شود، حتی اگر روی دیسک چیز دیگری نشسته باشد.
     */
    function adoptRecord() {
      if (!existing) return;
      var fresh = M.get(existing.id);
      if (!fresh) return;
      var now = M.strip(fresh);
      Object.keys(now).forEach(function (k) {
        if (edited[k] || k === 'id') return;
        if (draft[k] === now[k]) return;
        draft[k] = now[k];
      });
      Object.keys(draft).forEach(function (k) {
        if (edited[k] || k === 'id') return;
        if (now[k] === undefined) delete draft[k];
      });
    }

    function collect() {
      adoptRecord();
      return draft;
    }

    /**
     * بررسی پیش از ذخیره.
     *
     * نکتهٔ مهم: هیچ‌کدام از این مسیرها نباید app.render() صدا بزند. آن
     * تابع کل فرم را از نو می‌سازد و پیش‌نویسِ تایپ‌شده را دور می‌ریزد —
     * یعنی کاربر یک فیلد را اشتباه می‌زد و همهٔ کارش پاک می‌شد. به‌جایش
     * فقط تبِ درست باز و همان فیلد روشن می‌شود؛ draft دست‌نخورده می‌ماند.
     */
    function problems() {
      var out = [];
      if (!draft.caseNo) {
        out.push({ field: 'caseNo', text: 'شمارهٔ پرونده الزامی است.' });
      }
      // تاریخی که خوانده نشده، نباید بی‌صدا نادیده گرفته شود
      w.U.$$('.date-field', panel).forEach(function (node) {
        if (!node.isInvalid || !node.isInvalid()) return;
        var wrap = node.closest('[data-field]');
        out.push({
          field: wrap ? wrap.dataset.field : '',
          text: 'تاریخ «' + (wrap ? labelOf(wrap.dataset.field) : '') +
            '» خوانده نشد: ' + node.raw()
        });
      });
      return out;
    }

    function labelOf(key) {
      var found = '';
      M.FIELDS.forEach(function (f) { if (f.key === key) found = cleanLabel(f.label); });
      return found || key;
    }

    function showProblems(list) {
      w.U.$$('.field.has-error', panel).forEach(function (n) {
        n.classList.remove('has-error');
        var e = n.querySelector('.field-error');
        if (e) e.remove();
      });
      w.U.clear(errBox);
      if (!list.length) { errBox.style.display = 'none'; return; }
      errBox.style.display = '';
      errBox.appendChild(el('b', {
        text: list.length === 1 ? 'یک مورد باید درست شود:'
          : w.U.toFaDigits(list.length) + ' مورد باید درست شود:'
      }));
      errBox.appendChild(el('ul', null, list.map(function (p) {
        return el('li', null, [
          el('button.linkish', {
            type: 'button', text: p.text,
            onclick: function () { if (p.field) jumpToField(p.field); }
          })
        ]);
      })));
      // نشانه‌گذاری روی خود فیلدها، برای وقتی کاربر همان تب است
      list.forEach(function (p) {
        var node = panel.querySelector('[data-field="' + p.field + '"]');
        if (!node) return;
        node.classList.add('has-error');
        if (!node.querySelector('.field-error')) {
          node.appendChild(el('div.field-error', { text: p.text }));
        }
      });
      jumpToField(list[0].field);
    }

    function doSave() {
      var data = collect();
      var bad = problems();
      if (bad.length) {
        showProblems(bad);
        w.U.toast(bad[0].text, 'bad');
        return;
      }
      showProblems([]);
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
        return t.groups.indexOf(f.group) >= 0 && !f.hidden && draft[f.key];
      }).length);
    });
    makeTab('__notes', 'کارها و یادداشت‌ها',
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

    /*
     * گیرهٔ کاغذ کنار فیلدهای نامه.
     *
     * هر جا شمارهٔ نامه یا تاریخ نامه‌ای هست، پشتش یک کاغذ واقعی است. این
     * دکمه همان‌جا یا سندِ ثبت‌شده را نشان می‌دهد، یا پنجرهٔ بارگذاری را با
     * نوعِ درست باز می‌کند — با جای متن نامه و خود تصویر. نتیجه در همان
     * تب مستندات جمع می‌شود، نه جای جدا.
     */
    function letterClip(f) {
      if (!existing) return null;
      var kind = w.Docs.kindForField(f.key);
      if (!kind) return null;
      var have = w.Docs.status().linked ? w.Docs.ofKind(existing.id, kind) : [];
      var btn = el('button.letter-clip' + (have.length ? '.has' : ''), {
        type: 'button',
        title: have.length
          ? w.U.toFaDigits(have.length) + ' سند «' + kind + '» — برای دیدن کلیک کنید'
          : 'پیوست «' + kind + '»: متن نامه و تصویرش',
        html: w.Mobile.icon('paperclip')
      }, [
        have.length ? el('span.letter-clip-n', { text: w.U.toFaDigits(have.length) }) : null
      ]);
      // برچسب، فیلد را فوکوس می‌کند؛ کلیک روی گیره نباید این کار را بکند
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (have.length) {
          w.UIViewer.open(have, 0);
          return;
        }
        w.UIDocs.addFrom(existing, function () {
          app.state.formTab = activeTab;
          app.render();
        }, { kind: kind });
      });
      return btn;
    }

    var panel = el('div.form-panel');

    /*
     * شمارش معکوس، چسبیده به خودِ فیلد مهلت.
     *
     * تاریخ که وارد شد، همان‌جا — بی‌آنکه لازم باشد ذخیره کنید یا صفحه
     * عوض شود — می‌گوید چند روز مانده و چقدرش گذشته. این همان عددی است
     * که بالای پرونده و در فهرست هم دیده می‌شود، از یک تابع.
     */
    function countdownChip() {
      var box = el('div.cd-inline');
      box.paint = function () {
        w.U.clear(box);
        box.className = 'cd-inline';
        if (draft.defenseReceivedDate) {
          box.appendChild(el('span.cd-inline-note', {
            text: '✓ دفاعیه در ' + J.format(draft.defenseReceivedDate) +
              ' رسید؛ شمارش تمام شد.'
          }));
          return;
        }
        var cd = w.Worklist.defenseWatch(draft);
        if (!cd) {
          box.appendChild(el('span.cd-inline-note.muted', {
            text: 'تاریخ مهلت را بگذارید تا شمارش معکوس شروع شود.'
          }));
          return;
        }
        box.classList.add('is-' + cd.state);
        var fill = el('span.cd-fill');
        box.appendChild(el('b.cd-inline-n', { text: w.UIWorklist.cdText(cd) }));
        box.appendChild(el('span.cd-line', null, [fill]));
        setTimeout(function () { fill.style.width = cd.pct + '%'; }, 60);
      };
      box.paint();
      return box;
    }

    /** شبکهٔ فیلدها — همان چیدمانی که همه‌جای فرم است */
    function fieldGrid(fields) {
      var grid = el('div.field-grid');
      fields.forEach(function (f) {
        var chip = null;
        var input = makeInput(f, draft[f.key] || '', function (v) {
          setField(f.key, v);
          if (chip) chip.paint();
        }, app);
        var label = el('span.field-label', {
          text: cleanLabel(f.label), title: f.label
        });
        var clip = letterClip(f);
        if (f.key === 'defenseDueDate') chip = countdownChip();
        grid.appendChild(el('label.field' +
          (f.type === 'textarea' ? '.wide' : '') + (chip ? '.has-cd' : ''),
          { 'data-field': f.key }, [
            // گیرهٔ پیوست کنار برچسب می‌نشیند، نه زیرش
            clip ? el('span.field-head', null, [label, clip]) : label,
            input,
            chip
          ]));
      });
      return grid;
    }

    /** یک بخش اختیاری: باز اگر داده دارد یا کاربر بازش کرده، وگرنه یک سطر */
    function blockNode(b) {
      var fields = M.FIELDS.filter(function (f) {
        return b.fields.indexOf(f.key) >= 0 && !f.hidden;
      });
      // ترتیبِ نوشته‌شده در خودِ بخش مقدم است، نه ترتیب فایل فیلدها
      fields.sort(function (a, c) {
        return b.fields.indexOf(a.key) - b.fields.indexOf(c.key);
      });
      var filled = fields.filter(function (f) { return draft[f.key]; });
      var open = b.always || filled.length > 0 || openBlocks[b.key];

      if (!open) {
        return el('div.form-block.is-off', { 'data-block': b.key }, [
          el('div.form-block-off-text', null, [
            el('b', { text: b.label }),
            el('span.muted.tiny', { text: 'برای این پرونده ثبت نشده. ' + b.hint })
          ]),
          el('button.btn.small.ghost', {
            type: 'button', text: '＋ ' + b.ask,
            onclick: function () {
              openBlocks[b.key] = true;
              renderPanel();
              setTimeout(function () {
                var first = panel.querySelector('[data-block="' + b.key + '"] input');
                if (first) first.focus();
              }, 40);
            }
          })
        ]);
      }

      var head = el('div.form-block-head', null, [
        el('h5', { text: b.label }),
        el('span.form-block-n', {
          text: w.U.toFaDigits(filled.length) + ' از ' +
            w.U.toFaDigits(fields.length) + ' پرشده'
        }),
        el('div.spacer')
      ]);
      /* بستنِ بخشی که داده دارد، یعنی پنهان کردن داده — پس فقط بخشِ خالی
         جمع می‌شود. بخش همیشگی هم اصلاً جمع نمی‌شود. */
      if (!filled.length && !b.always) {
        head.appendChild(el('button.linkish.tiny', {
          type: 'button', text: 'ندارد، جمعش کن',
          onclick: function () {
            openBlocks[b.key] = false;
            renderPanel();
          }
        }));
      }
      return el('section.form-block' + (b.always ? '.is-always' : ''),
        { 'data-block': b.key }, [head, fieldGrid(fields)]);
    }

    function renderPanel() {
      adoptRecord();
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

      var tabBlocks = OPTIONAL_BLOCKS.filter(function (b) {
        return tab.groups.indexOf(b.group) >= 0;
      });
      // بخش‌هایی که جای ثابت دارند، از چرخهٔ گروه‌ها بیرون‌اند
      tabBlocks.filter(function (b) { return b.place === 'tabTop'; })
        .forEach(function (b) { panel.appendChild(blockNode(b)); });

      tab.groups.forEach(function (gk) {
        // فیلدهای پنهان (مثل مرحلهٔ دستی) جایشان بالای پرونده است، نه در فرم
        var all = M.FIELDS.filter(function (f) {
          return f.group === gk && !f.hidden;
        });
        var mine = tabBlocks.filter(function (b) { return b.group === gk; });
        var blocks = mine.filter(function (b) { return !b.place; });
        var inBlock = {};
        mine.forEach(function (b) {
          b.fields.forEach(function (k) { inBlock[k] = true; });
        });
        var fields = all.filter(function (f) { return !inBlock[f.key]; });
        if (!fields.length && !blocks.length) return;
        // وقتی چند گروه در یک تب‌اند، هرکدام سربرگ خودش را دارد
        if (many) {
          var filled = all.filter(function (f) { return draft[f.key]; }).length;
          panel.appendChild(el('div.form-section-head', null, [
            el('h4', { text: GROUP_LABEL[gk] || gk }),
            el('span.form-section-count', {
              text: w.U.toFaDigits(filled) + ' از ' + w.U.toFaDigits(all.length) + ' پرشده'
            })
          ]));
        }
        if (fields.length) panel.appendChild(fieldGrid(fields));
        blocks.forEach(function (b) { panel.appendChild(blockNode(b)); });
      });

      tabBlocks.filter(function (b) { return b.place === 'tabBottom'; })
        .forEach(function (b) { panel.appendChild(blockNode(b)); });
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
      var needRender = false;
      if (target.key !== activeTab) {
        activeTab = target.key;
        app.state.formTab = activeTab;
        w.U.$$('.tab', tabs).forEach(function (t) {
          t.classList.toggle('active', t.dataset.tab === activeTab);
        });
        needRender = true;
      }
      /* اگر فیلد داخل یک بخش اختیاریِ جمع‌شده است، اول بازش کن — وگرنه
         «رفتن به فیلد» به جایی می‌رسد که فیلدی آنجا نیست. */
      var block = BLOCK_OF_FIELD[key];
      if (block && !openBlocks[block.key]) {
        openBlocks[block.key] = true;
        needRender = true;
      }
      if (needRender) renderPanel();
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
            /* پر شدن فیلدهای پرونده کار خودِ لایهٔ مستندات است (applyToCase)
               تا از هر سه مسیر یکسان باشد؛ اینجا فقط دوباره رندر می‌کنیم. */
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
    errBox = el('div.err-box');
    errBox.style.display = 'none';

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
        next = el('div.case-next' + (action.overdue ? '.late' : '') +
          (action.manual ? '.manual' : ''), null, [
          el('div.case-next-text', null, [
            el('span.case-next-label', { text: action.label }),
            action.manual ? el('span.stage-manual-tag', { text: 'مرحلهٔ دستی' }) : null,
            w.U.dots(meta, '.case-next-meta'),
            // وقتی دستی تنظیم شده، محاسبهٔ خودکار هم گفته می‌شود تا پنهان نماند
            action.manual && action.autoLabel && action.autoKey !== action.key
              ? el('span.case-next-auto', {
                text: 'بر اساس تاریخ‌های ثبت‌شده: ' + action.autoLabel
              })
              : null
          ]),
          el('div.spacer'),
          el('button.btn.small.ghost.case-stage', {
            type: 'button',
            text: action.manual ? 'تغییر مرحله' : 'تنظیم دستی مرحله',
            title: 'اگر مرحلهٔ واقعی پرونده با تاریخ‌های ثبت‌شده نمی‌خواند',
            onclick: function () {
              w.UIStage.dialog(app, existing, function () {
                app.state.formTab = activeTab;
                app.render();
              });
            }
          }),
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

      /*
       * یادداشت‌ها بالای پرونده.
       *
       * «اقدام بعدی» را برنامه حساب می‌کند؛ یادداشت را خودِ کاربر نوشته و
       * چیزی می‌گوید که هیچ فیلدی نمی‌گوید («با حراست تماس گرفته شود»).
       * تا امروز فقط قرارِ پیگیری‌دار دیده می‌شد و یادداشت بدون تاریخ
       * پنهان می‌ماند. حالا تازه‌ترین یادداشتِ باز — با تاریخ یا بی‌تاریخ —
       * همین‌جا می‌آید، با شمارش بقیه.
       */
      var note = w.Notes.headline(existing.id);
      var openNotes = w.Notes.openCount(existing.id);
      var followNode = null;
      if (note) {
        var late = note.followUp && J.diffDays(J.today(), note.followUp) > 0;
        followNode = el('div.case-next.follow' + (late ? '.late' : ''), null, [
          el('span.case-next-label', {
            text: note.followUp
              ? (note.kind === 'task' ? 'کار ' : 'پیگیری ') + J.format(note.followUp)
              : (note.kind === 'task' ? 'کار' : 'یادداشت')
          }),
          el('div.case-next-text', null, [
            el('span.case-next-meta', {
              text: w.Notes.preview(w.Notes.textOf(note), 120)
            }),
            note.followUp ? el('span.case-next-auto', {
              text: w.UINotes.relativeDay(note.followUp)
            }) : null
          ]),
          el('div.spacer'),
          openNotes > 1 ? el('button.linkish.tiny', {
            type: 'button',
            text: '+' + w.U.toFaDigits(openNotes - 1) + ' مورد دیگر',
            onclick: function () {
              activeTab = '__notes';
              app.state.formTab = activeTab;
              w.U.$$('.tab', tabs).forEach(function (t) {
                t.classList.toggle('active', t.dataset.tab === '__notes');
              });
              renderPanel();
            }
          }) : null,
          note.followUp ? el('button.btn.small', {
            type: 'button', text: 'انجام شد',
            onclick: function () {
              w.Notes.complete(note).then(function () {
                app.state.formTab = activeTab;
                app.render();
              });
            }
          }) : null
        ]);
      }
      /* شمارش معکوسِ مهلت دفاعیه، بینِ «اقدام بعدی» و یادداشت.
         پرونده‌ای که مهلتش دارد تمام می‌شود، نباید این را در تبِ دعوت
         پنهان کند: جایش همان بالاست، کنار بقیهٔ هشدارها. */
      var cdNode = w.UIWorklist.countdown(M.get(existing.id) || existing,
        function () {
          w.UIDocs.addFrom(existing, function () {
            app.state.formTab = activeTab;
            app.render();
          }, { kind: 'نامهٔ پیگیری دفاعیات' });
        },
        function () { jumpToField('defenseReceivedDate'); });

      return el('div.case-rail', null, [
        w.UIWorklist.rail(existing, 'full', function (fieldKey) {
          jumpToField(fieldKey);
        }),
        transferNode || next,
        cdNode,
        followNode
      ]);
    }

    w.U.clear(mount);
    mount.appendChild(el('div.case-view', null, [
      el('div.case-head', null, [headTitle, actions]),
      railCard(),
      warnBox, errBox, tabs, panel
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

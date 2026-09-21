/* تب «مستندات» در پروندهٔ هر فرد */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, D = w.Docs;

  function extOf(name) {
    var m = /\.([A-Za-z0-9]+)$/.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  /* خانوادهٔ فایل: تصویر و PDF پیش‌نمایش واقعی می‌گیرند، بقیه یک کاشیِ
     نوع‌دار — آیکن خطی + خودِ پسوند. پسوند، بیشتر از هر شکلکی می‌گوید
     فایل چیست. */
  var FAMILY = {
    doc: ['doc', 'docx', 'rtf', 'odt'],
    sheet: ['xls', 'xlsx', 'csv', 'ods'],
    slide: ['ppt', 'pptx', 'odp'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz'],
    text: ['txt', 'md', 'log'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tif', 'tiff'],
    pdf: ['pdf']
  };

  function familyOf(name) {
    var ext = extOf(name);
    var found = 'other';
    Object.keys(FAMILY).forEach(function (fam) {
      if (FAMILY[fam].indexOf(ext) >= 0) found = fam;
    });
    return found;
  }

  var FAMILY_ICON = {
    doc: 'fileText', sheet: 'fileSheet', slide: 'fileSheet',
    archive: 'fileZip', text: 'fileText', image: 'fileImage',
    pdf: 'filePdf', other: 'file'
  };

  /** آیکن خطیِ نوع فایل، برای سطرها و تایم‌لاین */
  function iconFor(name) {
    return w.Mobile.icon(FAMILY_ICON[familyOf(name)] || 'file');
  }

  var IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'];

  function isImage(doc) {
    return (doc.mime || '').indexOf('image/') === 0 ||
      IMAGE_EXT.indexOf(extOf(doc.fileName)) >= 0;
  }

  function isPdf(doc) {
    return (doc.mime || '') === 'application/pdf' || extOf(doc.fileName) === 'pdf';
  }

  // ------------------------------------------------------------- پیش‌نمایش
  // نشانی‌های موقت فایل‌ها؛ با هر بار رندر دوبارهٔ پنل آزاد می‌شوند تا حافظه
  // نشت نکند.
  var thumbUrls = [];
  var observer = null;
  var pdfBudget = 0;
  var PDF_LIMIT = 16;          // سقف تعداد پیش‌نمایش هم‌زمان PDF

  function releaseThumbs() {
    thumbUrls.forEach(function (u) {
      try { URL.revokeObjectURL(u); } catch (e) { /* از قبل آزاد شده */ }
    });
    thumbUrls = [];
    pdfBudget = 0;
    if (observer) { observer.disconnect(); observer = null; }
  }

  function trackUrl(url) { thumbUrls.push(url); return url; }

  var MIME_BY_EXT = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    bmp: 'image/bmp', avif: 'image/avif'
  };

  /**
   * نشانی موقت با نوع MIME صریح.
   * اگر فایل نوع نداشته باشد، مرورگر PDF را متن ساده نشان می‌دهد؛ نوع را از
   * پسوند جبران می‌کنیم.
   */
  function objectUrlFor(file, doc) {
    var wanted = MIME_BY_EXT[extOf(doc.fileName)] || '';
    var blob = (wanted && file.type !== wanted)
      ? new Blob([file], { type: wanted })
      : file;
    return trackUrl(URL.createObjectURL(blob));
  }

  function fillThumb(box, doc) {
    if (box.dataset.loaded) return;
    box.dataset.loaded = '1';
    D.readFile(doc).then(function (file) {
      if (!document.body.contains(box)) return;
      var url = objectUrlFor(file, doc);
      if (isImage(doc)) {
        var img = el('img.thumb-img', { src: url, alt: doc.kind, loading: 'lazy' });
        img.addEventListener('load', function () { box.classList.add('ready'); });
        img.addEventListener('error', function () { box.classList.add('icon-only'); });
        w.U.clear(box);
        box.appendChild(img);
        return;
      }
      // PDF بدون کتابخانه: نمایشگر داخلی مرورگر، کوچک‌شده و بدون نوار ابزار
      if (pdfBudget >= PDF_LIMIT) return;
      pdfBudget += 1;
      var frame = el('iframe.thumb-pdf', {
        src: url + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH',
        tabindex: '-1', 'aria-hidden': 'true', loading: 'lazy'
      });
      w.U.clear(box);
      box.appendChild(frame);
      box.classList.add('ready', 'pdf');
    }).catch(function () {
      box.classList.add('icon-only');
    });
  }

  function getObserver() {
    if (observer) return observer;
    if (typeof w.IntersectionObserver !== 'function') return null;
    observer = new w.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        observer.unobserve(e.target);
        fillThumb(e.target, e.target._doc);
      });
    }, { rootMargin: '200px' });
    return observer;
  }

  /** جعبهٔ پیش‌نمایش: تصویر یا صفحهٔ اول PDF، وگرنه کاشیِ نوع فایل */
  function thumb(doc, onOpen) {
    var previewable = isImage(doc) || isPdf(doc);
    var fam = familyOf(doc.fileName);
    var ext = extOf(doc.fileName);
    var box = el('button.doc-thumb.fam-' + fam + (previewable ? '' : '.icon-only'), {
      type: 'button',
      title: previewable ? 'باز کردن ' + doc.fileName : doc.fileName,
      onclick: onOpen
    }, [
      el('span.doc-icon', { html: w.Mobile.icon(FAMILY_ICON[fam]) }),
      ext ? el('span.doc-ext', { text: ext.toUpperCase() }) : null
    ]);
    if (!previewable || !D.status().linked) return box;
    box._doc = doc;
    var obs = getObserver();
    if (obs) obs.observe(box); else fillThumb(box, doc);
    return box;
  }

  function sizeText(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return w.U.toFaDigits(bytes) + ' بایت';
    if (bytes < 1048576) return w.U.toFaDigits(Math.round(bytes / 1024)) + ' کیلوبایت';
    return w.U.toFaDigits((bytes / 1048576).toFixed(1)) + ' مگابایت';
  }

  /** از نام فایل، تاریخ و شمارهٔ نامه را حدس می‌زند تا ورود سریع‌تر شود */
  function guessFromName(name) {
    var clean = w.U.toLatinDigits(name || '');
    var out = {};
    var d = /(1[34]\d{2})[-\/_.]?(\d{2})[-\/_.]?(\d{2})/.exec(clean);
    if (d) {
      var packed = d[1] + d[2] + d[3];
      if (J.unpack(packed)) out.docDate = packed;
    }
    /* تاریخ را از نام برمی‌داریم پیش از حدسِ شمارهٔ نامه. وگرنه در
       «۱۴۰۵-۰۶-۳۰-ray-1.pdf» خودِ تاریخ به‌عنوان شمارهٔ نامه خوانده
       می‌شود — و در یک دستهٔ بیست‌تایی، بیست شمارهٔ غلط. */
    var rest = d ? clean.replace(d[0], ' ') : clean;
    var l = /(\d{2,6}[\/\-]\d{2,6}(?:[\/\-][؀-ۿ\w]+)*)/.exec(rest);
    if (l) out.letterNo = l[1];
    return out;
  }

  function pickFiles(multiple) {
    return new Promise(function (resolve) {
      var input = el('input', { type: 'file', multiple: multiple ? true : null });
      input.style.display = 'none';
      input.addEventListener('change', function () {
        resolve(Array.prototype.slice.call(input.files || []));
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  // --------------------------------------------------- پنجرهٔ افزودن مستندات
  /**
   * ویرایشگر تگ: چیپ‌ها + یک ورودی با پیشنهاد.
   *
   * تگ آزادِ محض بعد از سه ماه می‌شود «آرا»، «آراء» و «آرای صادره»؛ پس
   * هرچه تا امروز به کار رفته پیشنهاد می‌شود، پرتکرارترین اول.
   */
  function tagField(initial, onChange) {
    var tags = D.cleanTags(initial || []);
    var chips = el('div.tag-chips');
    var listId = 'tags-' + w.U.uid();
    var dl = el('datalist', { id: listId });
    D.tagSuggestions().forEach(function (t) {
      dl.appendChild(el('option', { value: t }));
    });
    var input = el('input.input.small.tag-input', {
      type: 'text', list: listId, placeholder: 'تگ… (اختیاری)'
    });

    function emit() { if (onChange) onChange(tags.slice()); }

    function paint() {
      w.U.clear(chips);
      tags.forEach(function (t) {
        chips.appendChild(el('button.tag-chip', {
          type: 'button', title: 'برداشتن این تگ',
          onclick: function () {
            tags = tags.filter(function (x) { return x !== t; });
            paint();
            emit();
          }
        }, [el('span', { text: t }), el('span.tag-x', { text: '×' })]));
      });
    }

    function add(v) {
      var next = D.cleanTags(tags.concat([v]));
      if (next.length === tags.length) { input.value = ''; return; }
      tags = next;
      input.value = '';
      paint();
      emit();
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
        e.preventDefault();
        if (input.value.trim()) add(input.value);
      } else if (e.key === 'Backspace' && !input.value && tags.length) {
        tags.pop();
        paint();
        emit();
      }
    });
    input.addEventListener('change', function () {
      if (input.value.trim()) add(input.value);
    });

    paint();
    var node = el('div.tag-field', null, [chips, input, dl]);
    node.getTags = function () { return tags.slice(); };
    node.setTags = function (list) { tags = D.cleanTags(list); paint(); };
    return node;
  }

  /** ورودی پرونده: شماره، نام یا کد ملی */
  function caseField(value, onPick) {
    var listId = 'dcase-' + w.U.uid();
    var dl = el('datalist', { id: listId });
    M.state.cases.forEach(function (c) {
      dl.appendChild(el('option', { value: caseLabel(c) }));
    });
    var input = el('input.input.small', {
      type: 'text', list: listId, value: value || '',
      placeholder: 'شماره، نام یا کد ملی — خالی یعنی بی‌پرونده'
    });
    var hint = el('span.muted.tiny.dcase-hint');
    function sync() {
      var rec = findCase(input.value);
      hint.textContent = !input.value.trim() ? 'بی‌پرونده — در بایگانی می‌نشیند'
        : (rec ? caseLabel(rec) : 'پیدا نشد؛ بی‌پرونده ثبت می‌شود');
      hint.className = 'tiny dcase-hint ' + (!input.value.trim() || rec ? 'muted' : 'warn-text');
      if (onPick) onPick(rec);
    }
    input.addEventListener('input', sync);
    sync();
    var node = el('div.dcase-field', null, [input, dl, hint]);
    node.getCase = function () { return findCase(input.value); };
    node.setValue = function (v) { input.value = v; sync(); };
    return node;
  }

  function caseLabel(rec) {
    return w.U.toLatinDigits(rec.caseNo || '') + ' — ' +
      ([rec.firstName, rec.lastName].filter(Boolean).join(' ') || 'بدون نام') +
      (rec.nationalId ? ' — ' + w.U.toLatinDigits(rec.nationalId) : '');
  }

  /** همان جستجوی «کارها»: شماره، نام، یا کد ملی */
  function findCase(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var head = w.U.toLatinDigits(raw.split('—')[0]).trim();
    var norm = w.U.normalize(raw);
    var exact = null, starts = null, has = null;
    M.state.cases.forEach(function (c) {
      var no = w.U.toLatinDigits(c.caseNo || '').trim();
      var nid = w.U.toLatinDigits(c.nationalId || '').trim();
      if (no && no === head) { exact = exact || c; return; }
      if (nid && (nid === head || nid === w.U.toLatinDigits(raw).trim())) {
        exact = exact || c;
        return;
      }
      var name = w.U.normalize([c.firstName, c.lastName].filter(Boolean).join(' '));
      if (!name || !norm) return;
      if (name === norm) exact = exact || c;
      else if (name.indexOf(norm) === 0) starts = starts || c;
      else if (name.indexOf(norm) >= 0) has = has || c;
    });
    return exact || starts || has;
  }

  /**
   * پنجرهٔ افزودن سند — یک سطر برای هر فایل.
   *
   * opts.freeCase: هر سطر پروندهٔ خودش را دارد و می‌تواند بی‌پرونده بماند
   * (بارگذاری دسته‌ای از نمای بایگانی). بدون آن، همه‌چیز به rec می‌چسبد.
   *
   * با بیش از یک فایل، یک سربرگ بالا می‌آید که یک بار زده می‌شود و روی
   * همه می‌نشیند — وگرنه برای بیست اسکن باید بیست بار نوع و تاریخ زد و
   * کسی این کار را نمی‌کند.
   */
  function addDialog(rec, files, onDone, opts) {
    opts = opts || {};
    var freeCase = !!opts.freeCase;
    var person = rec ? w.Person.forCase(rec) : null;
    var multiCase = person && person.caseCount > 1;
    var batchId = w.U.uid();

    var rows = files.map(function (file, idx) {
      var guess = guessFromName(file.name);
      /* آنچه پرونده از قبل دربارهٔ این نوع سند می‌داند — شمارهٔ نامه و
         تاریخش — همین‌جا از قبل پر می‌شود. کاربر دوباره تایپشان نمی‌کند. */
      function fromCase(kind, forRec) {
        var target = forRec || state.rec;
        var map = D.fieldsForKind(kind);
        if (!map || !target) return {};
        return {
          docDate: map.date ? (target[map.date] || '') : '',
          letterNo: map.no ? (target[map.no] || '') : ''
        };
      }
      var state = {
        file: file,
        rec: freeCase ? null : rec,
        kind: opts.kind || 'سایر',
        title: '',
        body: '',
        tags: (opts.tags || []).slice(),
        category: D.categoryOf(opts.kind || 'سایر'),
        direction: D.directionOf(opts.kind || 'سایر'),
        scope: opts.scope || (freeCase ? 'general' : 'case')
      };
      var known = fromCase(state.kind, state.rec);
      state.docDate = known.docDate || guess.docDate ||
        (state.rec ? state.rec.intakeDate : '') || J.today();
      state.letterNo = known.letterNo || guess.letterNo || '';

      // سطح سند: این پرونده، یا مدرک مشترک شخص
      var scopeSel = el('select.input.small');
      scopeSel.appendChild(el('option', { value: 'case', text: 'فقط این پرونده' }));
      scopeSel.appendChild(el('option', {
        value: 'person',
        text: 'مدرک شخص' + (multiCase
          ? ' (مشترک بین ' + w.U.toFaDigits(person.caseCount) + ' پرونده)' : '')
      }));
      scopeSel.value = state.scope === 'person' ? 'person' : 'case';
      scopeSel.addEventListener('change', function () { state.scope = scopeSel.value; });

      var kindSel = el('select.input.small');
      D.kinds().forEach(function (k) {
        kindSel.appendChild(el('option', { value: k, text: k, selected: k === state.kind }));
      });

      /* جهت نامه از نوع سند حدس زده می‌شود ولی قفل نیست: «سایر» ممکن است
         نامهٔ صادره باشد و کاربر باید بتواند بگوید. */
      var dirSel = el('select.input.small');
      D.DIRECTIONS.forEach(function (d) {
        dirSel.appendChild(el('option', { value: d.key, text: d.label }));
      });
      var catNode = el('span.doc-cat-chip');
      var dupNode = el('div.doc-dup');
      var dupSel = el('select.input.small');
      dupSel.appendChild(el('option', { value: 'version', text: 'نسخهٔ تازه از همان سند' }));
      dupSel.appendChild(el('option', { value: 'separate', text: 'سند جداگانه' }));
      dupSel.addEventListener('change', function () { state.dup = dupSel.value; });

      function syncKind(fromUser) {
        state.category = D.categoryOf(state.kind);
        catNode.textContent = 'دسته: ' + D.categoryLabel(state.category);
        if (fromUser) {
          state.direction = D.directionOf(state.kind);
          dirSel.value = state.direction;
          // نوع که عوض شد، آنچه پرونده دربارهٔ نوع تازه می‌داند پر شود
          var k = fromCase(state.kind);
          if (k.docDate) { state.docDate = k.docDate; dateField.setValue(k.docDate); }
          if (k.letterNo) { state.letterNo = k.letterNo; letterInput.value = k.letterNo; }
        }
        syncDup();
      }

      /*
       * سند تکراری.
       *
       * اگر از قبل سندی از همین نوع در پرونده هست، به احتمال زیاد این
       * همان است — اسکن دوباره، یا نسخهٔ اصلاح‌شده. پیش‌فرض «نسخهٔ تازه»
       * است تا فهرست مستندات با ده‌تا «دعوت‌نامهٔ جلسه» پر نشود؛ نسخهٔ
       * قبلی هم پاک نمی‌شود، زیر همان سند بایگانی می‌ماند.
       */
      function syncDup() {
        var target = state.rec;
        var existing = (state.scope === 'person' || !target) ? []
          : D.sameKind(target.id, state.kind);
        state.existing = existing[existing.length - 1] || null;
        w.U.clear(dupNode);
        if (!state.existing) { state.dup = 'separate'; return; }
        state.dup = state.dup || 'version';
        dupSel.value = state.dup;
        dupNode.appendChild(el('span', {
          text: 'یک سند «' + state.kind + '» از قبل هست' +
            (state.existing.docDate ? ' (' + J.format(state.existing.docDate) + ')' : '') +
            ' — این فایل چیست؟'
        }));
        dupNode.appendChild(dupSel);
      }
      dirSel.addEventListener('change', function () { state.direction = dirSel.value; });

      kindSel.addEventListener('change', function () {
        state.kind = kindSel.value;
        syncKind(true);
        // مدارک هویتی و حکم کارگزینی به شخص تعلق دارند، نه به یک پرونده
        if (!opts.scope && !freeCase) {
          state.scope = D.PERSON_KINDS.indexOf(state.kind) >= 0 ? 'person' : 'case';
          scopeSel.value = state.scope;
        }
      });

      var dateField = w.DatePicker.field(state.docDate, function (v) { state.docDate = v; });
      var letterInput = el('input.input.small', {
        type: 'text', value: state.letterNo, placeholder: 'شمارهٔ نامه'
      });
      letterInput.addEventListener('input', function () { state.letterNo = letterInput.value; });
      var titleInput = el('input.input.small', {
        type: 'text', placeholder: 'توضیح کوتاه (اختیاری)'
      });
      titleInput.addEventListener('input', function () { state.title = titleInput.value; });

      var tagsField = tagField(state.tags, function (list) { state.tags = list; });

      var caseNode = null;
      if (freeCase) {
        caseNode = caseField('', function (found) {
          state.rec = found;
          state.scope = found ? 'case' : 'general';
          syncDup();
        });
      }

      /* متن نامه تاشده است: بیشتر وقت‌ها لازم نیست، و باز گذاشتنش پنجره را
         شلوغ می‌کند. ولی وقتی نوشته شود، در جستجوی پرونده هم پیدا می‌شود. */
      var bodyInput = el('textarea.input.area', {
        rows: '4',
        placeholder: 'متن نامه را اینجا بنویسید یا بچسبانید — در جستجو پیدا می‌شود'
      });
      bodyInput.addEventListener('input', function () { state.body = bodyInput.value; });
      var bodyBox = el('details.doc-add-body', null, [
        el('summary', { text: 'متن نامه (اختیاری)' }), bodyInput
      ]);

      syncKind(false);
      dirSel.value = state.direction;

      var fields = [
        el('label.mini', { text: 'نوع سند' }), kindSel,
        el('label.mini', { text: 'وارده / صادره' }), dirSel
      ];
      if (freeCase) {
        fields.push(el('label.mini', { text: 'پرونده' }), caseNode);
      } else {
        fields.push(el('label.mini', { text: 'سطح سند' }), scopeSel);
      }
      fields.push(
        el('label.mini', { text: 'تاریخ سند' }), dateField,
        el('label.mini', { text: 'شمارهٔ نامه' }), letterInput,
        el('label.mini', { text: 'توضیح' }), titleInput,
        el('label.mini', { text: 'تگ' }), tagsField
      );

      var statusNode = el('span.doc-add-status');
      state.node = el('div.doc-add-row', null, [
        el('div.doc-add-file', null, [
          el('span.doc-icon', { html: iconFor(file.name) }),
          el('span.doc-add-name', { text: file.name, title: file.name }),
          el('span.muted.tiny', { text: sizeText(file.size) }),
          el('div.spacer'), statusNode, catNode
        ]),
        el('div.doc-add-fields', null, fields),
        dupNode,
        bodyBox
      ]);
      state.statusNode = statusNode;
      state.index = idx;
      /* سربرگ «روی همه بنشان» از همین دسته‌ها استفاده می‌کند */
      state.apply = function (h) {
        if (h.kind) {
          state.kind = h.kind;
          kindSel.value = h.kind;
          syncKind(true);
        }
        if (h.docDate) { state.docDate = h.docDate; dateField.setValue(h.docDate); }
        if (h.tags && h.tags.length) {
          state.tags = D.cleanTags(state.tags.concat(h.tags));
          tagsField.setTags(state.tags);
        }
        if (freeCase && h.caseText != null) {
          caseNode.setValue(h.caseText);
        }
      };
      return state;
    });

    // ------------------------------------------------------------- سربرگ
    var head = null;
    var batchName = el('input.input.small', {
      type: 'text', value: opts.batchName || '',
      placeholder: 'مثلاً: اسکن آرای صادره'
    });
    if (rows.length > 1) {
      var hKind = el('select.input.small');
      hKind.appendChild(el('option', { value: '', text: '— بدون تغییر —' }));
      D.kinds().forEach(function (k) {
        hKind.appendChild(el('option', { value: k, text: k }));
      });
      var hDate = w.DatePicker.field('', function () { });
      var hTags = tagField([], null);
      var hCase = freeCase ? caseField('', null) : null;

      head = el('div.batch-head', null, [
        el('div.batch-head-top', null, [
          el('h4', { text: 'روی همهٔ ' + w.U.toFaDigits(rows.length) + ' فایل' }),
          el('span.muted.tiny', { text: 'هر سطر می‌تواند بعدش خودش را عوض کند.' })
        ]),
        el('div.doc-add-fields', null, ([
          el('label.mini', { text: 'نوع سند' }), hKind,
          el('label.mini', { text: 'تاریخ سند' }), hDate
        ]).concat(freeCase
          ? [el('label.mini', { text: 'پرونده' }), hCase] : [])
          .concat([
            el('label.mini', { text: 'تگ' }), hTags,
            el('label.mini', { text: 'نام دسته' }), batchName
          ])),
        el('button.btn.small.primary.batch-apply', {
          type: 'button', text: 'روی همه بنشان',
          onclick: function () {
            /* تاریخِ نیمه‌تایپ‌شده نباید روی بیست فایل بنشیند؛ اگر
               خوانده نشد، تاریخ‌ها دست‌نخورده می‌مانند. */
            var d = hDate.getValue ? hDate.getValue() : '';
            if (d && !J.unpack(d)) {
              w.U.toast('تاریخ خوانده نشد — به شکل ۱۴۰۴/۰۷/۲۰ بنویسید.', 'warn');
              return;
            }
            var h = {
              kind: hKind.value,
              docDate: d,
              tags: hTags.getTags(),
              caseText: hCase ? hCase.querySelector('input').value : null
            };
            rows.forEach(function (r) { r.apply(h); });
            w.U.toast('روی ' + w.U.toFaDigits(rows.length) + ' فایل نشست.', 'good');
          }
        })
      ]);
    }

    var lead = freeCase
      ? el('p.muted.tiny', {
        text: 'سندی که پرونده‌اش را بزنید در پوشهٔ همان پرونده می‌نشیند؛ ' +
          'بقیه در «' + D.ARCHIVE_ROOT + '» و زیر نام دسته.'
      })
      : el('p.muted.tiny', {
        text: 'سند پرونده در پوشهٔ «' + (rec.docFolder || D.folderNameFor(rec)) +
          '» ذخیره می‌شود و مدرک شخص در «' + D.PERSON_ROOT + '/' +
          (person ? D.personFolderNameFor(person) : '') + '».'
      });

    var progress = el('div.doc-progress');
    var bar = el('div.doc-progress-bar');
    var progText = el('span.doc-progress-text');
    progress.appendChild(bar);
    progress.style.display = 'none';

    var body = el('div.doc-add', null,
      [lead, head, progress, progText].concat(rows.map(function (r) { return r.node; })));

    var m, busy = false;
    var save = el('button.btn.primary', {
      type: 'button', text: 'ثبت ' + w.U.toFaDigits(rows.length) + ' سند',
      onclick: function () {
        if (busy) return;
        busy = true;
        save.textContent = 'در حال ذخیره…';
        progress.style.display = '';
        var filled = [], versions = 0, done = 0, failed = 0, general = 0;
        var bname = batchName.value.trim();

        function step(n) {
          done = n;
          bar.style.width = Math.round((done / rows.length) * 100) + '%';
          progText.textContent = w.U.toFaDigits(done) + ' از ' +
            w.U.toFaDigits(rows.length) + ' ذخیره شد' +
            (failed ? ' — ' + w.U.toFaDigits(failed) + ' ناموفق' : '');
        }
        step(0);

        rows.reduce(function (chain, r, i) {
          return chain.then(function () {
            var meta = {
              kind: r.kind, docDate: r.docDate, category: r.category,
              direction: r.direction, body: r.body,
              letterNo: r.letterNo, title: r.title,
              tags: r.tags, batchId: batchId, batchName: bname
            };
            var target = r.rec || (freeCase ? null : rec);
            if (r.scope === 'person' && person) {
              return D.addPersonFile(person, r.file, meta, rec);
            }
            if (!target) {
              general += 1;
              return D.addGeneralFile(r.file, meta);
            }
            /* سند تکراری: به‌جای سند دوم، نسخهٔ تازه از همان. نسخهٔ قبلی
               پاک نمی‌شود؛ زیر همان سند بایگانی می‌ماند. */
            if (r.dup === 'version' && r.existing) {
              versions += 1;
              return D.addVersion(target, r.existing, r.file, meta);
            }
            return D.addFile(target, r.file, meta);
          }).then(function (doc) {
            // هر مسیری که سند ثبت کند، فیلدهای پرونده را هم پر می‌کند
            var target = r.rec || (freeCase ? null : rec);
            r.statusNode.textContent = '✓';
            r.statusNode.className = 'doc-add-status ok';
            if (!target) return null;
            return D.applyToCase(target, doc).then(function (list) {
              filled = filled.concat(list);
            });
          }).catch(function (err) {
            /* یک فایلِ خراب نباید نوزده‌تای دیگر را زمین بزند */
            failed += 1;
            r.statusNode.textContent = '✕';
            r.statusNode.className = 'doc-add-status bad';
            r.statusNode.title = err && err.message ? err.message : String(err);
          }).then(function () { step(i + 1); });
        }, Promise.resolve()).then(function () {
          m.close();
          var ok = rows.length - failed;
          w.U.toast(w.U.toFaDigits(ok) + ' سند ذخیره شد' +
            (general ? ' (' + w.U.toFaDigits(general) + ' در بایگانی)' : '') +
            (versions ? ' (' + w.U.toFaDigits(versions) + ' نسخهٔ تازه)' : '') +
            (failed ? ' — ' + w.U.toFaDigits(failed) + ' ناموفق' : '') +
            (filled.length
              ? ' و «' + filled.map(function (f) { return f.label; }).join('»، «') +
                '» پر شد.'
              : '.'), failed ? 'warn' : 'good');
          if (bname) D.addTag(bname).catch(function () { /* تگ نشد، مهم نیست */ });
          onDone({
            rows: rows.length, failed: failed, general: general,
            docDate: rows[0] && rows[0].docDate,
            batchId: batchId, batchName: bname,
            filled: filled, versions: versions
          });
        }).catch(function (err) {
          busy = false;
          save.textContent = 'ثبت دوباره';
          w.U.toast('ذخیرهٔ سند ناموفق بود: ' + err.message, 'bad');
        });
      }
    });

    m = w.U.modal(freeCase
      ? 'بارگذاری دسته‌ای سند' : 'افزودن سند به پرونده', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      save
    ]);
    m.root.classList.add('doc-add-modal');
  }

  // ------------------------------------------------------- ویرایش مشخصات
  /**
   * ویرایش فرادادهٔ سند — خود فایل دست نمی‌خورد.
   * بعد از ثبت هم آدم یادش می‌افتد نوع را اشتباه زده یا متن نامه را نگذاشته؛
   * تا حالا چاره‌اش حذف و ثبت دوباره بود.
   */
  function editDialog(doc, onDone) {
    var state = {
      kind: doc.kind, direction: doc.direction || '', docDate: doc.docDate,
      letterNo: doc.letterNo || '', title: doc.title || '', body: doc.body || ''
    };

    var kindSel = el('select.input.small');
    D.kinds().forEach(function (k) {
      kindSel.appendChild(el('option', { value: k, text: k, selected: k === state.kind }));
    });
    var catNode = el('span.doc-cat-chip');
    function syncCat() {
      catNode.textContent = 'دسته: ' + D.categoryLabel(D.categoryOf(state.kind));
    }
    kindSel.addEventListener('change', function () {
      state.kind = kindSel.value;
      state.direction = D.directionOf(state.kind);
      dirSel.value = state.direction;
      syncCat();
    });

    var dirSel = el('select.input.small');
    D.DIRECTIONS.forEach(function (d) {
      dirSel.appendChild(el('option', { value: d.key, text: d.label }));
    });
    dirSel.value = state.direction;
    dirSel.addEventListener('change', function () { state.direction = dirSel.value; });

    var dateField = w.DatePicker.field(state.docDate, function (v) { state.docDate = v; });
    var letterInput = el('input.input.small', { type: 'text', value: state.letterNo });
    letterInput.addEventListener('input', function () { state.letterNo = letterInput.value; });
    var titleInput = el('input.input.small', { type: 'text', value: state.title });
    titleInput.addEventListener('input', function () { state.title = titleInput.value; });
    var bodyInput = el('textarea.input.area', {
      rows: '6', placeholder: 'متن نامه — در جستجوی پرونده پیدا می‌شود'
    });
    bodyInput.value = state.body;
    bodyInput.addEventListener('input', function () { state.body = bodyInput.value; });
    syncCat();

    var body = el('div.doc-edit', null, [
      el('div.doc-add-file', null, [
        el('span.doc-icon', { html: iconFor(doc.fileName) }),
        el('span.doc-add-name', { text: doc.fileName, title: doc.fileName }),
        el('div.spacer'), catNode
      ]),
      el('div.doc-add-fields', null, [
        el('label.mini', { text: 'نوع سند' }), kindSel,
        el('label.mini', { text: 'وارده / صادره' }), dirSel,
        el('label.mini', { text: 'تاریخ سند' }), dateField,
        el('label.mini', { text: 'شمارهٔ نامه' }), letterInput,
        el('label.mini', { text: 'توضیح' }), titleInput
      ]),
      el('label.field.wide', null, [
        el('span.field-label', { text: 'متن نامه' }), bodyInput
      ])
    ]);

    var m = w.U.modal('ویرایش مشخصات سند', body, [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'ذخیرهٔ تغییرات',
        onclick: function () {
          D.updateMeta(doc, state).then(function () {
            m.close();
            w.U.toast('مشخصات سند به‌روز شد.', 'good');
            if (onDone) onDone();
          }).catch(function (e) {
            w.U.toast('ذخیره ناموفق بود: ' + e.message, 'bad');
          });
        }
      })
    ]);
    return m;
  }

  /** دانلود خود فایل، با نام خودش */
  function saveDoc(doc) {
    return D.readFile(doc).then(function (file) {
      w.U.download(doc.fileName, file);
    }).catch(function (e) {
      w.U.toast('فایل پیدا نشد: ' + e.message, 'bad');
    });
  }

  /** بستهٔ زیپ از چند سند، با نام لاتین (وگرنه کروم روی file:// نامش را می‌برد) */
  function zipDocs(list, rec, label) {
    if (!list.length) {
      w.U.toast('سندی انتخاب نشده است.', 'warn');
      return Promise.resolve();
    }
    w.U.toast('در حال ساخت بستهٔ زیپ…');
    return D.bundle(list, label || (rec ? rec.caseNo : '')).then(function (res) {
      var no = w.U.toLatinDigits((rec && rec.caseNo) || '').replace(/[^\w.-]+/g, '-');
      w.U.download('madarek' + (no ? '-' + no : '') + '.zip', res.blob);
      w.U.toast(w.U.toFaDigits(res.count) + ' فایل در یک بسته ذخیره شد' +
        (res.missing ? '؛ ' + w.U.toFaDigits(res.missing) + ' فایل پیدا نشد.' : '.'),
        res.missing ? 'warn' : 'good');
    }).catch(function (e) {
      w.U.toast('ساخت بسته ناموفق بود: ' + e.message, 'bad');
    });
  }

  // ------------------------------------------------------------ فهرست اسناد
  /**
   * یک سطر سند.
   * sel: وضعیت انتخاب مشترک پنل (برای خروجی زیپ چندتایی) — اختیاری.
   * siblings: اسنادی که با فلش در نمایشگر ورق می‌خورند.
   */
  function docRow(app, rec, doc, refresh, sel, siblings) {
    var versions = D.versionsOf(doc);
    // نام فایل خودش تاریخ و نوع و شماره را دارد؛ در عنوان تکرارش نمی‌کنیم
    var headline = doc.title || doc.letterNo || doc.originalName || doc.fileName;
    var meta = [
      doc.docDate ? J.format(doc.docDate) : null,
      doc.title && doc.letterNo ? doc.letterNo : null,
      sizeText(doc.size)
    ].filter(Boolean).join(' • ');

    var open = function () {
      var list = siblings && siblings.length ? siblings : [doc];
      var at = list.indexOf(doc);
      w.UIViewer.open(list, at < 0 ? 0 : at);
    };

    function iconBtn(icon, title, fn, cls) {
      return el('button.icon-btn.doc-act' + (cls ? '.' + cls : ''), {
        type: 'button', title: title, html: w.Mobile.icon(icon), onclick: fn
      });
    }

    /* چهار اقدام، همه به‌شکل آیکن: سه دکمهٔ متنی کنار هم، هر سطر را شلوغ
       می‌کرد و چشم را از خود سند برمی‌داشت. */
    var actions = el('div.doc-actions', null, [
      iconBtn('eye', 'نمایش سند', open),
      iconBtn('download', 'دانلود فایل', function () { saveDoc(doc); }),
      iconBtn('pencil', 'ویرایش مشخصات و متن نامه', function () {
        editDialog(doc, refresh);
      }),
      doc.scope === 'person' ? null : iconBtn('upload', 'ثبت نسخهٔ جدید', function () {
        pickFiles(false).then(function (files) {
          if (!files.length) return;
          return D.addVersion(rec, doc, files[0]).then(function () {
            w.U.toast('نسخهٔ جدید ثبت شد؛ نسخهٔ قبلی نگه داشته شد.', 'good');
            refresh();
          });
        }).catch(function (e) { w.U.toast('ثبت نسخه ناموفق بود: ' + e.message, 'bad'); });
      }),
      iconBtn('trash', 'حذف سند', function () {
        w.U.confirmBox('حذف سند',
          doc.scope === 'person'
            ? 'این مدرک شخص است و از همهٔ پرونده‌های این فرد برداشته می‌شود. ' +
              'فایل «' + doc.fileName + '» هم از پوشه پاک می‌شود. ادامه می‌دهید؟'
            : 'فایل «' + doc.fileName + '» از پوشهٔ پرونده هم پاک می‌شود. ادامه می‌دهید؟',
          'حذف کن').then(function (ok) {
            if (!ok) return;
            return D.removeDoc(doc).then(function () {
              w.U.toast('سند حذف شد.', 'good');
              refresh();
            });
          }).catch(function (e) { w.U.toast('حذف ناموفق بود: ' + e.message, 'bad'); });
      }, 'danger')
    ]);

    var versionNote = versions.length ? el('details.doc-versions', null, [
      el('summary', { text: w.U.toFaDigits(versions.length) + ' نسخهٔ قبلی' }),
      el('ul', null, versions.map(function (v) {
        return el('li', null, [
          el('button.linkish', {
            type: 'button', text: 'نسخهٔ ' + w.U.toFaDigits(v.version) + ' — ' + v.fileName,
            onclick: function () { w.UIViewer.open([v], 0); }
          }),
          el('span.muted.tiny', { text: ' • ' + v.addedAtJalali })
        ]);
      }))
    ]) : null;

    // متن نامه، تاشده — هست ولی سطر را بلند نمی‌کند
    var bodyNote = doc.body ? el('details.doc-body-text', null, [
      el('summary', { text: 'متن نامه' }),
      el('p', { text: doc.body })
    ]) : null;

    var dirLabel = D.directionLabel(doc.direction);
    var row = el('li.doc-item' + (doc.missing ? '.missing' : '') +
      (doc.scope === 'person' ? '.person-doc' : ''), null, [
      sel ? el('label.doc-pick', { title: 'انتخاب برای خروجی زیپ' }, [
        el('input', {
          type: 'checkbox',
          checked: sel.has(doc.id) ? true : null,
          onchange: function (e) { sel.toggle(doc, e.target.checked); }
        })
      ]) : null,
      thumb(doc, open),
      el('div.doc-body', null, [
        el('div.doc-head', null, [
          el('span.doc-kind', { text: doc.kind }),
          dirLabel ? el('span.doc-dir.dir-' + doc.direction, { text: dirLabel }) : null,
          doc.scope === 'person'
            ? el('span.doc-scope', { text: 'مدرک شخص' }) : null,
          doc.version > 1 ? el('span.doc-version', {
            text: 'نسخهٔ ' + w.U.toFaDigits(doc.version)
          }) : null,
          el('b.doc-title', { text: headline, title: headline })
        ]),
        el('div.doc-meta', { text: meta }),
        /* تگ‌ها اینجا هم دیده می‌شوند، وگرنه فقط در بایگانی معلوم‌اند و
           کسی که از داخل پرونده نگاه می‌کند نمی‌داند سند تگ دارد. */
        (doc.tags || []).length ? el('div.doc-tags', null,
          doc.tags.map(function (t) {
            return el('span.tag-chip.ro', { text: t });
          })) : null,
        doc.batchName ? el('div.doc-batch', {
          text: 'از دستهٔ «' + doc.batchName + '»'
        }) : null,
        el('div.doc-file', { text: doc.fileName, title: 'نام فایل در پوشهٔ پرونده' }),
        doc.missing ? el('div.doc-warn', {
          text: 'این فایل در پوشه پیدا نشد؛ شاید جابه‌جا یا حذف شده است.'
        }) : null,
        bodyNote,
        versionNote
      ]),
      actions
    ]);
    return row;
  }

  /** پنل مستندات یک پرونده */
  function render(app, rec, refresh) {
    releaseThumbs();
    var st = D.status();

    if (!st.supported) {
      // روی موبایل این قابلیت اصلاً وجود ندارد؛ بهتر است صریح گفته شود چرا
      var why = w.Mobile.isPhone()
        ? 'مرورگرهای موبایل اجازهٔ دسترسی به پوشه‌های دستگاه را نمی‌دهند. ' +
          'مستندات هر پرونده را روی رایانه اضافه کنید؛ اینجا فقط دیده نمی‌شوند، ' +
          'چیزی از بین نمی‌رود.'
        : 'ذخیرهٔ مستندات در پوشه فقط در کروم و اج کار می‌کند. ' +
          'این مرورگر از این قابلیت پشتیبانی نمی‌کند.';
      return el('div.doc-panel', null, [
        el('div.warn', null, [el('span', { text: why })])
      ]);
    }

    if (!st.linked) {
      // پوشهٔ نشست قبل هنوز ثبت است و فقط اجازه‌اش لازم است
      if (st.hasStored) {
        return el('div.doc-panel', null, [
          el('div.doc-empty', null, [
            el('p', { text: 'پوشهٔ «' + st.storedName + '» از قبل انتخاب شده است.' }),
            el('p.muted.tiny', {
              text: 'مرورگر پس از هر بار بسته شدن، یک تأیید تازه می‌خواهد. ' +
                'لازم نیست دوباره پوشه را انتخاب کنید.'
            }),
            el('button.btn.primary', {
              type: 'button', text: 'تأیید دسترسی به پوشه',
              onclick: function () {
                D.relinkFolder(true).then(function (ok) {
                  if (ok) { w.U.toast('دسترسی برقرار شد.', 'good'); refresh(); }
                  else w.U.toast('دسترسی داده نشد.', 'bad');
                });
              }
            }),
            el('button.btn.ghost.small', {
              type: 'button', text: 'انتخاب پوشهٔ دیگر',
              onclick: function () {
                D.linkFolder().then(function () {
                  w.U.toast('پوشهٔ مستندات وصل شد.', 'good');
                  refresh();
                }).catch(function (e) {
                  if (e && e.name === 'AbortError') return;
                  w.U.toast('اتصال پوشه ناموفق بود: ' + e.message, 'bad');
                });
              }
            })
          ])
        ]);
      }
      return el('div.doc-panel', null, [
        el('div.doc-empty', null, [
          el('p', { text: 'هنوز پوشه‌ای برای نگهداری مستندات انتخاب نشده است.' }),
          el('p.muted.tiny', {
            text: 'یک پوشه انتخاب کنید؛ برنامه داخلش برای هر پرونده یک زیرپوشه ' +
              'به نام «شمارهٔ پرونده - نام و نام خانوادگی» می‌سازد.'
          }),
          el('button.btn.primary', {
            type: 'button', text: 'انتخاب پوشهٔ مستندات',
            onclick: function () {
              D.linkFolder().then(function () {
                w.U.toast('پوشهٔ مستندات وصل شد.', 'good');
                refresh();
              }).catch(function (e) {
                if (e && e.name === 'AbortError') return;
                w.U.toast('اتصال پوشه ناموفق بود: ' + e.message, 'bad');
              });
            }
          })
        ])
      ]);
    }

    if (!rec) {
      return el('div.doc-panel', null, [
        el('p.muted', { text: 'برای افزودن سند، اول پرونده را ذخیره کنید.' })
      ]);
    }

    var list = D.current(rec.id);
    var panel = el('div.doc-panel');

    /* انتخاب چندتایی، فقط برای خروجی زیپ. نوارش تا چیزی انتخاب نشده دیده
       نمی‌شود، تا فهرست در حالت عادی ساده بماند. */
    var person = w.Person.forCase(rec);
    var picked = {};
    var pickBar = el('div.doc-pickbar');
    var sel = {
      has: function (id) { return !!picked[id]; },
      toggle: function (doc, on) {
        if (on) picked[doc.id] = doc; else delete picked[doc.id];
        syncPickBar();
      },
      list: function () {
        return Object.keys(picked).map(function (k) { return picked[k]; });
      }
    };

    function syncPickBar() {
      var chosen = sel.list();
      w.U.clear(pickBar);
      pickBar.classList.toggle('on', chosen.length > 0);
      if (!chosen.length) return;
      pickBar.appendChild(el('span', {
        text: w.U.toFaDigits(chosen.length) + ' سند انتخاب شده'
      }));
      pickBar.appendChild(el('div.spacer'));
      pickBar.appendChild(el('button.btn.small.primary', {
        type: 'button', text: 'خروجی زیپ',
        onclick: function () { zipDocs(chosen, rec); }
      }));
      pickBar.appendChild(el('button.btn.small.ghost', {
        type: 'button', text: 'لغو انتخاب',
        onclick: function () {
          picked = {};
          w.U.$$('.doc-pick input', panel).forEach(function (c) { c.checked = false; });
          syncPickBar();
        }
      }));
    }

    // نوار ابزار
    var toolbar = el('div.doc-toolbar', null, [
      el('button.btn.primary.small', {
        type: 'button', text: '＋ افزودن سند',
        onclick: function () {
          pickFiles(true).then(function (files) {
            if (files.length) addDialog(rec, files, refresh);
          });
        }
      }),
      /* این دکمه پوشه را «باز» نمی‌کند — مرورگر چنین اجازه‌ای ندارد. کارش
         این است که داخل زیرپوشهٔ همین پرونده را می‌خوانَد و فایل‌هایی را که
         مستقیم آنجا ریخته‌اید (مثلاً خروجی اسکنر) برای ثبت پیشنهاد می‌دهد.
         اسمش هم همین را بگوید. */
      el('button.btn.small.ghost', {
        type: 'button', text: 'خواندن فایل‌های پوشه',
        title: 'داخل زیرپوشهٔ «' + (rec.docFolder || D.folderNameFor(rec)) +
          '» را می‌خوانَد و فایل‌های ثبت‌نشده را پیدا می‌کند ' +
          '(مثلاً چیزی که مستقیم اسکن کرده‌اید). پوشه را باز نمی‌کند.',
        onclick: function () {
          D.scan(rec).then(function (res) {
            if (res.entries.length) {
              scanDialog(rec, res.entries, refresh);
              return;
            }
            if (res.reason === 'no-root') {
              w.U.toast('اول پوشهٔ مستندات را وصل کنید.', 'warn');
            } else if (res.reason === 'no-folder') {
              w.U.toast('زیرپوشهٔ «' + res.folder + '» هنوز ساخته نشده است؛ ' +
                'با ثبت اولین سند خودکار ساخته می‌شود.', 'warn');
            } else if (res.reason === 'error') {
              w.U.toast('خواندن پوشه ناموفق بود: ' + (res.message || ''), 'bad');
            } else {
              w.U.toast('داخل «' + res.folder + '» فایل ثبت‌نشده‌ای نبود.', 'good');
            }
          });
        }
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'خروجی زیپ همه',
        title: 'همهٔ مدارک جاری این پرونده، به‌همراه یک فهرست، در یک فایل زیپ',
        onclick: function () {
          zipDocs(D.current(rec.id).concat(
            person ? D.currentForPerson(person.key) : []), rec);
        }
      }),
      el('div.spacer'),
      el('span.doc-folder', {
        text: '📂 ' + (rec.docFolder || D.folderNameFor(rec)),
        title: 'زیرپوشهٔ این پرونده داخل پوشهٔ ' + st.folderName
      })
    ]);
    panel.appendChild(toolbar);
    panel.appendChild(pickBar);

    if (D.folderMismatch(rec)) {
      panel.appendChild(el('div.warn', null, [
        el('span', {
          text: 'نام پوشه («' + rec.docFolder + '») با مشخصات فعلی پرونده نمی‌خواند. '
        }),
        el('button.btn.small', {
          type: 'button', text: 'هم‌نام کردن پوشه',
          onclick: function () {
            D.renameFolder(rec).then(function () {
              w.U.toast('پوشه به «' + rec.docFolder + '» تغییر نام یافت.', 'good');
              refresh();
            }).catch(function (e) {
              w.U.toast('تغییر نام ناموفق بود: ' + e.message, 'bad');
            });
          }
        })
      ]));
    }

    /* بارگذاری دسته‌ای از داخل پرونده هم در دسترس است: نوبتِ اسکن معمولاً
       از یک پرونده شروع می‌شود و بعد معلوم می‌شود چند پرونده را می‌گیرد. */
    panel.appendChild(el('div.doc-batch-hint', null, [
      el('span.muted.tiny', {
        text: 'یک دسته اسکن دارید که مالِ چند پرونده است یا هنوز معلوم نیست؟'
      }),
      el('button.btn.small.ghost', {
        type: 'button', text: 'بارگذاری دسته‌ای…',
        title: 'هر فایل پروندهٔ خودش را می‌گیرد؛ بی‌پرونده‌ها به بایگانی می‌روند',
        onclick: function () { batchUpload(refresh); }
      })
    ]));

    /* ناحیهٔ کشیدن‌و‌رها نازک است و تا فایلی بالای صفحه کشیده نشود، خودش را
       به رخ نمی‌کشد؛ یک کادر بزرگ خالی وسط پنل، فقط جا می‌گرفت. */
    var drop = el('div.doc-drop', null, [
      el('span', { text: 'فایل‌ها را اینجا رها کنید' })
    ]);
    ['dragenter', 'dragover'].forEach(function (evt) {
      drop.addEventListener(evt, function (e) {
        e.preventDefault();
        drop.classList.add('over');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      drop.addEventListener(evt, function () { drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      if (files.length) addDialog(rec, files, refresh);
    });
    panel.appendChild(drop);

    // مدارک مشترک شخص — یک کارمند ممکن است چند پرونده داشته باشد
    if (person) {
      var shared = D.currentForPerson(person.key);
      var sharedBox = el('section.doc-shared', null, [
        el('div.doc-shared-head', null, [
          el('h4', {
            text: 'مدارک شخص' + (person.caseCount > 1
              ? ' — مشترک بین ' + w.U.toFaDigits(person.caseCount) + ' پرونده'
              : '')
          }),
          el('div.spacer'),
          el('button.btn.small.ghost', {
            type: 'button', text: '＋ افزودن مدرک شخص',
            onclick: function () {
              pickFiles(true).then(function (files) {
                if (files.length) {
                  addDialog(rec, files, refresh,
                    { scope: 'person', kind: 'مدارک هویتی' });
                }
              });
            }
          })
        ])
      ]);
      if (shared.length) {
        sharedBox.appendChild(el('ul.doc-list', null, shared.map(function (doc) {
          return docRow(app, rec, doc, refresh, sel, shared);
        })));
      } else {
        // وقتی مدرکی نیست، توضیح کوتاه‌تر و خودِ بخش جمع‌وجورتر می‌شود
        sharedBox.classList.add('empty');
        sharedBox.appendChild(el('p.muted.tiny', {
          text: 'شناسنامه و حکم کارگزینی را اینجا یک بار ثبت کنید تا در همهٔ ' +
            'پرونده‌های این فرد دیده شود.'
        }));
      }
      panel.appendChild(sharedBox);
      if (person.caseCount > 1) {
        panel.appendChild(el('p.card-note', null, [
          el('span', {
            text: 'این فرد ' + w.U.toFaDigits(person.caseCount) + ' پرونده دارد. '
          }),
          el('button.linkish', {
            type: 'button', text: 'دیدن پروندهٔ شخص',
            onclick: function () { app.openPerson(person.key); }
          })
        ]));
      }
    }

    panel.appendChild(el('h4.doc-section-title', { text: 'مستندات این پرونده' }));

    if (!list.length) {
      panel.appendChild(el('p.muted', { text: 'هنوز سندی برای این پرونده ثبت نشده است.' }));
      return panel;
    }

    // ترتیب زمانی، مثل ورق زدن پروندهٔ فیزیکی؛ هم‌تاریخ‌ها به ترتیب گردش‌کار
    var order = D.kinds();
    list.sort(function (a, b) {
      var da = a.docDate || '', db = b.docDate || '';
      if (da !== db) return da < db ? -1 : 1;
      var oa = order.indexOf(a.kind), ob = order.indexOf(b.kind);
      return (oa < 0 ? 999 : oa) - (ob < 0 ? 999 : ob);
    });

    /* دسته‌بندی: وقتی بیش از یک دسته در پرونده هست، هر دسته سرفصل خودش را
       می‌گیرد. پروندهٔ کم‌سند، یک فهرست ساده می‌ماند — سرفصل بی‌خود نمی‌گیرد. */
    var groups = [];
    D.CATEGORIES.forEach(function (cat) {
      var items = list.filter(function (d) {
        return (d.category || D.categoryOf(d.kind)) === cat.key;
      });
      if (items.length) groups.push({ cat: cat, items: items });
    });

    if (groups.length > 1) {
      groups.forEach(function (g) {
        panel.appendChild(el('div.doc-cat-head', null, [
          el('span.doc-cat-name', { text: g.cat.label }),
          el('span.doc-cat-n', { text: w.U.toFaDigits(g.items.length) }),
          el('div.spacer'),
          el('button.linkish.tiny', {
            type: 'button', text: 'زیپ این دسته',
            onclick: function () { zipDocs(g.items, rec, g.cat.label); }
          })
        ]));
        panel.appendChild(el('ul.doc-list', null, g.items.map(function (doc) {
          return docRow(app, rec, doc, refresh, sel, list);
        })));
      });
    } else {
      panel.appendChild(el('ul.doc-list', null, list.map(function (doc) {
        return docRow(app, rec, doc, refresh, sel, list);
      })));
    }
    panel.appendChild(el('p.card-note', {
      text: w.U.toFaDigits(list.length) + ' سند جاری' +
        (D.forCase(rec.id).length > list.length
          ? ' • ' + w.U.toFaDigits(D.forCase(rec.id).length - list.length) + ' نسخهٔ بایگانی'
          : '')
    }));
    return panel;
  }

  /** ثبت فایل‌هایی که مستقیم در پوشه گذاشته شده‌اند */
  function scanDialog(rec, entries, refresh) {
    var rows = entries.map(function (entry) {
      var guess = guessFromName(entry.name);
      var state = { entry: entry, kind: 'سایر', docDate: guess.docDate || J.today(),
        letterNo: guess.letterNo || '', checked: true };
      var cb = el('input', { type: 'checkbox', checked: true });
      cb.addEventListener('change', function () { state.checked = cb.checked; });
      var kindSel = el('select.input.small');
      D.kinds().forEach(function (k) {
        kindSel.appendChild(el('option', { value: k, text: k }));
      });
      kindSel.addEventListener('change', function () { state.kind = kindSel.value; });
      state.node = el('label.scan-row', null, [
        cb,
        el('span.doc-icon', { html: iconFor(entry.name) }),
        el('span.scan-name', { text: entry.name, title: entry.name }),
        kindSel
      ]);
      return state;
    });

    var m;
    var body = el('div.scan-dialog', null,
      [el('p.muted.tiny', {
        text: w.U.toFaDigits(entries.length) +
          ' فایل در پوشهٔ این پرونده هست که در برنامه ثبت نشده. ' +
          'فایل‌ها جابه‌جا نمی‌شوند؛ فقط ثبت می‌شوند.'
      })].concat(rows.map(function (r) { return r.node; })));

    m = w.U.modal('پویش پوشهٔ پرونده', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      el('button.btn.primary', {
        type: 'button', text: 'ثبت انتخاب‌شده‌ها',
        onclick: function () {
          var chosen = rows.filter(function (r) { return r.checked; });
          chosen.reduce(function (chain, r) {
            return chain.then(function () {
              return D.register(rec, r.entry, { kind: r.kind, docDate: r.docDate,
                letterNo: r.letterNo });
            });
          }, Promise.resolve()).then(function () {
            m.close();
            w.U.toast(w.U.toFaDigits(chosen.length) + ' فایل ثبت شد.', 'good');
            refresh();
          }).catch(function (e) {
            w.U.toast('ثبت ناموفق بود: ' + e.message, 'bad');
          });
        }
      })
    ]);
  }

  /**
   * افزودن سند از هر جای دیگر برنامه (مثلاً از تب یادداشت): همان پنجرهٔ
   * افزودن، با همان نام‌گذاری و نسخه‌بندی و همان پوشهٔ روی دیسک.
   */
  function addFrom(rec, onDone, opts) {
    var st = D.status();
    if (!st.supported) {
      w.U.toast(w.Mobile.isPhone() ? w.Mobile.NO_FOLDER_MSG
        : 'این مرورگر از ذخیرهٔ مستندات در پوشه پشتیبانی نمی‌کند.', 'warn');
      return;
    }
    if (!st.linked) {
      w.U.toast('اول از تب «مستندات»، پوشهٔ مستندات را انتخاب کنید.', 'warn');
      return;
    }
    pickFiles(true).then(function (files) {
      if (files.length) addDialog(rec, files, onDone, opts || {});
    });
  }

  /**
   * بارگذاری دسته‌ای — بدون پروندهٔ ثابت.
   * هر فایل پروندهٔ خودش را دارد و می‌تواند بی‌پرونده بماند.
   */
  function batchUpload(onDone, files, opts) {
    var st = D.status();
    if (!st.supported) {
      w.U.toast(w.Mobile.isPhone() ? w.Mobile.NO_FOLDER_MSG
        : 'این مرورگر از ذخیرهٔ مستندات در پوشه پشتیبانی نمی‌کند.', 'warn');
      return;
    }
    if (!st.linked) {
      w.U.toast('اول از تب «مستندات» یا تنظیمات، پوشهٔ مستندات را انتخاب کنید.', 'warn');
      return;
    }
    var o = opts || {};
    o.freeCase = true;
    if (files && files.length) { addDialog(null, files, onDone, o); return; }
    pickFiles(true).then(function (list) {
      if (list.length) addDialog(null, list, onDone, o);
    });
  }

  w.UIDocs = {
    render: render, iconFor: iconFor, sizeText: sizeText, thumb: thumb,
    isImage: isImage, isPdf: isPdf, releaseThumbs: releaseThumbs,
    addFrom: addFrom, batchUpload: batchUpload, tagField: tagField,
    caseField: caseField, findCase: findCase, caseLabel: caseLabel,
    familyOf: familyOf, editDialog: editDialog,
    saveDoc: saveDoc, zipDocs: zipDocs, pickFiles: pickFiles
  };
})(window);

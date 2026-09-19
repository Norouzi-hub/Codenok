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
    var l = /(\d{2,6}[\/\-]\d{2,6}(?:[\/\-][؀-ۿ\w]+)*)/.exec(clean);
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
  /** برای هر فایل یک ردیف با نوع، تاریخ، شمارهٔ نامه و عنوان */
  function addDialog(rec, files, onDone, opts) {
    opts = opts || {};
    var person = w.Person.forCase(rec);
    var multiCase = person && person.caseCount > 1;

    var rows = files.map(function (file) {
      var guess = guessFromName(file.name);
      var state = {
        file: file,
        kind: opts.kind || 'سایر',
        docDate: guess.docDate || rec.intakeDate || J.today(),
        letterNo: guess.letterNo || '',
        title: '',
        scope: opts.scope || 'case'
      };

      // سطح سند: این پرونده، یا مدرک مشترک شخص
      var scopeSel = el('select.input.small');
      scopeSel.appendChild(el('option', { value: 'case', text: 'فقط این پرونده' }));
      scopeSel.appendChild(el('option', {
        value: 'person',
        text: 'مدرک شخص' + (multiCase
          ? ' (مشترک بین ' + w.U.toFaDigits(person.caseCount) + ' پرونده)' : '')
      }));
      scopeSel.value = state.scope;
      scopeSel.addEventListener('change', function () { state.scope = scopeSel.value; });

      var kindSel = el('select.input.small');
      D.kinds().forEach(function (k) {
        kindSel.appendChild(el('option', { value: k, text: k, selected: k === state.kind }));
      });
      kindSel.addEventListener('change', function () {
        state.kind = kindSel.value;
        // مدارک هویتی و حکم کارگزینی به شخص تعلق دارند، نه به یک پرونده
        if (!opts.scope) {
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

      state.node = el('div.doc-add-row', null, [
        el('div.doc-add-file', null, [
          el('span.doc-icon', { html: iconFor(file.name) }),
          el('span.doc-add-name', { text: file.name, title: file.name }),
          el('span.muted.tiny', { text: sizeText(file.size) })
        ]),
        el('div.doc-add-fields', null, [
          el('label.mini', { text: 'نوع سند' }), kindSel,
          el('label.mini', { text: 'سطح سند' }), scopeSel,
          el('label.mini', { text: 'تاریخ سند' }), dateField,
          el('label.mini', { text: 'شمارهٔ نامه' }), letterInput,
          el('label.mini', { text: 'توضیح' }), titleInput
        ])
      ]);
      return state;
    });

    var body = el('div.doc-add', null,
      [el('p.muted.tiny', {
        text: 'سند پرونده در پوشهٔ «' + (rec.docFolder || D.folderNameFor(rec)) +
          '» ذخیره می‌شود و مدرک شخص در «' + D.PERSON_ROOT + '/' +
          (person ? D.personFolderNameFor(person) : '') + '».'
      })].concat(rows.map(function (r) { return r.node; })));

    var m, busy = false;
    var save = el('button.btn.primary', {
      type: 'button', text: 'ثبت ' + w.U.toFaDigits(rows.length) + ' سند',
      onclick: function () {
        if (busy) return;
        busy = true;
        save.textContent = 'در حال ذخیره…';
        rows.reduce(function (chain, r) {
          return chain.then(function () {
            var meta = {
              kind: r.kind, docDate: r.docDate,
              letterNo: r.letterNo, title: r.title
            };
            if (r.scope === 'person' && person) {
              return D.addPersonFile(person, r.file, meta, rec);
            }
            return D.addFile(rec, r.file, meta);
          });
        }, Promise.resolve()).then(function () {
          m.close();
          w.U.toast(w.U.toFaDigits(rows.length) + ' سند در پوشهٔ پرونده ذخیره شد.', 'good');
          onDone();
        }).catch(function (err) {
          busy = false;
          save.textContent = 'ثبت دوباره';
          w.U.toast('ذخیرهٔ سند ناموفق بود: ' + err.message, 'bad');
        });
      }
    });

    m = w.U.modal('افزودن سند به پرونده', body, [
      el('button.btn.ghost', { type: 'button', text: 'انصراف', onclick: function () { m.close(); } }),
      save
    ]);
  }

  // ------------------------------------------------------------ فهرست اسناد
  function docRow(app, rec, doc, refresh) {
    var versions = D.versionsOf(doc);
    // نام فایل خودش تاریخ و نوع و شماره را دارد؛ در عنوان تکرارش نمی‌کنیم
    var headline = doc.title || doc.letterNo || doc.originalName || doc.fileName;
    var meta = [
      doc.docDate ? J.format(doc.docDate) : null,
      doc.title && doc.letterNo ? doc.letterNo : null,
      sizeText(doc.size)
    ].filter(Boolean).join(' • ');

    var actions = el('div.doc-actions', null, [
      el('button.btn.small', { type: 'button', text: 'باز کردن', onclick: open }),
      doc.scope === 'person' ? null : el('button.btn.small.ghost', {
        type: 'button', text: 'نسخهٔ جدید', title: 'نسخهٔ قبلی نگه داشته می‌شود',
        onclick: function () {
          pickFiles(false).then(function (files) {
            if (!files.length) return;
            return D.addVersion(rec, doc, files[0]).then(function () {
              w.U.toast('نسخهٔ جدید ثبت شد؛ نسخهٔ قبلی نگه داشته شد.', 'good');
              refresh();
            });
          }).catch(function (e) { w.U.toast('ثبت نسخه ناموفق بود: ' + e.message, 'bad'); });
        }
      }),
      el('button.btn.small.ghost.danger', {
        type: 'button', text: 'حذف',
        onclick: function () {
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
        }
      })
    ]);

    var versionNote = versions.length ? el('details.doc-versions', null, [
      el('summary', { text: w.U.toFaDigits(versions.length) + ' نسخهٔ قبلی' }),
      el('ul', null, versions.map(function (v) {
        return el('li', null, [
          el('button.linkish', {
            type: 'button', text: 'نسخهٔ ' + w.U.toFaDigits(v.version) + ' — ' + v.fileName,
            onclick: function () {
              D.openDoc(v).catch(function (e) { w.U.toast(e.message, 'bad'); });
            }
          }),
          el('span.muted.tiny', { text: ' • ' + v.addedAtJalali })
        ]);
      }))
    ]) : null;

    var open = function () {
      D.openDoc(doc).catch(function (e) { w.U.toast(e.message, 'bad'); });
    };
    return el('li.doc-item' + (doc.missing ? '.missing' : '') +
      (doc.scope === 'person' ? '.person-doc' : ''), null, [
      thumb(doc, open),
      el('div.doc-body', null, [
        el('div.doc-head', null, [
          el('span.doc-kind', { text: doc.kind }),
          doc.scope === 'person'
            ? el('span.doc-scope', { text: 'مدرک شخص' }) : null,
          doc.version > 1 ? el('span.doc-version', {
            text: 'نسخهٔ ' + w.U.toFaDigits(doc.version)
          }) : null,
          el('b.doc-title', { text: headline, title: headline })
        ]),
        el('div.doc-meta', { text: meta }),
        el('div.doc-file', { text: doc.fileName, title: 'نام فایل در پوشهٔ پرونده' }),
        doc.missing ? el('div.doc-warn', {
          text: 'این فایل در پوشه پیدا نشد؛ شاید جابه‌جا یا حذف شده است.'
        }) : null,
        versionNote
      ]),
      actions
    ]);
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
      el('button.btn.small.ghost', {
        type: 'button', text: 'پویش پوشه',
        title: 'فایل‌هایی که مستقیم در پوشه گذاشته‌اید (مثلاً خروجی اسکنر)',
        onclick: function () {
          D.scan(rec).then(function (entries) {
            if (!entries.length) {
              w.U.toast('فایل ثبت‌نشده‌ای در پوشه نبود.', 'good');
              return;
            }
            scanDialog(rec, entries, refresh);
          });
        }
      }),
      el('div.spacer'),
      el('span.doc-folder', {
        text: '📂 ' + (rec.docFolder || D.folderNameFor(rec)),
        title: 'زیرپوشهٔ این پرونده داخل پوشهٔ ' + st.folderName
      })
    ]);
    panel.appendChild(toolbar);

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

    // ناحیهٔ کشیدن‌و‌رها
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
    var person = w.Person.forCase(rec);
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
          return docRow(app, rec, doc, refresh);
        })));
      } else {
        sharedBox.appendChild(el('p.muted.tiny', {
          text: 'مدارکی مثل شناسنامه و حکم کارگزینی که به خود فرد تعلق دارند ' +
            'اینجا یک بار ثبت می‌شوند و در همهٔ پرونده‌های او دیده می‌شوند.'
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

    panel.appendChild(el('ul.doc-list', null, list.map(function (doc) {
      return docRow(app, rec, doc, refresh);
    })));
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
  function addFrom(rec, onDone) {
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
      if (files.length) addDialog(rec, files, onDone);
    });
  }

  w.UIDocs = {
    render: render, iconFor: iconFor, sizeText: sizeText, thumb: thumb,
    isImage: isImage, isPdf: isPdf, releaseThumbs: releaseThumbs,
    addFrom: addFrom, familyOf: familyOf
  };
})(window);

/*
 * بایگانی — دسته‌های اسکن و سندهای بی‌پرونده.
 *
 * تا امروز هر سند یا به پرونده وصل بود یا به شخص. ولی کار واقعی
 * دبیرخانه این‌طور نیست: یک نوبت می‌نشینید و یک دسته اسکن می‌کنید —
 * «اسکن آرای صادره» — و بعضی‌شان مالِ پرونده‌های شماست و بعضی نه.
 *
 * دو چیز اینجا دیده می‌شود:
 *
 *   دسته‌ها  — هر نوبتِ بارگذاری، با نام و تاریخ و تعداد. دسته ظرفِ سند
 *             نیست؛ برچسبی است که موقع بارگذاری روی همه می‌خورد. پس یک
 *             دسته می‌تواند هم سندِ سه پرونده داشته باشد هم پنج سندِ
 *             بی‌پرونده — و سند پرونده در پوشهٔ خودش مانده است.
 *
 *   سندهای بی‌پرونده — «اسکن متفرقه» و هرچه هنوز معلوم نیست مالِ کدام
 *             پرونده است. هر کدام با دکمهٔ «وصل به پرونده» که فایل را
 *             هم روی دیسک جابه‌جا می‌کند، نه فقط فراداده را.
 */
(function (w) {
  'use strict';

  var el = w.U.el, J = w.J, M = w.Model, D = w.Docs;

  function fa(n) { return w.U.toFaDigits(n); }

  function sizeText(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return fa(bytes) + ' بایت';
    if (bytes < 1048576) return fa(Math.round(bytes / 1024)) + ' کیلوبایت';
    return fa((bytes / 1048576).toFixed(1)) + ' مگابایت';
  }

  // ------------------------------------------------------------ یک سند
  function docRow(app, doc, refresh) {
    var rec = doc.caseId ? M.get(doc.caseId) : null;
    var meta = [];
    if (doc.docDate) meta.push(el('span', { text: J.format(doc.docDate) }));
    if (doc.letterNo) meta.push(el('span.reg-no', { text: w.U.toLatinDigits(doc.letterNo) }));
    meta.push(el('span.muted', { text: sizeText(doc.size) }));
    if (doc.batchName) meta.push(el('span.muted', { text: 'دسته: ' + doc.batchName }));

    var tags = el('div.arc-tags', null, (doc.tags || []).map(function (t) {
      return el('button.tag-chip.ro', {
        type: 'button', title: 'جستجوی این تگ',
        text: t,
        onclick: function () {
          app.state.archive.tags = [t];
          app.state.archive.q = '';
          app.render();
        }
      });
    }));

    var actions = el('div.arc-actions', null, [
      rec ? el('button.btn.small.ghost', {
        type: 'button', text: w.U.toLatinDigits(rec.caseNo || '') + ' ←',
        title: 'رفتن به پرونده',
        onclick: function () { app.openCase(rec.id); }
      }) : el('button.btn.small', {
        type: 'button', text: 'وصل به پرونده',
        title: 'فایل هم روی دیسک به پوشهٔ همان پرونده منتقل می‌شود',
        onclick: function () { attachDialog(app, doc, refresh); }
      }),
      el('button.icon-btn.tiny', {
        type: 'button', title: 'ویرایش مشخصات', 'aria-label': 'ویرایش',
        html: w.Mobile.icon('pencil'),
        onclick: function () { w.UIDocs.editDialog(doc, refresh); }
      }),
      el('button.icon-btn.tiny', {
        type: 'button', title: 'تگ‌ها', 'aria-label': 'تگ‌ها', text: '#',
        onclick: function () { tagDialog(doc, refresh); }
      }),
      el('button.icon-btn.tiny.danger', {
        type: 'button', title: 'حذف', 'aria-label': 'حذف',
        html: w.Mobile.icon('trash'),
        onclick: function () {
          w.U.confirmBox('حذف سند',
            'فایل «' + doc.fileName + '» از دیسک پاک شود؟', 'حذف کن')
            .then(function (ok) {
              if (ok) D.removeDoc(doc).then(refresh);
            });
        }
      })
    ]);

    return el('li.arc-doc' + (rec ? '.on-case' : ''), null, [
      w.UIDocs.thumb(doc, function () {
        D.openDoc(doc).catch(function (e) { w.U.toast(e.message, 'bad'); });
      }),
      el('div.arc-doc-body', null, [
        el('div.arc-doc-top', null, [
          el('b.arc-kind', { text: doc.kind }),
          doc.title ? el('span.muted', { text: doc.title }) : null,
          el('div.spacer'),
          rec ? el('span.arc-on-case', { text: 'در پرونده' })
            : el('span.arc-loose', { text: 'بی‌پرونده' })
        ]),
        el('div.arc-doc-meta', null, meta),
        el('div.arc-doc-name', { text: doc.fileName, title: doc.folderName }),
        tags
      ]),
      actions
    ]);
  }

  /** وصل کردن سندِ بی‌پرونده به یک پرونده */
  function attachDialog(app, doc, refresh) {
    var field = w.UIDocs.caseField('', null);
    var m;
    var go = el('button.btn.primary', {
      type: 'button', text: 'وصل کن',
      onclick: function () {
        var rec = field.getCase();
        if (!rec) { w.U.toast('پرونده را مشخص کنید.', 'warn'); return; }
        go.disabled = true;
        go.textContent = 'در حال جابه‌جایی…';
        D.attachToCase(doc, rec).then(function () {
          m.close();
          w.U.toast('سند به پروندهٔ ' + w.U.toLatinDigits(rec.caseNo || '') +
            ' وصل شد و فایلش به پوشهٔ همان پرونده منتقل شد.', 'good');
          refresh();
        }).catch(function (e) {
          go.disabled = false;
          go.textContent = 'وصل کن';
          w.U.toast('وصل کردن ناموفق بود: ' + e.message, 'bad');
        });
      }
    });
    m = w.U.modal('وصل کردن سند به پرونده', el('div', null, [
      el('p', { text: doc.kind + ' — ' + doc.fileName }),
      el('p.muted.tiny', {
        text: 'فایل از پوشهٔ بایگانی به پوشهٔ همان پرونده منتقل می‌شود، نه ' +
          'فقط فراداده. اگر نوع سند فیلدی در پرونده داشته باشد (تاریخ رأی، ' +
          'شمارهٔ ابلاغ…) همان‌جا هم پر می‌شود.'
      }),
      field
    ]), [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      go
    ]);
    m.root.classList.add('small-modal');
  }

  /** ویرایش تگ‌های یک سند */
  function tagDialog(doc, refresh) {
    var field = w.UIDocs.tagField(doc.tags || [], null);
    var m;
    m = w.U.modal('تگ‌های سند', el('div', null, [
      el('p.muted.tiny', { text: doc.kind + ' — ' + doc.fileName }),
      field
    ]), [
      el('button.btn.ghost', {
        type: 'button', text: 'انصراف', onclick: function () { m.close(); }
      }),
      el('button.btn.primary', {
        type: 'button', text: 'ذخیره',
        onclick: function () {
          D.setTags(doc, field.getTags()).then(function () {
            m.close();
            refresh();
          });
        }
      })
    ]);
    m.root.classList.add('small-modal');
  }

  // ----------------------------------------------------------- دسته‌ها
  function batchCard(app, b, refresh) {
    var st = app.state.archive;
    var open = st.batchId === b.id;
    return el('article.arc-batch' + (open ? '.open' : ''), null, [
      el('button.arc-batch-head', {
        type: 'button',
        onclick: function () {
          st.batchId = open ? '' : b.id;
          st.scope = '';
          app.render();
        }
      }, [
        el('span.arc-batch-n', { text: fa(b.docs.length) }),
        el('span.arc-batch-body', null, [
          el('b', { text: b.name }),
          /* هر تکه یک span جداست، نه یک رشته با «•».
             دو عددِ فارسی که با یک نویسهٔ خنثی به هم چسبیده باشند، در
             چیدمان راست‌به‌چپ به هم می‌پیوندند: «۱ پرونده • ۵ بی‌پرونده»
             روی صفحه «۱۰ پرونده ۵۰ بی‌پرونده» خوانده می‌شد. */
          el('span.arc-batch-meta', null, [
            el('span', { text: J.format(b.date) }),
            b.user ? el('span', { text: b.user }) : null,
            el('span', { text: sizeText(b.size) }),
            b.caseCount ? el('span', { text: fa(b.caseCount) + ' پرونده' }) : null,
            b.general ? el('span', { text: fa(b.general) + ' بی‌پرونده' }) : null
          ])
        ]),
        el('div.arc-batch-tags', null, b.tagList.slice(0, 4).map(function (t) {
          return el('span.tag-chip.ro', { text: t });
        })),
        el('span.arc-batch-go', { text: open ? '▲' : '▼' })
      ]),
      el('div.arc-batch-actions', null, [
        el('button.btn.small.ghost', {
          type: 'button', text: '⬇ زیپ این دسته',
          title: fa(b.docs.length) + ' فایل در یک بسته',
          onclick: function (e) {
            e.stopPropagation();
            w.UIDocs.zipDocs(b.docs, null, b.name);
          }
        }),
        /* دسته و کار دو رویِ یک چیزند؛ راهِ رفت‌وبرگشت باید از هر دو
           سمت باز باشد، وگرنه کاربر نمی‌داند این بارگذاری ثبت شده یا نه. */
        (function () {
          var tasks = w.Notes.tasksOfBatch(b.id);
          if (!tasks.length) return null;
          return el('button.btn.small.ghost', {
            type: 'button', text: '✓ ' + fa(tasks.length) + ' کار ثبت‌شده ←',
            title: 'دیدن این بارگذاری در فهرست کارها',
            onclick: function (e) {
              e.stopPropagation();
              app.state.taskFilter = 'all';
              app.state.taskCat = 'بایگانی و اسکن';
              app.goTasks();
            }
          });
        })()
      ])
    ]);
  }

  // ------------------------------------------------------------- صفحه
  function render(app, mount) {
    var st = app.state.archive || (app.state.archive = {
      q: '', tags: [], batchId: '', scope: '', kind: ''
    });
    var refresh = function () { app.render(); };
    var status = D.status();

    if (!status.linked) {
      w.U.clear(mount);
      mount.appendChild(el('div.arc-view', null, [
        el('div.empty-state', null, [
          el('p', { text: 'پوشهٔ مستندات وصل نیست.' }),
          el('p.muted.tiny', {
            text: status.supported
              ? 'بایگانی، سندها را در پوشهٔ واقعی روی دیسک نگه می‌دارد. ' +
                'اول پوشه را انتخاب کنید.'
              : w.Mobile.NO_FOLDER_MSG
          }),
          status.supported ? el('button.btn.primary', {
            type: 'button', text: 'انتخاب پوشهٔ مستندات',
            onclick: function () {
              D.linkFolder().then(refresh).catch(function (e) {
                if (e && e.name !== 'AbortError') w.U.toast(e.message, 'bad');
              });
            }
          }) : null
        ])
      ]));
      return;
    }

    var batches = D.batches();
    var found = D.searchDocs(st.q, {
      tags: st.tags, kind: st.kind, batchId: st.batchId,
      scope: st.scope || undefined
    });

    // ------------------------------------------------------------ سربرگ
    var search = el('input.input.arc-search', {
      type: 'search', value: st.q,
      placeholder: 'جستجو در سندها — نوع، تگ، شمارهٔ نامه، نام فایل، متن نامه، پرونده'
    });
    search.addEventListener('input', w.U.debounce(function () {
      st.q = search.value;
      app.render();
      var again = document.querySelector('.arc-search');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    }, 220));

    var head = el('header.arc-head', null, [
      el('div.arc-plate', null, [
        el('div.wl-eyebrow', null, [
          el('span.wl-eyebrow-tag', { text: 'بایگانی اسناد' }),
          el('span.wl-eyebrow-date.arc-batch-meta', null, [
            el('span', { text: fa(D.visibleDocs().length) + ' سند' }),
            el('span', { text: fa(batches.length) + ' دسته' }),
            el('span', { text: fa(D.general().length) + ' بی‌پرونده' })
          ]),
          el('div.spacer'),
          el('button.btn.small.primary', {
            type: 'button', text: '＋ بارگذاری دسته‌ای',
            onclick: function () {
              w.UIDocs.batchUpload(function () { app.render(); });
            }
          })
        ]),
        search,
        filterBar(app, st, batches)
      ])
    ]);

    // ------------------------------------------------- کادر رها کردن فایل
    var drop = el('div.arc-drop', null, [
      el('span', { text: 'یک دسته فایل را همین‌جا رها کنید' })
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
      if (files.length) w.UIDocs.batchUpload(function () { app.render(); }, files);
    });

    var sections = [];

    if (batches.length) {
      sections.push(el('section.arc-section', null, [
        el('div.wl-section-head', null, [
          el('h2', { text: 'دسته‌های بارگذاری' }),
          el('span.wl-count', { text: fa(batches.length) + ' دسته' }),
          el('p.wl-sub', {
            text: 'هر دسته یک نوبتِ کار است؛ سندِ پرونده‌دار در پوشهٔ ' +
              'پروندهٔ خودش مانده و فقط برچسبِ دسته را دارد.'
          })
        ]),
        el('div.arc-batches', null, batches.slice(0, 40).map(function (b) {
          return batchCard(app, b, refresh);
        }))
      ]));
    }

    var title = st.batchId
      ? 'سندهای دستهٔ «' + ((D.batch(st.batchId) || {}).name || '') + '»'
      : (st.q || st.tags.length || st.kind || st.scope ? 'نتیجهٔ جستجو' : 'همهٔ سندها');

    sections.push(el('section.arc-section', null, [
      el('div.wl-section-head', null, [
        el('h2', { text: title }),
        el('span.wl-count', { text: fa(found.length) + ' سند' }),
        el('div.spacer'),
        found.length ? el('button.btn.small.ghost', {
          type: 'button', text: '⬇ زیپ این نتیجه',
          onclick: function () { w.UIDocs.zipDocs(found, null, title); }
        }) : null
      ]),
      found.length
        ? el('ul.arc-docs', null, found.slice(0, 200).map(function (d) {
          return docRow(app, d, refresh);
        }))
        : el('div.empty-state', null, [
          el('p', {
            text: st.q || st.tags.length
              ? 'سندی با این جستجو پیدا نشد.'
              : 'هنوز سندی ثبت نشده است.'
          })
        ])
    ]));

    if (found.length > 200) {
      sections.push(el('p.muted.tiny', {
        text: 'فقط ۲۰۰ سند اول نشان داده شد؛ جستجو را باریک‌تر کنید.'
      }));
    }

    w.U.clear(mount);
    mount.appendChild(el('div.arc-view', null,
      [head, drop].concat(sections)));
  }

  /** چیپ‌های صافی: دامنه، نوع و تگ */
  function filterBar(app, st, batches) {
    var bar = el('div.arc-filters');

    function chip(label, on, onclick, cls) {
      return el('button.chip-btn' + (on ? '.on' : '') + (cls || ''), {
        type: 'button', text: label, onclick: onclick
      });
    }

    bar.appendChild(chip('همه', !st.scope && !st.batchId, function () {
      st.scope = ''; st.batchId = '';
      app.render();
    }));
    bar.appendChild(chip('بی‌پرونده', st.scope === 'general', function () {
      st.scope = st.scope === 'general' ? '' : 'general';
      st.batchId = '';
      app.render();
    }));
    bar.appendChild(chip('روی پرونده', st.scope === 'case', function () {
      st.scope = st.scope === 'case' ? '' : 'case';
      st.batchId = '';
      app.render();
    }));

    if (st.batchId) {
      var b = D.batch(st.batchId);
      bar.appendChild(el('button.fchip', {
        type: 'button', title: 'برداشتن صافی دسته',
        onclick: function () { st.batchId = ''; app.render(); }
      }, [
        el('span.fchip-op', { text: 'دسته' }),
        el('span.fchip-v', { text: b ? b.name : '' }),
        el('span.fchip-x', { text: '×' })
      ]));
    }

    var tags = D.tagsInUse();
    if (tags.length) {
      bar.appendChild(el('span.arc-sep'));
      tags.slice(0, 10).forEach(function (t) {
        var on = st.tags.indexOf(t) >= 0;
        bar.appendChild(chip(t, on, function () {
          st.tags = on ? st.tags.filter(function (x) { return x !== t; })
            : st.tags.concat([t]);
          app.render();
        }, '.tag-filter'));
      });
    }

    if (st.tags.length || st.kind || st.q) {
      bar.appendChild(el('button.linkish.tiny', {
        type: 'button', text: 'پاک کردن جستجو',
        onclick: function () {
          st.q = ''; st.tags = []; st.kind = '';
          app.render();
        }
      }));
    }
    return bar;
  }

  w.UIArchive = { render: render, attachDialog: attachDialog, tagDialog: tagDialog };
})(window);

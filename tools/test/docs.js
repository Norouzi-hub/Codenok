/*
 * تست مستندات. چون showDirectoryPicker را نمی‌توان خودکار کرد، یک
 * FileSystemDirectoryHandle ساختگیِ درون‌حافظه‌ای تزریق می‌شود و کل منطق
 * (ساخت پوشه، نام‌گذاری، نسخه‌بندی، پویش، حذف، تغییر نام پوشه) روی آن
 * آزموده می‌شود.
 *
 * اجرا:  node tools/test/docs.js
 */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

const APP = 'file://' + path.resolve(__dirname, '../../dist/parvandeha.html');

let failures = 0;
function check(name, ok, extra) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '  — ' + extra : ''));
  if (!ok) failures++;
}

const MOCK_FS = `
(function () {
  function makeFile(name) {
    var blob = new Blob([]);
    return {
      kind: 'file', name: name,
      getFile: function () {
        return Promise.resolve(new File([blob], name, { type: blob.type }));
      },
      createWritable: function () {
        var parts = [];
        return Promise.resolve({
          write: function (d) { parts.push(d); return Promise.resolve(); },
          close: function () { blob = new Blob(parts); return Promise.resolve(); }
        });
      }
    };
  }
  function notFound(n) {
    var e = new Error('NotFound: ' + n);
    e.name = 'NotFoundError';
    return e;
  }
  function makeDir(name) {
    var entries = new Map();
    return {
      kind: 'directory', name: name, _entries: entries,
      queryPermission: function () { return Promise.resolve('granted'); },
      requestPermission: function () { return Promise.resolve('granted'); },
      getDirectoryHandle: function (n, opts) {
        if (!entries.has(n)) {
          if (!opts || !opts.create) return Promise.reject(notFound(n));
          entries.set(n, makeDir(n));
        }
        return Promise.resolve(entries.get(n));
      },
      getFileHandle: function (n, opts) {
        if (!entries.has(n)) {
          if (!opts || !opts.create) return Promise.reject(notFound(n));
          entries.set(n, makeFile(n));
        }
        return Promise.resolve(entries.get(n));
      },
      removeEntry: function (n) {
        if (!entries.has(n)) return Promise.reject(notFound(n));
        entries.delete(n);
        return Promise.resolve();
      },
      values: function () {
        var arr = Array.from(entries.values()), i = 0;
        return {
          next: function () {
            return Promise.resolve(i < arr.length
              ? { done: false, value: arr[i++] } : { done: true });
          }
        };
      }
    };
  }

  window.__mockRoot = makeDir('مستندات کمیته');
  window.showDirectoryPicker = function () { return Promise.resolve(window.__mockRoot); };

  // handle ساختگی قابل ذخیره در IndexedDB نیست (تابع دارد)؛ برای همین کلید
  // یک حافظهٔ جداگانه می‌گذاریم تا مسیر «ذخیره و بازخوانی ارجاع» هم آزموده شود
  var fakeMeta = {};
  var origMetaSet = window.Store.metaSet;
  var origMetaGet = window.Store.metaGet;
  window.Store.metaSet = function (k, v) {
    if (k === 'docsFolder') { fakeMeta[k] = v; return Promise.resolve(); }
    return origMetaSet(k, v);
  };
  window.Store.metaGet = function (k, d) {
    if (k === 'docsFolder' && Object.prototype.hasOwnProperty.call(fakeMeta, k)) {
      return fakeMeta[k];
    }
    return origMetaGet(k, d);
  };

  // درخت پوشه به شکل ساده، برای بازرسی از تست
  window.__tree = function (dir) {
    dir = dir || window.__mockRoot;
    var out = {};
    dir._entries.forEach(function (h, n) {
      out[n] = h.kind === 'directory' ? window.__tree(h) : 'file';
    });
    return out;
  };
})();
`;

function fakeFile(name, text) {
  return `new File([${JSON.stringify(text || 'x')}], ${JSON.stringify(name)}, ` +
    `{ type: 'application/pdf' })`;
}


/** صفحهٔ نخست حالا کارتابل است؛ تست‌ها با فهرست پرونده‌ها کار می‌کنند */
async function openList(page) {
  await page.waitForSelector('.worklist, .lock-screen, .tr', { timeout: 20000 });
  if (await page.$('.lock-screen')) return;
  await page.evaluate(() => window.App.goList());
  await page.waitForSelector('.tr', { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ acceptDownloads: true, locale: 'fa-IR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP);
  await openList(page);
  await page.evaluate(MOCK_FS);

  console.log('\n— اتصال پوشه —');
  const linked = await page.evaluate(async () => {
    await window.Docs.linkFolder();
    return window.Docs.status();
  });
  check('پوشهٔ مستندات وصل شد', linked.linked && linked.supported,
    linked.folderName);

  console.log('\n— افزودن سند —');
  const added = await page.evaluate(async (fileExpr) => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404308');
    const file = eval(fileExpr);
    const doc = await window.Docs.addFile(rec, file, {
      kind: 'نامهٔ وارده', docDate: '14040720',
      letterNo: '1404/11133/429/م', title: ''
    });
    return {
      folder: rec.docFolder, fileName: doc.fileName, tree: window.__tree(),
      caseNo: rec.caseNo, name: [rec.firstName, rec.lastName].join(' ')
    };
  }, fakeFile('scan001.pdf'));
  check('زیرپوشه به نام «شماره - نام خانوادگی» ساخته شد',
    added.folder === '1404308 - غلامستان اینده', added.folder);
  check('نویسهٔ ممنوع ویندوز در نام فایل نیست',
    !/[\\/:*?"<>|]/.test(added.fileName), added.fileName);
  check('نام فایل از تاریخ، نوع و شمارهٔ نامه ساخته شد',
    added.fileName.startsWith('1404-07-20 - نامهٔ وارده - 1404-11133-429') &&
    added.fileName.endsWith('.pdf'), added.fileName);
  check('فایل واقعاً داخل پوشهٔ پرونده نوشته شد',
    added.tree[added.folder] && added.tree[added.folder][added.fileName] === 'file',
    JSON.stringify(added.tree));

  console.log('\n— نام‌های خطرناک —');
  const risky = await page.evaluate(async (fileExpr) => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404337');
    const file = eval(fileExpr);
    const doc = await window.Docs.addFile(rec, file, {
      kind: 'رأی کمیته', docDate: '14050504',
      letterNo: '12/34*56?', title: 'رأی <نهایی> / اصلاحی'
    });
    return { fileName: doc.fileName, safe: window.Docs.safeName('CON'),
      trail: window.Docs.safeName('نام با نقطه...'),
      empty: window.Docs.safeName('///') };
  }, fakeFile('a.pdf'));
  check('نویسه‌های ممنوع به خط تیره تبدیل شدند',
    !/[\\/:*?"<>|]/.test(risky.fileName), risky.fileName);
  check('نام رزروشدهٔ ویندوز خنثی شد', risky.safe === '_CON', risky.safe);
  check('نقطهٔ انتهایی حذف شد', !/[. ]$/.test(risky.trail), risky.trail);
  check('نام کاملاً نامعتبر جایگزین گرفت', risky.empty === 'بدون نام', risky.empty);

  console.log('\n— نام تکراری —');
  const dupe = await page.evaluate(async (fileExpr) => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404308');
    const names = [];
    for (let i = 0; i < 2; i++) {
      const doc = await window.Docs.addFile(rec, eval(fileExpr), {
        kind: 'نامهٔ صادره', docDate: '14040801', letterNo: '', title: ''
      });
      names.push(doc.fileName);
    }
    return names;
  }, fakeFile('b.pdf'));
  check('فایل هم‌نام با پسوند شماره ذخیره شد',
    dupe[0] !== dupe[1] && /\(2\)\.pdf$/.test(dupe[1]), dupe.join(' | '));

  console.log('\n— نسخه‌بندی —');
  const versioned = await page.evaluate(async (fileExpr) => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404337');
    const doc = window.Docs.current(rec.id).find(d => d.kind === 'رأی کمیته');
    const v2 = await window.Docs.addVersion(rec, doc, eval(fileExpr));
    const tree = window.__tree()[rec.docFolder];
    return {
      v2Name: v2.fileName, v2Version: v2.version,
      oldSuperseded: doc.superseded,
      currentCount: window.Docs.current(rec.id).filter(d => d.kind === 'رأی کمیته').length,
      oldStillOnDisk: tree[doc.fileName] === 'file',
      versionsListed: window.Docs.versionsOf(v2).length,
      folder: rec.docFolder
    };
  }, fakeFile('c.pdf'));
  check('نسخهٔ ۲ با پسوند نسخه ذخیره شد',
    versioned.v2Version === 2 && /نسخه 2\.pdf$/.test(versioned.v2Name),
    versioned.v2Name);
  check('نسخهٔ قبلی روی دیسک باقی ماند', versioned.oldStillOnDisk);
  check('فقط یک نسخه جاری است',
    versioned.oldSuperseded && versioned.currentCount === 1,
    'جاری=' + versioned.currentCount);
  check('نسخهٔ قبلی زیر سند جاری فهرست می‌شود',
    versioned.versionsListed === 1, 'نسخه‌های قبلی=' + versioned.versionsListed);

  console.log('\n— پویش پوشه —');
  const scanned = await page.evaluate(async () => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404308');
    // شبیه‌سازی اسکنر: فایل مستقیم در پوشه گذاشته می‌شود
    const dir = await window.__mockRoot.getDirectoryHandle(rec.docFolder);
    const fh = await dir.getFileHandle('اسکن جدید 001.pdf', { create: true });
    const wr = await fh.createWritable();
    await wr.write(new Blob(['scan']));
    await wr.close();

    const found = await window.Docs.scan(rec);
    const before = window.Docs.current(rec.id).length;
    await window.Docs.register(rec, found[0], { kind: 'گزارش بازرسی', docDate: '14040901' });
    const afterScan = await window.Docs.scan(rec);
    return {
      foundNames: found.map(f => f.name), before: before,
      after: window.Docs.current(rec.id).length, leftover: afterScan.length
    };
  });
  check('فایل ثبت‌نشدهٔ داخل پوشه پیدا شد',
    scanned.foundNames.length === 1 && scanned.foundNames[0] === 'اسکن جدید 001.pdf',
    scanned.foundNames.join(', '));
  check('ثبت فایل موجود، بدون جابه‌جایی انجام شد',
    scanned.after === scanned.before + 1 && scanned.leftover === 0,
    scanned.before + ' → ' + scanned.after);

  console.log('\n— تاریخچه، جستجو و تایم‌لاین —');
  const wired = await page.evaluate(() => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404308');
    const hist = window.Model.historyFor(rec.id);
    const tl = window.Model.timelineFor(rec);
    return {
      docEvents: hist.filter(h => h.kind.indexOf('doc') === 0).length,
      timelineDocs: tl.filter(i => i.type === 'doc').length,
      searchHit: window.Model.query({ q: 'گزارش بازرسی', filters: {} })
        .some(c => c.id === rec.id),
      sortedTimeline: tl.every((it, i) => i === 0 || tl[i - 1].sortKey <= it.sortKey)
    };
  });
  check('رویدادهای سند در تاریخچهٔ پرونده ثبت شدند',
    wired.docEvents >= 4, wired.docEvents + ' رویداد');
  check('اسناد در تایم‌لاین پرونده می‌آیند',
    wired.timelineDocs >= 3, wired.timelineDocs + ' سند');
  check('تایم‌لاین مرتب مانده است', wired.sortedTimeline);
  check('نوع سند با جستجوی سراسری پیدا می‌شود', wired.searchHit);

  console.log('\n— حذف سند —');
  const removed = await page.evaluate(async () => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404337');
    const doc = window.Docs.current(rec.id).find(d => d.kind === 'رأی کمیته');
    const before = window.__tree()[rec.docFolder];
    await window.Docs.removeDoc(doc);
    const after = window.__tree()[rec.docFolder];
    const nowCurrent = window.Docs.current(rec.id).filter(d => d.kind === 'رأی کمیته');
    return {
      fileGone: !!before[doc.fileName] && !after[doc.fileName],
      restoredVersion: nowCurrent.length === 1 ? nowCurrent[0].version : null
    };
  });
  check('فایل از پوشه هم پاک شد', removed.fileGone);
  check('با حذف نسخهٔ جاری، نسخهٔ قبلی دوباره جاری شد',
    removed.restoredVersion === 1, 'نسخهٔ جاری = ' + removed.restoredVersion);

  console.log('\n— هم‌نام کردن پوشه —');
  const renamed = await page.evaluate(async () => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404308');
    const oldFolder = rec.docFolder;
    const fileNames = Object.keys(window.__tree()[oldFolder]);
    await window.Model.update(rec.id, Object.assign({}, window.Model.strip(rec),
      { lastName: 'آینده‌نژاد' }));
    const updated = window.Model.get(rec.id);
    const mismatch = window.Docs.folderMismatch(updated);
    await window.Docs.renameFolder(updated);
    const tree = window.__tree();
    return {
      oldFolder: oldFolder, newFolder: updated.docFolder, mismatch: mismatch,
      oldGone: !tree[oldFolder],
      filesMoved: fileNames.every(n => tree[updated.docFolder] &&
        tree[updated.docFolder][n] === 'file'),
      fileCount: Object.keys(tree[updated.docFolder] || {}).length,
      expectedCount: fileNames.length,
      docsRepointed: window.Docs.forCase(updated.id)
        .every(d => d.folderName === updated.docFolder)
    };
  });
  check('ناهم‌خوانی نام پوشه تشخیص داده شد', renamed.mismatch);
  check('پوشه به نام تازه منتقل شد',
    renamed.newFolder === '1404308 - غلامستان آینده‌نژاد' && renamed.oldGone,
    renamed.oldFolder + ' → ' + renamed.newFolder);
  check('همهٔ فایل‌ها منتقل شدند',
    renamed.filesMoved && renamed.fileCount === renamed.expectedCount,
    renamed.fileCount + ' از ' + renamed.expectedCount);
  check('ارجاع اسناد به پوشهٔ تازه به‌روز شد', renamed.docsRepointed);

  console.log('\n— مدارک شخص (مشترک بین پرونده‌ها) —');
  const personDocs = await page.evaluate(async (fileExpr) => {
    // دو پرونده برای یک کارمند
    const a = window.Model.state.cases.find(c => c.caseNo === '1404380');
    await window.Model.update(a.id, Object.assign({}, window.Model.strip(a),
      { nationalId: '0055443322', firstName: 'سعید', lastName: 'موسوی' }));
    const b = await window.Model.create({
      caseNo: '1405900', nationalId: '0055443322',
      firstName: 'سعید', lastName: 'موسوی', status: 'مفتوح رسیدگی',
      intakeDate: '14050301'
    });
    const recA = window.Model.get(a.id);
    const person = window.Person.forCase(recA);

    const doc = await window.Docs.addPersonFile(person, eval(fileExpr),
      { kind: 'مدارک هویتی', docDate: '14000101', title: 'شناسنامه' }, recA);

    const tree = window.__tree();
    const personRoot = tree[window.Docs.PERSON_ROOT] || {};
    const folderName = window.Docs.personFolderNameFor(person);

    return {
      caseCount: person.caseCount,
      folder: folderName,
      storedUnderRoot: !!personRoot[folderName],
      fileStored: !!(personRoot[folderName] || {})[doc.fileName],
      fileName: doc.fileName,
      // مدرک شخص نباید جزو اسناد هیچ‌کدام از پرونده‌ها شمرده شود
      caseADocs: window.Docs.current(recA.id).some(d => d.id === doc.id),
      caseBDocs: window.Docs.current(b.id).some(d => d.id === doc.id),
      // ولی از هر دو پرونده دیده می‌شود
      sharedFromA: window.Docs.currentForPerson(
        window.Person.forCase(recA).key).length,
      sharedFromB: window.Docs.currentForPerson(
        window.Person.forCase(window.Model.get(b.id)).key).length,
      allForPerson: window.Docs.allForPerson(window.Person.forCase(recA)).length,
      history: window.Model.historyFor(recA.id).some(h => h.kind === 'doc-person'),
      docId: doc.id
    };
  }, fakeFile('id-card.pdf'));
  check('دو پروندهٔ یک کارمند به یک شخص گره خوردند',
    personDocs.caseCount === 2, personDocs.caseCount + ' پرونده');
  check('مدرک شخص در پوشهٔ جدا و به نام «کد ملی - نام» ذخیره شد',
    personDocs.storedUnderRoot && personDocs.fileStored &&
    personDocs.folder === '0055443322 - سعید موسوی',
    personDocs.folder + '/' + personDocs.fileName);
  check('مدرک شخص جزو اسناد هیچ پروندهٔ خاصی شمرده نمی‌شود',
    !personDocs.caseADocs && !personDocs.caseBDocs);
  check('همان مدرک از هر دو پرونده دیده می‌شود',
    personDocs.sharedFromA === 1 && personDocs.sharedFromB === 1,
    personDocs.sharedFromA + ' و ' + personDocs.sharedFromB);
  check('رویداد مدرک شخص در تاریخچه ثبت شد', personDocs.history);

  const personDocRemoved = await page.evaluate(async (docId) => {
    const doc = window.Docs.all().find(d => d.id === docId);
    const person = window.Person.get(doc.personKey);
    const before = (window.__tree()[window.Docs.PERSON_ROOT] || {})[
      window.Docs.personFolderNameFor(person)] || {};
    const had = !!before[doc.fileName];
    await window.Docs.removeDoc(doc);
    const after = (window.__tree()[window.Docs.PERSON_ROOT] || {})[
      window.Docs.personFolderNameFor(person)] || {};
    return { had: had, gone: !after[doc.fileName],
      left: window.Docs.currentForPerson(person.key).length };
  }, personDocs.docId);
  check('حذف مدرک شخص، فایلش را از پوشهٔ شخص پاک می‌کند',
    personDocRemoved.had && personDocRemoved.gone && personDocRemoved.left === 0);

  console.log('\n— تأیید دوبارهٔ دسترسی —');
  const regrant = await page.evaluate(async () => {
    const before = window.Docs.status();
    const ok = await window.Docs.relinkFolder(true);
    return { hasStored: before.hasStored, storedName: before.storedName, regranted: ok };
  });
  check('ارجاع پوشه برای نشست بعد ذخیره می‌شود',
    regrant.hasStored && regrant.storedName === 'مستندات کمیته',
    regrant.storedName);
  check('تأیید دوبارهٔ دسترسی بدون انتخاب دوبارهٔ پوشه کار می‌کند',
    regrant.regranted === true);

  console.log('\n— ماندگاری فراداده —');
  await page.reload();
  await openList(page);
  const persisted = await page.evaluate(() => {
    const rec = window.Model.state.cases.find(c => c.caseNo === '1404308');
    return {
      docs: window.Docs.forCase(rec.id).length,
      folder: rec.docFolder,
      linked: window.Docs.status().linked
    };
  });
  check('فرادادهٔ اسناد پس از رفرش باقی ماند',
    persisted.docs >= 4 && persisted.folder === '1404308 - غلامستان آینده‌نژاد',
    persisted.docs + ' سند، پوشه: ' + persisted.folder);
  // در مرورگر واقعی، ارجاع پوشه در IndexedDB می‌ماند و فقط تأیید تازه لازم است؛
  // در این تست چون handle ساختگی ذخیره‌شدنی نیست، پس از رفرش خالی است.
  check('پس از رفرش، برنامه بدون فایل‌های پوشه هم سالم بالا می‌آید',
    persisted.linked === false, 'linked=' + persisted.linked);

  console.log('\n— پشتیبان JSON —');
  const backup = await page.evaluate(() => {
    const snap = window.Store.snapshot();
    let serializable = true;
    try { JSON.stringify(snap); } catch (e) { serializable = false; }
    return {
      docs: (snap.docs || []).length,
      hasHandles: (snap.meta || []).some(m =>
        m.key === 'docsFolder' || m.key === 'fileHandle'),
      serializable: serializable
    };
  });
  check('فرادادهٔ اسناد در پشتیبان هست', backup.docs >= 4, backup.docs + ' سند');
  check('ارجاع پوشه وارد پشتیبان نمی‌شود و JSON سالم است',
    !backup.hasHandles && backup.serializable);

  console.log('\n— هر نوع فایلی، با کاشی نوع‌دار —');
  // بعد از رفرش، پوشهٔ ساختگی رفته است؛ دوباره وصلش می‌کنیم
  await page.evaluate(MOCK_FS);
  await page.evaluate(() => window.Docs.linkFolder());
  const types = await page.evaluate(async () => {
    const rec = window.Model.state.cases[0];
    const before = window.Docs.current(rec.id).map(d => d.id);
    const files = [
      new File(['x'], 'dadkhast.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      new File(['x'], 'jadval.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      new File(['x'], 'peyvast.zip', { type: 'application/zip' }),
      new File(['x'], 'scan.png', { type: 'image/png' }),
      new File(['x'], 'ray.pdf', { type: 'application/pdf' })
    ];
    for (const f of files) {
      await window.Docs.addFile(rec, f, { kind: 'سایر', docDate: window.J.today() });
    }
    // نام ذخیره‌شده از تاریخ و نوع سند ساخته می‌شود، نه از نام اصلی؛
    // پس تازه‌ها را با شناسه‌های پیش از افزودن جدا می‌کنیم
    const added = window.Docs.current(rec.id).filter(d => before.indexOf(d.id) < 0);
    return {
      count: added.length,
      families: added.map(d => window.UIDocs.familyOf(d.fileName)).sort(),
      recId: rec.id
    };
  });
  check('ورد، اکسل، زیپ، عکس و PDF همگی بارگذاری می‌شوند', types.count === 5,
    types.count + ' فایل');
  check('هر کدام خانوادهٔ خودش را می‌گیرد',
    types.families.join(',') === 'archive,doc,image,pdf,sheet', types.families.join(','));

  const tiles = await page.evaluate((recId) => {
    window.App.state.formTab = '__docs';
    window.App.openCase(recId);
    const box = {};
    document.querySelectorAll('.doc-thumb').forEach(t => {
      const fam = [...t.classList].find(c => c.indexOf('fam-') === 0);
      box[fam] = (box[fam] || 0) + 1;
    });
    return {
      fams: box,
      exts: [...document.querySelectorAll('.doc-thumb .doc-ext')].map(e => e.textContent),
      svg: document.querySelectorAll('.doc-thumb .doc-icon svg').length,
      emoji: [...document.querySelectorAll('.doc-icon')]
        .filter(e => !e.querySelector('svg') && e.textContent.trim()).length
    };
  }, types.recId);
  check('کاشی هر فایل، پسوندش را می‌نویسد',
    tiles.exts.indexOf('DOCX') >= 0 && tiles.exts.indexOf('XLSX') >= 0 &&
    tiles.exts.indexOf('ZIP') >= 0, tiles.exts.join('/'));
  check('آیکن فایل‌ها خطی است، نه شکلک',
    tiles.svg > 0 && tiles.emoji === 0,
    tiles.svg + ' آیکن خطی، ' + tiles.emoji + ' شکلک');

  console.log('\n— بارگذاری از تب یادداشت —');
  const fromNotes = await page.evaluate((recId) => {
    window.App.state.formTab = '__notes';
    window.App.openCase(recId);
    return {
      button: !!document.querySelector('.note-attach-btn'),
      hint: (document.querySelector('.note-attach') || {}).textContent || '',
      recent: document.querySelectorAll('.note-doc').length
    };
  }, types.recId);
  check('تب یادداشت دکمهٔ بارگذاری سند دارد', fromNotes.button);
  check('چند سند آخر در تب یادداشت دیده می‌شوند', fromNotes.recent > 0,
    fromNotes.recent + ' سند');
  check('راهنما می‌گوید چه فرمت‌هایی قبول است',
    /عکس/.test(fromNotes.hint) && /زیپ/.test(fromNotes.hint));

  console.log('\n— خطاهای کنسول —');
  check('بدون خطای جاوااسکریپت', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  console.log('\n' + (failures ? '✗ ' + failures + ' تست ناموفق' : '✓ همهٔ تست‌ها موفق'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('خطای اجرای تست:', e); process.exit(2); });

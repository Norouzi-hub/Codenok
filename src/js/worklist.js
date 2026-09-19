/*
 * موتور «اقدام بعدی».
 *
 * پرونده‌ها یک گردش‌کار واقعی و ترتیبی دارند و هر مرحله با پر شدن یک فیلد
 * تاریخ ثبت می‌شود. از روی همین‌ها می‌شود گفت چه کاری انجام شده و چه کاری
 * مانده — بدون اینکه کاربر چیز تازه‌ای وارد کند.
 */
(function (w) {
  'use strict';

  var J = w.J, M = w.Model;

  /**
   * مرحله‌های گردش‌کار به ترتیب. هر مرحله با «رسیدن یا گذشتن» از آن کامل
   * می‌شود؛ پس اگر تاریخ یک مرحله ثبت نشده ولی مرحلهٔ بعدش ثبت شده، باز هم
   * انجام‌شده حساب می‌شود.
   */
  var STAGES = [
    { key: 'intake', label: 'دریافت و ثبت مستندات', short: 'ثبت', field: 'intakeDate' },
    { key: 'assign', label: 'ارجاع به کارشناس', short: 'ارجاع', field: 'deliveryDate' },
    { key: 'decree', label: 'بارگذاری آخرین حکم', short: 'حکم', field: 'decreeDate' },
    { key: 'defect', label: 'نامهٔ رفع نواقص', short: 'نواقص',
      field: 'defectLetterDate', optional: true },
    { key: 'inquiry', label: 'استعلام حراست', short: 'استعلام',
      field: 'securityInLetterDate', optional: true },
    { key: 'invite', label: 'نامهٔ دعوت', short: 'دعوت', field: 'invitationLetterDate' },
    { key: 'defense', label: 'دریافت دفاعیات', short: 'دفاعیه', field: 'defenseReceivedDate' },
    { key: 'complete', label: 'تکمیل مستندات', short: 'تکمیل', field: 'docsCompleteDate' },
    { key: 'hearing', label: 'جلسهٔ دفاع', short: 'جلسه', field: 'committeeDate' },
    { key: 'hearingLetter', label: 'نامهٔ حضور در جلسه', short: 'حضور',
      field: 'hearingLetterDate', optional: true },
    { key: 'verdict', label: 'صدور رأی', short: 'رأی', field: 'verdictDate' },
    { key: 'sign', label: 'امضای رأی توسط اعضا', short: 'امضا', field: 'verdictSignedDate' },
    { key: 'notice', label: 'ابلاغ رأی', short: 'ابلاغ', field: 'noticeLetterDate' },
    { key: 'result', label: 'دریافت نتیجهٔ ابلاغ', short: 'نتیجه', field: 'noticeResultDate' },
    { key: 'archive', label: 'بایگانی و اختتام', short: 'بایگانی', field: 'archiveDate' }
  ];

  /* رأی ممکن است تاریخ نداشته باشد ولی متنش ثبت شده باشد — پرونده‌های قدیمی
     این‌طورند. پس «رأی صادر شده» یعنی یکی از این سه. */
  function hasVerdict(rec) {
    return !!(rec.verdictDate || rec.verdictFull || rec.committeeRegNo);
  }

  /* نتیجهٔ ابلاغ هم یا تاریخ دارد یا در فیلد انتخابی «بازگشت ابلاغ» ثبت شده */
  function hasNoticeResult(rec) {
    return !!(rec.noticeResultDate ||
      (rec.noticeReturn && rec.noticeReturn !== 'در انتظار بازگشت'));
  }

  function stageDone(rec, stage) {
    if (stage.key === 'verdict') return hasVerdict(rec);
    if (stage.key === 'result') return hasNoticeResult(rec);
    if (stage.key === 'archive') return !!(rec.archiveDate || isClosed(rec));
    return !!rec[stage.field];
  }

  function isClosed(rec) { return /مختومه/.test(rec.status || ''); }

  /**
   * ارجاع به کارشناس دیگر: پرونده از دست ما خارج شده است.
   * نه مختومه است (رأیی صادر نشده) و نه در جریانِ ما؛ حالت سومی است که
   * باید از کارتابل بیرون برود ولی در گزارش‌ها جای خودش را داشته باشد.
   */
  function isTransferred(rec) { return !!rec.transferDate; }

  /** «دیگر کار ما نیست» — چه مختومه، چه ارجاع‌شده */
  function isDone(rec) { return isClosed(rec) || isTransferred(rec); }

  /**
   * وضعیت هر هشت مرحله برای یک پرونده.
   * done: انجام شده · current: مرحله‌ای که الان روی آن ایستاده‌ایم
   */
  function stages(rec) {
    var lastDone = -1;
    var done = STAGES.map(function (st, i) {
      var d = stageDone(rec, st);
      if (d) lastDone = i;
      return d;
    });
    // مرحله‌ای که از آن گذشته‌ایم، حتی اگر تاریخش ثبت نشده، انجام‌شده است
    for (var i = 0; i < lastDone; i++) done[i] = true;
    var closed = isDone(rec);
    return STAGES.map(function (st, i) {
      return {
        key: st.key, label: st.label, short: st.short,
        done: done[i],
        date: st.field ? (rec[st.field] || '') : '',
        current: !closed && !done[i] && i === lastDone + 1,
        optional: !!st.optional
      };
    });
  }

  /**
   * مهلت پیش‌فرض هر اقدام، به روز. هر عدد یعنی «از تاریخ مرحلهٔ قبل، چند روز
   * فرصت هست». همه در تنظیمات قابل تغییرند، چون رویهٔ هر دبیرخانه فرق دارد.
   */
  var SLA = {
    assign: 3,          // از ثبت تا ارجاع به کارشناس
    decree: 5,          // از ارجاع تا گرفتن و بارگذاری آخرین حکم
    defect: 7,          // از نامهٔ رفع نواقص تا وصول جواب
    inquiry: 20,        // از ارسال استعلام حراست تا پاسخ
    invite: 7,          // از آماده شدن پرونده تا صدور نامهٔ دعوت
    defense: 10,        // مهلت کارمند برای دادن دفاعیه
    chase: 7,           // از نامهٔ پیگیری دفاعیات تا پاسخ
    complete: 7,        // از دریافت دفاعیه تا تکمیل مستندات
    hearing: 21,        // از تکمیل مستندات تا تعیین جلسهٔ دفاع
    hearingLetter: 3,   // نامهٔ حضور، پیش از جلسه
    verdict: 7,         // از جلسه تا صدور رأی
    sign: 7,            // امضای رأی توسط اعضا
    notice: 5,          // از امضا تا صدور ابلاغیه
    result: 10,         // از ابلاغ تا دریافت نتیجه
    archive: 7          // از نتیجهٔ ابلاغ تا بایگانی
  };

  /** برچسب فارسی هر مهلت، برای صفحهٔ تنظیمات */
  var SLA_LABELS = {
    assign: 'ارجاع به کارشناس، از تاریخ ثبت',
    decree: 'بارگذاری آخرین حکم، از تاریخ ارجاع',
    defect: 'پاسخ رفع نواقص، از تاریخ نامه',
    inquiry: 'پاسخ استعلام حراست، از تاریخ نامهٔ صادره',
    invite: 'صدور نامهٔ دعوت، از آماده شدن پرونده',
    defense: 'مهلت دفاعیهٔ کارمند، از تاریخ دعوت‌نامه',
    chase: 'پاسخ به نامهٔ پیگیری دفاعیات',
    complete: 'تکمیل مستندات، از دریافت دفاعیه',
    hearing: 'تعیین جلسهٔ دفاع، از تکمیل مستندات',
    hearingLetter: 'نامهٔ حضور در جلسه، از تعیین جلسه',
    verdict: 'صدور رأی، از تاریخ جلسه',
    sign: 'امضای رأی توسط اعضا، از صدور رأی',
    notice: 'صدور ابلاغیه، از امضای رأی',
    result: 'دریافت نتیجهٔ ابلاغ، از تاریخ ابلاغیه',
    archive: 'ارسال به بایگانی، از دریافت نتیجه'
  };

  function sla() {
    var saved = M.state.settings.sla;
    if (!saved) return SLA;
    var out = {};
    Object.keys(SLA).forEach(function (k) {
      out[k] = saved[k] != null ? saved[k] : SLA[k];
    });
    return out;
  }

  /**
   * اقدام بعدیِ یک پرونده: چه کاری، از کِی منتظر است، و آیا از مهلت گذشته.
   * ترتیب بررسی، همان ترتیب واقعی کار در دبیرخانه است — از دریافت مستندات
   * تا بایگانی. هر شرط یعنی «تا این کار نشود، کار بعدی معنا ندارد».
   */
  function nextAction(rec) {
    var limits = sla();
    var today = J.today();

    function make(key, label, owner, since, limit) {
      var days = since ? J.diffDays(today, since) : null;
      if (days != null && days < 0) days = 0;
      return {
        key: key, label: label, owner: owner, since: since || '',
        days: days, limit: limit,
        // سررسید واقعی: از کِی منتظر است + مهلتش. مبنای نمای «این هفته».
        due: (since && limit != null) ? J.addDays(since, limit) : '',
        overdue: days != null && limit != null && days > limit,
        remaining: (days != null && limit != null) ? (limit - days) : null
      };
    }

    if (isTransferred(rec)) {
      return make('transferred',
        'ارجاع‌شده به ' + (rec.transferTo || 'کارشناس دیگر'), '—', '', null);
    }
    if (isClosed(rec) || rec.archiveDate) return make('closed', 'مختومه', '—', '', null);

    // ۱) ثبت
    if (!rec.intakeDate) return make('intake', 'ثبت تاریخ ورود پرونده', 'دبیرخانه', '', null);

    // ۲) ارجاع به کارشناس
    if (!rec.deliveryDate) {
      return make('assign', 'ارجاع به کارشناس', 'دبیرخانه', rec.intakeDate, limits.assign);
    }

    // ۳) آخرین حکم کارگزینی
    if (!rec.decreeDate) {
      return make('decree', 'گرفتن و بارگذاری آخرین حکم', 'کارشناس',
        rec.deliveryDate, limits.decree);
    }

    // ۴) رفع نواقص — فقط اگر نامه‌اش رفته و هنوز پرونده کامل نشده
    if (rec.defectLetterDate && !rec.docsCompleteDate && !rec.invitationLetterDate) {
      return make('defect', 'پیگیری رفع نواقص', 'واحد سازمانی',
        rec.defectLetterDate, limits.defect);
    }

    // ۵) استعلام حراست — اختیاری؛ فقط وقتی فرستاده شده و بی‌پاسخ مانده
    if (rec.securityOutLetterDate && !rec.securityInLetterDate) {
      return make('inquiry', 'پیگیری پاسخ حراست', 'حراست',
        rec.securityOutLetterDate, limits.inquiry);
    }

    // ۶) نامهٔ دعوت
    if (!rec.invitationLetterDate) {
      return make('invite', 'صدور نامهٔ دعوت', 'کارشناس', rec.decreeDate, limits.invite);
    }

    // ۷) دفاعیات — اگر نیامد، اول پیگیری، بعد مهلت پیگیری
    if (!rec.defenseReceivedDate) {
      if (rec.defenseChaseLetterDate) {
        return make('chase', 'پیگیری دفاعیات (نامهٔ پیگیری رفته)', 'کارمند',
          rec.defenseChaseLetterDate, limits.chase);
      }
      return make('defense', 'دریافت دفاعیات', 'کارمند',
        rec.invitationLetterDate, limits.defense);
    }

    // ۸) تکمیل مستندات
    if (!rec.docsCompleteDate) {
      return make('complete', 'تکمیل سایر مستندات', 'کارشناس',
        rec.defenseReceivedDate, limits.complete);
    }

    // ۹) تعیین جلسهٔ دفاع
    if (!rec.committeeDate) {
      return make('hearing', 'تعیین تاریخ جلسهٔ دفاع', 'دبیر کمیته',
        rec.docsCompleteDate, limits.hearing);
    }

    // ۱۰) نامهٔ حضور در جلسه — فقط تا وقتی جلسه نرسیده
    if (!rec.hearingLetterDate && J.diffDays(rec.committeeDate, today) > 0) {
      return make('hearingLetter', 'صدور نامهٔ حضور در جلسهٔ دفاع', 'دبیرخانه',
        rec.committeeDate, limits.hearingLetter);
    }

    // ۱۱) صدور رأی
    if (!hasVerdict(rec)) {
      return make('verdict', 'صدور و ثبت متن رأی', 'دبیر کمیته',
        rec.committeeDate, limits.verdict);
    }

    // ۱۲) امضای رأی توسط اعضا
    if (!rec.verdictSignedDate) {
      return make('sign', 'گرفتن امضای اعضا پای رأی', 'اعضای کمیته',
        rec.verdictDate || rec.committeeDate, limits.sign);
    }

    // ۱۳) ابلاغ رأی
    if (!rec.noticeLetterDate) {
      return make('notice', 'صدور ابلاغیهٔ رأی', 'دبیرخانه',
        rec.verdictSignedDate, limits.notice);
    }

    // ۱۴) نتیجهٔ ابلاغ
    if (!hasNoticeResult(rec)) {
      return make('result', 'پیگیری نتیجهٔ ابلاغ', 'واحد سازمانی',
        rec.noticeLetterDate, limits.result);
    }

    // ۱۵) بایگانی
    return make('archive', 'ارسال پرونده به بایگانی و اختتام', 'دبیرخانه',
      rec.noticeResultDate || rec.noticeLetterDate, limits.archive);
  }

  /** «منتظر ما» در برابر «منتظر دیگران» */
  var OURS = {
    intake: 1, assign: 1, decree: 1, invite: 1, complete: 1,
    hearing: 1, hearingLetter: 1, verdict: 1, notice: 1, archive: 1
  };

  function isOurs(action) { return !!OURS[action.key]; }

  /**
   * گروه‌بندی پرونده‌ها بر اساس اقدام بعدی.
   * داخل هر گروه، دیرکردها اول می‌آیند و بعد بیشترین انتظار.
   */
  function buckets(cases) {
    var map = {};
    cases.forEach(function (rec) {
      var action = nextAction(rec);
      if (action.key === 'closed' || action.key === 'transferred') return;
      var b = map[action.key] || (map[action.key] = {
        key: action.key, label: action.label, owner: action.owner,
        ours: isOurs(action), limit: action.limit, items: [], overdue: 0
      });
      b.items.push({ rec: rec, action: action });
      if (action.overdue) b.overdue += 1;
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.forEach(function (b) {
      b.items.sort(function (a, c) {
        if (a.action.overdue !== c.action.overdue) return a.action.overdue ? -1 : 1;
        return (c.action.days || 0) - (a.action.days || 0);
      });
      b.oldest = b.items.length ? (b.items[0].action.days || 0) : 0;
    });
    list.sort(function (a, b) {
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      return b.items.length - a.items.length;
    });
    return list;
  }

  /** شمارش پرونده‌ها روی هر مرحله از گردش‌کار */
  function pipeline(cases) {
    var counts = STAGES.map(function () { return 0; });
    cases.forEach(function (rec) {
      stages(rec).forEach(function (st, i) {
        if (st.done) counts[i] += 1;
      });
    });
    return STAGES.map(function (st, i) {
      return { key: st.key, label: st.label, short: st.short, value: counts[i] };
    });
  }

  function summary(cases) {
    var open = cases.filter(function (c) { return !isDone(c); });
    var transferred = cases.filter(isTransferred).length;
    var overdue = 0, ours = 0, theirs = 0;
    open.forEach(function (rec) {
      var a = nextAction(rec);
      if (a.overdue) overdue += 1;
      if (isOurs(a)) ours += 1; else theirs += 1;
    });
    return {
      total: cases.length, open: open.length,
      closed: cases.filter(isClosed).length,
      transferred: transferred,
      overdue: overdue, ours: ours, theirs: theirs
    };
  }

  /**
   * پرونده‌هایی که آمادهٔ جلسهٔ دفاع‌اند: دفاعیه گرفته شده، مستندات تکمیل شده،
   * استعلامی معطل نمانده و هنوز تاریخ جلسه نخورده‌اند.
   */
  function readyForCommittee(cases) {
    return cases.filter(function (rec) {
      if (isDone(rec) || rec.committeeDate) return false;
      if (!rec.deliveryDate || !rec.invitationLetterDate) return false;
      if (rec.securityOutLetterDate && !rec.securityInLetterDate) return false;
      // دفاعیه یا گرفته شده، یا مهلتش گذشته و پیگیری هم شده
      return !!(rec.defenseReceivedDate || rec.docsCompleteDate);
    }).sort(function (a, b) {
      return (a.intakeDate || '') < (b.intakeDate || '') ? -1 : 1;
    });
  }

  /**
   * هفتهٔ پیشِ رو: برای هر یک از هفت روز آینده، چه چیزی سررسید می‌شود.
   * دو جنس در کنار هم می‌آیند: مهلت اقدامِ خودِ پرونده (از روی تاریخ‌ها حساب
   * می‌شود) و قرار پیگیریِ دستی (که کاربر خودش گذاشته است).
   */
  function week(cases, days) {
    var span = days || 7;
    var today = J.today();
    var slots = [];
    var byDate = {};
    for (var i = 0; i < span; i++) {
      var d = J.addDays(today, i);
      var p = J.unpack(d);
      var slot = {
        date: d, offset: i,
        weekday: J.weekday(p.jy, p.jm, p.jd),
        day: p.jd, month: p.jm,
        deadlines: [], follows: []
      };
      slots.push(slot);
      byDate[d] = slot;
    }

    cases.forEach(function (rec) {
      var a = nextAction(rec);
      if (a.key === 'closed' || a.key === 'transferred' || !a.due) return;
      var slot = byDate[a.due];
      if (slot) slot.deadlines.push({ rec: rec, action: a });
    });

    // قرارهای پیگیری، از یادداشت‌های دستی
    if (w.Notes && w.Notes.dueFollowUps) {
      w.Notes.dueFollowUps(false).forEach(function (f) {
        var slot = byDate[f.note.followUp];
        if (slot) slot.follows.push(f);
      });
    }

    slots.forEach(function (s) {
      s.count = s.deadlines.length + s.follows.length;
      s.ids = s.deadlines.map(function (d) { return d.rec.id; })
        .concat(s.follows.map(function (f) { return f.rec.id; }))
        .filter(function (id, i, arr) { return arr.indexOf(id) === i; });
    });
    return slots;
  }

  w.Worklist = {
    STAGES: STAGES, SLA: SLA, SLA_LABELS: SLA_LABELS, sla: sla, stages: stages, nextAction: nextAction,
    buckets: buckets, pipeline: pipeline, summary: summary, isOurs: isOurs,
    isClosed: isClosed, isTransferred: isTransferred, isDone: isDone,
    readyForCommittee: readyForCommittee, week: week
  };
})(window);

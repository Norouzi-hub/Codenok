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
    { key: 'intake', label: 'ثبت در دبیرخانه', short: 'ثبت', field: 'intakeDate' },
    { key: 'assign', label: 'ارجاع به کارشناس', short: 'ارجاع', field: 'deliveryDate' },
    { key: 'inquiry', label: 'استعلام حراست', short: 'استعلام',
      field: 'securityInLetterDate', optional: true },
    { key: 'defense', label: 'دعوت و اخذ دفاعیه', short: 'دفاعیه',
      field: 'invitationLetterDate' },
    { key: 'committee', label: 'طرح در کمیته', short: 'کمیته', field: 'committeeDate' },
    { key: 'verdict', label: 'صدور رأی', short: 'رأی', field: null },
    { key: 'notice', label: 'ابلاغ رأی', short: 'ابلاغ', field: 'noticeLetterDate' },
    { key: 'enforce', label: 'بازگشت ابلاغ و اجرا', short: 'اجرا', field: null }
  ];

  function hasVerdict(rec) {
    return !!(rec.verdictFull || rec.committeeRegNo);
  }

  function hasEnforcement(rec) {
    return !!(rec.noticeReturn || rec.enforcementNotes);
  }

  function stageDone(rec, stage) {
    if (stage.key === 'verdict') return hasVerdict(rec);
    if (stage.key === 'enforce') return hasEnforcement(rec);
    return !!rec[stage.field];
  }

  function isClosed(rec) { return /مختومه/.test(rec.status || ''); }

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
    var closed = isClosed(rec);
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

  /** مهلت پیش‌فرض هر اقدام، به روز */
  var SLA = {
    assign: 3, inquiry: 20, defense: 15, committee: 30,
    verdictText: 7, notice: 10, noticeReturn: 20, enforce: 30
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
   * ترتیب بررسی همان ترتیب واقعی کار در دبیرخانه است.
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

    if (isClosed(rec)) return make('closed', 'مختومه', '—', '', null);
    if (!rec.intakeDate) return make('intake', 'ثبت تاریخ ورود', 'دبیرخانه', '', null);
    if (!rec.deliveryDate) {
      return make('assign', 'ارجاع به کارشناس', 'دبیرخانه', rec.intakeDate, limits.assign);
    }
    // استعلام اختیاری است؛ فقط وقتی فرستاده شده و بی‌پاسخ مانده پیگیری لازم است
    if (rec.securityOutLetterDate && !rec.securityInLetterDate) {
      return make('inquiry', 'پیگیری پاسخ حراست', 'حراست',
        rec.securityOutLetterDate, limits.inquiry);
    }
    if (!rec.invitationLetterDate && !rec.committeeDate) {
      return make('defense', 'دعوت به جلسه و اخذ دفاعیه', 'کارشناس',
        rec.deliveryDate, limits.defense);
    }
    if (!rec.committeeDate) {
      return make('committee', 'درج در دستور کار جلسه', 'کارشناس',
        rec.invitationLetterDate || rec.deliveryDate, limits.committee);
    }
    if (!hasVerdict(rec)) {
      return make('verdictText', 'ثبت متن رأی', 'دبیر کمیته',
        rec.committeeDate, limits.verdictText);
    }
    if (!rec.noticeLetterDate) {
      return make('notice', 'صدور ابلاغیه', 'دبیرخانه', rec.committeeDate, limits.notice);
    }
    if (!rec.noticeReturn) {
      return make('noticeReturn', 'پیگیری بازگشت ابلاغ', 'دبیرخانه',
        rec.noticeLetterDate, limits.noticeReturn);
    }
    return make('enforce', 'پیگیری اجرای رأی', 'واحد سازمانی',
      rec.noticeLetterDate, limits.enforce);
  }

  /** «منتظر ما» در برابر «منتظر دیگران» */
  var OURS = { intake: 1, assign: 1, defense: 1, committee: 1, verdictText: 1, notice: 1 };

  function isOurs(action) { return !!OURS[action.key]; }

  /**
   * گروه‌بندی پرونده‌ها بر اساس اقدام بعدی.
   * داخل هر گروه، دیرکردها اول می‌آیند و بعد بیشترین انتظار.
   */
  function buckets(cases) {
    var map = {};
    cases.forEach(function (rec) {
      var action = nextAction(rec);
      if (action.key === 'closed') return;
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
    var open = cases.filter(function (c) { return !isClosed(c); });
    var overdue = 0, ours = 0, theirs = 0;
    open.forEach(function (rec) {
      var a = nextAction(rec);
      if (a.overdue) overdue += 1;
      if (isOurs(a)) ours += 1; else theirs += 1;
    });
    return {
      total: cases.length, open: open.length,
      closed: cases.length - open.length,
      overdue: overdue, ours: ours, theirs: theirs
    };
  }

  /** پرونده‌هایی که همه‌چیزشان آماده است و فقط باید در جلسه مطرح شوند */
  function readyForCommittee(cases) {
    return cases.filter(function (rec) {
      if (isClosed(rec) || rec.committeeDate) return false;
      if (!rec.deliveryDate) return false;
      if (rec.securityOutLetterDate && !rec.securityInLetterDate) return false;
      return !!rec.invitationLetterDate;
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
      if (a.key === 'closed' || !a.due) return;
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
    STAGES: STAGES, SLA: SLA, sla: sla, stages: stages, nextAction: nextAction,
    buckets: buckets, pipeline: pipeline, summary: summary, isOurs: isOurs,
    isClosed: isClosed, readyForCommittee: readyForCommittee, week: week
  };
})(window);

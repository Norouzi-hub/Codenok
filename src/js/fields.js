// این فایل به‌صورت خودکار از روی فایل اکسل ساخته شده است — دستی ویرایش نکنید.
// tools/gen_data.py

window.FIELDS = [
  {
    "key": "caseNo",
    "label": "شماره پرونده(1)",
    "type": "text",
    "group": "case",
    "col": 0
  },
  {
    "key": "expert",
    "label": "کارشناس پرونده",
    "type": "select",
    "group": "case",
    "col": 1,
    "list": "Karshenas"
  },
  {
    "key": "deliveryDate",
    "label": "تاریخ تحویل پرونده به کارشناس",
    "type": "date",
    "group": "case",
    "col": 2
  },
  {
    "key": "status",
    "label": "وضعیت پرونده(1و2)",
    "type": "select",
    "group": "case",
    "col": 3,
    "list": "vazeiat"
  },
  {
    "key": "year",
    "label": "سال رسیدگی",
    "type": "text",
    "group": "case",
    "col": 8,
    "hidden": true
  },
  {
    "key": "intakeDate",
    "label": "تاریخ ورود به دبیرخانه کمیته(1)",
    "type": "date",
    "group": "case",
    "col": 27
  },
  {
    "key": "reporterOrg",
    "label": "مرجع گزارش دهنده(1)",
    "type": "text",
    "group": "case",
    "col": 28
  },
  {
    "key": "letterNo",
    "label": "شماره نامه(1)",
    "type": "text",
    "group": "case",
    "col": 29
  },
  {
    "key": "letterDate",
    "label": "تاریخ نامه(1)",
    "type": "date",
    "group": "case",
    "col": 30
  },
  {
    "key": "caseType",
    "label": "نوع پرونده مطروحه(1)",
    "type": "select",
    "group": "case",
    "col": 31,
    "list": "NoeParvande"
  },
  {
    "key": "reportSubject",
    "label": "موضوع گزارش پرونده(1)",
    "type": "textarea",
    "group": "case",
    "col": 32
  },
  {
    "key": "priorRecord",
    "label": "سابقه تخلف/ پرونده",
    "type": "textarea",
    "group": "case",
    "col": 33
  },
  {
    "key": "pastReporters",
    "label": "مراجع گزارش سالهای گذشته",
    "type": "textarea",
    "group": "case",
    "col": 67
  },
  {
    "key": "notes",
    "label": "توضیحات",
    "type": "textarea",
    "group": "case",
    "col": 45
  },
  {
    "key": "updatedAtField",
    "label": "تاریخ بروز رسانی",
    "type": "date",
    "group": "case",
    "col": 68
  },
  {
    "key": "transferDate",
    "label": "تاریخ ارجاع به کارشناس دیگر",
    "type": "date",
    "group": "case",
    "col": null
  },
  {
    "key": "transferTo",
    "label": "ارجاع به (کارشناس جدید)",
    "type": "select",
    "group": "case",
    "col": null,
    "list": "Karshenas"
  },
  {
    "key": "transferFrom",
    "label": "کارشناس قبلی",
    "type": "text",
    "group": "case",
    "col": null
  },
  {
    "key": "transferLetterNo",
    "label": "شماره نامه ارجاع",
    "type": "text",
    "group": "case",
    "col": null
  },
  {
    "key": "transferReason",
    "label": "علت ارجاع به کارشناس دیگر",
    "type": "textarea",
    "group": "case",
    "col": null
  },
  {
    "key": "stageOverride",
    "label": "مرحلهٔ تنظیم‌شدهٔ دستی",
    "type": "text",
    "group": "case",
    "col": null,
    "hidden": true
  },
  {
    "key": "stageOverrideDate",
    "label": "تاریخ تنظیم دستی مرحله",
    "type": "date",
    "group": "case",
    "col": null,
    "hidden": true
  },
  {
    "key": "stageOverrideNote",
    "label": "علت تنظیم دستی مرحله",
    "type": "text",
    "group": "case",
    "col": null,
    "hidden": true
  },
  {
    "key": "caseSummary",
    "label": "خلاصه پرونده",
    "type": "textarea",
    "group": "case",
    "col": null,
    "hidden": true
  },
  {
    "key": "nationalId",
    "label": "کد ملی*(1)",
    "type": "text",
    "group": "person",
    "col": 4
  },
  {
    "key": "firstName",
    "label": "نام(1)",
    "type": "text",
    "group": "person",
    "col": 5
  },
  {
    "key": "lastName",
    "label": "نام خانوادگی(1)",
    "type": "text",
    "group": "person",
    "col": 6
  },
  {
    "key": "fatherName",
    "label": "نام پدر(1)",
    "type": "text",
    "group": "person",
    "col": 11
  },
  {
    "key": "idNumber",
    "label": "شماره شناسنامه(1)",
    "type": "text",
    "group": "person",
    "col": 12
  },
  {
    "key": "personnelCode",
    "label": "کد پرسنلی(1)",
    "type": "text",
    "group": "person",
    "col": 10
  },
  {
    "key": "gender",
    "label": "جنسیت(1)",
    "type": "select",
    "group": "person",
    "col": 13,
    "list": "Jensiat"
  },
  {
    "key": "maritalStatus",
    "label": "وضعیت تاهل(1)",
    "type": "select",
    "group": "person",
    "col": 14,
    "list": "Tahol"
  },
  {
    "key": "education",
    "label": "مدرک تحصیلی(1)",
    "type": "select",
    "group": "person",
    "col": 15,
    "list": "Madrak"
  },
  {
    "key": "phone",
    "label": "شماره تماس(1)",
    "type": "tel",
    "group": "person",
    "col": 16
  },
  {
    "key": "postTitle",
    "label": "نام پست(1)",
    "type": "text",
    "group": "job",
    "col": 17
  },
  {
    "key": "jobTitle",
    "label": "نام شغل(1)",
    "type": "text",
    "group": "job",
    "col": 18
  },
  {
    "key": "jobGrade",
    "label": "رتبه/گروه شغلی(1)",
    "type": "text",
    "group": "job",
    "col": 19
  },
  {
    "key": "jobNature",
    "label": "ماهیت شغل(1)",
    "type": "select",
    "group": "job",
    "col": 20,
    "list": "Mahiat"
  },
  {
    "key": "payrollPlace",
    "label": "محل پرداخت(1)",
    "type": "text",
    "group": "job",
    "col": 21
  },
  {
    "key": "orgUnit",
    "label": "*واحد سازمانی(1)",
    "type": "text",
    "group": "job",
    "col": 22
  },
  {
    "key": "servicePlace",
    "label": "محل خدمت*(1)",
    "type": "text",
    "group": "job",
    "col": 23
  },
  {
    "key": "servicePlaceType",
    "label": "نوع محل خدمت*(1)",
    "type": "select",
    "group": "job",
    "col": 24,
    "list": "NoeMahaleKHedmat"
  },
  {
    "key": "contractType",
    "label": "نوع قرارداد*(1)",
    "type": "select",
    "group": "job",
    "col": 25,
    "list": "NoeGHarardad"
  },
  {
    "key": "employmentStatus",
    "label": "وضعیت اشتغال*(1)",
    "type": "select",
    "group": "job",
    "col": 26,
    "list": "Eshteghal"
  },
  {
    "key": "hireDate",
    "label": "تاریخ استخدام",
    "type": "date",
    "group": "job",
    "col": null
  },
  {
    "key": "decreeDate",
    "label": "تاریخ آخرین حکم کارگزینی",
    "type": "date",
    "group": "job",
    "col": null
  },
  {
    "key": "invitationLetterNo",
    "label": "شماره نامه جهت دعوت به کمیته(اخذ دفاعیه)",
    "type": "text",
    "group": "defense",
    "col": 57
  },
  {
    "key": "invitationLetterDate",
    "label": "تاریخ نامه جهت اخذ دفاعیه",
    "type": "date",
    "group": "defense",
    "col": 58
  },
  {
    "key": "defenseSummary",
    "label": "خلاصه دفاعیات",
    "type": "textarea",
    "group": "defense",
    "col": 34
  },
  {
    "key": "securityOutLetterNo",
    "label": "نامه صادره استعلام حراست",
    "type": "text",
    "group": "defense",
    "col": 52
  },
  {
    "key": "securityOutLetterDate",
    "label": "تاریخ نامه صادره استعلام حراست",
    "type": "date",
    "group": "defense",
    "col": 53
  },
  {
    "key": "securityInLetterNo",
    "label": "شماره نامه وارده  استعلام حراست",
    "type": "text",
    "group": "defense",
    "col": 54
  },
  {
    "key": "securityInLetterDate",
    "label": "تاریخ  نامه پاسخ استعلام حراست",
    "type": "date",
    "group": "defense",
    "col": 55
  },
  {
    "key": "securityAnswerSubject",
    "label": "موضوع پاسخ حراست",
    "type": "textarea",
    "group": "defense",
    "col": 56
  },
  {
    "key": "defenseDueDate",
    "label": "مهلت حضور و ارائه دفاعیه",
    "type": "date",
    "group": "defense",
    "col": null
  },
  {
    "key": "defenseReceivedDate",
    "label": "تاریخ اخذ دفاعیه (دریافت دفاعیات)",
    "type": "date",
    "group": "defense",
    "col": null
  },
  {
    "key": "defenseChaseLetterDate",
    "label": "تاریخ نامه پیگیری دفاعیات",
    "type": "date",
    "group": "defense",
    "col": null
  },
  {
    "key": "defectLetterNo",
    "label": "شماره نامه رفع نواقص",
    "type": "text",
    "group": "defense",
    "col": null
  },
  {
    "key": "defectLetterDate",
    "label": "تاریخ نامه رفع نواقص",
    "type": "date",
    "group": "defense",
    "col": null
  },
  {
    "key": "docsCompleteDate",
    "label": "تاریخ تکمیل مستندات پرونده",
    "type": "date",
    "group": "defense",
    "col": null
  },
  {
    "key": "salaryStopLetterNo",
    "label": "شماره نامه بستن حقوق",
    "type": "text",
    "group": "defense",
    "col": null
  },
  {
    "key": "salaryStopLetterDate",
    "label": "تاریخ نامه بستن حقوق",
    "type": "date",
    "group": "defense",
    "col": null
  },
  {
    "key": "committeeDate",
    "label": "تاریخ طرح در کمیته(2)",
    "type": "date",
    "group": "verdict",
    "col": 7
  },
  {
    "key": "session",
    "label": "جلسه(2)",
    "type": "text",
    "group": "verdict",
    "col": 9
  },
  {
    "key": "committeeRegNo",
    "label": "شماره ثبت دبیرخانه کمیته(2)",
    "type": "text",
    "group": "verdict",
    "col": 41
  },
  {
    "key": "verdictFull",
    "label": "رای کامل کمیته انضباطی(2)",
    "type": "textarea",
    "group": "verdict",
    "col": 35
  },
  {
    "key": "hearingLetterNo",
    "label": "شماره نامه حضور در جلسه دفاع",
    "type": "text",
    "group": "verdict",
    "col": null
  },
  {
    "key": "hearingLetterDate",
    "label": "تاریخ نامه حضور در جلسه دفاع",
    "type": "date",
    "group": "verdict",
    "col": null
  },
  {
    "key": "verdictDate",
    "label": "تاریخ صدور رأی",
    "type": "date",
    "group": "verdict",
    "col": null
  },
  {
    "key": "verdictSignedDate",
    "label": "تاریخ امضای رأی توسط اعضا",
    "type": "date",
    "group": "verdict",
    "col": null
  },
  {
    "key": "verdictResult",
    "label": "نتیجه رأی کمیته",
    "type": "select",
    "group": "verdict",
    "col": null,
    "list": "NatijeRay"
  },
  {
    "key": "noticeLetterNo",
    "label": "شماره نامه ابلاغ رای(3)",
    "type": "text",
    "group": "enforce",
    "col": 42
  },
  {
    "key": "noticeLetterDate",
    "label": "تاریخ نامه ابلاغ رای(3)",
    "type": "date",
    "group": "enforce",
    "col": 43
  },
  {
    "key": "noticeReturn",
    "label": "بازگشت ابلاغ رای(4)",
    "type": "select",
    "group": "enforce",
    "col": 44,
    "list": "Eblagh"
  },
  {
    "key": "enforcementNotes",
    "label": "توضیح پیگیری اجرای آرا",
    "type": "textarea",
    "group": "enforce",
    "col": 46
  },
  {
    "key": "enforcementFollowup2",
    "label": "پیگیری اجرای آرا2",
    "type": "textarea",
    "group": "enforce",
    "col": 47
  },
  {
    "key": "contractStatusUntilFurther",
    "label": "وضعیت قرارداد تا اطلاع ثانوی(تعلیق، تنزل قرارداد، استرداد اضافه مبلغ و مبالغ دیگر، ....)",
    "type": "textarea",
    "group": "enforce",
    "col": 48
  },
  {
    "key": "deadlines",
    "label": "بازه زمانی و مهلت های تعیین شده",
    "type": "textarea",
    "group": "enforce",
    "col": 49
  },
  {
    "key": "cooperationStatus",
    "label": "وضعیت همکاری",
    "type": "text",
    "group": "enforce",
    "col": 50
  },
  {
    "key": "incentiveDocs",
    "label": "مستندات درخصوص تقاضای تشویقی",
    "type": "textarea",
    "group": "enforce",
    "col": 51
  },
  {
    "key": "judicialReport",
    "label": "گزارش به مراجع قضایی",
    "type": "textarea",
    "group": "enforce",
    "col": 61
  },
  {
    "key": "multiJobViolation",
    "label": "پیگیری نقض قانون  ممنوعیت تصدی  بیش از یک شغل",
    "type": "textarea",
    "group": "enforce",
    "col": 62
  },
  {
    "key": "noticeResultDate",
    "label": "تاریخ دریافت نتیجه ابلاغ",
    "type": "date",
    "group": "enforce",
    "col": null
  },
  {
    "key": "archiveDate",
    "label": "تاریخ ارسال به بایگانی",
    "type": "date",
    "group": "enforce",
    "col": null
  },
  {
    "key": "salaryResumeLetterNo",
    "label": "شماره نامه باز کردن حقوق",
    "type": "text",
    "group": "enforce",
    "col": null
  },
  {
    "key": "salaryResumeLetterDate",
    "label": "تاریخ نامه باز کردن حقوق",
    "type": "date",
    "group": "enforce",
    "col": null
  },
  {
    "key": "enforceOutcome",
    "label": "وضعیت کارمند پس از ابلاغ رأی",
    "type": "select",
    "group": "enforce",
    "col": null,
    "list": "NatijeEjra"
  },
  {
    "key": "dismissalLetterNo",
    "label": "شماره نامه اخراج / خاتمه همکاری",
    "type": "text",
    "group": "enforce",
    "col": null
  },
  {
    "key": "dismissalDate",
    "label": "تاریخ اخراج / خاتمه همکاری",
    "type": "date",
    "group": "enforce",
    "col": null
  },
  {
    "key": "undertakingDate",
    "label": "تاریخ اخذ تعهد",
    "type": "date",
    "group": "enforce",
    "col": null
  },
  {
    "key": "undertakingNote",
    "label": "موضوع تعهد اخذشده",
    "type": "textarea",
    "group": "enforce",
    "col": null
  }
];
window.GROUPS = [
  {
    "key": "case",
    "label": "پرونده و گزارش"
  },
  {
    "key": "person",
    "label": "مشخصات فرد"
  },
  {
    "key": "job",
    "label": "اطلاعات شغلی و سازمانی"
  },
  {
    "key": "defense",
    "label": "دعوت، دفاعیات و استعلام حراست"
  },
  {
    "key": "verdict",
    "label": "کمیته و رأی"
  },
  {
    "key": "enforce",
    "label": "ابلاغ و اجرای رأی"
  }
];
window.DEFAULT_LISTS = {
  "Karshenas": [
    "نوروزی"
  ],
  "vazeiat": [
    "ابلاغ و مختومه شد",
    "ارجاع به کارشناس دیگر",
    "در انتظار وصول استعلام",
    "در دستور کار قرار گرفت",
    "رای صادر، ثبت و در انتظارابلاغ رای قرار گرفت",
    "مفتوح رسیدگی",
    "وفق مقررات اقدام و مختومه شد"
  ],
  "NoeParvande": [
    "تشویق",
    "تنبیه",
    "سایر",
    "غیبت"
  ],
  "Jensiat": [
    "زن",
    "مرد"
  ],
  "Tahol": [
    "متاهل",
    "مجرد",
    "معیل"
  ],
  "Madrak": [
    "دیپلم",
    "زیر دیپلم",
    "فوق دیپلم",
    "فوق لیسانس",
    "لیسانس"
  ],
  "Mahiat": [
    "کارمندی",
    "کارگری"
  ],
  "NoeMahaleKHedmat": [
    "سازمان های غیر مستقل",
    "سازمان های مستقل",
    "شرکت های تابعه شهرداری تهران",
    "مناطق",
    "واحدهای ستادی"
  ],
  "NoeGHarardad": [
    "شرکت خدمات اداری شهر",
    "قرارداد دائم سازمان یا شرکت",
    "قرارداد مدت معین سازمان یا شرکت",
    "موسسه هادیان شهر",
    "کارگر رسمی"
  ],
  "Eshteghal": [
    "بازنشسته",
    "تعلیق",
    "خاتمه همکاری",
    "شاغل"
  ],
  "Eblagh": [
    "ابلاغ شد",
    "ابلاغ نشد",
    "در انتظار بازگشت",
    "مستنکف از ابلاغ"
  ],
  "NatijeRay": [
    "تبرئه",
    "محکومیت (صدور تنبیه)",
    "منع تعقیب / مختومه",
    "سایر"
  ],
  "NatijeEjra": [
    "اخراج / خاتمه همکاری",
    "اخذ تعهد",
    "اجرای تنبیه",
    "بدون اقدام اجرایی",
    "سایر"
  ]
};
window.DEFAULT_COLUMNS = ["caseNo", "status", "firstName", "lastName", "nationalId", "caseType", "orgUnit", "intakeDate", "committeeDate", "expert"];
window.MILESTONES = [
  {
    "key": "intakeDate",
    "label": "ورود پرونده به دبیرخانه کمیته"
  },
  {
    "key": "deliveryDate",
    "label": "تحویل پرونده به کارشناس"
  },
  {
    "key": "decreeDate",
    "label": "بارگذاری آخرین حکم کارگزینی"
  },
  {
    "key": "defectLetterDate",
    "label": "ارسال نامه رفع نواقص"
  },
  {
    "key": "securityOutLetterDate",
    "label": "ارسال استعلام حراست"
  },
  {
    "key": "securityInLetterDate",
    "label": "وصول پاسخ استعلام حراست"
  },
  {
    "key": "invitationLetterDate",
    "label": "دعوت به کمیته جهت اخذ دفاعیه"
  },
  {
    "key": "salaryStopLetterDate",
    "label": "ارسال نامه بستن حقوق"
  },
  {
    "key": "defenseChaseLetterDate",
    "label": "ارسال نامه پیگیری دفاعیات"
  },
  {
    "key": "defenseReceivedDate",
    "label": "دریافت دفاعیات"
  },
  {
    "key": "docsCompleteDate",
    "label": "تکمیل مستندات پرونده"
  },
  {
    "key": "committeeDate",
    "label": "جلسه دفاع / طرح در کمیته"
  },
  {
    "key": "hearingLetterDate",
    "label": "ارسال نامه حضور در جلسه دفاع"
  },
  {
    "key": "verdictDate",
    "label": "صدور رأی"
  },
  {
    "key": "verdictSignedDate",
    "label": "امضای رأی توسط اعضا"
  },
  {
    "key": "noticeLetterDate",
    "label": "صدور نامه ابلاغ رأی"
  },
  {
    "key": "noticeResultDate",
    "label": "دریافت نتیجه ابلاغ"
  },
  {
    "key": "salaryResumeLetterDate",
    "label": "ارسال نامه باز کردن حقوق"
  },
  {
    "key": "dismissalDate",
    "label": "اخراج / خاتمه همکاری"
  },
  {
    "key": "undertakingDate",
    "label": "اخذ تعهد از کارمند"
  },
  {
    "key": "archiveDate",
    "label": "ارسال به بایگانی"
  }
];

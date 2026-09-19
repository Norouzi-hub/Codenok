# -*- coding: utf-8 -*-
"""Generates src/js/fields.js and src/js/seed.js from the source workbook."""
import json
import os
import re
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# (excel column index, key, type, group)
# type: text | textarea | select | date | tel
SCHEMA = [
    # --- 1) پرونده -------------------------------------------------------
    (0,  'caseNo',                     'text',     'case'),
    (1,  'expert',                     'select',   'case'),
    (2,  'deliveryDate',               'date',     'case'),
    (3,  'status',                     'select',   'case'),
    (8,  'year',                       'text',     'case'),
    (27, 'intakeDate',                 'date',     'case'),
    (28, 'reporterOrg',                'text',     'case'),
    (29, 'letterNo',                   'text',     'case'),
    (30, 'letterDate',                 'date',     'case'),
    (31, 'caseType',                   'select',   'case'),
    (32, 'reportSubject',              'textarea', 'case'),
    (33, 'priorRecord',                'textarea', 'case'),
    (67, 'pastReporters',              'textarea', 'case'),
    # --- 2) مشخصات فرد ---------------------------------------------------
    (4,  'nationalId',                 'text',     'person'),
    (5,  'firstName',                  'text',     'person'),
    (6,  'lastName',                   'text',     'person'),
    (11, 'fatherName',                 'text',     'person'),
    (12, 'idNumber',                   'text',     'person'),
    (10, 'personnelCode',              'text',     'person'),
    (13, 'gender',                     'select',   'person'),
    (14, 'maritalStatus',              'select',   'person'),
    (15, 'education',                  'select',   'person'),
    (16, 'phone',                      'tel',      'person'),
    # --- 3) اطلاعات شغلی و سازمانی ---------------------------------------
    (17, 'postTitle',                  'text',     'job'),
    (18, 'jobTitle',                   'text',     'job'),
    (19, 'jobGrade',                   'text',     'job'),
    (20, 'jobNature',                  'select',   'job'),
    (21, 'payrollPlace',               'text',     'job'),
    (22, 'orgUnit',                    'text',     'job'),
    (23, 'servicePlace',               'text',     'job'),
    (24, 'servicePlaceType',           'select',   'job'),
    (25, 'contractType',               'select',   'job'),
    (26, 'employmentStatus',           'select',   'job'),
    # --- 4) دفاعیات و استعلام حراست --------------------------------------
    (57, 'invitationLetterNo',         'text',     'defense'),
    (58, 'invitationLetterDate',       'date',     'defense'),
    (34, 'defenseSummary',             'textarea', 'defense'),
    (52, 'securityOutLetterNo',        'text',     'defense'),
    (53, 'securityOutLetterDate',      'date',     'defense'),
    (54, 'securityInLetterNo',         'text',     'defense'),
    (55, 'securityInLetterDate',       'date',     'defense'),
    (56, 'securityAnswerSubject',      'textarea', 'defense'),
    # --- 5) کمیته و رأی ---------------------------------------------------
    (7,  'committeeDate',              'date',     'verdict'),
    (9,  'session',                    'text',     'verdict'),
    (41, 'committeeRegNo',             'text',     'verdict'),
    (35, 'verdictFull',                'textarea', 'verdict'),
    # --- 6) ابلاغ و اجرای رأی ---------------------------------------------
    (42, 'noticeLetterNo',             'text',     'enforce'),
    (43, 'noticeLetterDate',           'date',     'enforce'),
    (44, 'noticeReturn',               'select',   'enforce'),
    (46, 'enforcementNotes',           'textarea', 'enforce'),
    (47, 'enforcementFollowup2',       'textarea', 'enforce'),
    (48, 'contractStatusUntilFurther', 'textarea', 'enforce'),
    (49, 'deadlines',                  'textarea', 'enforce'),
    (50, 'cooperationStatus',          'text',     'enforce'),
    (51, 'incentiveDocs',              'textarea', 'enforce'),
    (61, 'judicialReport',             'textarea', 'enforce'),
    (62, 'multiJobViolation',          'textarea', 'enforce'),
    # --- 7) دسته‌بندی تخلف و توضیحات --------------------------------------
    (63, 'violationAdmin',             'textarea', 'violation'),
    (64, 'violationFinancial',         'textarea', 'violation'),
    (65, 'violationTechnical',         'textarea', 'violation'),
    (66, 'violationDisciplinary',      'textarea', 'violation'),
    (45, 'notes',                      'textarea', 'violation'),
    (68, 'updatedAtField',             'date',     'violation'),
]

# ستون‌هایی که عمداً در برنامه نمی‌آیند (به درخواست کاربر حذف شدند).
# در فایل مرجع هر هفت ستون خالی بودند، پس داده‌ای از دست نمی‌رود.
EXCLUDED_COLUMNS = {
    36: 'رای کمیته انضباطی1',
    37: 'رای کمیته انضباطی2',
    38: 'رای کمیته انضباطی3',
    39: 'رای کمیته انضباطی4',
    40: 'رای کمیته انضباطی5',
    59: 'سال',
    60: 'نوع گزارش',
}

# --------------------------------------------------------------------------
# فیلدهایی که در فایل اکسل نبودند ولی گردش‌کار واقعی کمیته به آنها نیاز دارد.
# هر کدام یک مرحله از مسیر پرونده را تاریخ‌دار می‌کند، تا کارتابل بتواند
# بگوید پرونده کجا ایستاده و چند روز است که ایستاده.
#   (key, label, type, group)
EXTRA_FIELDS = [
    # ارجاع به کارشناس دیگر: پرونده از دست دبیرخانهٔ ما خارج می‌شود
    ('transferDate', 'تاریخ ارجاع به کارشناس دیگر', 'date', 'case'),
    ('transferTo', 'ارجاع به (کارشناس جدید)', 'select', 'case'),
    ('transferFrom', 'کارشناس قبلی', 'text', 'case'),
    ('transferLetterNo', 'شماره نامه ارجاع', 'text', 'case'),
    ('transferReason', 'علت ارجاع به کارشناس دیگر', 'textarea', 'case'),
    ('decreeDate', 'تاریخ آخرین حکم کارگزینی', 'date', 'job'),
    ('defectLetterNo', 'شماره نامه رفع نواقص', 'text', 'defense'),
    ('defectLetterDate', 'تاریخ نامه رفع نواقص', 'date', 'defense'),
    ('defenseReceivedDate', 'تاریخ دریافت دفاعیات', 'date', 'defense'),
    ('defenseChaseLetterDate', 'تاریخ نامه پیگیری دفاعیات', 'date', 'defense'),
    ('docsCompleteDate', 'تاریخ تکمیل مستندات پرونده', 'date', 'defense'),
    ('hearingLetterNo', 'شماره نامه حضور در جلسه دفاع', 'text', 'verdict'),
    ('hearingLetterDate', 'تاریخ نامه حضور در جلسه دفاع', 'date', 'verdict'),
    ('verdictDate', 'تاریخ صدور رأی', 'date', 'verdict'),
    ('verdictSignedDate', 'تاریخ امضای رأی توسط اعضا', 'date', 'verdict'),
    ('noticeResultDate', 'تاریخ دریافت نتیجه ابلاغ', 'date', 'enforce'),
    ('archiveDate', 'تاریخ ارسال به بایگانی', 'date', 'enforce'),
]

GROUPS = [
    ('case',      'پرونده و گزارش'),
    ('person',    'مشخصات فرد'),
    ('job',       'اطلاعات شغلی و سازمانی'),
    ('defense',   'دعوت، دفاعیات و استعلام حراست'),
    ('verdict',   'کمیته و رأی'),
    ('enforce',   'ابلاغ و اجرای رأی'),
    ('violation', 'دسته‌بندی تخلف و توضیحات'),
]

# فیلدهایی که به‌صورت پیش‌فرض در جدول فهرست دیده می‌شوند
DEFAULT_COLUMNS = [
    'caseNo', 'status', 'firstName', 'lastName', 'nationalId',
    'caseType', 'orgUnit', 'intakeDate', 'committeeDate', 'expert',
]

# لیست‌های کشویی: کلید فیلد -> نام لیست (همان نام‌های اکسل)
SELECT_LISTS = {
    'expert': 'Karshenas',
    'status': 'vazeiat',
    'gender': 'Jensiat',
    'maritalStatus': 'Tahol',
    'education': 'Madrak',
    'jobNature': 'Mahiat',
    'servicePlaceType': 'NoeMahaleKHedmat',
    'contractType': 'NoeGHarardad',
    'employmentStatus': 'Eshteghal',
    'caseType': 'NoeParvande',
    'noticeReturn': 'Eblagh',
    'transferTo': 'Karshenas',
}

# گزینه‌هایی که در فایل نمونه نبودند ولی منطقاً لازم‌اند
EXTRA_OPTIONS = {
    'Eblagh': ['ابلاغ شد', 'ابلاغ نشد', 'مستنکف از ابلاغ', 'در انتظار بازگشت'],
    'vazeiat': ['ارجاع به کارشناس دیگر'],
    'Eshteghal': ['شاغل', 'بازنشسته', 'خاتمه همکاری', 'تعلیق'],
    'NoeParvande': ['تنبیه', 'تشویق', 'غیبت', 'سایر'],
}

# رویدادهای تایم‌لاین که خودکار از روی فیلدهای تاریخ ساخته می‌شوند
MILESTONES = [
    ('intakeDate',              'ورود پرونده به دبیرخانه کمیته'),
    ('deliveryDate',            'تحویل پرونده به کارشناس'),
    ('decreeDate',              'بارگذاری آخرین حکم کارگزینی'),
    ('defectLetterDate',        'ارسال نامه رفع نواقص'),
    ('securityOutLetterDate',   'ارسال استعلام حراست'),
    ('securityInLetterDate',    'وصول پاسخ استعلام حراست'),
    ('invitationLetterDate',    'دعوت به کمیته جهت اخذ دفاعیه'),
    ('defenseChaseLetterDate',  'ارسال نامه پیگیری دفاعیات'),
    ('defenseReceivedDate',     'دریافت دفاعیات'),
    ('docsCompleteDate',        'تکمیل مستندات پرونده'),
    ('committeeDate',           'جلسه دفاع / طرح در کمیته'),
    ('hearingLetterDate',       'ارسال نامه حضور در جلسه دفاع'),
    ('verdictDate',             'صدور رأی'),
    ('verdictSignedDate',       'امضای رأی توسط اعضا'),
    ('noticeLetterDate',        'صدور نامه ابلاغ رأی'),
    ('noticeResultDate',        'دریافت نتیجه ابلاغ'),
    ('archiveDate',             'ارسال به بایگانی'),
]

PERSIAN_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def norm_date(raw):
    """هر شکلی از تاریخ شمسی را به YYYYMMDD تبدیل می‌کند."""
    s = str(raw).strip().translate(PERSIAN_DIGITS)
    digits = re.sub(r'\D', '', s)
    if len(digits) == 8 and digits[0] == '1':
        return digits
    if len(digits) == 6 and digits[0] == '1':  # مثل 140407 -> ناقص، دست نخورد
        return digits
    return s


def clean(value):
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def main(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    headers = [clean(h) for h in rows[0]]
    body = rows[1:]

    by_col = {col: (key, kind, group) for col, key, kind, group in SCHEMA}
    missing = [i for i in range(len(headers))
               if i not in by_col and i not in EXCLUDED_COLUMNS and headers[i]]
    if missing:
        raise SystemExit('ستون نگاشت‌نشده: %s' % [headers[i] for i in missing])

    dropped = [headers[i] for i in sorted(EXCLUDED_COLUMNS) if i < len(headers)]
    if dropped:
        print('ستون‌های حذف‌شده: %s' % '، '.join(dropped))

    date_keys = {key for _, key, kind, _ in SCHEMA if kind == 'date'}

    # --- استخراج گزینه‌های لیست‌ها از داده‌های موجود ---
    lists = {}
    for col, key, kind, _group in SCHEMA:
        if kind != 'select':
            continue
        name = SELECT_LISTS[key]
        seen = []
        for r in body:
            v = clean(r[col]) if col < len(r) else ''
            if v and v not in seen:
                seen.append(v)
        for extra in EXTRA_OPTIONS.get(name, []):
            if extra not in seen:
                seen.append(extra)
        lists[name] = sorted(seen)

    fields = []
    for col, key, kind, group in SCHEMA:
        f = {'key': key, 'label': headers[col], 'type': kind, 'group': group, 'col': col}
        if kind == 'select':
            f['list'] = SELECT_LISTS[key]
        fields.append(f)
    # فیلدهای گردش‌کار، بعد از فیلدهای اکسل و در گروه خودشان
    for key, label, kind, group in EXTRA_FIELDS:
        f = {'key': key, 'label': label, 'type': kind, 'group': group, 'col': None}
        if kind == 'select':
            f['list'] = SELECT_LISTS[key]
        fields.append(f)
    # داخل هر گروه، ترتیب فیلدها همان ترتیب تعریف است
    order = {g: i for i, (g, _) in enumerate(GROUPS)}
    fields.sort(key=lambda f: order.get(f['group'], 99))

    js = ['// این فایل به‌صورت خودکار از روی فایل اکسل ساخته شده است — دستی ویرایش نکنید.',
          '// tools/gen_data.py', '']
    js.append('window.FIELDS = %s;' % json.dumps(fields, ensure_ascii=False, indent=2))
    js.append('window.GROUPS = %s;' % json.dumps(
        [{'key': k, 'label': v} for k, v in GROUPS], ensure_ascii=False, indent=2))
    js.append('window.DEFAULT_LISTS = %s;' % json.dumps(lists, ensure_ascii=False, indent=2))
    js.append('window.DEFAULT_COLUMNS = %s;' % json.dumps(DEFAULT_COLUMNS, ensure_ascii=False))
    js.append('window.MILESTONES = %s;' % json.dumps(
        [{'key': k, 'label': v} for k, v in MILESTONES], ensure_ascii=False, indent=2))
    with open(os.path.join(ROOT, 'src', 'js', 'fields.js'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(js) + '\n')

    # --- داده‌های اولیه ---
    seed = []
    for r in body:
        rec = {}
        for col, key, kind, _group in SCHEMA:
            v = clean(r[col]) if col < len(r) else ''
            if not v:
                continue
            rec[key] = norm_date(v) if key in date_keys else v
        if rec.get('caseNo'):
            seed.append(rec)

    with open(os.path.join(ROOT, 'src', 'js', 'seed.js'), 'w', encoding='utf-8') as fh:
        fh.write('// داده‌های اولیه، برگرفته از فایل اکسل ارائه‌شده.\n')
        fh.write('window.SEED_CASES = %s;\n' % json.dumps(seed, ensure_ascii=False, indent=1))

    print('fields: %d، گروه: %d، رکورد اولیه: %d' % (len(fields), len(GROUPS), len(seed)))
    for name, opts in lists.items():
        print('  لیست %-18s %d گزینه' % (name, len(opts)))


if __name__ == '__main__':
    main(sys.argv[1])

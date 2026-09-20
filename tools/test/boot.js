/*
 * راه‌اندازی برنامه در تست‌ها.
 *
 * برنامه دیگر بدون دیتابیس بالا نمی‌آید: صفحهٔ شروع می‌پرسد دیتابیس
 * کجاست. تست‌ها فایل واقعی ندارند، پس راه «دادهٔ نمونه» را می‌زنند —
 * همان دکمه‌ای که کاربر هم برای دیدن برنامه دارد.
 */
module.exports = async function bootApp(page, url, opts) {
  opts = opts || {};
  await page.goto(url);
  // یا صفحهٔ شروع می‌آید، یا قفل، یا خودِ برنامه
  await page.waitForSelector('.start-screen, .lock-screen, .worklist, .tasks-view, .tr',
    { timeout: opts.timeout || 20000 });
  if (await page.$('.start-screen')) {
    await page.evaluate(() => document.querySelector('.start-demo').click());
    await page.waitForSelector('.worklist, .tasks-view, .lock-screen, .tr',
      { timeout: opts.timeout || 20000 });
  }
  await page.waitForTimeout(opts.settle == null ? 800 : opts.settle);
};

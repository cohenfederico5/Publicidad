const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = 'file:///' + path.resolve(__dirname, 'Folleto fresquitos v2.html').split('\\').join('/');
  await page.goto(filePath);
  await page.waitForTimeout(2000);
  await page.pdf({
    path: 'Folleto fresquitos v2.pdf',
    width: '210mm',
    height: '297mm',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 }
  });
  await browser.close();
  console.log('PDF generado');
})();

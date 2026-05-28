import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());
app.use(express.static('public'));

let pricesCache = { lastUpdate: null, data: { total: [] } };

async function scrapeSite(url, competitor) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 60000
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const products = await page.evaluate((comp) => {
      const items = [];
      const selectors = ['.product', '.catalog-item', '.product-card', 'article', 'div.card'];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          const nameEl = el.querySelector('h2, h3, .name, .title, strong, a');
          const priceEl = el.querySelector('.price, .current-price, .woocommerce-Price-amount, .catalog-price');

          const name = nameEl ? nameEl.innerText.trim() : '';
          let price = priceEl ? priceEl.innerText.trim() : '';

          if (!price) {
            const match = el.innerText.match(/(\d{1,3}(?:\s?\d{3})*)\s*[₽р]/);
            if (match) price = match[0] + ' ₽';
          }

          if (name.length > 12 && price && !name.includes('elementor')) {
            items.push({
              name: name.slice(0, 160),
              price: price,
              competitor: comp
            });
          }
        });
      });
      return items.slice(0, 25);
    }, competitor);

    return products;
  } catch (e) {
    console.error(`Ошибка парсинга ${competitor}:`, e.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

app.get('/api/prices', async (req, res) => {
  try {
    if (!pricesCache.lastUpdate || (Date.now() - pricesCache.lastUpdate) > 30 * 60 * 1000) {
      console.log("🔄 Запуск парсинга конкурентов...");

      const [tn, strong, anko] = await Promise.all([
        scrapeSite('https://techengroup.ru/catalog/', 'TN Group'),
        scrapeSite('https://strongpol.ru/catalog/', 'Strongpol'),
        scrapeSite('https://akro-p.ru/shop/', 'Anko-P')
      ]);

      pricesCache.data.total = [...tn, ...strong, ...anko];
      pricesCache.lastUpdate = Date.now();

      console.log(`✅ Спарсено товаров: ${pricesCache.data.total.length}`);
    }

    res.json(pricesCache.data);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
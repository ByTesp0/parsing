import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());
app.use(express.static('public'));

let pricesCache = { lastUpdate: null, data: { total: [] } };

async function scrapeTechengroup() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://techengroup.ru/catalog/', { waitUntil: 'networkidle2', timeout: 60000 });

  const products = await page.evaluate(() => {
    const items = [];
    
    // Более точные селекторы для Techengroup
    document.querySelectorAll('div, article, .product, .catalog-item').forEach(el => {
      const nameEl = el.querySelector('h2, h3, .name, .title, strong');
      const priceEl = el.querySelector('.price, .catalog-price, .current-price, span');

      let name = nameEl ? nameEl.innerText.trim() : '';
      let price = priceEl ? priceEl.innerText.trim() : '';

      // Дополнительно ищем цену по тексту
      if (!price) {
        const text = el.innerText;
        const priceMatch = text.match(/(\d[\d\s]*[₽р.])/);
        if (priceMatch) price = priceMatch[0];
      }

      if (name.length > 10 && price && !name.includes('elementor')) {
        items.push({
          name: name.slice(0, 150),
          price: price,
          competitor: 'TN Group'
        });
      }
    });

    return items.slice(0, 25); // ограничиваем
  });

  await browser.close();
  return products;
}

async function scrapeStrongpol() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://strongpol.ru/catalog/', { waitUntil: 'networkidle2', timeout: 60000 });

  const products = await page.evaluate(() => {
    const items = [];
    
    document.querySelectorAll('.product, .catalog-item, div').forEach(el => {
      const nameEl = el.querySelector('h2, h3, .name, .title');
      const priceEl = el.querySelector('.price, .woocommerce-Price-amount, .current-price');

      let name = nameEl ? nameEl.innerText.trim() : '';
      let price = priceEl ? priceEl.innerText.trim() : '';

      if (name.length > 8 && price) {
        items.push({
          name: name.slice(0, 150),
          price: price,
          competitor: 'Strongpol'
        });
      }
    });

    return items;
  });

  await browser.close();
  return products;
}

async function scrapeAkrop() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://akro-p.ru/shop/', { waitUntil: 'networkidle2', timeout: 60000 });

  const products = await page.evaluate(() => {
    const items = [];
    
    document.querySelectorAll('.product, .shop-item, .product-item').forEach(el => {
      const nameEl = el.querySelector('h2, h3, .name, .title');
      const priceEl = el.querySelector('.price, .woocommerce-Price-amount');

      let name = nameEl ? nameEl.innerText.trim() : '';
      let price = priceEl ? priceEl.innerText.trim() : '';

      if (name.length > 8 && price) {
        items.push({
          name: name.slice(0, 150),
          price: price,
          competitor: 'Anko-P'
        });
      }
    });

    return items;
  });

  await browser.close();
  return products;
};

app.get('/api/prices', async (req, res) => {
  try {
    if (!pricesCache.lastUpdate || (Date.now() - pricesCache.lastUpdate) > 25 * 60 * 1000) {
      console.log("🔄 Запуск парсинга конкурентов...");

      const [tn, strong, anko] = await Promise.all([
        scrapeTechengroup(),
        scrapeStrongpol(),
        scrapeAkrop()
      ]);

      pricesCache.data = {
        tnGroup: tn,
        strongpol: strong,
        ankoP: anko,
        total: [...tn, ...strong, ...anko]
      };
      pricesCache.lastUpdate = Date.now();

      console.log(`✅ Успешно спарсено: ${pricesCache.data.total.length} товаров`);
    }

    res.json(pricesCache.data);
  } catch (error) {
    console.error("❌ Ошибка:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});
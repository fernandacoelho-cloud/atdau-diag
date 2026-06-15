// tests/categorias-ma.spec.js
// Mapa Anotado — categorias: (a) categorias fixas novas p/ itinerários culturais e
// leitura perceptiva SEL (patrimônio imaterial, ponto de interpretação, elemento
// cênico); (b) categorias PERSONALIZADAS (state.ma_categorias) mescladas em
// MA_CATEGORIES via maSyncCategorias, persistem no reload e podem ser removidas.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Categorias do Mapa Anotado: fixas novas + custom (cria, persiste, remove)', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(700);

  // (a) categorias fixas novas presentes e com chip
  const fixas = await page.evaluate(() => ({
    imaterial: !!MA_CATEGORIES.find(c => c.id === 'patrimonio-imaterial'),
    interpret: !!MA_CATEGORIES.find(c => c.id === 'ponto-interpretacao'),
    cenico: !!MA_CATEGORIES.find(c => c.id === 'elemento-cenico'),
    chip: !!document.querySelector('#ma-categories [onclick*="patrimonio-imaterial"]'),
  }));
  expect(fixas.imaterial).toBe(true);
  expect(fixas.interpret).toBe(true);
  expect(fixas.cenico).toBe(true);
  expect(fixas.chip).toBe(true);

  // (b) criar categoria custom
  const criar = await page.evaluate(() => {
    document.getElementById('ma-cat-nova-nome').value = 'Espaço âncora';
    document.getElementById('ma-cat-nova-cor').value = '#9b59b6';
    maAddCategoria();
    const c = (state.ma_categorias || [])[0];
    return { n: (state.ma_categorias || []).length, id: c && c.id, noArray: !!MA_CATEGORIES.find(x => x.id === (c && c.id)), chip: !!document.querySelector('#ma-categories [onclick*="maRemCategoria"]') };
  });
  expect(criar.n).toBe(1);
  expect(criar.noArray).toBe(true);
  expect(criar.chip).toBe(true);

  // anotação com a categoria custom resolve a cor (não cai no fallback)
  const cor = await page.evaluate((cid) => {
    MapaAnotadoStore.add({ category: cid, title: 'Âncora', coords: [-43.8, -19.7] });
    return (MA_CATEGORIES.find(c => c.id === cid) || {}).color;
  }, criar.id);
  expect(cor).toBe('#9b59b6');

  // persiste no reload (rehidrata MA_CATEGORIES via carregarDados→maSyncCategorias)
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(500);
  const persist = await page.evaluate(() => ({
    n: (state.ma_categorias || []).length,
    noArray: !!MA_CATEGORIES.find(x => x.custom),
    chip: !!document.querySelector('#ma-categories [onclick*="maRemCategoria"]'),
  }));
  expect(persist.n).toBe(1);
  expect(persist.noArray).toBe(true);
  expect(persist.chip).toBe(true);

  // remover
  const rem = await page.evaluate(() => {
    maRemCategoria((state.ma_categorias || [])[0].id);
    return { n: (state.ma_categorias || []).length, noArray: !!MA_CATEGORIES.find(x => x.custom) };
  });
  expect(rem.n).toBe(0);
  expect(rem.noArray).toBe(false);
});

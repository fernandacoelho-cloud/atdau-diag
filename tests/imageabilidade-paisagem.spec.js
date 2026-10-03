// tests/imageabilidade-paisagem.spec.js
// Onda F2 — usabilidade: o painel Paisagem (04) ganha o MAPA de imageabilidade (Lynch),
// reusando a camada/tema 'lynch' já existente. Bloco "Leitura da imagem urbana" agora
// tem botão "📍 Mostrar mapa" + block-map data-theme="lynch" (marcos/nós/caminhos/bordas/bairros).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('F2: Paisagem (panel-5, fundida com a antiga 04) tem o mapa de imageabilidade (tema lynch) e ele inicializa', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  await page.locator('#nav-5').click();
  await page.waitForTimeout(700);

  // o block-map de imageabilidade existe no painel Paisagem
  const wrap = page.locator('#panel-5 .block-map-wrap[data-theme="lynch"]');
  expect(await wrap.count()).toBe(1);

  // abrir o mapa pelo toggle do mesmo bloco ("Leitura da imagem urbana")
  const toggle = page.locator('#panel-5 .block:has(.block-map-wrap[data-theme="lynch"]) .block-map-toggle');
  expect(await toggle.count()).toBe(1);
  // na aba fundida o bloco fica no grupo "Paisagem e imagem urbana" (recolhido por padrão)
  const grupo = page.locator('#panel-5 .cat-group:has(.block-map-wrap[data-theme="lynch"])');
  await expect(grupo.locator('.cat-title')).toHaveText('Paisagem e imagem urbana');
  await grupo.locator(':scope > .cat-header').click();
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();

  // o mapa inicializa (canvas do MapLibre) + ganha o botão "abrir maior" (F1)
  await page.waitForFunction(
    () => { const w = document.querySelector('#panel-5 .block-map-wrap[data-theme="lynch"]'); return w && w.querySelector('.maplibregl-canvas'); },
    null, { timeout: 25000 }
  );
  const info = await page.evaluate(() => {
    const w = document.querySelector('#panel-5 .block-map-wrap[data-theme="lynch"]');
    return {
      temCanvas: !!w.querySelector('.maplibregl-canvas'),
      temExpand: !!w.querySelector('.ml-expand-btn'),
      temaLynchExiste: !!(typeof ML_THEMES !== 'undefined' && ML_THEMES.lynch && ML_THEMES.lynch.layers.includes('lynch')),
    };
  });
  console.log('F2:', info);
  expect(info.temCanvas).toBe(true);
  expect(info.temaLynchExiste).toBe(true);
  expect(info.temExpand).toBe(true);   // herdou o "abrir maior" da F1
});

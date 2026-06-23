// tests/mapa-fullscreen.spec.js
// Onda F1 — usabilidade: todo mapa MapLibre ganha o controle "⛶ abrir maior" (controle PRÓPRIO,
// que expande o mapa numa sobreposição via CSS — NÃO usa a API de tela cheia do SO, que
// iframes/preview embutidos bloqueiam e fariam o FullscreenControl nativo sumir).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('F1: "abrir maior" aparece nos mapas e expande o mapa numa sobreposição', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  // Mapa de Análise: botão presente
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const expandBtn = page.locator('#ml-map .ml-expand-btn');
  expect(await expandBtn.count()).toBeGreaterThan(0);

  // clicar → o container ganha .mapa-expandido e cresce ~ até a viewport (1400px)
  const antes = await page.locator('#ml-map').boundingBox();
  await expandBtn.first().click();
  await page.waitForTimeout(250);
  const expandido = await page.evaluate(() => document.getElementById('ml-map').classList.contains('mapa-expandido'));
  const depois = await page.locator('#ml-map').boundingBox();
  console.log('F1 expand:', { antesW: Math.round(antes.width), depoisW: Math.round(depois.width), expandido });
  expect(expandido).toBe(true);
  expect(depois.width).toBeGreaterThan(antes.width);
  expect(depois.width).toBeGreaterThan(1000);   // ocupa quase a viewport (1400) → não caiu em containing-block de transform

  // restaurar (clicar de novo)
  await expandBtn.first().click();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.getElementById('ml-map').classList.contains('mapa-expandido'))).toBe(false);

  // block-map do Contexto Urbano também tem o botão
  await page.locator('#nav-1').click();
  await page.waitForTimeout(700);
  const btn = page.locator('.block-map-toggle').nth(0);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForFunction(() => document.querySelectorAll('.block-map-wrap')[0]?.querySelector('.ml-expand-btn'), null, { timeout: 25000 });
  expect(await page.locator('.block-map-wrap').nth(0).locator('.ml-expand-btn').count()).toBeGreaterThan(0);
});

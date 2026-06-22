// tests/import-formato.spec.js
// UX: os botões de Importar mostram os formatos aceitos à vista (não só no tooltip).
//   - Mapa de Análise (label #ml-import-file): "shape/GeoJSON"
//   - Block-map do diagnóstico (.bm-import-btn, ex.: Contexto Urbano): "shape/GeoJSON/KML"
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Botões de importar mostram os formatos aceitos (Mapa de Análise + block-map)', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  // 1) Mapa de Análise (elemento estático no DOM)
  const lblImport = (await page.locator('label[for="ml-import-file"]').textContent()) || '';
  console.log('label Mapa de Análise:', lblImport.trim());
  expect(lblImport).toMatch(/shape/i);
  expect(lblImport).toMatch(/GeoJSON/i);

  // 2) Block-map do Contexto Urbano (panel-1): abrir o mapa do 1º bloco e ler o botão
  await page.locator('#nav-1').click();
  await page.waitForTimeout(700);
  const btn = page.locator('.block-map-toggle').nth(0);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await page.waitForFunction(() => document.querySelectorAll('.block-map-wrap')[0]?.querySelector('.bm-import-btn'), null, { timeout: 25000 });
  const bmTxt = (await page.locator('.block-map-wrap').nth(0).locator('.bm-import-btn').textContent()) || '';
  console.log('botão block-map:', bmTxt.trim());
  expect(bmTxt).toMatch(/shape/i);
  expect(bmTxt).toMatch(/GeoJSON/i);
});

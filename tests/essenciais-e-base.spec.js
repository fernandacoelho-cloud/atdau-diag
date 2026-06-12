// tests/essenciais-e-base.spec.js
// 2026-06-11:
//  (2) Completude com CAMPOS ESSENCIAIS: pesam mais e marcam o bloco como
//      pendente (◆) quando vazios.
//  (3) Mapa Anotado: o basemap fica ACIMA da camada de fundo (id 'bg') — antes
//      era inserido abaixo do fundo opaco e o mapa aparecia "vazio".
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

const ESSENCIAIS = ['proj-nome', 'proj-tipo', 'proj-escopo', 'proj-end', 'proj-area', 'proj-ac', 'proj-usuario'];

test('Completude: campos essenciais pesam mais e marcam o bloco como pendente', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  // panel-0 (Identificação) já é o ativo; os campos essenciais ganham .is-essencial
  const marcados = await page.evaluate(() => [...document.querySelectorAll('.form-field.is-essencial')].length);
  expect(marcados).toBeGreaterThanOrEqual(5);

  const antesEssPend = await page.evaluate(() =>
    document.getElementById('proj-nome').closest('.block').querySelector(':scope > .block-header .block-progress').classList.contains('ess-pend'));
  expect(antesEssPend).toBe(true); // há essencial vazio → pendente

  // preencher TODOS os essenciais
  await page.evaluate((ids) => {
    ids.forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      if (el.tagName === 'SELECT') { if (el.options.length > 1) el.selectedIndex = 1; }
      else el.value = '123';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, ESSENCIAIS);
  await page.waitForTimeout(700);
  const depois = await page.evaluate(() => document.getElementById('proj-nome').closest('.block').querySelector(':scope > .block-header .block-progress').classList.contains('ess-pend'));
  expect(depois).toBe(false); // todos preenchidos → sem alerta

  // peso direto: um campo essencial vale PESO_ESSENCIAL (2) no denominador
  const peso = await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'block';
    d.innerHTML = '<input id="proj-area" type="text"><input id="x-comum" type="text">';
    document.body.appendChild(d);
    const r = _contarPreenchimento(d); d.remove();
    return r;
  });
  expect(peso.total).toBe(3);    // proj-area(2) + comum(1)
  expect(peso.essTotal).toBe(1);
});

test('Mapa Anotado: basemap renderizado acima do fundo (mapa não fica vazio)', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  await page.locator('#nav-9').click();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('ma-mapa')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const layers = _maInst.getStyle().layers;
    const bgIdx = layers.findIndex(l => l.type === 'background');
    const bmIdx = layers.findIndex(l => l.id === 'basemap-layer');
    const canvas = document.querySelector('#ma-mapa canvas');
    return { bgIdx, bmIdx, acimaDoFundo: bmIdx > bgIdx, canvasW: canvas ? Math.round(canvas.getBoundingClientRect().width) : 0 };
  });
  expect(r.bmIdx).toBeGreaterThanOrEqual(0);   // basemap existe
  expect(r.acimaDoFundo).toBe(true);           // o fix: acima do fundo opaco 'bg'
  expect(r.canvasW).toBeGreaterThan(100);      // mapa realmente dimensionado
});

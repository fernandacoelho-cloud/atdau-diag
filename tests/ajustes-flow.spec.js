// tests/ajustes-flow.spec.js
// Ajustes 2026-06-11: pesos por critério na Viabilidade, undo no SWOT, e a
// cópia do Mapa Anotado ("categoria acima", não "abaixo").
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Viabilidade: peso do critério muda o escore (média ponderada)', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-11').click();
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    state.viab_criterios = ['C1', 'C2', 'C3', 'Custo'];
    state.viab_pesos = {};
    state.viab_terrenos = [{ id: 1, nome: 'A', area: 1000, scores: { C1: 5, C2: 4, C3: 4, Custo: 2 } }];
    document.getElementById('v-dim-ac').value = 800; document.getElementById('v-dim-ca').value = 2;
    renderViabilidade();
    const sem = _viabScore(state.viab_terrenos[0]).media;
    setCriterioPeso('Custo', 3);
    const com = _viabScore(state.viab_terrenos[0]).media;
    return { sem: +sem.toFixed(2), com: +com.toFixed(2), salvo: state.viab_pesos.Custo, botoesPeso: document.querySelectorAll('#v-criterios-lista button[onclick^="setCriterioPeso"]').length };
  });
  expect(r.sem).toBe(3.75);              // pesos iguais
  expect(r.com).toBeCloseTo(3.17, 1);    // Custo (nota 2) ponderado ×3 puxa para baixo
  expect(r.salvo).toBe(3);
  expect(r.botoesPeso).toBe(12);         // 4 critérios × 3 botões (×1/×2/×3)
});

test('SWOT: desfazer remove a última feição desenhada', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-7').click();
  await page.waitForFunction(() => typeof _swotMap !== 'undefined' && _swotMap && _swotMap.isStyleLoaded && _swotMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const c = _swotMap.getCenter();
    _swotFeatures = { P: [], F: [], O: [], A: [] };
    _swotFeatures.P = [{ id: 1000, geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { cat: 'P' } }];
    _swotFeatures.O = [{ id: 3000, geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { cat: 'O' } }];
    ['P', 'F', 'O', 'A'].forEach(k => _swotMap.getSource('swot-' + k).setData(swotFC(k)));
    swotUndo(); // remove a de maior id (O=3000)
    return { O: _swotFeatures.O.length, P: _swotFeatures.P.length, botao: !!document.querySelector('button[onclick="swotUndo()"]') };
  });
  expect(r.O).toBe(0);  // última removida
  expect(r.P).toBe(1);  // a anterior permanece
  expect(r.botao).toBe(true);
});

test('Mapa Anotado: o aviso diz "categoria acima" (não "abaixo")', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(1000);
  const txt = await page.evaluate(() => { maSetMode('add'); return document.getElementById('ma-mode-info')?.textContent || ''; });
  expect(txt).toContain('acima');
  expect(txt).not.toContain('abaixo');
});

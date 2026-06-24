// tests/topografia-escalas.spec.js
// Onda F3 COMPLETO: a topografia de ENTORNO foi consolidada em 01 · Contexto Urbano (p1);
// 03 · Condicionantes (p3) ficou só com a escala do LOTE. Os campos foram MOVIDOS mantendo
// os mesmos ids (dados de projetos salvos preservados). Referência cruzada nos dois sentidos.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('F3 completo: topografia de entorno consolidada no p1, p3 só lote, ids preservados', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1100);

  const r = await page.evaluate(() => {
    const blockTitle = (panelId, titleSubstr) => {
      const blocks = [...document.querySelectorAll('#' + panelId + ' .block')];
      const b = blocks.find(bl => { const t = bl.querySelector('.block-title'); return t && t.textContent.includes(titleSubstr); });
      return b ? b.textContent : '';
    };
    return {
      // campos de entorno agora vivem no panel-1 (não no panel-3)
      deltaNoP1: !!document.querySelector('#panel-1 #a-topo-delta-ent'),
      ventoNoP1: !!document.querySelector('#panel-1 #a-topo-vento'),
      visualNoP1: !!document.querySelector('#panel-1 #r-topo-visual'),
      deltaNoP3: !!document.querySelector('#panel-3 #a-topo-delta-ent'),
      // o rating moveu e ainda é construído (tem botões)
      ratingBuilt: !!document.querySelector('#panel-1 #r-topo-visual .r-btn'),
      // p3 virou "Topografia do lote"; cota do lote continua no p3
      p3Title: blockTitle('panel-3', 'Topografia do lote'),
      cotaLoteNoP3: !!document.querySelector('#panel-3 #a-topo-cota-guia'),
      // referência cruzada nos dois sentidos
      p1Block: blockTitle('panel-1', 'Topografia — escala do entorno'),
      p3Block: blockTitle('panel-3', 'Topografia do lote'),
    };
  });
  console.log('F3 completo:', { deltaNoP1: r.deltaNoP1, deltaNoP3: r.deltaNoP3, p3Title: !!r.p3Title, ratingBuilt: r.ratingBuilt });

  // consolidação: entorno no p1, fora do p3
  expect(r.deltaNoP1).toBe(true);
  expect(r.ventoNoP1).toBe(true);
  expect(r.visualNoP1).toBe(true);
  expect(r.deltaNoP3).toBe(false);
  expect(r.ratingBuilt).toBe(true);           // rating movido continua funcional
  // p3 = lote
  expect(r.p3Title).toBeTruthy();
  expect(r.cotaLoteNoP3).toBe(true);
  // referência cruzada
  expect(r.p1Block).toMatch(/Condicionantes/);   // p1 aponta lote → p3
  expect(r.p3Block).toMatch(/Contexto Urbano/);  // p3 aponta entorno → p1

  // dados preservados: o id mantido continua coletado para o state
  const persist = await page.evaluate(() => {
    const el = document.getElementById('a-topo-delta-ent'); el.value = '37';
    if (typeof coletarDados === 'function') coletarDados();
    return state['a-topo-delta-ent'];
  });
  expect(persist).toBe('37');
});

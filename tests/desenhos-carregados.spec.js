// tests/desenhos-carregados.spec.js
// 2026-10-03 · REGRESSÃO de perda de dados (achada testando um projeto real): os desenhos salvos só
// iam para a memória quando o Mapa de Análise (aba 08) era aberto. Desenhar antes disso no mapa do
// diagnóstico (ou nos antigos mini-mapas) salvava a memória vazia por cima e APAGAVA os desenhos e
// o lote anteriores.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Desenhar no mapa do diagnóstico sem abrir a aba 08 preserva os desenhos e o lote salvos', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL); await page.waitForTimeout(1000);
  const c = [-43.85, -19.77];
  await page.evaluate(c => {
    const ring = [[c[0], c[1]], [c[0] + .001, c[1]], [c[0] + .001, c[1] + .001], [c[0], c[1]]];
    localStorage.setItem('atdau-diag-v1', JSON.stringify({
      'ml-lot': c,
      'ml-features': {
        swot: [1, 2, 3].map(i => ({ id: 's' + i, geom: { type: 'Polygon', coordinates: [ring] }, props: { swot: 'P' } })),
        notas: [{ id: 'n1', geom: { type: 'Point', coordinates: c }, props: { rotulo: 'nota antiga' } }],
      },
    }));
  }, c);
  await page.reload(); await page.waitForTimeout(1500);
  expect(await page.evaluate(() => [_mlFeatures.swot.length, _mlFeatures.notas.length, _mlLotCoord])).toEqual([3, 1, c]);

  await page.locator('#nav-1').click();
  await page.waitForFunction(() => document.getElementById('lente-wrap').dataset.ready === '1', null, { timeout: 30000 });
  await page.evaluate(() => { const cb = document.getElementById('lente-seguir'); cb.checked = false; lenteSeguir(false); });
  await page.selectOption('#lente-tema', 'notas');
  await page.waitForFunction(() => document.querySelector('#lente-wrap .bm-layer-select')?.value === 'notas', null, { timeout: 15000 });
  // o mapa abre centrado no lote salvo
  const centro = await page.evaluate(() => { const m = _blockMaps['lente-wrap'].getCenter(); return [+m.lng.toFixed(2), +m.lat.toFixed(2)]; });
  expect(centro).toEqual(c);
  await page.locator('#lente-wrap .bm-draw-btn[data-geom="point"]').click();
  const box = await page.locator('#lente-wrap .block-map canvas').first().boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  const pular = page.locator('#ml-vinculo-modal button', { hasText: 'Pular' });
  try { await pular.waitFor({ timeout: 1500 }); await pular.click(); } catch {}
  await page.waitForTimeout(1500);
  const salvo = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('atdau-diag-v1')); return { swot: s['ml-features'].swot.length, notas: s['ml-features'].notas.map(n => n.props.rotulo || 'nova'), lote: s['ml-lot'] }; });
  expect(salvo).toEqual({ swot: 3, notas: ['nota antiga', 'nova'], lote: c });
});

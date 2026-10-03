// tests/p2-blockmap-layers.spec.js
// Regressão do vazamento de camadas nos block-maps do Diagnóstico (2026-06-10):
// o mapa temático carregava feições de OUTROS temas (patrimônio, uso, viário)
// porque mlAddSourcesOnMap adia a criação das camadas e o antigo loop de "hide"
// rodava antes delas existirem. Agora: whitelist por tema (só as camadas do
// tema visíveis) aplicado via callback, + controle "▦ Camadas" para ligar outras.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirBlockMapMobil(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  // semear feições em camadas que NÃO são do tema mobil
  await page.evaluate(() => {
    const c = [-43.85, -19.77];
    const mk = () => ({ type: 'Point', coordinates: [c[0] + (Math.random() - .5) * .004, c[1] + (Math.random() - .5) * .004] });
    _mlLotCoord = c;
    _mlFeatures.patrim = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, geom: mk(), props: { origem: 'csv-tombamento', denominacao: 'B' + i, esfera: 'Estadual' } }));
    _mlFeatures.uso = [{ id: 'u1', geom: { type: 'Polygon', coordinates: [[[c[0] - .002, c[1] - .002], [c[0] + .002, c[1] - .002], [c[0] + .002, c[1] + .002], [c[0] - .002, c[1] + .002], [c[0] - .002, c[1] - .002]]] }, props: { cor: '#f0bf3a' } }];
  });
  await page.locator('#nav-1').click();
  await page.waitForTimeout(700);
  const idx = await page.evaluate(() => {
    const ts = [...document.querySelectorAll('.block-map-toggle')];
    const i = ts.findIndex(b => (b.closest('.block')?.querySelector('.block-title')?.textContent || '').includes('Mobiliário'));
    let el = ts[i];
    while (el && el !== document.body) { if (el.classList?.contains('cat-group') && !el.classList.contains('cat-open')) el.querySelector(':scope > .cat-header')?.click(); el = el.parentElement; }
    return i;
  });
  const btn = page.locator('.block-map-toggle').nth(idx);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  // 2026-10: os mini-mapas por bloco viraram lentes do mapa único (#lente-wrap)
  await page.waitForFunction(() => { const w = document.getElementById('lente-wrap'); return w && w.dataset.theme === 'mobil' && w.dataset.ready === '1' && w.querySelector('.bm-layers-ctrl'); }, null, { timeout: 25000 });
  await page.waitForTimeout(1500);
}

test.describe('P2 — block-maps do Diagnóstico não vazam outros temas', () => {

  test('Mapa de Mobiliário oculta patrimônio/uso por padrão (whitelist do tema)', async ({ page }) => {
    await abrirBlockMapMobil(page);
    const vis = await page.evaluate(() => {
      const m = Object.values(_blockMaps)[Object.values(_blockMaps).length - 1];
      const get = id => m.getLayer(id) ? (m.getLayoutProperty(id, 'visibility') || 'visible') : 'AUSENTE';
      return {
        patrim: get('circle-patrim'),
        usoFill: get('fill-uso'),
        viario: get('polyline-viario'),
        mobil: get('circle-mobil'),   // camada do tema: visível
        terreno: get('fill-terreno'), // referência do tema: visível
      };
    });
    expect(vis.patrim).toBe('none');
    expect(vis.usoFill).toBe('none');
    expect(vis.viario).toBe('none');
    expect(vis.mobil).toBe('visible');
    expect(vis.terreno).toBe('visible');
  });

  test('Controle "Camadas" liga e desliga uma camada de outro tema', async ({ page }) => {
    await abrirBlockMapMobil(page);
    const wrap = page.locator('.block-map-wrap.open');
    expect(await wrap.locator('.bm-layers-ctrl').count()).toBe(1);

    // ligar Patrimônio
    await wrap.locator('.bm-layers-panel input[data-layer="patrim"]').evaluate(cb => { cb.checked = true; cb.onchange(); });
    await page.waitForTimeout(200);
    let v = await page.evaluate(() => { const m = Object.values(_blockMaps).at(-1); return m.getLayoutProperty('circle-patrim', 'visibility'); });
    expect(v).toBe('visible');

    // desligar de novo
    await wrap.locator('.bm-layers-panel input[data-layer="patrim"]').evaluate(cb => { cb.checked = false; cb.onchange(); });
    await page.waitForTimeout(200);
    v = await page.evaluate(() => { const m = Object.values(_blockMaps).at(-1); return m.getLayoutProperty('circle-patrim', 'visibility'); });
    expect(v).toBe('none');
  });
});

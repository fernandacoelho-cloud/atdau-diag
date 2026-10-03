// tests/blockmap-barra-estilo.spec.js
// 2026-10-03: (1) a barra de desenho do block-map fica ACIMA do mapa (antes flutuava por
// cima e cobria ~1/3 dos 240px, engolindo os cliques do desenho — quebrava o sweep);
// (2) tracejado por feição funciona (MapLibre 4.x rejeitava line-dasharray por expressão);
// (3) o painel "Estilo do próximo desenho" grava nas chaves que os layers leem.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Block-map: barra fora do mapa, estilo tracejado/espessura aplicado ao polígono', async ({ page }) => {
  const erros = [];
  page.on('console', m => { if (m.type() === 'error' && /dasharray/.test(m.text())) erros.push(m.text().slice(0, 120)); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelector('#nav-1').click());
  await page.waitForTimeout(700);
  const btn = page.locator('#panel-1 .block-map-toggle').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  const wrap = page.locator('#lente-wrap');   // 2026-10: os mini-mapas por bloco viraram lentes do mapa único (#lente-wrap)
  await wrap.locator('.bm-draw-btn[data-geom="polygon"]').waitFor({ timeout: 25000 });
  await page.waitForTimeout(1000);

  // (1) barra acima do mapa, sem sobreposição
  const geo = await wrap.evaluate(w => {
    const c = w.querySelector('.block-map-draw-ctrl').getBoundingClientRect();
    const m = w.querySelector('.block-map').getBoundingClientRect();
    return { barBottom: c.bottom, mapTop: m.top, dentro: !!w.querySelector('.block-map .block-map-draw-ctrl') };
  });
  expect(geo.dentro).toBe(false);
  expect(geo.barBottom).toBeLessThanOrEqual(geo.mapTop);

  // (3) estilo: tracejada + espessura 5
  await wrap.locator('.bm-style-btn').click();
  const panelTop = await wrap.evaluate(w => {
    const p = w.querySelector('.block-map-style-panel').getBoundingClientRect();
    return p.top - w.querySelector('.block-map-draw-ctrl').getBoundingClientRect().bottom;
  });
  expect(panelTop).toBeGreaterThanOrEqual(0); // painel abre abaixo da barra, não por cima
  await wrap.locator('.bm-st-tipo[data-tipo="tracejado"]').click();
  await wrap.locator('.bm-st-largura').evaluate(el => { el.value = '5'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await wrap.locator('.bm-style-btn').click();

  const lid = await wrap.evaluate(w => w.querySelector('.bm-layer-select').value);
  const antes = await page.evaluate(l => (_mlFeatures[l] || []).length, lid);
  await wrap.locator('.bm-draw-btn[data-geom="polygon"]').click();
  const canvas = wrap.locator('.block-map canvas').first();
  await canvas.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // inclui um vértice no terço superior do mapa (a faixa que a barra antiga cobria), abaixo dos controles
  const yTopo = box.y + box.height * 0.3;
  await page.mouse.click(cx - 60, cy + 40);
  await page.mouse.click(cx + 60, cy + 40);
  await page.mouse.click(cx, yTopo);
  await page.mouse.dblclick(cx, yTopo);
  await page.waitForFunction(({ l, a }) => (_mlFeatures[l] || []).length > a, { l: lid, a: antes }, { timeout: 8000 });

  const r = await page.evaluate(l => {
    const f = _mlFeatures[l][_mlFeatures[l].length - 1];
    const m = Object.values(_blockMaps).find(m => m.getContainer().offsetWidth > 0);
    const dashId = _mlDashLayerId(l, 'dashed');
    return { tipo: f.geom.type, props: f.props, temDash: !!m.getLayer(dashId),
             dashArr: m.getLayer(dashId) && m.getPaintProperty(dashId, 'line-dasharray') };
  }, lid);
  expect(r.tipo).toBe('Polygon');
  expect(r.props.lineDash).toBe('dashed');
  expect(Number(r.props.lineWidth)).toBe(5);
  expect(r.temDash).toBe(true);
  expect(r.dashArr).toEqual([4, 2]);
  expect(erros).toEqual([]);
});

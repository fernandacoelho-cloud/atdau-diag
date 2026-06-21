// tests/simbologia-onda-e.spec.js
// Onda E — simbologia cartográfica de Bertin: hachura/padrão de área (grayscale-safe).
//   E1 — modelo de hachuras + swatch da legenda (SVG) + tile de canvas (relatório) + seletor no editor de estilo.
//   E2 — fill-pattern ao vivo no MapLibre (Mapa de Análise), só p/ camadas de cor única; limpa ao voltar p/ sólido.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('E1: hachura no swatch da legenda (SVG), tile de canvas e seletor no editor de estilo', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const svgDiag = MapLegend.swatchSVG('polygon', { fillColor: '#3366cc', lineColor: '#113366', fillPattern: 'diag' });
    const svgSolid = MapLegend.swatchSVG('polygon', { fillColor: '#3366cc', lineColor: '#113366', fillPattern: 'none' });
    const tile = _hachuraCanvasTile('cross', '#000');
    // seletor de hachura no editor de estilo (offline, inst mínima)
    document.querySelectorAll('.ml-style-pop').forEach(p => p.remove());
    const inst = { cfg: { mapKey: 't', getItems: () => [{ id: 'x', label: 'X', geom: 'polygon', style: {} }], onStyleChange: () => {} } };
    MapLegend._openStyleEditor(inst, 'x', { clientX: 10, clientY: 10 });
    const pop = document.querySelector('.ml-style-pop');
    const hasHachura = !!(pop && pop.querySelector('select[data-k="fillPattern"]'));
    const opcoes = pop ? [...pop.querySelectorAll('select[data-k="fillPattern"] option')].map(o => o.value) : [];
    if (pop) pop.remove();
    return {
      diagHasPattern: /<pattern /.test(svgDiag) && /url\(#swhach\d+\)/.test(svgDiag),
      solidNoPattern: !/<pattern /.test(svgSolid),
      tileOk: !!(tile && tile.width === 6 && typeof tile.getContext === 'function'),
      pats: Object.keys(MAP_FILL_PATTERNS),
      hasHachura, opcoes,
    };
  });
  console.log('E1:', { diag: r.diagHasPattern, solid: r.solidNoPattern, tile: r.tileOk, hachura: r.hasHachura });

  expect(r.diagHasPattern).toBe(true);          // swatch com hachura → <pattern> + url(#…)
  expect(r.solidNoPattern).toBe(true);          // sólido → sem <pattern>
  expect(r.tileOk).toBe(true);                  // tile 6×6 p/ ctx.createPattern (relatório)
  expect(r.pats).toEqual(expect.arrayContaining(['none', 'diag', 'diagrev', 'cross', 'horiz', 'vert', 'dots']));
  expect(r.hasHachura).toBe(true);              // seletor de hachura no editor de polígono
  expect(r.opcoes).toEqual(expect.arrayContaining(['none', 'diag', 'dots']));
});

test('E2: hachura aplica fill-pattern no Mapa de Análise e limpa ao voltar p/ sólido', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const corPorFeicao = ['uso', 'equip', 'swot', 'cobertura', 'uc'];
    const lid = ML_LAYERS.map(l => l.id).find(id => _mlMap.getLayer('fill-' + id) && !corPorFeicao.includes(id));
    if (!lid) return { lid: null };
    mlAplicarEstilo(lid, Object.assign(mlGetEstilo(lid), { fillPattern: 'diag' }));
    const aplicado = _mlMap.getPaintProperty('fill-' + lid, 'fill-pattern');
    const temImg = _mlMap.hasImage('hachpat-' + lid);
    mlAplicarEstilo(lid, Object.assign(mlGetEstilo(lid), { fillPattern: 'none' }));
    const limpo = _mlMap.getPaintProperty('fill-' + lid, 'fill-pattern');
    return { lid, aplicado, temImg, limpo };
  });
  console.log('E2:', r);

  expect(r.lid).toBeTruthy();                       // achou uma camada de polígono de cor única
  expect(r.aplicado).toBe('hachpat-' + r.lid);      // fill-pattern setado
  expect(r.temImg).toBe(true);                      // imagem do padrão registrada no mapa
  expect(r.limpo == null).toBe(true);               // 'none' limpa o fill-pattern (volta ao sólido)
});

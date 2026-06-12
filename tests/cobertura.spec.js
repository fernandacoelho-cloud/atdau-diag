// tests/cobertura.spec.js
// 2026-06-12: nova camada "Cobertura do Solo" (padrão MapBiomas) no Mapa de
// Análise — distinta de USO (função). Desenha classificando a cobertura física;
// cor por classe; legenda própria; não abre modal de vínculo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Cobertura do Solo: camada, seletor de classe, cor por classe e legenda', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(700);

  const inLayers = await page.evaluate(() => ML_LAYERS.some(l => l.id === 'cobertura') && ML_COBERTURA_CATS.length >= 8);
  expect(inLayers).toBe(true);

  await page.evaluate(() => mlSetActiveLayer('cobertura'));
  await page.waitForTimeout(200);
  const bar = await page.evaluate(() => {
    const sel = document.getElementById('cob-cat-sel');
    return { temSelect: !!sel, n: sel ? sel.options.length : 0, head: document.querySelector('.ml-drawbar-head')?.textContent || '' };
  });
  expect(bar.temSelect).toBe(true);
  expect(bar.n).toBe(10);
  expect(bar.head).toContain('Cobertura do Solo');

  const draw = await page.evaluate(() => {
    _mlSelCob = 'agricultura';
    mlSelectDraw('cobertura', 'polygon');
    const c = _mlMap.getCenter(); const d = 0.002;
    const pts = [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d]];
    pts.forEach(p => _mlMap.fire('click', { lngLat: { lng: p[0], lat: p[1] }, point: _mlMap.project(p) }));
    _mlMap.fire('dblclick', { lngLat: { lng: pts[2][0], lat: pts[2][1] }, point: _mlMap.project(pts[2]), preventDefault: () => {} });
    const f = (_mlFeatures.cobertura || [])[_mlFeatures.cobertura.length - 1];
    return { n: (_mlFeatures.cobertura || []).length, props: f ? f.props : null, semVinculo: !document.getElementById('ml-vinculo-modal') };
  });
  expect(draw.n).toBe(1);
  expect(draw.props).toMatchObject({ layer: 'cobertura', subcategoria: 'agricultura', cor: '#C27BA0' });
  expect(draw.semVinculo).toBe(true); // pintura temática não abre modal de vínculo

  const leg = await page.evaluate(() => mlLegendItems().filter(i => String(i.id).startsWith('cob-')).map(i => i.id));
  expect(leg).toContain('cob-agricultura');
});

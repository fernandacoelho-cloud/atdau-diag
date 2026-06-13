// tests/uc.spec.js
// 2026-06-12: nova camada "Unidades de Conservação" (SNUC) no Mapa de Análise —
// restrição legal-ambiental. Desenha/importa e classifica pelo REGIME de proteção
// (Proteção Integral, Uso Sustentável, RPPN, zona de amortecimento, outra).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Unidades de Conservação: camada, seletor de regime, cor por regime e legenda', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(700);

  const inLayers = await page.evaluate(() => ML_LAYERS.some(l => l.id === 'uc') && ML_UC_CATS.length === 5);
  expect(inLayers).toBe(true);

  await page.evaluate(() => mlSetActiveLayer('uc'));
  await page.waitForTimeout(200);
  const bar = await page.evaluate(() => {
    const sel = document.getElementById('uc-cat-sel');
    return { temSelect: !!sel, n: sel ? sel.options.length : 0, head: document.querySelector('.ml-drawbar-head')?.textContent || '' };
  });
  expect(bar.temSelect).toBe(true);
  expect(bar.n).toBe(5);
  expect(bar.head).toContain('Unidades de Conservação');

  const draw = await page.evaluate(() => {
    _mlSelUc = 'pi'; // Proteção Integral
    mlSelectDraw('uc', 'polygon');
    const c = _mlMap.getCenter(); const d = 0.002;
    const pts = [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d]];
    pts.forEach(p => _mlMap.fire('click', { lngLat: { lng: p[0], lat: p[1] }, point: _mlMap.project(p) }));
    _mlMap.fire('dblclick', { lngLat: { lng: pts[2][0], lat: pts[2][1] }, point: _mlMap.project(pts[2]), preventDefault: () => {} });
    const f = (_mlFeatures.uc || [])[_mlFeatures.uc.length - 1];
    return { n: (_mlFeatures.uc || []).length, props: f ? f.props : null, semVinculo: !document.getElementById('ml-vinculo-modal') };
  });
  expect(draw.n).toBe(1);
  expect(draw.props).toMatchObject({ layer: 'uc', subcategoria: 'pi', cor: '#1f8d49' });
  expect(draw.semVinculo).toBe(true); // restrição/referência não abre modal de vínculo

  const leg = await page.evaluate(() => mlLegendItems().filter(i => String(i.id).startsWith('uc-')).map(i => i.id));
  expect(leg).toContain('uc-pi');
});

// tests/p2-categoriza.spec.js
// Regressão do estilo por atributo (Categorizado, P2 item 3 — 2026-06-10):
// uma camada importada pode ser colorida por uma coluna do shape (como o
// Categorizado do QGIS), gerando cores por valor + legenda, e isso persiste.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirComCamada(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const c = _mlMap.getCenter();
    const zonas = ['ZR1', 'ZC', 'ZM'];
    const feats = [];
    for (let i = 0; i < 30; i++) {
      const dx = ((i % 6) - 3) * 0.001, dy = (Math.floor(i / 6) - 2) * 0.001;
      feats.push({ type: 'Feature', properties: { zona: zonas[i % 3], nome: 'L' + i }, geometry: { type: 'Polygon', coordinates: [[[c.lng + dx, c.lat + dy], [c.lng + dx + .0008, c.lat + dy], [c.lng + dx + .0008, c.lat + dy + .0008], [c.lng + dx, c.lat + dy + .0008], [c.lng + dx, c.lat + dy]]] } });
    }
    return mlAddImportedLayer({ type: 'FeatureCollection', features: feats }, 'Zoneamento').id;
  });
}

test.describe('P2 — estilo por atributo (Categorizado)', () => {

  test('Categorizar por coluna gera cores por valor + legenda', async ({ page }) => {
    const lid = await abrirComCamada(page);
    // atributos detectados
    const attrs = await page.evaluate((id) => _mlImportAttrs(_mlImportedLayers.find(l => l.id === id)), lid);
    expect(attrs).toContain('zona');

    await page.evaluate((id) => mlCategorizeImported(id, 'zona'), lid);
    await page.waitForTimeout(300);
    const r = await page.evaluate((id) => {
      const e = _mlImportedLayers.find(l => l.id === id);
      const expr = _mlMap.getPaintProperty('fill-imp-' + id, 'fill-color');
      const cores = e.categoria.valores.map(v => v.cor);
      return {
        nValores: e.categoria.valores.length,
        coresDistintas: new Set(cores).size,
        contagens: e.categoria.valores.map(v => v.n),
        ehMatch: Array.isArray(expr) && expr[0] === 'match',
        legenda: mlLegendItems().filter(i => String(i.id).startsWith('imp-')).map(i => i.label.trim()),
      };
    }, lid);
    expect(r.nValores).toBe(3);
    expect(r.coresDistintas).toBe(3);          // cor distinta por valor
    expect(r.contagens).toEqual([10, 10, 10]); // 30 feições / 3 zonas
    expect(r.ehMatch).toBe(true);              // expressão match no paint
    expect(r.legenda).toEqual(expect.arrayContaining(['ZR1', 'ZC', 'ZM']));
  });

  test('Categorização persiste no reload; "Cor única" reverte', async ({ page }) => {
    const lid = await abrirComCamada(page);
    await page.evaluate((id) => mlCategorizeImported(id, 'zona'), lid);
    await page.waitForTimeout(1500); // autosave
    await page.reload();
    await page.waitForTimeout(1500);
    await page.locator('#nav-6').click();
    await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
    await page.waitForTimeout(1000);

    const apos = await page.evaluate(() => {
      const e = _mlImportedLayers.find(l => l.categoria);
      if (!e) return { ok: false };
      const expr = _mlMap.getPaintProperty('fill-imp-' + e.id, 'fill-color');
      return { ok: true, campo: e.categoria.campo, ehMatch: Array.isArray(expr) && expr[0] === 'match' };
    });
    expect(apos.ok).toBe(true);
    expect(apos.campo).toBe('zona');
    expect(apos.ehMatch).toBe(true);

    // reverter para cor única
    await page.evaluate(() => mlClearCategoria(_mlImportedLayers.find(l => l.categoria).id));
    await page.waitForTimeout(300);
    const limpo = await page.evaluate(() => {
      const e = _mlImportedLayers[0];
      return { temCat: !!e.categoria, corUnica: typeof _mlMap.getPaintProperty('fill-imp-' + e.id, 'fill-color') === 'string' };
    });
    expect(limpo.temCat).toBe(false);
    expect(limpo.corUnica).toBe(true);
  });
});

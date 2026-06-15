// tests/map-algebra.spec.js
// L4 — resiliencia / SbN: algebra de mapas no Mapa de Analise. Camadas novas
// (Vulnerabilidade climatica, Oportunidades SbN) + cruzamento de duas camadas de
// poligonos via turf.js (intersect/union/difference). Ex.: livres ∩ agua -> SbN.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Algebra de mapas: intersecao de dois poligonos gera feicao na camada SbN', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  expect(await page.evaluate(() => ML_LAYERS.some(l => l.id === 'sbn'))).toBe(true);
  expect(await page.evaluate(() => ML_LAYERS.some(l => l.id === 'vulner'))).toBe(true);

  await page.evaluate(() => {
    _mlFeatures.livres = [{ id: 'L1', geom: { type: 'Polygon', coordinates: [[[-43.81, -19.71], [-43.79, -19.71], [-43.79, -19.69], [-43.81, -19.69], [-43.81, -19.71]]] }, props: {} }];
    _mlFeatures.agua = [{ id: 'A1', geom: { type: 'Polygon', coordinates: [[[-43.80, -19.70], [-43.78, -19.70], [-43.78, -19.68], [-43.80, -19.68], [-43.80, -19.70]]] }, props: {} }];
    mlAlgebraPopulate();
    document.getElementById('mlalg-a').value = 'livres';
    document.getElementById('mlalg-op').value = 'intersect';
    document.getElementById('mlalg-b').value = 'agua';
    document.getElementById('mlalg-target').value = 'sbn';
    mlAlgebra();
  });

  await page.waitForFunction(() => (_mlFeatures.sbn || []).some(f => f.props && f.props.origem === 'algebra'), null, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const f = (_mlFeatures.sbn || []).find(x => x.props && x.props.origem === 'algebra');
    return { geom: f && f.geom && f.geom.type, n: (_mlFeatures.sbn || []).length };
  });
  expect(r.geom).toBe('Polygon');
  expect(r.n).toBe(1);
});

// tests/import-idb.spec.js
// Camadas importadas grandes (2026-06-11): a geometria passou para o IndexedDB
// (cota grande) — antes shapes >~3MB sumiam no reload (cap do localStorage).
// O state guarda só metadados; "Salvar projeto" coleta a geometria em memória
// (arquivo continua portável).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirMapa(page) {
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
}

test('Geometria importada no IndexedDB sobrevive ao reload; state fica leve', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await abrirMapa(page);

  const id = await page.evaluate(() => {
    const c = _mlMap.getCenter();
    const feats = [];
    for (let i = 0; i < 40; i++) { const d = 0.0006, dx = ((i % 8) - 4) * 0.0012, dy = (Math.floor(i / 8) - 2) * 0.0012;
      feats.push({ type: 'Feature', properties: { zona: 'Z' + (i % 3) }, geometry: { type: 'Polygon', coordinates: [[[c.lng + dx, c.lat + dy], [c.lng + dx + d, c.lat + dy], [c.lng + dx + d, c.lat + dy + d], [c.lng + dx, c.lat + dy + d], [c.lng + dx, c.lat + dy]]] } }); }
    return mlAddImportedLayer({ type: 'FeatureCollection', features: feats }, 'Zoneamento').id;
  });
  await page.waitForTimeout(2200); // autoSave (1200ms) + IDB.set

  // state metadata-only; IndexedDB com a geometria
  const a = await page.evaluate(async (id) => ({
    metaSemFc: !state['ml-imports'][0].fc,
    idbFeatures: ((await IDB.get('imp-fc-' + id))?.features || []).length,
  }), id);
  expect(a.metaSemFc).toBe(true);
  expect(a.idbFeatures).toBe(40);

  // sobrevive ao reload (restaura do IndexedDB)
  await page.reload();
  await page.waitForTimeout(1500);
  await abrirMapa(page);
  await page.waitForTimeout(800);
  const b = await page.evaluate((id) => ({
    n: _mlImportedLayers.length, nome: _mlImportedLayers[0]?.name, noMapa: !!_mlMap.getLayer('fill-imp-' + id),
  }), id);
  expect(b.n).toBe(1);
  expect(b.nome).toBe('Zoneamento');
  expect(b.noMapa).toBe(true);

  // "Salvar projeto" coleta a geometria (arquivo self-contained)
  const c = await page.evaluate(() => {
    const fc = {}; _mlImportedLayers.forEach(l => { if (l.fc) fc[l.id] = l.fc; });
    return Object.values(fc).reduce((s, f) => s + (f.features || []).length, 0);
  });
  expect(c).toBe(40);

  // remover limpa o IndexedDB
  await page.evaluate((id) => mlRemoveImported(id), id);
  await page.waitForTimeout(400);
  const d = await page.evaluate(async (id) => ({ n: _mlImportedLayers.length, idb: !!(await IDB.get('imp-fc-' + id)) }), id);
  expect(d.n).toBe(0);
  expect(d.idb).toBe(false);
});

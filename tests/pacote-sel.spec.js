// tests/pacote-sel.spec.js
// Pacote SEL (item 5): exporta as camadas do Mapa de Analise organizadas pela
// metodologia de sistema de espacos livres (Tardim) — grupo viaja como atributo
// sel_grupo — + as anotacoes do Mapa Anotado, num GeoJSON unico p/ QGIS/ATDAU_PAIS.
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Pacote SEL: agrupa camadas por Tardim + inclui anotacoes; GeoJSON valido', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  await page.evaluate(() => {
    _mlFeatures.agua = [{ id: 'a1', geom: { type: 'LineString', coordinates: [[-43.8, -19.7], [-43.81, -19.71]] }, props: { nome: 'Corrego' } }];
    _mlFeatures.livres = [{ id: 'l1', geom: { type: 'Polygon', coordinates: [[[-43.8, -19.7], [-43.8, -19.69], [-43.79, -19.69], [-43.8, -19.7]]] }, props: { nome: 'Praca' } }];
    MapaAnotadoStore.add({ category: 'patrimonio-imaterial', title: 'Festa', coords: [-43.805, -19.705], fotos: ['x'] });
  });

  const dlPromise = page.waitForEvent('download', { timeout: 8000 });
  await page.evaluate(() => exportarPacoteSEL());
  const dl = await dlPromise;
  expect(dl.suggestedFilename()).toMatch(/pacote-sel/);
  const fc = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));

  expect(fc.metadata.schema).toBe('atdau-sel-v1');
  expect(fc.metadata.metodologia).toMatch(/Tardim/);
  const grupos = [...new Set(fc.features.map(f => f.properties.sel_grupo))];
  expect(grupos).toContain('biofisico');        // agua
  expect(grupos).toContain('espacos_livres');   // livres
  expect(grupos).toContain('registro_campo');   // anotacao
  const anot = fc.features.find(f => f.properties.sel_grupo === 'registro_campo');
  expect(anot.properties.n_fotos).toBe(1);
  expect(anot.geometry.type).toBe('Point');
});

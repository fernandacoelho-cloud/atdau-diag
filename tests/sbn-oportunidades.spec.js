// tests/sbn-oportunidades.spec.js
// Onda Partido — Etapa 2: "Encontrar oportunidades" (álgebra de mapas / SbN). Cruzamentos
// PRONTOS (presets) pré-preenchem A/op/B/destino + explicam em linguagem simples e rodam a
// álgebra. Ex.: livres ∩ APP = parque alagável (oportunidade SbN) → camada 'sbn'.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Etapa2: preset "Parque alagável" cruza livres ∩ APP e gera oportunidades em sbn', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(600);

  // os cruzamentos prontos aparecem
  const presets = await page.evaluate(() => { mlAlgebraPopulate(); return [...document.querySelectorAll('#mlalg-presets .mlalg-preset-btn')].map(b => b.dataset.preset); });
  expect(presets).toEqual(['alagavel', 'risco', 'seguro', 'verdeazul']);

  // injeta polígonos sobrepostos em livres e app, dispara o preset
  await page.evaluate(() => {
    const c = _mlMap.getCenter(); const s = 0.002;
    const sq = () => ({ type: 'Polygon', coordinates: [[[c.lng - s, c.lat - s], [c.lng + s, c.lat - s], [c.lng + s, c.lat + s], [c.lng - s, c.lat + s], [c.lng - s, c.lat - s]]] });
    _mlFeatures['livres'] = [{ id: 'L1', geom: sq(), props: {} }];
    _mlFeatures['app'] = [{ id: 'A1', geom: sq(), props: {} }];   // sobrepõe L1
    mlRefreshSource('livres'); mlRefreshSource('app');
    _mlFeatures['sbn'] = [];
    mlAlgebraPreset('alagavel');   // seta os selects + explica + roda (async via turf)
  });
  // a álgebra é async (carrega turf) → espera o resultado em sbn
  await page.waitForFunction(() => (_mlFeatures['sbn'] || []).length > 0, null, { timeout: 15000 });

  const r = await page.evaluate(() => ({
    a: document.getElementById('mlalg-a').value, op: document.getElementById('mlalg-op').value,
    b: document.getElementById('mlalg-b').value, target: document.getElementById('mlalg-target').value,
    explVisible: document.getElementById('mlalg-expl').style.display !== 'none',
    explText: document.getElementById('mlalg-expl').textContent,
    sbnCount: (_mlFeatures['sbn'] || []).length,
  }));
  console.log('Etapa2:', r);

  expect(r.a).toBe('livres');
  expect(r.op).toBe('intersect');
  expect(r.b).toBe('app');
  expect(r.target).toBe('sbn');
  expect(r.explVisible).toBe(true);
  expect(r.explText).toMatch(/alag/i);       // explicação em linguagem simples
  expect(r.sbnCount).toBeGreaterThan(0);     // interseção gerou oportunidade SbN
});

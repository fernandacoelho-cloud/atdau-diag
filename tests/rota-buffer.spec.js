// tests/rota-buffer.spec.js
// L2 — itinerario cultural geo: camada "Rota cultural + buffer" no Mapa de Analise.
// Desenha-se o percurso (linha) e gera-se o buffer (area de estudo do percurso) com
// turf.js (carregado sob demanda do CDN — online). O buffer entra em _mlFeatures.rota
// como poligono (props.tipo==='buffer').
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Rota + buffer: turf gera o poligono de area de estudo a partir do percurso', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);

  expect(await page.evaluate(() => ML_LAYERS.some(l => l.id === 'rota'))).toBe(true);

  await page.evaluate(() => {
    _mlFeatures.rota = [{ id: 'r1', geom: { type: 'LineString', coordinates: [[-43.80, -19.70], [-43.78, -19.69], [-43.76, -19.71]] }, props: { layer: 'rota' } }];
    rotaGerarBuffer();
  });

  // turf carrega do CDN; espera o buffer aparecer
  await page.waitForFunction(() => (_mlFeatures.rota || []).some(f => f.props && f.props.tipo === 'buffer'), null, { timeout: 20000 });

  const r = await page.evaluate(() => {
    const buf = (_mlFeatures.rota || []).find(f => f.props && f.props.tipo === 'buffer');
    return { geomType: buf && buf.geom && buf.geom.type, km: state.rota_buffer_km };
  });
  expect(r.geomType).toBe('Polygon');
  expect(r.km).toBe(1);
});

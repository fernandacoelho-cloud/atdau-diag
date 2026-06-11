// tests/p1-cluster.spec.js
// Regressão do clustering de patrimônio (P1, 2026-06-10): os bens tombados
// (CSV) viram clusters em vez de "chuva de confete"; pontos individuais
// coloridos por esfera; clique no cluster aproxima; clique no ponto abre o
// popup de bem tombado com os atalhos de pesquisa. Polígonos de patrimônio
// desenhados à mão NÃO entram no cluster (continuam visíveis).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirMapa(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
}

// injeta N bens tombados (esferas mistas) + 1 polígono de patrim desenhado
async function injetarTombamentos(page, n = 60) {
  await page.evaluate((n) => {
    const c = _mlMap.getCenter();
    const esferas = ['Federal (IPHAN)', 'Estadual (IEPHA-MG)', 'Municipal'];
    _mlFeatures.patrim = [];
    for (let i = 0; i < n; i++) {
      const dx = ((i % 10) - 5) * 0.0008, dy = (Math.floor(i / 10) - 3) * 0.0008;
      _mlFeatures.patrim.push({ id: 'tomb-' + i, geom: { type: 'Point', coordinates: [c.lng + dx, c.lat + dy] },
        props: { origem: 'csv-tombamento', denominacao: 'Bem ' + i, municipio: 'Santa Luzia', esfera: esferas[i % 3] } });
    }
    const d = 0.0015;
    _mlFeatures.patrim.push({ id: 'patrim-poly-1', geom: { type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]] }, props: { rotulo: 'Conjunto' } });
    mlRefreshSource('patrim');
  }, n);
}

async function jumpEIdle(page, zoom) {
  await page.evaluate((z) => new Promise(res => {
    _mlMap.jumpTo({ center: _mlMap.getCenter(), zoom: z });
    const t = setTimeout(res, 8000);
    _mlMap.once('idle', () => { clearTimeout(t); res(); });
  }), zoom);
  await page.waitForTimeout(300);
}

test.describe('P1 — clustering de patrimônio', () => {

  test('Bens tombados clusterizam (sem confete) e polígono desenhado sobrevive', async ({ page }) => {
    await abrirMapa(page);
    await injetarTombamentos(page, 60);
    await jumpEIdle(page, 12);

    const r = await page.evaluate(() => ({
      clusters: _mlMap.queryRenderedFeatures({ layers: ['patrim-clusters'] }).length,
      soma: _mlMap.queryRenderedFeatures({ layers: ['patrim-clusters'] }).reduce((s, f) => s + f.properties.point_count, 0),
      tombamentoNoCircleGenerico: _mlMap.queryRenderedFeatures({ layers: ['circle-patrim'] }).filter(f => f.properties.origem === 'csv-tombamento').length,
      poligonoVisivel: _mlMap.queryRenderedFeatures({ layers: ['fill-patrim'] }).length,
      camadas: ['patrim-clusters', 'patrim-cluster-count', 'patrim-points'].filter(id => !!_mlMap.getLayer(id)).length,
    }));
    expect(r.camadas).toBe(3);
    expect(r.clusters).toBeGreaterThanOrEqual(1);
    expect(r.soma).toBe(60);                 // todos os 60 agregados
    expect(r.tombamentoNoCircleGenerico).toBe(0); // não há confete na camada genérica
    expect(r.poligonoVisivel).toBeGreaterThanOrEqual(1); // polígono desenhado preservado
  });

  test('Pontos individuais coloridos por esfera; legenda lista as esferas', async ({ page }) => {
    await abrirMapa(page);
    await injetarTombamentos(page, 60);
    await jumpEIdle(page, 17);

    const r = await page.evaluate(() => ({
      esferas: [...new Set(_mlMap.queryRenderedFeatures({ layers: ['patrim-points'] }).map(f => f.properties._esf))].sort(),
      expr: JSON.stringify(_mlMap.getPaintProperty('patrim-points', 'circle-color')),
      legenda: mlLegendItems().filter(i => String(i.id).startsWith('esf-')).map(i => i.id),
    }));
    expect(r.esferas).toEqual(['estadual', 'federal', 'municipal']);
    expect(r.expr).toContain('match');
    expect(r.expr).toContain('_esf');
    expect(r.legenda.sort()).toEqual(['esf-estadual', 'esf-federal', 'esf-municipal']);
  });

  test('Clique no cluster aproxima; clique no ponto abre popup de bem tombado', async ({ page }) => {
    page.on('dialog', d => d.dismiss());
    await abrirMapa(page);
    await injetarTombamentos(page, 60);

    // cluster → zoom sobe (a partir de zoom baixo, delta de expansão é claro)
    await jumpEIdle(page, 10);
    const box = await page.locator('#ml-map').boundingBox();
    const cl = await page.evaluate(() => {
      // mirar o cluster de maior contagem (mais denso = expande bem acima de 10)
      const fs = _mlMap.queryRenderedFeatures({ layers: ['patrim-clusters'] });
      fs.sort((a, b) => b.properties.point_count - a.properties.point_count);
      const p = _mlMap.project(fs[0].geometry.coordinates); return { x: p.x, y: p.y };
    });
    const zAntes = await page.evaluate(() => _mlMap.getZoom());
    await page.mouse.click(box.x + cl.x, box.y + cl.y);
    // getClusterExpansionZoom é Promise: o easeTo começa de forma assíncrona,
    // então fazemos poll do zoom subir (esperar 'idle' corre antes do easeTo iniciar)
    await page.waitForFunction((z0) => _mlMap.getZoom() > z0 + 0.3, zAntes, { timeout: 6000 });
    const zDepois = await page.evaluate(() => _mlMap.getZoom());
    expect(zDepois).toBeGreaterThan(zAntes + 0.3);

    // ponto individual → popup de bem tombado com atalhos
    await page.evaluate(() => document.querySelectorAll('.maplibregl-popup').forEach(p => p.remove()));
    await jumpEIdle(page, 18);
    const pt = await page.evaluate(() => {
      const f = _mlMap.queryRenderedFeatures({ layers: ['patrim-points'] })[0];
      const p = _mlMap.project(f.geometry.coordinates); return { x: p.x, y: p.y };
    });
    await page.mouse.click(box.x + pt.x, box.y + pt.y);
    await page.waitForSelector('.maplibregl-popup', { timeout: 6000 });
    const popup = await page.evaluate(() => {
      const p = document.querySelector('.maplibregl-popup');
      return { temFontes: p.textContent.includes('PESQUISAR FONTES'), atalhos: p.querySelectorAll('a[target="_blank"]').length };
    });
    expect(popup.temFontes).toBe(true);
    expect(popup.atalhos).toBeGreaterThanOrEqual(8);
  });
});

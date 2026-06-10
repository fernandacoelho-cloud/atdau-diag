// tests/p0.spec.js
// Regressão do pacote P0 (2026-06-10):
//   1. Legenda fixa de usos do solo só aparece quando há manchas de uso
//   2. Importação (block-map e Mapa de Análise) cria camadas NOMEADAS com cor
//      própria, renomeáveis, clicáveis, na legenda e persistidas no projeto
//   3. Piso tipográfico: texto de leitura/interação ≥ 12px
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

// GeoJSON de teste: polígono quadrado em volta de [lng,lat]
function fcQuadrado(lng, lat, d = 0.002) {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { fonte: 'teste', esfera: 'estadual' },
      geometry: { type: 'Polygon', coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] },
    }],
  };
}

async function abrirMapaAnalise(page) {
  await page.locator('#nav-6').click();
  await page.waitForFunction(
    () => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(),
    null, { timeout: 20000 }
  );
  await page.waitForTimeout(800);
}

test.describe('P0 — legibilidade, legenda de usos e camadas importadas', () => {

  test('Piso tipográfico: elementos de leitura ≥ 12px', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForTimeout(1500);
    const medidas = await page.evaluate(() => {
      const probe = sel => {
        const el = document.querySelector(sel);
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      };
      return {
        raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
        tituloBloco: probe('.block-title'),
        labelCampo: probe('.form-field label'),
        navLateral: probe('.sec-nav-item'),
        botaoMapa: probe('.block-map-toggle'),
        textarea: probe('textarea'),
        tituloCategoria: probe('.cat-title'),
      };
    });
    console.log('fontes:', medidas);
    expect(medidas.raiz).toBe(16);
    for (const [nome, px] of Object.entries(medidas)) {
      if (nome === 'raiz' || px === null) continue;
      expect(px, `${nome} deveria ter ≥12px, tem ${px}px`).toBeGreaterThanOrEqual(11.9);
    }
  });

  test('Legenda fixa de usos só aparece com manchas de uso desenhadas', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForTimeout(1500);
    await abrirMapaAnalise(page);

    const inicial = await page.evaluate(() => getComputedStyle(document.getElementById('ml-uso-legend')).display);
    expect(inicial).toBe('none');

    // desenhar (injetar) uma mancha de uso → legenda aparece
    await page.evaluate(() => {
      const c = _mlMap.getCenter(); const d = 0.001;
      _mlFeatures['uso'] = [{ id: Date.now(), geom: { type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]] }, props: { cor: '#f0bf3a' } }];
      mlRefreshSource('uso');
      mlRefreshLegenda();
    });
    const comUso = await page.evaluate(() => getComputedStyle(document.getElementById('ml-uso-legend')).display);
    expect(comUso).toBe('block');

    // limpar → some de novo
    await page.evaluate(() => { _mlFeatures['uso'] = []; mlRefreshSource('uso'); mlRefreshLegenda(); });
    const semUso = await page.evaluate(() => getComputedStyle(document.getElementById('ml-uso-legend')).display);
    expect(semUso).toBe('none');
  });

  test('Importação: camadas nomeadas, cores distintas, popup, renomear e persistir', async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.goto(DIAG_URL);
    await page.waitForTimeout(1500);

    // 1) importar pelo BLOCK-MAP (caminho real do usuário: input de arquivo)
    await page.locator('#nav-1').click();
    await page.waitForTimeout(700);
    const btn = page.locator('.block-map-toggle').nth(0);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForFunction(() => document.querySelectorAll('.block-map-wrap')[0].querySelector('.block-map-draw-ctrl'), null, { timeout: 25000 });
    await page.waitForTimeout(500);

    const featuresAntes = await page.evaluate(() => Object.values(_mlFeatures).reduce((s, a) => s + (a || []).length, 0));

    const centro = [-43.85, -19.77];
    await page.locator('.block-map-wrap').nth(0).locator('.bm-import-input').setInputFiles({
      name: 'iepha_teste.geojson', mimeType: 'application/geo+json',
      buffer: Buffer.from(JSON.stringify(fcQuadrado(centro[0], centro[1]))),
    });
    await page.waitForFunction(() => typeof _mlImportedLayers !== 'undefined' && _mlImportedLayers.length === 1, null, { timeout: 10000 });

    const aposPrimeira = await page.evaluate(() => {
      const e = _mlImportedLayers[0];
      const bm = Object.values(_blockMaps)[0];
      return {
        nome: e.name, cor: e.color,
        renderizadaNoBlockMap: !!bm.getLayer('fill-imp-' + e.id),
        featuresTematicas: Object.values(_mlFeatures).reduce((s, a) => s + (a || []).length, 0),
      };
    });
    console.log('1ª importação:', aposPrimeira);
    expect(aposPrimeira.nome).toBe('iepha_teste');
    expect(aposPrimeira.renderizadaNoBlockMap).toBe(true);
    // não polui mais as camadas temáticas
    expect(aposPrimeira.featuresTematicas).toBe(featuresAntes);

    // 2) segunda importação → cor DISTINTA
    await page.locator('.block-map-wrap').nth(0).locator('.bm-import-input').setInputFiles({
      name: 'municipal_teste.geojson', mimeType: 'application/geo+json',
      buffer: Buffer.from(JSON.stringify(fcQuadrado(centro[0] + 0.006, centro[1]))),
    });
    await page.waitForFunction(() => _mlImportedLayers.length === 2, null, { timeout: 10000 });
    const cores = await page.evaluate(() => _mlImportedLayers.map(l => l.color));
    console.log('cores:', cores);
    expect(cores[0]).not.toBe(cores[1]);

    // 3) no Mapa de Análise: sidebar + legenda listam as duas
    await abrirMapaAnalise(page);
    const listagem = await page.evaluate(() => ({
      sidebar: [...document.querySelectorAll('.ml-layer-item[data-import-id] .ml-import-name')].map(e => e.textContent),
      legenda: mlLegendItems().filter(i => String(i.id).startsWith('import-')).map(i => i.label),
    }));
    console.log('listagem:', listagem);
    expect(listagem.sidebar).toEqual(['iepha_teste', 'municipal_teste']);
    expect(listagem.legenda.length).toBe(2);

    // 4) clique na feição importada → popup da camada; renomear e recolorir
    const box = await page.locator('#ml-map').boundingBox();
    await page.evaluate((c) => { _mlMap.jumpTo({ center: c, zoom: 14 }); }, centro);
    await page.waitForTimeout(800);
    const pt = await page.evaluate((c) => { const p = _mlMap.project(c); return { x: p.x, y: p.y }; }, centro);
    await page.mouse.click(box.x + pt.x, box.y + pt.y);
    await page.waitForSelector('#imp-pop-nome', { timeout: 6000 });
    await page.waitForTimeout(300);

    await page.locator('#imp-pop-nome').fill('IEPHA renomeada');
    await page.locator('#imp-pop-nome').blur();
    await page.evaluate(() => {
      const cor = document.querySelector('#imp-pop-cor');
      cor.value = '#123456';
      cor.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(400);
    const aposEdicao = await page.evaluate(() => ({
      nome: _mlImportedLayers[0].name,
      cor: _mlImportedLayers[0].color,
      corNoMapa: _mlMap.getPaintProperty('fill-imp-' + _mlImportedLayers[0].id, 'fill-color'),
      nomeNoSidebar: document.querySelector('.ml-layer-item[data-import-id] .ml-import-name')?.textContent,
    }));
    console.log('após renomear/recolorir:', aposEdicao);
    expect(aposEdicao.nome).toBe('IEPHA renomeada');
    expect(aposEdicao.cor).toBe('#123456');
    expect(aposEdicao.corNoMapa).toBe('#123456');
    expect(aposEdicao.nomeNoSidebar).toBe('IEPHA renomeada');

    // 5) persistência: aguardar autosave (debounce 1,2s) e recarregar
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForTimeout(1500);
    await abrirMapaAnalise(page);
    const restauradas = await page.evaluate(() => ({
      n: _mlImportedLayers.length,
      nomes: _mlImportedLayers.map(l => l.name),
      noMapa: _mlImportedLayers.every(l => !!_mlMap.getLayer('fill-imp-' + l.id)),
    }));
    console.log('após reload:', restauradas);
    expect(restauradas.n).toBe(2);
    expect(restauradas.nomes).toEqual(['IEPHA renomeada', 'municipal_teste']);
    expect(restauradas.noMapa).toBe(true);
  });
});

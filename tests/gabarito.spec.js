// tests/gabarito.spec.js
// Mapa de GABARITO — fatia 1: modo "🖱 editar prédios" adota um prédio real (OSM/Open Buildings)
// por clique → popup pavimentos/uso → feição na camada 'gabarito' classificada por FAIXA
// (cor da faixa + legenda por faixa + persistência via mlSaveState). O prédio original é
// ocultado via feature-state 'adotado'; o 3D extruda por pavimentos×3 m (gab-3d).
// Requer internet (tiles OpenFreeMap) — mesma classe do edificacoes-3d.spec.js.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Gabarito: adotar prédio real por clique, classificar por faixa, ocultar original, 3D', async ({ page }) => {
  test.setTimeout(120000);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });

  // centro denso (BH, Praça Sete) + prédios OSM ligados
  await page.evaluate(() => {
    _mlMap.jumpTo({ center: [-43.9378, -19.9191], zoom: 16.5 });
    const cb = document.querySelector('.edif-box .edif-osm'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => !!_mlMap.getLayer('edif-osm-fill'), null, { timeout: 15000 });
  await page.waitForFunction(() => _mlMap.areTilesLoaded() && _mlMap.queryRenderedFeatures({ layers: ['edif-osm-fill'] }).length > 0, null, { timeout: 60000 });

  // liga o modo editar prédios
  await page.evaluate(() => { const cb = document.querySelector('.edif-box .edif-editar'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(await page.evaluate(() => _gabMode)).toBe(true);

  // clique num prédio: varre a tela até acertar um footprint renderizado
  const hit = await page.evaluate(() => {
    const c = _mlMap.getCanvas();
    for (let x = 12; x < c.clientWidth - 12; x += 24) {
      for (let y = 12; y < c.clientHeight - 12; y += 24) {
        const fs = _mlMap.queryRenderedFeatures([x, y], { layers: ['edif-osm-fill'] });
        if (fs.length && (fs[0].geometry.type === 'Polygon' || fs[0].geometry.type === 'MultiPolygon')) {
          return { achou: true, handled: _gabHandleClick({ point: { x, y }, lngLat: _mlMap.unproject([x, y]) }), x, y };
        }
      }
    }
    return { achou: false };
  });
  expect(hit.achou).toBe(true);
  expect(hit.handled).toBe(true);

  // adotado: feição na camada gabarito + popup aberto + original ocultado por feature-state
  const r1 = await page.evaluate(() => {
    const g = _mlFeatures['gabarito'][0];
    const fs = _mlMap.getFeatureState({ source: 'openmaptiles', sourceLayer: g.props.srcLayer || 'building', id: isNaN(+g.props.srcId) ? g.props.srcId : +g.props.srcId });
    return { n: _mlFeatures['gabarito'].length, src: g.props.src, temSrcId: !!g.props.srcId, popup: !!document.getElementById('gab-pav'), adotado: !!(fs && fs.adotado) };
  });
  expect(r1).toEqual({ n: 1, src: 'osm', temSrcId: true, popup: true, adotado: true });

  // define 12 pavimentos + uso → cor da faixa 9–15, persiste (mlSaveState) e entra na legenda
  const r2 = await page.evaluate(() => {
    document.getElementById('gab-pav').value = '12';
    document.getElementById('gab-uso').value = 'res_multi';
    document.getElementById('gab-salvar').click();
    const g = _mlFeatures['gabarito'][0];
    const leg = mlLegendItems();
    return {
      pav: g.props.pavimentos, uso: g.props.uso, cor: g.props.cor,
      corFaixa: _gabFaixa(12).cor,
      legenda: leg.some(i => i.id === 'gab-9-15'),
      persistiu: (state['ml-features'] && state['ml-features'].gabarito || []).length,
    };
  });
  expect(r2.pav).toBe(12);
  expect(r2.uso).toBe('res_multi');
  expect(r2.cor).toBe(r2.corFaixa);
  expect(r2.legenda).toBe(true);
  expect(r2.persistiu).toBe(1);

  // 3D: extrusão do gabarito entra junto com o Volume 3D
  await page.evaluate(() => { const cb = document.querySelector('.edif-box .edif-3d'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => !!_mlMap.getLayer('gab-3d'), null, { timeout: 8000 });

  // clicar de novo no mesmo prédio REEDITA (não duplica)
  const r3 = await page.evaluate((p) => {
    _gabHandleClick({ point: { x: p.x, y: p.y }, lngLat: _mlMap.unproject([p.x, p.y]) });
    return { n: _mlFeatures['gabarito'].length, popup: !!document.getElementById('gab-pav') };
  }, { x: hit.x, y: hit.y });
  expect(r3).toEqual({ n: 1, popup: true });

  // remover devolve o original (feature-state limpo)
  const r4 = await page.evaluate(() => {
    const g = _mlFeatures['gabarito'][0];
    const spec = { source: 'openmaptiles', sourceLayer: g.props.srcLayer || 'building', id: isNaN(+g.props.srcId) ? g.props.srcId : +g.props.srcId };
    document.getElementById('gab-remover').click();
    const fs = _mlMap.getFeatureState(spec);
    return { n: _mlFeatures['gabarito'].length, adotado: !!(fs && fs.adotado) };
  });
  expect(r4).toEqual({ n: 0, adotado: false });
});

test('Gabarito fatia 2: Shift+clique acumula, retângulo seleciona em massa, aplicar em grupo', async ({ page }) => {
  test.setTimeout(120000);
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.evaluate(() => {
    _mlMap.jumpTo({ center: [-43.9378, -19.9191], zoom: 16.5 });
    const cb = document.querySelector('.edif-box .edif-osm'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(() => !!_mlMap.getLayer('edif-osm-fill'), null, { timeout: 15000 });
  await page.waitForFunction(() => _mlMap.areTilesLoaded() && _mlMap.queryRenderedFeatures({ layers: ['edif-osm-fill'] }).length > 0, null, { timeout: 60000 });

  // liga o modo → a linha de seleção múltipla aparece, com o select de uso populado
  await page.evaluate(() => { const cb = document.querySelector('.edif-box .edif-editar'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
  const ui = await page.evaluate(() => ({
    visivel: document.querySelector('.edif-box .gab-multi').style.display !== 'none',
    usoOpts: document.querySelector('.edif-box .gab-multi-uso').options.length,
  }));
  expect(ui.visivel).toBe(true);
  expect(ui.usoOpts).toBeGreaterThan(1);

  // Shift+clique acumula até 2 prédios distintos (prédios OSM podem se sobrepor no mesmo
  // pixel — se o clique destogglar o mesmo prédio, o teste reclica, como faria o usuário
  // guiado pelo realce visual)
  const sel2 = await page.evaluate(() => {
    const c = _mlMap.getCanvas();
    for (let x = 12; x < c.clientWidth - 12 && _gabSelList.length < 2; x += 24) {
      for (let y = 12; y < c.clientHeight - 12 && _gabSelList.length < 2; y += 24) {
        const fs = _mlMap.queryRenderedFeatures([x, y], { layers: ['edif-osm-fill'] });
        if (!fs.length) continue;
        const antes = _gabSelList.length;
        const ev = { point: { x, y }, lngLat: _mlMap.unproject([x, y]), originalEvent: { shiftKey: true } };
        _gabHandleClick(ev);
        if (_gabSelList.length < antes) _gabHandleClick(ev);   // destogglou o mesmo → refaz
      }
    }
    const primeiro = _gabSelList[0];
    const st = primeiro ? _mlMap.getFeatureState({ source: 'openmaptiles', sourceLayer: primeiro.srcLayer || 'building', id: isNaN(+primeiro.srcId) ? primeiro.srcId : +primeiro.srcId }) : {};
    return { n: _gabSelList.length, texto: document.querySelector('.edif-box .gab-sel-count').textContent, realce: !!(st && st.sel), popupNaoAbriu: !document.getElementById('gab-pav') };
  });
  expect(sel2.n).toBe(2);
  expect(sel2.texto).toContain('2 selecionados');
  expect(sel2.realce).toBe(true);
  expect(sel2.popupNaoAbriu).toBe(true);   // Shift+clique seleciona, não abre popup

  // retângulo cobrindo a tela seleciona em massa
  const nBox = await page.evaluate(() => {
    const c = _mlMap.getCanvas();
    _gabSelecionarBox([0, 0], [c.clientWidth, c.clientHeight]);
    return _gabSelList.length;
  });
  expect(nBox).toBeGreaterThan(2);

  // aplicar em grupo: todos viram feições do gabarito com 2 pavimentos (faixa 1–2), seleção limpa
  const r = await page.evaluate((esperado) => {
    document.querySelector('.edif-box .gab-multi-pav').value = '2';
    document.querySelector('.edif-box .gab-multi-uso').value = 'res_uni';
    _gabAplicarSelecao();
    const g = _mlFeatures['gabarito'];
    return {
      n: g.length, esperado,
      todos2pav: g.every(x => x.props.pavimentos === 2),
      corFaixa: g.every(x => x.props.cor === _gabFaixa(2).cor),
      selLimpa: _gabSelList.length,
      persistiu: (state['ml-features'] && state['ml-features'].gabarito || []).length,
    };
  }, nBox);
  expect(r.n).toBe(nBox);
  expect(r.todos2pav).toBe(true);
  expect(r.corFaixa).toBe(true);
  expect(r.selLimpa).toBe(0);
  expect(r.persistiu).toBe(nBox);

  // Shift+clique num prédio JÁ adotado entra na seleção como 'gab' (contorno de destaque)
  // (espera o MapLibre repintar a fonte GeoJSON com as feições recém-adotadas)
  await page.waitForFunction(() => _mlMap.queryRenderedFeatures({ layers: ['fill-gabarito'] }).length > 0, null, { timeout: 15000 });
  const g1 = await page.evaluate(() => {
    const c = _mlMap.getCanvas();
    for (let x = 12; x < c.clientWidth - 12; x += 24) {
      for (let y = 12; y < c.clientHeight - 12; y += 24) {
        const fs = _mlMap.queryRenderedFeatures([x, y], { layers: ['fill-gabarito'] });
        if (fs.length) {
          _gabHandleClick({ point: { x, y }, lngLat: _mlMap.unproject([x, y]), originalEvent: { shiftKey: true } });
          return { kind: _gabSelList[0] && _gabSelList[0].kind, outline: !!_mlMap.getLayer('gab-sel-line') };
        }
      }
    }
    return { kind: null };
  });
  expect(g1.kind).toBe('gab');
  expect(g1.outline).toBe(true);
});

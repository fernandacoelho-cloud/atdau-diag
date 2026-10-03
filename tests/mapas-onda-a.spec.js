// tests/mapas-onda-a.spec.js
// Onda A — padronizacao e integracao dos mapas:
//  (1) ordem da navegacao: Mapa-Sintese passa a ser o ULTIMO item, depois das
//      Diretrizes (grupos "Analise & Sintese" e "Proposicao & Entrega").
//  (2) salvarVistaMapa() compoe a vista (norte/escala/legenda) e guarda no
//      PhotoStore('mapas-salvos') -> entra no Relatorio; manager renderMapasSalvos.
//  (3) achados generalizados: o caminho desenho->achado->SWOT funciona para
//      qualquer camada (usado pelos block-maps).
//  (4) tema 'zona' + mapa de zoneamento dedicado na Legislacao.
//  (5) link IDE-Sisema corrigido (visualizador, sem hifen).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Onda A: ordem nav, salvar vista, achados, zoneamento, link IDE', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  // (1) ordem da navegacao: nav-8 (Diretrizes) vem ANTES de nav-10 (Mapa-Sintese),
  //     e o Mapa-Sintese e o ultimo .sec-nav-item.
  const nav = await page.evaluate(() => {
    const itens = [...document.querySelectorAll('.sec-nav .sec-nav-item')].map(e => e.id);
    const grupos = [...document.querySelectorAll('.sec-nav .sec-nav-group')].map(e => e.textContent.trim());
    return {
      ordem: itens,
      idxDiretrizes: itens.indexOf('nav-8'),
      idxSintese: itens.indexOf('nav-10'),
      ultimo: itens[itens.length - 1],
      temAnaliseSintese: grupos.some(g => /An[aá]lise/.test(g) && /S[ií]ntese/.test(g)),
      temProposicao: grupos.some(g => /Proposi/.test(g)),
    };
  });
  expect(nav.idxDiretrizes).toBeGreaterThan(-1);
  expect(nav.idxSintese).toBeGreaterThan(nav.idxDiretrizes); // Mapa-Sintese depois das Diretrizes
  expect(nav.ultimo).toBe('nav-10');                          // e e o ultimo
  expect(nav.temAnaliseSintese).toBe(true);
  expect(nav.temProposicao).toBe(true);

  // (5) link IDE-Sisema: visualizador correto presente, hifenado ausente
  const links = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    return {
      visualizador: html.includes('visualizador.idesisema.meioambiente.mg.gov.br'),
      hifenQuebrado: html.includes('ide-sisema.meioambiente.mg.gov.br'),
    };
  });
  expect(links.visualizador).toBe(true);
  expect(links.hifenQuebrado).toBe(false);

  // (4) tema 'zona' existe e a Legislacao tem um block-map de zoneamento
  const zona = await page.evaluate(() => ({
    tema: !!(typeof ML_THEMES !== 'undefined' && ML_THEMES.zona && ML_THEMES.zona.defaultLayer === 'zona'),
    blockMap: !!document.querySelector('#panel-2 .lente-btn[data-lente="zona"]'),   // 2026-10: os mini-mapas por bloco viraram lentes do mapa único (#lente-wrap)
  }));
  expect(zona.tema).toBe(true);
  expect(zona.blockMap).toBe(true);

  // (3) achados generalizados (caminho usado pelos block-maps): feicao -> vincular -> criar achado
  const ach = await page.evaluate(() => {
    if (!_mlFeatures.viario) _mlFeatures.viario = [];
    const id = 'bm-test-' + Date.now();
    _mlFeatures.viario.push({ id, geom: { type: 'Point', coordinates: [-43.85, -19.77] }, props: { origem: 'block-map' } });
    mlVincularAchado({ id }, 'viario');
    const modal = !!document.getElementById('ml-vinculo-modal');
    const inp = document.getElementById('ml-vinculo-novo'); inp.value = 'Achado de teste do mini-mapa';
    const antes = (state.findings[1] || []).length;
    mlCriarAchadoDeDesenho(id, 'viario');
    const depois = (state.findings[1] || []).length;
    const feat = _mlFeatures.viario.find(f => f.id === id);
    return { modal, cresceu: depois > antes, vinculado: !!(feat && feat.props.achadoVinculado) };
  });
  expect(ach.modal).toBe(true);
  expect(ach.cresceu).toBe(true);
  expect(ach.vinculado).toBe(true);

  // (2) salvar vista do Mapa de Analise -> PhotoStore('mapas-salvos') cresce; manager lista
  await page.evaluate(() => irPara(6, document.getElementById('nav-6')));
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const salvar = await page.evaluate(() => {
    if (typeof PhotoStore !== 'undefined') { PhotoStore.load(); PhotoStore.data['mapas-salvos'] = []; PhotoStore.save(); }
    _mlMap.resize();
    salvarVistaMapa(_mlMap, { titulo: 'Teste', credito: 'Suite ATDAU', legendaItems: mlLegendItems }, 'Mapa de Análise');
    const n = PhotoStore.get('mapas-salvos').length;
    const temImg = n > 0 && /^data:image\//.test(PhotoStore.get('mapas-salvos')[0].dataUrl || '');
    renderMapasSalvos();
    const cont = (document.getElementById('mapas-salvos-count') || {}).textContent;
    const temItem = !!document.querySelector('#mapas-salvos-lista img');
    return { n, temImg, cont, temItem };
  });
  expect(salvar.n).toBeGreaterThanOrEqual(1);
  expect(salvar.temImg).toBe(true);
  expect(salvar.temItem).toBe(true);

  // remover a vista salva
  const rem = await page.evaluate(() => {
    const arr = PhotoStore.get('mapas-salvos');
    removerVistaMapa(arr[0].id);
    return PhotoStore.get('mapas-salvos').length;
  });
  expect(rem).toBe(0);
});

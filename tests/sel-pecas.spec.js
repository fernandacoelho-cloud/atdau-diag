// tests/sel-pecas.spec.js
// Onda Partido — Etapa 1: PEÇAS do Sistema de Espaços Livres (Tardin) como classificação
// de feição. Cada feição do mapa pode ser marcada como uma peça (matriz/fragmento/praça/
// conector/fronteira/corpo d'água) no popup de edição; persiste em props.peca. É a base
// que vai carregar os verbos operativos (modelo many-to-many) nas etapas seguintes.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Etapa1: feição classificável como peça do SEL (popup) e persiste em props.peca', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(600);

  // as 6 peças do SEL existem
  const pecas = await page.evaluate(() => (typeof SEL_PECAS !== 'undefined') ? SEL_PECAS.map(p => p.id) : null);
  expect(pecas).toEqual(['matriz', 'fragmento', 'praca', 'conector', 'fronteira', 'corpodagua']);

  // injeta uma feição de espaço livre e abre o popup de edição
  await page.evaluate(() => {
    state['proj-modulo'] = 'paisagistico';   // tipologia de SEL → peça do SEL visível
    const c = _mlMap.getCenter(); const d = 0.001;
    _mlFeatures['livres'] = [{ id: 777, geom: { type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]] }, props: {} }];
    mlRefreshSource('livres');
    const layerDef = ML_LAYERS.find(l => l.id === 'livres');
    mlOpenFeaturePopup('livres', 777, {}, c, layerDef, _mlMap);
  });
  await page.waitForTimeout(250);   // handlers do popup são ligados em setTimeout(50)

  // o seletor de peça existe, com as 6 opções; classificar como "matriz" e salvar
  const r1 = await page.evaluate(() => {
    const sel = document.querySelector('#popup-peca');
    const out = { hasSel: !!sel, opts: sel ? [...sel.options].map(o => o.value) : [] };
    if (sel) { sel.value = 'matriz'; document.querySelector('#popup-salvar').click(); }
    const f = (_mlFeatures['livres'] || []).find(x => String(x.id) === '777');
    out.peca = f && f.props && f.props.peca;
    return out;
  });
  console.log('Etapa1:', r1);
  expect(r1.hasSel).toBe(true);
  expect(r1.opts).toContain('matriz');
  expect(r1.opts).toContain('corpodagua');
  expect(r1.peca).toBe('matriz');

  // reabrir, escolher "não classificar" → remove props.peca
  await page.evaluate(() => {
    const c = _mlMap.getCenter();
    const layerDef = ML_LAYERS.find(l => l.id === 'livres');
    const f = _mlFeatures['livres'].find(x => String(x.id) === '777');
    mlOpenFeaturePopup('livres', 777, f.props, c, layerDef, _mlMap);
  });
  await page.waitForTimeout(250);
  const r2 = await page.evaluate(() => {
    const sel = document.querySelector('#popup-peca');
    const selecionado = sel ? sel.value : null;       // deve refletir 'matriz' salvo
    if (sel) { sel.value = ''; document.querySelector('#popup-salvar').click(); }
    const f = (_mlFeatures['livres'] || []).find(x => String(x.id) === '777');
    return { selecionado, pecaApos: f && f.props ? f.props.peca : undefined };
  });
  expect(r2.selecionado).toBe('matriz');               // o popup reabre com a peça salva
  expect(r2.pecaApos == null).toBe(true);              // "não classificar" remove
});

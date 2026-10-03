// tests/pictogramas.spec.js
// 2026-10-03: pictogramas viram ÍCONES no mapa (antes eram texto e os glifos do MapLibre não
// têm emoji → nada aparecia) + biblioteca "Meus pictogramas" (emoji/símbolo ou imagem enviada),
// persistida em state.ml_pictos e usada no Mapa de Análise e nos block-maps.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');
// PNG 8x8 vermelho
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC', 'base64');

// pixels "pintados" (não brancos/transparentes) do ícone registrado no mapa
const pintados = (page, id) => page.evaluate(id => {
  const img = _mlMap.style.getImage(id); if (!img) return -1;
  const d = img.data.data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && !(d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240)) n++;
  return n;
}, id);

test('Pictogramas: emoji vira ícone no mapa; biblioteca própria (emoji + imagem) aplica e persiste', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelector('#nav-6').click());
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.getLayer('picto-mobil'), null, { timeout: 25000 });

  // (1) pictograma da lista padrão aparece como ícone
  await page.evaluate(() => {
    const c = _mlMap.getCenter();
    _mlFeatures.mobil = _mlFeatures.mobil || [];
    _mlFeatures.mobil.push({ id: 'pt-a', geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { pictograma: '🏥', rotulo: 'Posto' } });
    _mlMap.getSource('src-mobil').setData(mlGetFC('mobil'));
    mlToggleLayer('mobil', true);
  });
  await page.waitForFunction(() => _mlMap.hasImage('pic|🏥'), null, { timeout: 10000 });
  expect(await pintados(page, 'pic|🏥')).toBeGreaterThan(50); // o emoji foi desenhado (não só o disco)

  // (2) editor do ponto: "Meus pictogramas" — adicionar símbolo digitado
  const abrir = () => page.evaluate(() => {
    const f = _mlFeatures.mobil.find(x => x.id === 'pt-a');
    mlOpenFeaturePopup('mobil', 'pt-a', f.props, _mlMap.getCenter(), ML_LAYERS.find(l => l.id === 'mobil'));
  });
  await abrir();
  const pop = page.locator('.maplibregl-popup.ml-popup');
  await pop.waitFor({ timeout: 5000 });
  await page.waitForTimeout(300); // wire-up dos botões do editor roda num setTimeout(50)
  await expect(pop.locator('#popup-picto-meus')).toContainText('Nenhum ainda');
  await pop.locator('#popup-picto-add summary').click();
  await pop.locator('#popup-picto-txt').fill('★');
  await pop.locator('#popup-picto-nome').fill('Destaque');
  await pop.locator('#popup-picto-add-txt').click();
  await expect(pop.locator('#popup-picto-meus .ml-picto-btn')).toHaveCount(1);

  // (3) enviar imagem própria → vira o pictograma selecionado → Salvar
  await pop.locator('#popup-picto-nome').fill('Marca da prefeitura');
  await pop.locator('#popup-picto-file').setInputFiles({ name: 'marca.png', mimeType: 'image/png', buffer: PNG });
  await expect(pop.locator('#popup-picto-meus .ml-picto-btn')).toHaveCount(2);
  await expect(pop.locator('#popup-picto-meus img')).toHaveCount(1);
  await pop.locator('#popup-salvar').click();

  const r = await page.evaluate(() => ({
    pic: _mlFeatures.mobil.find(x => x.id === 'pt-a').props.pictograma,
    lib: state.ml_pictos.map(p => ({ tipo: p.tipo, label: p.label, ok: p.tipo === 'img' ? /^data:image\/png/.test(p.valor) : p.valor })),
  }));
  expect(r.pic).toMatch(/^img:u/);
  expect(r.lib).toEqual([{ tipo: 'texto', label: 'Destaque', ok: '★' }, { tipo: 'img', label: 'Marca da prefeitura', ok: true }]);
  await page.waitForFunction(id => _mlMap.hasImage('pic|' + id), r.pic, { timeout: 10000 });
  await expect.poll(() => pintados(page, 'pic|' + r.pic)).toBeGreaterThan(50); // imagem vermelha desenhada

  // (4) persiste: salvar → recarregar → biblioteca e ponto continuam
  await page.evaluate(() => { mlSaveState(); salvar(); });
  await page.reload();
  await page.waitForTimeout(1800);
  const depois = await page.evaluate(() => ({
    n: (state.ml_pictos || []).length,
    pic: ((state['ml-features'] || {}).mobil || []).find(x => x.id === 'pt-a')?.props?.pictograma,
  }));
  expect(depois.n).toBe(2);
  expect(depois.pic).toBe(r.pic);
});

test('Pictogramas: escolher na BARRA de desenho (block-map e Mapa de Análise) e clicar no mapa', async ({ page }) => {
  test.setTimeout(120000);
  page.on('dialog', d => d.accept().catch(() => {}));
  const pular = async () => {
    const b = page.locator('#ml-vinculo-modal button', { hasText: 'Pular' });
    try { await b.waitFor({ timeout: 1500 }); await b.click(); } catch {}
  };
  await page.goto(DIAG_URL);
  await page.waitForTimeout(1800);

  // block-map: "🙂 Pictograma" → 🏥 → já arma o Ponto → clique no mapa
  await page.locator('#nav-1').click();
  await page.waitForTimeout(700);
  const btn = page.locator('#panel-1 .block-map-toggle').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  const wrap = page.locator('#panel-1 .block-map-wrap').first();
  await wrap.locator('.bm-draw-btn').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(800);
  const lid = await wrap.evaluate(w => {
    const sel = w.querySelector('.bm-layer-select');
    const o = [...sel.options].find(o => (ML_LAYERS.find(l => l.id === o.value) || { geom: [] }).geom.includes('point'));
    sel.value = o.value; sel.dispatchEvent(new Event('change')); return o.value;
  });
  await expect(wrap.locator('.bm-picto-btn')).toBeVisible();
  await wrap.locator('.bm-picto-btn').click();
  await wrap.locator('.block-map-picto-panel .pic-sel-btn[data-pic="🏥"]').click();
  await expect(wrap.locator('.bm-picto-btn')).toContainText('Pictograma');
  await expect(wrap.locator('.block-map-active-hint')).toContainText('ponto');
  const canvas = wrap.locator('.block-map canvas.maplibregl-canvas');
  await canvas.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const box = await canvas.boundingBox();
  const n0 = await page.evaluate(l => (_mlFeatures[l] || []).length, lid);
  await page.mouse.click(box.x + box.width / 2 - 100, box.y + box.height / 2 + 20);
  await pular();
  const ptBm = await page.evaluate(l => _mlFeatures[l][_mlFeatures[l].length - 1], lid);
  expect(await page.evaluate(l => _mlFeatures[l].length, lid)).toBe(n0 + 1);
  expect(ptBm.geom.type).toBe('Point');
  expect(ptBm.props.pictograma).toBe('🏥');

  // Mapa de Análise: camada de pontos → "🙂 Pictograma do ponto" → símbolo próprio → clique
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.loaded() && _mlMap.getLayer('picto-notas'), null, { timeout: 30000 });
  await page.evaluate(() => { mlSetActiveLayer('notas'); mlToggleLayer('notas', true); });
  await page.locator('#ml-picto-btn').click();
  await page.locator('#ml-picto-sel .pic-sel-txt').fill('♣');
  await page.locator('#ml-picto-sel .pic-sel-nome').fill('Horta');
  await page.locator('#ml-picto-sel .pic-sel-add').click();
  expect(await page.evaluate(() => _mlDraw.mode === 'drawing' && _mlDraw.geomType === 'point')).toBe(true);
  await expect(page.locator('#ml-draw-hint')).toContainText('♣');
  const c2 = page.locator('#ml-map canvas.maplibregl-canvas');
  await c2.scrollIntoViewIfNeeded();
  const b2 = await c2.boundingBox();
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await pular();
  const ptMl = await page.evaluate(() => _mlFeatures.notas[_mlFeatures.notas.length - 1].props);
  expect(ptMl.pictograma).toBe('♣');
  await page.waitForFunction(() => _mlMap.hasImage('pic|♣'), null, { timeout: 8000 });
});

test('Pictogramas: ponto com pictograma aparece como ícone também no block-map', async ({ page }) => {
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelector('#nav-1').click());
  await page.waitForTimeout(700);
  const btn = page.locator('#panel-1 .block-map-toggle').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  const wrap = page.locator('#panel-1 .block-map-wrap').first();
  await wrap.locator('.bm-draw-btn[data-geom="point"]').waitFor({ timeout: 25000 });
  await page.waitForTimeout(800);
  const ok = await page.evaluate(async () => {
    const w = document.querySelector('#panel-1 .block-map-wrap');
    const lid = w.querySelector('.bm-layer-select').value;
    const m = Object.values(_blockMaps).find(m => m.getContainer().offsetWidth > 0);
    const c = m.getCenter();
    _mlFeatures[lid].push({ id: 'bm-pic', geom: { type: 'Point', coordinates: [c.lng, c.lat] }, props: { pictograma: '🌳' } });
    _blockMapRefreshSource(m, lid);
    for (let i = 0; i < 40 && !m.hasImage('pic|🌳'); i++) await new Promise(r => setTimeout(r, 150));
    return { layer: !!m.getLayer('picto-' + lid), img: m.hasImage('pic|🌳') };
  });
  expect(ok).toEqual({ layer: true, img: true });
});

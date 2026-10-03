// tests/fluxo-completo.spec.js
// 2026-10-03: teste de FLUXO de ponta a ponta, dirigindo a UI como o usuário:
//  A. percorre todas as abas na ordem do menu (sem erro de JS, cada painel com conteúdo);
//  B. Mapa de Análise: desenha ponto, linha e polígono com o mouse, edita o ponto
//     (pictograma + tracejado), desfaz;
//  C. block-map: desenha ponto/linha/polígono com o mouse, edita o ponto (pictograma) e
//     o ícone aparece no mapa;
//  D. salvar → recarregar mantém tudo; "Salvar projeto" gera arquivo com desenhos e pictogramas.
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

// Erros de JS da PÁGINA (exceções não tratadas). Falhas de rede/tiles não contam.
function vigiarErros(page) {
  const erros = [];
  page.on('pageerror', e => erros.push(e.message.slice(0, 200)));
  return erros;
}
async function pularVinculo(page) {
  const pular = page.locator('#ml-vinculo-modal button', { hasText: 'Pular' });
  try { await pular.waitFor({ timeout: 1500 }); await pular.click(); } catch {}
  await page.waitForFunction(() => !document.getElementById('ml-vinculo-modal'), null, { timeout: 3000 });
}
async function abrir(page) {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
}

test('A. Percorre todas as abas na ordem do menu sem erro de JS', async ({ page }) => {
  test.setTimeout(120000);
  const erros = vigiarErros(page);
  await abrir(page);
  const ids = await page.evaluate(() => [...document.querySelectorAll('.sec-nav-item')].map(n => n.id));
  expect(ids.length).toBeGreaterThanOrEqual(16);
  const vazios = [];
  for (const id of ids) {
    await page.locator('#' + id).click();
    await page.waitForTimeout(500);
    const r = await page.evaluate(id => {
      const n = id.replace('nav-', '');
      const p = document.getElementById('panel-' + n);
      return { ativo: !!p && p.classList.contains('active'), visivel: !!p && p.offsetParent !== null,
               texto: p ? p.innerText.trim().length : 0,
               navAtivo: document.getElementById(id).classList.contains('active') };
    }, id);
    if (!r.ativo || !r.visivel || !r.navAtivo || r.texto < 80) vazios.push(`${id}: ${JSON.stringify(r)}`);
  }
  expect(vazios, 'abas que não abriram direito').toEqual([]);
  expect(erros, 'erros de JS ao navegar').toEqual([]);
});

test('B. Mapa de Análise: desenhar ponto/linha/polígono, editar ponto (pictograma + tracejado) e desfazer', async ({ page }) => {
  test.setTimeout(120000);
  const erros = vigiarErros(page);
  await abrir(page);
  await page.locator('#nav-6').click();
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.loaded() && _mlMap.getLayer('picto-notas'), null, { timeout: 30000 });
  await page.waitForTimeout(800);

  // camada que aceita as três geometrias
  const lid = await page.evaluate(() => {
    const l = ML_LAYERS.find(l => ['point', 'polyline', 'polygon'].every(g => l.geom.includes(g)) && !['equip', 'swot', 'terreno', 'uso', 'cobertura', 'uc'].includes(l.id));
    mlSetActiveLayer(l.id); mlToggleLayer(l.id, true);
    return l.id;
  });
  const canvas = page.locator('#ml-map canvas.maplibregl-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const n = () => page.evaluate(l => (_mlFeatures[l] || []).length, lid);
  const n0 = await n();

  // ponto
  await page.locator(`#btn-draw-${lid}-point`).click();
  expect((await canvas.boundingBox()).y).toBeCloseTo(box.y, 0); // não pula ao entrar no modo desenho
  await page.mouse.click(cx - 120, cy);
  await pularVinculo(page);
  // linha
  await page.locator(`#btn-draw-${lid}-polyline`).click();
  await page.mouse.click(cx - 60, cy + 60);
  await page.mouse.click(cx + 60, cy + 60);
  await page.mouse.dblclick(cx + 60, cy + 60);
  await pularVinculo(page);
  // polígono
  await page.locator(`#btn-draw-${lid}-polygon`).click();
  await page.mouse.click(cx + 80, cy - 80);
  await page.mouse.click(cx + 160, cy - 80);
  await page.mouse.click(cx + 120, cy - 20);
  await page.mouse.dblclick(cx + 120, cy - 20);
  await pularVinculo(page);

  const tipos = await page.evaluate(l => _mlFeatures[l].slice(-3).map(f => f.geom.type), lid);
  expect(await n()).toBe(n0 + 3);
  expect(tipos).toEqual(['Point', 'LineString', 'Polygon']);

  // clicar no ponto abre o editor → pictograma 🌳 + tracejada → salvar
  // o mapa não pode "pular" ao começar/terminar desenho (a faixa de estado mantém a altura)
  expect((await canvas.boundingBox()).y).toBeCloseTo(box.y, 0);
  await page.mouse.click(cx - 120, cy);
  const pop = page.locator('.maplibregl-popup.ml-popup');
  await pop.waitFor({ timeout: 5000 });
  await page.waitForTimeout(300); // wire-up dos botões do editor roda num setTimeout(50)
  await pop.locator('.ml-picto-btn[data-pic="🌳"]').click();
  await pop.locator('#popup-rotulo').fill('Ipê da praça');
  await pop.locator('#popup-salvar').click();
  const pt = await page.evaluate(l => _mlFeatures[l].find(f => f.geom.type === 'Point' && f.props.rotulo === 'Ipê da praça')?.props, lid);
  expect(pt && pt.pictograma).toBe('🌳');
  await page.waitForFunction(() => _mlMap.hasImage('pic|🌳'), null, { timeout: 8000 });

  // linha: editor → tracejada
  await page.mouse.click(cx, cy + 60);
  await pop.waitFor({ timeout: 5000 });
  await page.waitForTimeout(300); // wire-up dos botões do editor roda num setTimeout(50)
  await pop.locator('.popup-dash-btn[data-dash="dashed"]').click();
  await pop.locator('#popup-salvar').click();
  const linha = await page.evaluate(l => _mlFeatures[l].find(f => f.geom.type === 'LineString')?.props, lid);
  expect(linha.lineDash).toBe('dashed');

  // desfazer remove a última feição
  await page.locator('.ml-draw-btn', { hasText: 'Desfazer' }).click();
  expect(await n()).toBe(n0 + 2);
  expect(erros).toEqual([]);
});

test('C. Block-map: desenhar ponto/linha/polígono com o mouse e pôr pictograma no ponto', async ({ page }) => {
  test.setTimeout(120000);
  const erros = vigiarErros(page);
  await abrir(page);
  await page.locator('#nav-1').click();
  await page.waitForTimeout(700);
  const btn = page.locator('#panel-1 .block-map-toggle').first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  const wrap = page.locator('#panel-1 .block-map-wrap').first();
  await wrap.locator('.bm-draw-btn').first().waitFor({ timeout: 25000 });
  await page.waitForTimeout(1000);

  // escolher uma camada com as três geometrias
  const lid = await wrap.evaluate(w => {
    const sel = w.querySelector('.bm-layer-select');
    const opt = [...sel.options].find(o => { const l = ML_LAYERS.find(x => x.id === o.value); return l && ['point', 'polyline', 'polygon'].every(g => l.geom.includes(g)); });
    sel.value = opt.value; sel.dispatchEvent(new Event('change'));
    return opt.value;
  });
  const canvas = wrap.locator('.block-map canvas.maplibregl-canvas');
  await canvas.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const n0 = await page.evaluate(l => (_mlFeatures[l] || []).length, lid);

  await wrap.locator('.bm-draw-btn[data-geom="point"]').click();
  await page.mouse.click(cx - 150, cy - 40);
  await pularVinculo(page);
  await wrap.locator('.bm-draw-btn[data-geom="polyline"]').click();
  await page.mouse.click(cx - 60, cy + 50);
  await page.mouse.click(cx + 40, cy + 50);
  await page.mouse.dblclick(cx + 40, cy + 50);
  await pularVinculo(page);
  await wrap.locator('.bm-draw-btn[data-geom="polygon"]').click();
  await page.mouse.click(cx + 100, cy - 60);
  await page.mouse.click(cx + 190, cy - 60);
  await page.mouse.click(cx + 150, cy + 10);
  await page.mouse.dblclick(cx + 150, cy + 10);
  await pularVinculo(page);
  const tipos = await page.evaluate(l => _mlFeatures[l].slice(-3).map(f => f.geom.type), lid);
  expect(tipos).toEqual(['Point', 'LineString', 'Polygon']);
  expect(await page.evaluate(l => _mlFeatures[l].length, lid)).toBe(n0 + 3);

  // editar o ponto no próprio block-map → pictograma ⚠️
  await page.mouse.click(cx - 150, cy - 40);
  const pop = page.locator('.maplibregl-popup.ml-popup');
  await pop.waitFor({ timeout: 5000 });
  await page.waitForTimeout(300); // wire-up dos botões do editor roda num setTimeout(50)
  await pop.locator('.ml-picto-btn[data-pic="⚠️"]').click();
  await pop.locator('#popup-salvar').click();
  const ok = await page.evaluate(async () => {
    const m = Object.values(_blockMaps).find(m => m.getContainer().offsetWidth > 0);
    for (let i = 0; i < 40 && !m.hasImage('pic|⚠️'); i++) await new Promise(r => setTimeout(r, 150));
    return m.hasImage('pic|⚠️');
  });
  expect(ok).toBe(true);
  expect(erros).toEqual([]);
});

test('D. Salvar → recarregar mantém dados; "Salvar projeto" gera arquivo com desenhos e pictogramas', async ({ page }) => {
  test.setTimeout(120000);
  const erros = vigiarErros(page);
  await abrir(page);
  // campo de texto da Identificação
  const campoId = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#panel-0 input[type="text"][id], #panel-0 textarea[id]')]
      .find(e => e.offsetParent !== null && !e.readOnly && !e.disabled);
    return el && el.id;
  });
  expect(campoId).toBeTruthy();
  const campo = page.locator('#' + campoId);
  await campo.fill('Teste de fluxo — Santa Luzia');
  await page.evaluate(() => {
    picAdicionarTexto('🚲', 'Bicicletário');
    _mlFeatures.notas = _mlFeatures.notas || [];
    _mlFeatures.notas.push({ id: 'fx1', geom: { type: 'Point', coordinates: [-43.85, -19.77] }, props: { pictograma: '🚲', rotulo: 'Paraciclo' } });
    mlSaveState();
  });
  await page.locator('#btn-save').click();
  await page.reload();
  await page.waitForTimeout(1800);
  expect(await page.locator('#' + campoId).inputValue()).toBe('Teste de fluxo — Santa Luzia');
  const pers = await page.evaluate(() => ({
    lib: (state.ml_pictos || []).map(p => p.valor),
    nota: ((state['ml-features'] || {}).notas || []).find(f => f.id === 'fx1')?.props?.pictograma,
  }));
  expect(pers.lib).toContain('🚲');
  expect(pers.nota).toBe('🚲');

  // arquivo do projeto
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('button', { hasText: 'Salvar projeto' }).first().click()]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  expect(txt).toContain('Teste de fluxo');
  expect(txt).toContain('Bicicletário');
  expect(txt).toContain('Paraciclo');
  expect(erros).toEqual([]);
});

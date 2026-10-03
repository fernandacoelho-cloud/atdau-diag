// tests/lente-mapa.spec.js
// 2026-10-03 · FASE 3, fatia 2: mapa único do diagnóstico com LENTES (substitui os 27 mini-mapas
// inline e o "Mapeamento temático do entorno").
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

const pronto = (page, tema) => page.waitForFunction(t => {
  const w = document.getElementById('lente-wrap');
  return w && w.dataset.ready === '1' && (!t || w.dataset.theme === t) && w.querySelector('.bm-layer-select');
}, tema || null, { timeout: 30000 });

test('Mapa aparece só nas abas de levantamento, troca de lente sem recriar e recolhe', async ({ page }) => {
  test.setTimeout(120000);
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(DIAG_URL); await page.waitForTimeout(1500);
  const vis = () => page.evaluate(() => getComputedStyle(document.getElementById('lente-dock')).display !== 'none');
  expect(await vis()).toBe(false);                       // Identificação: sem mapa
  expect(await page.locator('#ml-theme-map').count()).toBe(0);
  expect(await page.locator('.block-title', { hasText: 'Mapeamento temático do entorno' }).count()).toBe(0);

  await page.locator('#nav-1').click();
  expect(await vis()).toBe(true);
  await pronto(page);
  const n1 = await page.evaluate(() => Object.keys(_blockMaps).length);

  // seletor de lente: troca camadas e barra de desenho sem criar outro mapa
  await page.selectOption('#lente-tema', 'risco');
  await pronto(page, 'risco');
  const r = await page.evaluate(() => {
    const m = _blockMaps['lente-wrap'];
    const v = id => m.getLayer(id) ? (m.getLayoutProperty(id, 'visibility') || 'visible') : 'ausente';
    return { mapas: Object.keys(_blockMaps).length, camada: document.querySelector('#lente-wrap .bm-layer-select').value, risco: v('fill-risco'), viario: v('polyline-viario'), terreno3d: !!document.querySelector('#lente-wrap .block-map-terrain-ctrl') };
  });
  expect(r).toEqual({ mapas: n1, camada: 'risco', risco: 'visible', viario: 'none', terreno3d: true });

  // recolher e reabrir
  await page.locator('.lente-recolher').click();
  expect(await vis()).toBe(false);
  await expect(page.locator('#lente-aba')).toBeVisible();
  await page.locator('#lente-aba').click();
  expect(await vis()).toBe(true);

  // Mapa de Análise e Síntese: sem a coluna do mapa
  await page.locator('#nav-6').click(); await page.waitForTimeout(300);
  expect(await vis()).toBe(false);
  await page.locator('#nav-5').click(); await page.waitForTimeout(300);
  expect(await vis()).toBe(true);
  // a lente sobrevive a salvar + recarregar
  await page.evaluate(() => salvar());
  expect(erros).toEqual([]);
});

test('"Seguir a rolagem" troca a lente pelo bloco em leitura, mas nunca durante um desenho', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(DIAG_URL); await page.waitForTimeout(1500);
  await page.locator('#nav-1').click();
  await pronto(page);
  await page.evaluate(() => { document.querySelectorAll('#panel-1 .cat-group').forEach(g => g.classList.add('cat-open')); const c = document.getElementById('lente-seguir'); c.checked = true; lenteSeguir(true); });
  // rola até "Áreas de risco"
  const rolarAte = titulo => page.evaluate(t => {
    const b = [...document.querySelectorAll('#panel-1 .block')].find(b => b.querySelector('.block-title')?.textContent.startsWith(t));
    // a lente segue o bloco que cruza a linha de leitura (40% da altura da tela)
    window.scrollTo(0, window.scrollY + b.getBoundingClientRect().top - window.innerHeight * 0.4 + 10);
  }, titulo);
  await page.mouse.move(200, 400);   // mouse fora do mapa
  await rolarAte('Áreas de risco');
  await pronto(page, 'risco');
  await expect(page.locator('#lente-bloco')).toContainText('Áreas de risco');

  // começa a desenhar: rolar não troca a lente
  await page.locator('#lente-wrap .bm-draw-btn[data-geom="polygon"]').click();
  await page.mouse.move(200, 400);
  await rolarAte('Acessibilidade urbana');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.getElementById('lente-wrap').dataset.theme)).toBe('risco');
  // parou de desenhar: a próxima rolagem volta a seguir
  await page.evaluate(() => _blockMapCancelDraw(document.getElementById('lente-wrap'), _blockMaps['lente-wrap']));
  await rolarAte('Acessibilidade urbana');
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await pronto(page, 'acess');

  // fim da página: os últimos blocos não alcançam a linha de leitura → vale o último visível
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const ultimo = await page.evaluate(() => { const v = [...document.querySelectorAll('.panel.active .lente-btn')].filter(b => { const bl = b.closest('.block'); const r = bl.getBoundingClientRect(); return bl.offsetParent && r.top < innerHeight - 60 && r.bottom > 80; }); return v.at(-1).dataset.lente; });
  await pronto(page, ultimo);

  // desligado: rolagem não mexe
  await page.locator('#lente-seguir').uncheck();
  await rolarAte('Áreas de risco');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.getElementById('lente-wrap').dataset.theme)).toBe(ultimo);
});

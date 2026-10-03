// tests/p1-sidebar.spec.js
// Regressão da sidebar do Mapa de Análise (P1.7, 2026-06-10): os 3 botões de
// desenho por camada (≈59 no total) foram substituídos por UMA barra de desenho
// contextual que age na camada ativa, selecionada clicando na linha.
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

test.describe('P1.7 — sidebar com barra de desenho contextual', () => {

  test('Barra única no topo; sidebar não repete botões por camada', async ({ page }) => {
    await abrirMapa(page);
    const r = await page.evaluate(() => ({
      barra: !!document.getElementById('ml-drawbar'),
      head: document.querySelector('.ml-drawbar-head')?.textContent || '',
      // botões de desenho na sidebar = só os da barra contextual (poucos), não ~59
      botoesNaSidebar: document.querySelectorAll('#ml-sidebar .ml-draw-btn').length,
      botoesNaBarra: document.querySelectorAll('#ml-drawbar .ml-draw-btn').length,
      grupos: document.querySelectorAll('#ml-layer-list details').length,
      ativaInicial: document.querySelector('.ml-layer-item.active-draw')?.id,
    }));
    expect(r.barra).toBe(true);
    expect(r.head).toContain('Desenhar em');
    expect(r.grupos).toBeGreaterThanOrEqual(6);
    expect(r.ativaInicial).toBe('layer-item-terreno'); // camada default
    // todos os botões de desenho da sidebar estão dentro da barra contextual
    expect(r.botoesNaSidebar).toBe(r.botoesNaBarra);
    expect(r.botoesNaBarra).toBeLessThanOrEqual(4); // só a camada ativa (≤3 geoms + extra)
  });

  test('Clicar na linha troca a camada ativa e a barra reflete', async ({ page }) => {
    await abrirMapa(page);
    // expandir todos os grupos recolhíveis (uso fica num grupo fechado por padrão)
    await page.evaluate(() => document.querySelectorAll('#ml-layer-list details').forEach(d => d.open = true));
    // clicar na linha de Usos do Solo (tem seletor de categoria extra)
    await page.locator('#layer-item-uso .ml-row').click();
    await page.waitForTimeout(200);
    const uso = await page.evaluate(() => ({
      head: document.querySelector('.ml-drawbar-head')?.textContent || '',
      ativa: document.querySelector('.ml-layer-item.active-draw')?.id,
      categoria: !!document.getElementById('uso-cat-sel'),
      geoms: [...document.querySelectorAll('#ml-drawbar .ml-draw-btn')].map(b => b.id).filter(Boolean),
    }));
    expect(uso.head).toContain('Usos do Solo');
    expect(uso.ativa).toBe('layer-item-uso');
    expect(uso.categoria).toBe(true); // seletor de categoria só aparece p/ uso
    expect(uso.geoms).toContain('btn-draw-uso-polygon');

    // trocar para viario: categoria some, head muda
    await page.locator('#layer-item-viario .ml-row').click();
    await page.waitForTimeout(200);
    const via = await page.evaluate(() => ({
      head: document.querySelector('.ml-drawbar-head')?.textContent || '',
      ativa: document.querySelector('.ml-layer-item.active-draw')?.id,
      categoria: !!document.getElementById('uso-cat-sel'),
      umaSoAtiva: document.querySelectorAll('.ml-layer-item.active-draw').length,
    }));
    expect(via.head).toContain('Sistema Viário');
    expect(via.ativa).toBe('layer-item-viario');
    expect(via.categoria).toBe(false);
    expect(via.umaSoAtiva).toBe(1);
  });

  test('Desenho pela barra contextual cria feição na camada ativa', async ({ page }) => {
    await abrirMapa(page);
    await page.locator('#layer-item-viario .ml-row').click();
    await page.waitForTimeout(200);
    await page.locator('#btn-draw-viario-polygon').click();
    await page.waitForTimeout(200);

    const estado = await page.evaluate(() => ({
      drawMode: _mlDraw && _mlDraw.mode,
      drawLayer: _mlDraw && _mlDraw.layerId,
      hint: getComputedStyle(document.getElementById('ml-draw-hint')).display !== 'none' && !document.getElementById('ml-draw-hint').dataset.ocioso,
      btnAtivo: document.querySelectorAll('.ml-draw-btn.active').length,
    }));
    expect(estado.drawMode).toBe('drawing');
    expect(estado.drawLayer).toBe('viario');
    expect(estado.hint).toBe(true);
    expect(estado.btnAtivo).toBe(1);

    await page.locator('#ml-map').scrollIntoViewIfNeeded(); // a faixa de estado do desenho fica fixa acima do mapa
    const box = await page.locator('#ml-map').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const antes = await page.evaluate(() => (_mlFeatures.viario || []).length);
    await page.mouse.click(cx - 50, cy + 30);
    await page.mouse.click(cx + 50, cy + 30);
    await page.mouse.click(cx, cy - 40);
    await page.mouse.dblclick(cx, cy - 40);
    await page.waitForFunction((a) => (_mlFeatures.viario || []).length > a, antes, { timeout: 6000 });
    const depois = await page.evaluate(() => (_mlFeatures.viario || []).length);
    expect(depois).toBeGreaterThan(antes);
  });
});

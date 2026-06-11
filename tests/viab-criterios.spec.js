// tests/viab-criterios.spec.js
// Viabilidade preliminar — avaliação multicritério dos terrenos (2026-06-11).
// Antes os critérios definidos pelo usuário eram decorativos: a avaliação dos
// candidatos só usava o CA. Agora: porta de viabilidade (CA) + pontuação 1–5
// por critério + escore médio + ranking + radar comparativo (SVG).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrirViabComDados(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-11').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    state.viab_criterios = ['Proximidade de transporte', 'Topografia suave', 'Ausência de risco', 'Custo do terreno'];
    state.viab_terrenos = [
      { id: 1, nome: 'Lote A', area: 500, scores: { 'Proximidade de transporte': 5, 'Topografia suave': 4, 'Ausência de risco': 4, 'Custo do terreno': 2 } },
      { id: 2, nome: 'Lote B', area: 1200, scores: { 'Proximidade de transporte': 2, 'Topografia suave': 5, 'Ausência de risco': 5, 'Custo do terreno': 5 } },
      { id: 3, nome: 'Lote C', area: 300, scores: { 'Proximidade de transporte': 4, 'Topografia suave': 3, 'Ausência de risco': 3, 'Custo do terreno': 4 } },
    ];
    document.getElementById('v-dim-ac').value = 800;
    document.getElementById('v-dim-ca').value = 2.0;
    calcularDimensionamento();
    renderViabilidade();
  });
  await page.waitForTimeout(400);
}

test.describe('Viabilidade — avaliação multicritério do terreno', () => {

  test('Porta de CA + escore por critério + ranking + radar', async ({ page }) => {
    await abrirViabComDados(page);
    const r = await page.evaluate(() => ({
      portas: state.viab_terrenos.map(t => _viabGateCA(t).status),
      medias: state.viab_terrenos.map(t => +_viabScore(t).media.toFixed(2)),
      ranking: (document.getElementById('v-terr-compara').textContent || '').includes('Ranking'),
      radarPolys: [...document.querySelectorAll('#v-terr-compara svg polygon')].filter(p => p.getAttribute('stroke-width') === '1.6').length,
      ponte: (document.getElementById('v-terr-compara').textContent || '').includes('ATDAU T01'),
      botoes: document.querySelectorAll('#v-terrenos-lista button[onclick^="setTerrenoScore"]').length,
    }));
    // Lote C: 300m² × CA 2 = 600 < 800 pretendido → não comporta
    expect(r.portas).toEqual(['cabe', 'cabe', 'nao-cabe']);
    expect(r.medias).toEqual([3.75, 4.25, 3.5]);
    expect(r.ranking).toBe(true);
    expect(r.radarPolys).toBe(3);           // 1 polígono por terreno pontuado
    expect(r.ponte).toBe(true);             // ponte para o T01 (passo downstream)
    expect(r.botoes).toBe(60);              // 3 terrenos × 4 critérios × 5 botões
  });

  test('Pontuar por clique atualiza a média (toggle)', async ({ page }) => {
    await abrirViabComDados(page);
    const antes = await page.evaluate(() => _viabScore(state.viab_terrenos[0]).media);
    // clicar o 1º botão de pontuação do 1º terreno (muda "Proximidade" de 5 p/ 1)
    await page.evaluate(() => document.querySelector('#v-terrenos-lista button[onclick^="setTerrenoScore"]').click());
    await page.waitForTimeout(200);
    const depois = await page.evaluate(() => _viabScore(state.viab_terrenos[0]).media);
    expect(depois).not.toBe(antes);
    // e persiste no state
    const persiste = await page.evaluate(() => typeof state.viab_terrenos[0].scores['Proximidade de transporte'] === 'number');
    expect(persiste).toBe(true);
  });

  test('Adicionar critério entra na pontuação dos candidatos', async ({ page }) => {
    await abrirViabComDados(page);
    const antes = await page.evaluate(() => document.querySelectorAll('#v-terrenos-lista button[onclick^="setTerrenoScore"]').length);
    await page.evaluate(() => { document.getElementById('v-criterio-input').value = 'Infraestrutura disponível'; addCriterioTerreno(); });
    await page.waitForTimeout(300);
    const depois = await page.evaluate(() => document.querySelectorAll('#v-terrenos-lista button[onclick^="setTerrenoScore"]').length);
    expect(depois).toBe(antes + 3 * 5); // +1 critério × 3 terrenos × 5 botões
  });
});

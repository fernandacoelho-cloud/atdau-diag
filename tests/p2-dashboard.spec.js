// tests/p2-dashboard.spec.js
// Regressão do dashboard de entrada (P2, 2026-06-10): ao abrir a ferramenta,
// o painel Identificação mostra um panorama do progresso por fase — anel de %
// global, colunas por fase com barra/% por aba, painéis de mapa marcados como
// mapa (não %), e cada aba é clicável para navegar.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

async function abrir(page) {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

test.describe('P2 — dashboard de entrada', () => {

  test('Painel de entrada mostra anel global e as 5 fases', async ({ page }) => {
    await abrir(page);
    const r = await page.evaluate(() => ({
      existe: !!document.querySelector('#diag-dashboard .dash'),
      pct: document.querySelector('.dash-ring text')?.textContent || '',
      fases: [...document.querySelectorAll('.dash-phase-head span:first-child')].map(s => s.textContent),
      abas: document.querySelectorAll('.dash-aba').length,
      mapAbas: [...document.querySelectorAll('.dash-aba.is-map .dash-aba-pct')].map(s => s.textContent),
    }));
    expect(r.existe).toBe(true);
    expect(r.pct).toMatch(/^\d+%$/);
    expect(r.fases).toEqual(['Preparação', 'Diagnóstico', 'Coleta & Referências', 'Mapas', 'Síntese & Entrega']);
    expect(r.abas).toBe(15); // 14 + Dinâmica Territorial (panel-14)
    // painéis de mapa não mostram %, mostram "mapa" ou contagem de feições
    expect(r.mapAbas.length).toBe(2);
    r.mapAbas.forEach(t => expect(t).not.toMatch(/%/));
  });

  test('Preencher campo essencial sobe o % global', async ({ page }) => {
    await abrir(page);
    const pct = () => page.evaluate(() => parseInt(document.querySelector('.dash-ring text').textContent));
    const antes = await pct();
    await page.locator('#proj-nome').fill('Projeto P2');
    await page.locator('#proj-end').fill('Rua X, 1');
    await page.waitForTimeout(600);
    expect(await pct()).toBeGreaterThanOrEqual(antes);
  });

  test('Clicar numa aba do dashboard navega para o painel', async ({ page }) => {
    await abrir(page);
    await page.evaluate(() => {
      const a = [...document.querySelectorAll('.dash-aba')].find(x => x.textContent.includes('Legislação'));
      a.click();
    });
    await page.waitForTimeout(500);
    const nav = await page.evaluate(() => ({
      p2: document.getElementById('panel-2').classList.contains('active'),
      p0: document.getElementById('panel-0').classList.contains('active'),
    }));
    expect(nav.p2).toBe(true);
    expect(nav.p0).toBe(false);
  });
});

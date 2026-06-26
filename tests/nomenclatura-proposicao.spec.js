// tests/nomenclatura-proposicao.spec.js
// Clareza de fluxo (ajuste barato): desfaz o overload de "Síntese". O painel 10 passa a ser
// "Proposição — Partido (Mapa-Síntese)" e a descrição distingue PROPOR (aqui) de LER/diagnosticar
// (Mapa de Análise + Síntese SWOT, aba 09). Evita a percepção de mapas/sínteses duplicados.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Nomenclatura: painel 10 é "Proposição — Partido", distinto da Síntese SWOT/Mapa de Análise', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);

  const panel = page.locator('#panel-10');
  const title = (await panel.locator('.sec-title').first().textContent()).trim();
  expect(title).toContain('Proposição');
  expect(title).toContain('Mapa-Síntese');
  expect(title).not.toContain('Partido e Diretrizes Projetuais'); // título antigo, ambíguo

  // a descrição posiciona a etapa: aqui se PROPÕE; a leitura fica no Mapa de Análise + Síntese SWOT
  const intro = await panel.locator('p').first().textContent();
  expect(intro).toMatch(/prop/i);
  expect(intro).toContain('Mapa de Análise');
  expect(intro).toContain('Síntese SWOT');
});

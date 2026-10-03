// tests/escopo-ui.spec.js
// Redesenho do Escopo (UX): troca o paredão de checkboxes por (1) cartões de nível,
// (2) chips por dimensão com contagem + barra de progresso, (3) controle bloco-a-bloco
// recolhido (progressive disclosure). Toda a função antiga continua por baixo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Escopo UI: cartões de nível, chips por dimensão e toggle de dimensão inteira', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);

  // 3 cartões de nível (buttons) + 8 chips de dimensão (04 fundida na 05 em 2026-10) + detalhe recolhido com checkboxes
  const base = await page.evaluate(() => ({
    cards: document.querySelectorAll('#escopo-niveis button[onclick^="escopoAplicarPreset"]').length,
    chips: document.querySelectorAll('#escopo-dimensoes > div').length,
    checks: document.querySelectorAll('#escopo-container input[type=checkbox]').length,
    detalheRecolhido: !document.querySelector('#escopo-block details').open,
  }));
  expect(base.cards).toBe(3);
  expect(base.chips).toBe(8);
  expect(base.checks).toBeGreaterThan(30);
  expect(base.detalheRecolhido).toBe(true);

  // aplicar Essencial → cartão fica ativo (✓), progresso e contador de dimensões refletem 1/8
  const ess = await page.evaluate(() => {
    escopoAplicarPreset('essencial');
    return {
      cardAtivo: [...document.querySelectorAll('#escopo-niveis button')].some(b => /Essencial/.test(b.textContent) && /✓/.test(b.textContent)),
      dim: document.getElementById('escopo-dim-contador').textContent,
      prog: document.getElementById('escopo-prog').style.width,
    };
  });
  expect(ess.cardAtivo).toBe(true);
  expect(ess.dim).toMatch(/^1 de 8/);

  // ligar uma dimensão inteira pelo chip (togglePanel) sobe a contagem e marca personalizado
  const tog = await page.evaluate(() => {
    escopoTogglePanel(14); // Dinâmica Territorial
    const p14 = [...document.querySelectorAll('#panel-14 .block[data-escopo-id]')].every(b => escopoBlocoAtivo(b.getAttribute('data-escopo-id')));
    return { dim: document.getElementById('escopo-dim-contador').textContent, p14, nivelCustom: (state.escopo.nivel == null) };
  });
  expect(tog.dim).toMatch(/^2 de 8/);
  expect(tog.p14).toBe(true);
  expect(tog.nivelCustom).toBe(true);
});

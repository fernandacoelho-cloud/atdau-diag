// tests/conceito-tooltip.spec.js
// Onda 1 de clareza (UX): padrao "conceito" (ⓘ) reutilizavel que explica
// funcionalidades de nome tecnico no hover (o que e · p/ que serve · ref). Aplicado
// a "Camadas p/ QGIS" (antigo "Pacote SEL"), ao mapa de atores (Mendelow) e ao VUE.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Conceito: "Pacote SEL" renomeado + tooltips de conceito (sel/mendelow/vue)', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  const r = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /Camadas p\/ QGIS/.test(b.textContent));
    // hover no conceito SEL -> popover explica SEL/QGIS
    const iSel = btn && btn.querySelector('.conceito-i');
    conceitoHover(iSel, 'sel');
    const popSel = document.querySelector('.info-popover.hover');
    const selOk = !!popSel && /Sistema de Espa/.test(popSel.textContent) && /QGIS/.test(popSel.textContent);
    hideInfo();
    // conceitos mendelow e vue existem com o texto certo
    const cM = CONCEITOS.mendelow, cV = CONCEITOS.vue;
    return {
      renomeado: !!btn,
      semPacoteSel: !/Pacote SEL/.test(document.body.textContent),
      selOk,
      mendelowI: !!document.querySelector('#panel-15 .conceito-i[onclick*="mendelow"]'),
      vueI: !!document.querySelector('#panel-7 .conceito-i[onclick*="vue"]'),
      mendelowRef: /Eden/.test(cM.body),
      vueRef: /UNESCO/.test(cV.body),
    };
  });
  expect(r.renomeado).toBe(true);
  expect(r.semPacoteSel).toBe(true);
  expect(r.selOk).toBe(true);
  expect(r.mendelowI).toBe(true);
  expect(r.vueI).toBe(true);
  expect(r.mendelowRef).toBe(true);
  expect(r.vueRef).toBe(true);
});

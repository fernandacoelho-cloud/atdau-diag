// tests/conceito-empty.spec.js
// Clareza (continuacao): (a) ⓘ "conceito" estendido a mais jargao — PFOA, APO,
// HECTTEAS, SbN; (b) empty states padronizados (_emptyState) que ensinam: o que e ·
// exemplo · proximo passo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Conceito estendido (PFOA/APO/HECTTEAS/SbN) + empty states padronizados', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);

  const r = await page.evaluate(() => {
    const conceitos = ['pfoa', 'apo', 'hectteas', 'sbn'].every(k => !!CONCEITOS[k]);
    const iPfoa = !!document.querySelector('#panel-7 .conceito-i[onclick*="pfoa"]');
    const iApo = !!document.querySelector('#panel-9 .conceito-i[onclick*="apo"]');
    const iHect = !!document.querySelector('#panel-0 .conceito-i[onclick*="hectteas"]');
    const iSbn = !!document.querySelector('#panel-6 .conceito-i[onclick*="sbn"]');
    // hover mostra o conceito (HECTTEAS -> Hershberger)
    conceitoHover(document.querySelector('#panel-0 .conceito-i[onclick*="hectteas"]'), 'hectteas');
    const hoverOk = /Hershberger/.test((document.querySelector('.info-popover.hover') || {}).textContent || '');
    hideInfo();
    // empty states padronizados: "Ex.:" e "→ proximo passo"
    govRender();
    const es = document.getElementById('gov-stakeholders-lista').textContent;
    return { conceitos, iPfoa, iApo, iHect, iSbn, hoverOk, emptyEx: /Ex\.:/.test(es), emptyNext: /→/.test(es) };
  });
  expect(r.conceitos).toBe(true);
  expect(r.iPfoa).toBe(true);
  expect(r.iApo).toBe(true);
  expect(r.iHect).toBe(true);
  expect(r.iSbn).toBe(true);
  expect(r.hoverOk).toBe(true);
  expect(r.emptyEx).toBe(true);
  expect(r.emptyNext).toBe(true);
});

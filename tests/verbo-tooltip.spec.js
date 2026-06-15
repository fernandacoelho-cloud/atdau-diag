// tests/verbo-tooltip.spec.js
// Verbos operativos (painel 08): tooltip de CONCEITO no hover do chip (descoberta
// fácil) + popover por clique no ⓘ. O texto é resolvido por id do verbo
// (verboHover/verboInfo) — evita o bug de aspas do JSON.stringify no atributo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Verbos: tooltip de conceito no hover + ⓘ por clique (lookup por id)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);
  await page.evaluate(() => { irPara(8, document.getElementById('nav-8')); if (typeof renderVerbos === 'function') renderVerbos(); });
  await page.waitForTimeout(400);

  const chip = page.locator('.verbo-chip', { hasText: 'Conectar' }).first();
  await chip.scrollIntoViewIfNeeded();
  await chip.hover();
  await page.waitForTimeout(250);
  const hov = await page.evaluate(() => {
    const pop = document.querySelector('.info-popover.hover');
    return { pop: !!pop, conceito: /Estabelecer liga/.test(pop ? pop.textContent : ''), label: /Conectar/.test(pop ? pop.textContent : '') };
  });
  expect(hov.pop).toBe(true);
  expect(hov.conceito).toBe(true);
  expect(hov.label).toBe(true);

  // sair fecha o tooltip de hover
  await page.mouse.move(5, 5);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => !document.querySelector('.info-popover.hover'))).toBe(true);

  // clique no ⓘ abre o popover (lookup por id; sem bug de aspas mesmo com texto longo)
  const click = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.verbo-chip')].find(c => /Enlaçar/.test(c.textContent));
    sel.querySelector('.verbo-info').click();
    const pop = document.querySelector('.info-popover');
    return { abriu: !!pop, texto: /Entrelaçar escalas/.test(pop ? pop.textContent : '') };
  });
  expect(click.abriu).toBe(true);
  expect(click.texto).toBe(true);
});

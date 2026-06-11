// tests/p2-modo.spec.js
// Regressão do Modo Campo/Escritório (P2, 2026-06-10): botão na topbar
// alterna entre Escritório (denso, 16px) e Campo (fontes maiores + alvos de
// toque, raiz 19px); a preferência persiste no navegador.
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
const estado = (page) => page.evaluate(() => ({
  raiz: Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize)),
  campo: document.documentElement.classList.contains('modo-campo'),
  rotulo: document.getElementById('btn-modo')?.textContent?.trim(),
  label: parseFloat(getComputedStyle(document.querySelector('.form-field label')).fontSize),
}));

test.describe('P2 — modo campo/escritório', () => {

  test('Alterna escritório ↔ campo e escala as fontes', async ({ page }) => {
    await abrir(page);
    const ini = await estado(page);
    expect(ini.raiz).toBe(16);
    expect(ini.campo).toBe(false);
    expect(ini.rotulo).toContain('Escritório');

    await page.locator('#btn-modo').click();
    await page.waitForTimeout(300);
    const campo = await estado(page);
    expect(campo.raiz).toBe(19);
    expect(campo.campo).toBe(true);
    expect(campo.rotulo).toContain('Campo');
    expect(campo.label).toBeGreaterThan(ini.label); // labels escalam junto

    await page.locator('#btn-modo').click();
    await page.waitForTimeout(300);
    const volta = await estado(page);
    expect(volta.raiz).toBe(16);
    expect(volta.campo).toBe(false);
  });

  test('Preferência de modo persiste no reload', async ({ page }) => {
    await abrir(page);
    await page.locator('#btn-modo').click(); // liga campo
    await page.waitForTimeout(1500);         // autosave debounce
    await page.reload();
    await page.waitForTimeout(1800);
    const r = await estado(page);
    expect(r.campo).toBe(true);
    expect(r.raiz).toBe(19);
    expect(r.rotulo).toContain('Campo');
  });
});

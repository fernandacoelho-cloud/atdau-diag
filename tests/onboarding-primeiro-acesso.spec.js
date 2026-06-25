// tests/onboarding-primeiro-acesso.spec.js
// Frente Onboarding/usabilidade (F+): no PRIMEIRO acesso a ferramenta abre o tour ("Como usar")
// automaticamente UMA vez (flag atdau-diag-onboarded no localStorage), com uma faixa de
// boas-vindas. Não dispara sob automação (navigator.webdriver) — assim os outros 118 testes
// não são afetados. A lógica é exercitada via _onboardingPrimeiroAcesso(force=true).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Primeiro acesso: tour abre uma vez + boas-vindas; guard de automação protege os testes', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);

  // guard de automação: sem force e sob webdriver, NÃO dispara (é o que protege os demais testes)
  const guard = await page.evaluate(() => {
    localStorage.removeItem('atdau-diag-onboarded');
    const abriu = _onboardingPrimeiroAcesso(false);
    return { webdriver: navigator.webdriver, abriu, modal: !!document.getElementById('tut-modal') };
  });
  expect(guard.webdriver).toBe(true);
  expect(guard.abriu).toBe(false);
  expect(guard.modal).toBe(false);

  // force=true: primeiro acesso abre o tour + grava a flag + mostra a faixa de boas-vindas
  const r1 = await page.evaluate(() => {
    localStorage.removeItem('atdau-diag-onboarded');
    const abriu = _onboardingPrimeiroAcesso(true);
    const m = document.getElementById('tut-modal');
    return {
      abriu,
      visivel: !!m && m.style.display !== 'none',
      flag: localStorage.getItem('atdau-diag-onboarded'),
      boasVindas: !!m && /Bem-vindo/.test(m.textContent),
      temPercursos: !!m && /Início rápido/.test(m.textContent),
    };
  });
  expect(r1.abriu).toBe(true);
  expect(r1.visivel).toBe(true);
  expect(r1.flag).toBe('1');
  expect(r1.boasVindas).toBe(true);
  expect(r1.temPercursos).toBe(true);   // reaproveita o tutorial existente (não duplica)

  // segunda vez: a flag impede reabrir sozinho
  const r2 = await page.evaluate(() => {
    fecharTutorial();
    const abriu = _onboardingPrimeiroAcesso(true);
    const m = document.getElementById('tut-modal');
    return { abriu, visivel: !!m && m.style.display !== 'none' };
  });
  expect(r2.abriu).toBe(false);
  expect(r2.visivel).toBe(false);

  // reabrir manualmente (botão "Como usar") NÃO mostra a faixa de boas-vindas
  const r3 = await page.evaluate(() => {
    abrirTutorial();
    const m = document.getElementById('tut-modal');
    return { visivel: !!m && m.style.display !== 'none', boasVindas: /Bem-vindo/.test(m.textContent) };
  });
  expect(r3.visivel).toBe(true);
  expect(r3.boasVindas).toBe(false);
});

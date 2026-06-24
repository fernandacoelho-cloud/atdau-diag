// tests/sobre-posicionamento.spec.js
// Frente "Sobre": (1) texto de POSICIONAMENTO — a ferramenta é usada no pré-projeto, antes da
// modelagem (CAD/BIM/SIG); não desenha massa (Forma/TestFit/Snaptrude/Modelur); (2) FUNDAMENTOS
// METODOLÓGICOS com referência verificável por termo (Tardin, Bertin, Lynch, Gehl, Clark&Pause,
// Rheingantz/APO, Problem Seeking/Peña, NBR 13531/13532). Tudo offline, no modal abrirSobre().
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Sobre: posicionamento (pré-projeto, antes da modelagem) + fundamentos com referência verificável', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(900);

  // abre o modal Sobre
  await page.evaluate(() => abrirSobre());
  await page.waitForTimeout(150);
  const modal = page.locator('#sobre-modal');
  await expect(modal).toBeVisible();

  const txt = await modal.textContent();

  // (1) Posicionamento — pré-projeto, antes da modelagem; não desenha massa
  expect(txt).toContain('Posicionamento');
  expect(txt).toMatch(/pré-projeto/i);
  expect(txt).toMatch(/antes da modelagem/i);
  expect(txt).toContain('CAD');
  expect(txt).toContain('BIM');
  expect(txt).toMatch(/Snaptrude|Modelur|TestFit|Forma/);
  // linguagem direta — sem o jargão de hidrologia
  expect(txt).not.toMatch(/montante|jusante/i);

  // (2) Fundamentos metodológicos — referência verificável por termo realmente usado na ferramenta
  expect(txt).toContain('Fundamentos metodológicos');
  for (const ref of ['Tardin', 'Bertin', 'Lynch', 'Gehl', 'Clark', 'Pause', 'Rheingantz', 'Peña', 'Conzen', 'NBR 13531']) {
    expect(txt, `referência ausente: ${ref}`).toContain(ref);
  }

  // pelo menos um link de fonte estável real (prolugar/UFRJ já verificado na ferramenta)
  const links = await modal.locator('a[href^="http"]').evaluateAll(as => as.map(a => a.href));
  console.log('Sobre links:', links);
  expect(links.some(h => /fau\.ufrj\.br\/prolugar/.test(h))).toBe(true);

  // fecha
  await page.evaluate(() => fecharSobre());
  await page.waitForTimeout(80);
  expect(await page.locator('#sobre-modal').evaluate(el => el.style.display)).toBe('none');
});

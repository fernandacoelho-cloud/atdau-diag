// tests/backbone-tipologia.spec.js
// Backbone tipologia × escopo: a tipologia escolhida na Identificação sugere um
// "Percurso de uso" (quais painéis do Escopo priorizar + módulos + campo CAU) e o
// botão "Aplicar percurso" aplica esse conjunto ao Escopo (reusa o motor de Escopo).
// Híbrido: o usuário ajusta tudo depois. Aqui validamos o cartão e a aplicação.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Backbone: tipologia "rota" mostra percurso e aplica ao Escopo os painéis certos', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // escolher a tipologia de recorte → cartão de percurso aparece
  const card = await page.evaluate(() => {
    const sel = document.getElementById('proj-tipologia-recorte');
    sel.value = 'rota';
    sel.dispatchEvent(new Event('change'));
    const box = document.getElementById('recorte-orientacao');
    return {
      visivel: box.style.display !== 'none',
      temPercurso: /Percurso de uso sugerido/.test(box.textContent || ''),
      temCAU: /Patrim/.test(box.textContent || ''),
      temBotao: !!box.querySelector('button[onclick*="aplicarPercursoTipologia"]'),
    };
  });
  expect(card.visivel).toBe(true);
  expect(card.temPercurso).toBe(true);
  expect(card.temCAU).toBe(true);
  expect(card.temBotao).toBe(true);

  // aplicar o percurso → rota prioriza os painéis [1,5,9,12,14] (a 04 foi fundida na 05); os demais saem do escopo
  const esc = await page.evaluate(() => {
    aplicarPercursoTipologia();
    _escopoAtribuirIds();
    const at = (n) => {
      const bl = document.querySelector('#panel-' + n + ' .block[data-escopo-id]');
      return bl ? escopoBlocoAtivo(bl.getAttribute('data-escopo-id')) : null;
    };
    return { p1: at(1), p5: at(5), p9: at(9), p12: at(12), p14: at(14), p2: at(2), p3: at(3), p11: at(11) };
  });
  // dentro do percurso
  expect(esc.p1).toBe(true);
  expect(esc.p5).toBe(true);
  expect(esc.p9).toBe(true);
  expect(esc.p12).toBe(true);
  expect(esc.p14).toBe(true);
  // fora do percurso
  expect(esc.p2).toBe(false);
  expect(esc.p3).toBe(false);
  expect(esc.p11).toBe(false);
});

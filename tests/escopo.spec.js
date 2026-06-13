// tests/escopo.spec.js
// 2026-06-13: ESCOPO (Fatia 1) — o usuário define quais análises (blocos) fará
// no painel de Identificação; a completude passa a ser relativa ao escopo, não à
// ferramenta inteira. Presets Essencial/Aprofundado/Pleno + toggle por bloco.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Escopo: checklist, presets e completude relativa ao escopo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  // checklist renderiza com presets e contador (default: tudo no escopo)
  const r1 = await page.evaluate(() => ({
    n: document.querySelectorAll('#escopo-container input[type=checkbox]').length,
    presets: document.querySelectorAll('#escopo-block button[onclick^="escopoAplicarPreset"]').length,
    contador: document.getElementById('escopo-contador')?.textContent || '',
  }));
  expect(r1.n).toBeGreaterThan(30);
  expect(r1.presets).toBe(3);
  expect(r1.contador).toMatch(/^\d+ de \d+ análises/);

  // preset Essencial → só painel 1 no escopo; painel 2 sai
  const r2 = await page.evaluate(() => {
    escopoAplicarPreset('essencial');
    return {
      p1: [...document.querySelectorAll('#panel-1 .block[data-escopo-id]')].every(b => escopoBlocoAtivo(b.getAttribute('data-escopo-id'))),
      p2: [...document.querySelectorAll('#panel-2 .block[data-escopo-id]')].some(b => escopoBlocoAtivo(b.getAttribute('data-escopo-id'))),
    };
  });
  expect(r2.p1).toBe(true);
  expect(r2.p2).toBe(false);

  // bloco de Legislação (fora do escopo) marca "fora do escopo" e não conta
  const r3 = await page.evaluate(() => {
    const ca = document.getElementById('l-ca'); if (ca) ca.value = '2.0';
    atualizarCompletude();
    const bloco = document.getElementById('l-ca').closest('.block');
    const badge = bloco.querySelector(':scope > .block-header .block-progress');
    return { fora: bloco.classList.contains('fora-escopo'), badge: badge?.textContent };
  });
  expect(r3.fora).toBe(true);
  expect(r3.badge).toBe('fora do escopo');

  // toggle individual de um bloco reduz a contagem
  const r4 = await page.evaluate(() => {
    escopoAplicarPreset('pleno');
    const antesTxt = document.getElementById('escopo-contador').textContent;
    const id = document.querySelector('#panel-1 .block[data-escopo-id]').getAttribute('data-escopo-id');
    escopoToggleBloco(id, false);
    return { antes: parseInt(antesTxt), depois: parseInt(document.getElementById('escopo-contador').textContent), off: !escopoBlocoAtivo(id) };
  });
  expect(r4.depois).toBe(r4.antes - 1);
  expect(r4.off).toBe(true);

  // persiste no reload
  await page.waitForTimeout(1400);
  await page.reload();
  await page.waitForTimeout(1700);
  const persist = await page.evaluate(() => {
    const id = document.querySelector('#panel-1 .block[data-escopo-id]')?.getAttribute('data-escopo-id');
    return state.escopo?.blocos?.[id] === false;
  });
  expect(persist).toBe(true);
});

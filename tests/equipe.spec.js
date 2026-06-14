// tests/equipe.spec.js
// 2026-06-13: EQUIPE (Fatia 1) — trabalho assíncrono. Cadastra colaboradores,
// atribui um responsável por análise (bloco), e na sessão de "sou X" os blocos
// de outros ficam somente-leitura (com override). Pendura no modelo de Escopo.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Equipe: colaboradores, atribuição, bloqueio do bloco do outro e override', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  // adicionar colaboradores + popular o select "sou"
  const colabs = await page.evaluate(() => {
    escopoAplicarPreset('pleno');
    equipeAddColab('Ana'); equipeAddColab('Bruno');
    return { n: state.equipe.colaboradores.length, opcoesSou: document.getElementById('equipe-sou').options.length };
  });
  expect(colabs.n).toBe(2);
  expect(colabs.opcoesSou).toBe(3); // — ninguém — + 2

  // atribuir bloco à Ana; sou = Bruno → bloco alheio (read-only + chip + override)
  const alheio = await page.evaluate(() => {
    const ana = state.equipe.colaboradores.find(c => c.nome === 'Ana').id;
    const bruno = state.equipe.colaboradores.find(c => c.nome === 'Bruno').id;
    const bloco = document.getElementById('l-ca').closest('.block');
    const escId = bloco.getAttribute('data-escopo-id');
    equipeSetResp(escId, ana); equipeSetSou(bruno); atualizarCompletude();
    return {
      alheio: bloco.classList.contains('bloco-alheio'),
      travado: getComputedStyle(document.getElementById('l-ca')).pointerEvents === 'none',
      chip: bloco.querySelector(':scope > .block-header .bloco-resp-chip')?.textContent || '',
      override: !!bloco.querySelector(':scope > .block-header .bloco-override'),
      meu: blocoMeu(escId),
    };
  });
  expect(alheio.alheio).toBe(true);
  expect(alheio.travado).toBe(true);
  expect(alheio.chip).toContain('Ana');
  expect(alheio.override).toBe(true);
  expect(alheio.meu).toBe(false);

  // "editar assim mesmo" libera
  const lib = await page.evaluate(() => {
    document.getElementById('l-ca').closest('.block').querySelector('.bloco-override').click();
    return getComputedStyle(document.getElementById('l-ca')).pointerEvents;
  });
  expect(lib).toBe('auto');

  // compartilhado (👥 todos) → todos editam
  const shared = await page.evaluate(() => {
    const escId = document.getElementById('l-ca').closest('.block').getAttribute('data-escopo-id');
    equipeSetResp(escId, 'shared');
    return blocoMeu(escId);
  });
  expect(shared).toBe(true);

  // controles de escopo/equipe não contam na completude
  const semBadge = await page.evaluate(() => {
    const eq = document.querySelector('#equipe-block > .block-header .block-progress');
    return !eq;
  });
  expect(semBadge).toBe(true);
});

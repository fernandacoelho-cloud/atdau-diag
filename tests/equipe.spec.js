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

test('Equipe: comentários por análise (autor + data, persistem)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  // o botão de comentário aparece sempre (serve para notas suas e da equipe)
  const semTeam = await page.evaluate(() => {
    escopoAplicarPreset('pleno'); atualizarCompletude();
    return !!document.getElementById('l-ca').closest('.block').querySelector('.coment-btn');
  });
  expect(semTeam).toBe(true);

  // com colaborador + "sou": botão aparece e o comentário carimba autor/data
  const c = await page.evaluate(() => {
    equipeAddColab('Ana'); equipeSetSou(state.equipe.colaboradores[0].id); atualizarCompletude();
    const bloco = document.getElementById('l-ca').closest('.block');
    const escId = bloco.getAttribute('data-escopo-id');
    const cbtn = bloco.querySelector(':scope > .block-header .coment-btn');
    equipeToggleComentarios(escId, cbtn);
    document.getElementById('coment-input-' + escId).value = 'Verificar zoneamento';
    equipeAddComentario(escId);
    const arr = state.equipe.comentarios[escId];
    return { botao: !!cbtn, n: arr.length, autor: arr[0]?.autor, temData: !!arr[0]?.data, badge: bloco.querySelector('.coment-btn').textContent, mural: (document.getElementById('equipe-mural').textContent || '').includes('Verificar zoneamento') };
  });
  expect(c.botao).toBe(true);
  expect(c.n).toBe(1);
  expect(c.autor).toBe('Ana');
  expect(c.temData).toBe(true);
  expect(c.badge).toContain('1');
  expect(c.mural).toBe(true); // o comentário aparece no mural global da Equipe

  // persiste no reload
  await page.waitForTimeout(1400);
  await page.reload();
  await page.waitForTimeout(1700);
  const persist = await page.evaluate(() => {
    const k = Object.keys(state.equipe?.comentarios || {})[0];
    return k ? state.equipe.comentarios[k][0]?.texto : null;
  });
  expect(persist).toBe('Verificar zoneamento');
});

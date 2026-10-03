// tests/tutorial-fluxo.spec.js
// 2026-10-03 · Tutorial visual: fluxo das 13 abas em 5 fases no topo do "Como usar", percursos na
// ordem nova (Diretrizes → Programação → Mapa-Síntese no fim) e o guia visual com prints, que abre
// DENTRO da ferramenta (modal), como o guia do processo do ATDAU Implantação.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Tutorial: fluxo em 5 fases e percursos em ordem', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL); await page.waitForTimeout(1200);
  await page.evaluate(() => abrirTutorial());
  const fluxo = page.locator('#tut-fluxo');
  await expect(fluxo).toBeVisible();
  // 15 nós (Identificação, Viabilidade + 13 abas), cada um leva à sua aba
  await expect(fluxo.locator('.tut-fluxo-no')).toHaveCount(15);
  await expect(fluxo.locator('a[href]')).toHaveCount(0);   // nada de outra página

  // percursos: os números das abas só crescem; Diretrizes antes de Programação; Mapa-Síntese por último
  for (const k of ['novato', 'avancado', 'pesquisador']) {
    const lbls = await page.evaluate(k => TUT_PERCURSOS[k].nos.map(n => n.lbl), k);
    const nums = lbls.map(l => (l.match(/^(\d\d) ·/) || [])[1]).filter(Boolean).map(Number);
    expect(nums, k).toEqual([...nums].sort((a, b) => a - b));
    expect(lbls[lbls.length - 1], k).toMatch(/13 · Mapa-Síntese/);
  }
  const av = await page.evaluate(() => TUT_PERCURSOS.avancado.nos.map(n => n.n));
  expect(av).toEqual(expect.arrayContaining([14, 15]));   // Dinâmica e Governança entraram

  // clicar num nó do fluxo fecha o tutorial e abre a aba
  await fluxo.locator('.tut-fluxo-no', { hasText: '11 Diretrizes' }).click();
  await expect(page.locator('#tut-modal')).toBeHidden();
  await expect(page.locator('#nav-8')).toHaveClass(/active/);
});

test('Guia visual abre na própria ferramenta, com prints, e leva à aba', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.goto(DIAG_URL); await page.waitForTimeout(1200);
  // pelo tutorial
  await page.evaluate(() => abrirTutorial());
  await page.locator('#tut-fluxo button', { hasText: 'Guia visual com prints' }).click();
  await expect(page.locator('#guia-modal')).toBeVisible();
  await expect(page.locator('#tut-modal')).toBeHidden();
  const info = await page.evaluate(async () => {
    const sh = document.querySelector('#guia-corpo').shadowRoot;
    const imgs = [...sh.querySelectorAll('img')];
    await Promise.all(imgs.map(i => i.decode().catch(() => {})));
    return { cards: sh.querySelectorAll('article[data-aba]').length, imgs: imgs.length,
             carregadas: imgs.filter(i => i.naturalWidth > 0).length, botoes: sh.querySelectorAll('button.ir-aba').length,
             cor: getComputedStyle(sh.querySelector('.num')).backgroundColor };
  });
  expect(info).toMatchObject({ cards: 14, imgs: 14, carregadas: 14, botoes: 14 });
  expect(info.cor).not.toBe('rgba(0, 0, 0, 0)');   // tokens do :host chegaram ao shadow DOM
  await page.keyboard.press('Escape');
  await expect(page.locator('#guia-modal')).toBeHidden();

  // pelo "📖 por quê?" da aba: abre no cartão daquela aba; "ir para a aba" volta para ela
  await page.locator('#nav-13').click(); await page.waitForTimeout(300);
  await page.locator('#panel-13 .fluxo-trilho .ft-guia').click();
  await expect(page.locator('#guia-modal')).toBeVisible();
  await page.waitForTimeout(200);
  const topo = await page.evaluate(() => {
    const sh = document.querySelector('#guia-corpo').shadowRoot, c = document.querySelector('#guia-corpo');
    return Math.abs(sh.querySelector('article[data-aba="13"]').getBoundingClientRect().top - c.getBoundingClientRect().top);
  });
  expect(topo).toBeLessThan(5);
  await page.evaluate(() => document.querySelector('#guia-corpo').shadowRoot.querySelector('article[data-aba="7"] button.ir-aba').click());
  await expect(page.locator('#guia-modal')).toBeHidden();
  await expect(page.locator('#nav-7')).toHaveClass(/active/);
  // toda aba do menu tem "por quê?" que cai num cartão do guia (Viabilidade → cartão 00)
  const semCartao = await page.evaluate(() => [...document.querySelectorAll('.sec-nav-item')].map(nv => +nv.id.slice(4)).filter(n => {
    irPara(n, document.getElementById('nav-' + n)); abrirGuia(n);
    const sh = document.querySelector('#guia-corpo').shadowRoot; fecharGuia();
    return !sh.querySelector(`article[data-aba="${n == 11 ? 0 : n}"]`) || !document.querySelector('#panel-' + n + ' .fluxo-trilho .ft-guia');
  }));
  expect(semCartao).toEqual([]);
});

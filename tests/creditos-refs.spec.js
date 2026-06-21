// tests/creditos-refs.spec.js
// Autoria/versao + referencias + mini tutorial:
//  - selo "v1.0-alpha" na topbar (abre o Sobre) + bloco "Sobre" com autoria de
//    Fernanda Fonseca de Melo Coelho (IFMG) e o texto de direitos autorais.
//  - referencia de Gehl no instrumento de qualidade urbana (12 criterios) e no
//    bloco "Referencias do Bairro - Identidade e Memoria Coletiva", este ultimo
//    citando tambem o Coletivo Micropolis alem de Rheingantz.
//  - "Como usar": botao Sobre/autoria + mini tutorial "Inicio rapido".
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Autoria/alpha + direitos + Gehl/Micropolis + mini tutorial', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // selo alpha + botao dedicado na topbar + modal Sobre com autoria/direitos
  const sobre = await page.evaluate(() => {
    const alpha = document.querySelector('.tb-alpha');
    const btnTop = !!document.querySelector('.topbar button[onclick="abrirSobre()"]');
    abrirSobre();
    const modal = document.getElementById('sobre-modal');
    const txt = modal ? modal.textContent : '';
    const vis = modal && modal.style.display !== 'none';
    fecharSobre();
    const fechou = (document.getElementById('sobre-modal') || {}).style.display === 'none';
    return {
      temAlpha: !!alpha,
      alphaTxt: alpha ? alpha.textContent : '',
      btnTop, vis, fechou,
      autoraFernanda: /Fernanda Fonseca de Melo Coelho/.test(txt),
      temIFMG: /IFMG Campus Santa Luzia/.test(txt),
      temDireitos: /DIREITOS AUTORAIS RESERVADOS/.test(txt) && /9\.610/.test(txt),
      versao: /v1\.0-alpha/.test(txt),
      semMicropolisNoSobre: !/Micrópolis/.test(txt), // autoria e da Fernanda; Micropolis fica nas refs
    };
  });
  expect(sobre.temAlpha).toBe(true);
  expect(sobre.alphaTxt).toMatch(/alpha/i);
  expect(sobre.btnTop).toBe(true);     // botao dedicado "Sobre · autoria" na topbar
  expect(sobre.vis).toBe(true);        // abrirSobre abre o modal
  expect(sobre.fechou).toBe(true);     // fecharSobre fecha
  expect(sobre.autoraFernanda).toBe(true);
  expect(sobre.temIFMG).toBe(true);
  expect(sobre.temDireitos).toBe(true);
  expect(sobre.versao).toBe(true);
  expect(sobre.semMicropolisNoSobre).toBe(true);

  // referencias: Gehl no instrumento de qualidade urbana; Rheingantz+Gehl+Micropolis na Identidade
  const refs = await page.evaluate(() => {
    const gehlCard = [...document.querySelectorAll('.instr-card')].find(c => /12 critérios de qualidade do lugar/.test(c.textContent));
    const gehlRef = gehlCard ? (gehlCard.querySelector('.instr-ref') || {}).textContent || '' : '';
    const idCard = [...document.querySelectorAll('.instr-card')].find(c => /Identidade e Memória Coletiva/.test(c.textContent));
    const idRef = idCard ? (idCard.querySelector('.instr-ref') || {}).textContent || '' : '';
    return {
      gehlNaQualidade: /Gehl/.test(gehlRef),
      idTemRheingantz: /Rheingantz/.test(idRef),
      idTemGehl: /Gehl/.test(idRef),
      idTemMicropolis: /Micrópolis/.test(idRef),
    };
  });
  expect(refs.gehlNaQualidade).toBe(true);
  expect(refs.idTemRheingantz).toBe(true);
  expect(refs.idTemGehl).toBe(true);
  expect(refs.idTemMicropolis).toBe(true);

  // "Como usar": abre, tem mini tutorial "Inicio rapido" e botao Sobre/autoria;
  // o selo alpha chama abrirSobre, que leva ao bloco Sobre (panel-8).
  const tut = await page.evaluate(() => {
    abrirTutorial();
    const corpo = (document.getElementById('tut-body') || {}).textContent || '';
    const modal = (document.getElementById('tut-modal') || {}).textContent || '';
    fecharTutorial();
    return {
      miniTutorial: /Início rápido/.test(corpo) && /5 passos/.test(corpo),
      copyrightNoModal: /Fernanda/.test(modal) && /v1\.0-alpha/.test(modal),
      abrirSobreFn: typeof abrirSobre === 'function',
    };
  });
  expect(tut.miniTutorial).toBe(true);
  expect(tut.copyrightNoModal).toBe(true);
  expect(tut.abrirSobreFn).toBe(true);
});

// tests/p1.spec.js
// Regressão do pacote P1 (2026-06-10): navegação agrupada por fase de
// trabalho + indicador de completude por bloco e por aba.
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

test.describe('P1 — navegação agrupada e completude', () => {

  test('Nav tem 5 grupos de fase e mantém a ordem/ids dos itens', async ({ page }) => {
    await abrir(page);
    const grupos = await page.evaluate(() => [...document.querySelectorAll('.sec-nav-group')].map(g => g.textContent.trim()));
    expect(grupos).toEqual(['Preparação', 'Levantamento documental', 'Levantamento de campo', 'Análise & Síntese', 'Proposição & Entrega']);

    // ids preservados (testes e navegação dependem deles) e na ordem do fluxo
    // 2026-10 (Fase 3): aba 04 fundida na 05; Dinâmica (nav-14) abre o levantamento documental;
    // Mapa de Análise (nav-6) antes das Obras Análogas (nav-12); Mapa-Síntese (nav-10) no final
    const ids = await page.evaluate(() => [...document.querySelectorAll('.sec-nav-item')].map(n => n.id));
    expect(ids).toEqual(['nav-0','nav-11','nav-14','nav-1','nav-2','nav-3','nav-5','nav-9','nav-15','nav-6','nav-12','nav-7','nav-8','nav-13','nav-10']);

    // cada item ainda navega para o painel certo (amostra)
    await page.locator('#nav-1').click();
    await page.waitForTimeout(400);
    expect(await page.locator('#panel-1').isVisible()).toBe(true);
  });

  test('Completude por aba reage a campo e a rating', async ({ page }) => {
    await abrir(page);

    // campo de texto em Identificação
    const navPct = () => page.evaluate(() => {
      const t = document.getElementById('nav-0').querySelector('.nav-pct')?.textContent || '0%';
      return parseInt(t);
    });
    const antes = await navPct();
    await page.locator('#proj-nome').fill('Projeto Regressao P1');
    await page.waitForTimeout(600);
    const depois = await navPct();
    expect(depois).toBeGreaterThan(antes);

    // badge do bloco que contém #proj-nome reflete o preenchimento
    const badge = await page.evaluate(() => {
      const b = document.getElementById('proj-nome').closest('.block').querySelector(':scope > .block-header .block-progress');
      return b ? b.textContent : null;
    });
    expect(badge).toMatch(/^\d+\/\d+$/);
    const [ok, total] = badge.split('/').map(Number);
    expect(ok).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(ok);

    // rating em Contexto Urbano também conta
    await page.locator('#nav-1').click();
    await page.waitForTimeout(700);
    const rAntes = await page.evaluate(() => parseInt(document.getElementById('nav-1').querySelector('.nav-pct')?.textContent || '0'));
    await page.evaluate(() => document.querySelector('#panel-1 .rating-group .r-btn')?.click());
    await page.waitForTimeout(600);
    const rDepois = await page.evaluate(() => parseInt(document.getElementById('nav-1').querySelector('.nav-pct')?.textContent || '0'));
    expect(rDepois).toBeGreaterThanOrEqual(rAntes);
  });

  test('Badge fica "full" quando o bloco está completo e módulo inativo não conta', async ({ page }) => {
    await abrir(page);
    await page.locator('#nav-1').click();
    await page.waitForTimeout(700);

    // preencher TODOS os campos do bloco "Localização e inserção urbana"
    const fullState = await page.evaluate(() => {
      const bloco = [...document.querySelectorAll('#panel-1 .block')]
        .find(b => (b.querySelector('.block-title')?.textContent || '').includes('Localização'));
      if (!bloco) return { erro: 'bloco não achado' };
      bloco.querySelectorAll('input[type=text], textarea, select').forEach(el => {
        if (el.closest('.block-map-wrap')) return;
        el.value = 'preenchido';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return { ok: true };
    });
    expect(fullState.ok).toBe(true);
    await page.waitForTimeout(600);
    const badge = await page.evaluate(() => {
      const bloco = [...document.querySelectorAll('#panel-1 .block')]
        .find(b => (b.querySelector('.block-title')?.textContent || '').includes('Localização'));
      const b = bloco.querySelector(':scope > .block-header .block-progress');
      return { texto: b.textContent, full: b.classList.contains('full') };
    });
    const [ok, total] = badge.texto.split('/').map(Number);
    expect(ok).toBe(total);
    expect(badge.full).toBe(true);

    // módulo inativo não entra na contagem; ativar parcelamento aumenta o total da aba
    const escopo = await page.evaluate(() => {
      const tot = () => _contarPreenchimento(document.getElementById('panel-1')).total;
      const semMod = tot();
      setModule('parcelamento');
      const comMod = tot();
      return { semMod, comMod };
    });
    expect(escopo.comMod).toBeGreaterThan(escopo.semMod);
  });

  test('Completude pondera por tipo: observações/notas ficam fora do denominador', async ({ page }) => {
    await abrir(page);
    // bloco-sonda em memória: 2 estruturados + 1 textarea + 1 input "obs"
    const r = await page.evaluate(() => {
      const div = document.createElement('div');
      div.className = 'block';
      div.innerHTML = `
        <input id="probe-a" type="text">
        <select id="probe-b"><option value="">x</option><option value="y">y</option></select>
        <textarea id="probe-notas"></textarea>
        <input id="probe-obs" type="text">`;
      document.body.appendChild(div);
      const antes = _contarPreenchimento(div); // só os 2 estruturados contam
      div.querySelector('#probe-a').value = 'preenchido';
      const aposEstruturado = _contarPreenchimento(div);
      div.querySelector('#probe-notas').value = 'uma nota longa';
      div.querySelector('#probe-obs').value = 'observação';
      const aposNotas = _contarPreenchimento(div);
      div.remove();
      return { antes, aposEstruturado, aposNotas };
    });
    expect(r.antes.total).toBe(2);            // textarea + input "obs" fora do denominador
    expect(r.antes.ok).toBe(0);
    expect(r.aposEstruturado.ok).toBe(1);     // preencher estruturado sobe ok
    expect(r.aposNotas).toEqual(r.aposEstruturado); // preencher notas NÃO muda a contagem
  });

  test('Bloco só de notas: fallback conta as notas (não fica sem progresso)', async ({ page }) => {
    await abrir(page);
    const r = await page.evaluate(() => {
      const div = document.createElement('div');
      div.className = 'block';
      div.innerHTML = `<textarea id="probe-only-1"></textarea><textarea id="probe-only-2"></textarea>`;
      document.body.appendChild(div);
      const antes = _contarPreenchimento(div);
      div.querySelector('#probe-only-1').value = 'algo';
      const depois = _contarPreenchimento(div);
      div.remove();
      return { antes, depois };
    });
    expect(r.antes.total).toBe(2);  // fallback: as 2 notas contam
    expect(r.depois.ok).toBe(1);
  });
});

// tests/analogas-disc.spec.js
// Descoberta do editor de análise gráfica em Obras Análogas (2026-06-11):
// antes o editor "desenhar sobre imagem" estava atrás de 3 passos (adicionar
// obra → selecionar no dropdown → ativar sub-tema). Agora: ao adicionar a obra
// ela é auto-selecionada; um banner explica o atalho; e cada tema tem um ✏️ que
// abre o editor direto (1 clique).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test.describe('Obras Análogas — descoberta do editor gráfico', () => {

  test('Adicionar obra auto-seleciona, mostra banner e botões ✏️', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.locator('#nav-12').click();
    await page.waitForTimeout(500);

    await page.locator('#an-nome').fill('Casa de Vidro');
    await page.evaluate(() => addAnaloga());
    await page.waitForTimeout(400);

    const r = await page.evaluate(() => {
      const sel = document.getElementById('an-analise-sel');
      const panel = document.getElementById('an-analise-panel');
      return {
        selecionada: sel?.options[sel.selectedIndex]?.text,
        banner: (panel?.textContent || '').includes('Para desenhar sobre uma imagem'),
        lapis: panel ? [...panel.querySelectorAll('button')].filter(b => b.textContent.trim() === '✏️').length : 0,
      };
    });
    expect(r.selecionada).toBe('Casa de Vidro'); // auto-selecionada
    expect(r.banner).toBe(true);
    expect(r.lapis).toBeGreaterThan(0); // atalho de desenho em cada tema
  });

  test('Clicar ✏️ abre o editor gráfico direto (1 clique)', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.locator('#nav-12').click();
    await page.waitForTimeout(500);
    await page.locator('#an-nome').fill('Pavilhão Teste');
    await page.evaluate(() => addAnaloga());
    await page.waitForTimeout(400);

    await page.evaluate(() => {
      const panel = document.getElementById('an-analise-panel');
      const lapis = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === '✏️');
      lapis.click();
    });
    await page.waitForTimeout(400);

    const editor = await page.evaluate(() => {
      const m = document.getElementById('ag-modal');
      return {
        aberto: !!m && getComputedStyle(m).display !== 'none',
        upload: !!document.getElementById('ag-file'),
        ferramentas: !!document.getElementById('ag-tools'),
        agState: typeof AG_STATE !== 'undefined' && !!AG_STATE,
      };
    });
    expect(editor.aberto).toBe(true);
    expect(editor.upload).toBe(true);
    expect(editor.ferramentas).toBe(true);
    expect(editor.agState).toBe(true);

    // o sub-tema foi ativado pelo atalho (vira um card "ativo")
    await page.evaluate(() => agFechar());
    await page.waitForTimeout(200);
    const ativou = await page.evaluate(() => {
      const obra = (state.analogas || []).find(o => o.nome === 'Pavilhão Teste');
      return obra && obra.analise ? Object.keys(obra.analise).length : 0;
    });
    expect(ativou).toBeGreaterThan(0);
  });
});

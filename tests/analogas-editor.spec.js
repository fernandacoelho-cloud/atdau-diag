// tests/analogas-editor.spec.js
// Bug crítico (2026-06-11): o SVG do editor de análise gráfica colapsava a ~2px
// (viewBox sem width/height dentro de um flex-item shrink-to-fit) — a imagem
// "não carregava" e não dava para desenhar, embora o estado fosse atualizado.
// Fix: width/height explícitos + width:100% no SVG e largura no host.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAYAAADdDyyrAAAAHElEQVR42mNkYPj/n4EIwDiqkH4Kh1xJAcwBAEXjBf3pT0p1AAAAAElFTkSuQmCC', 'base64');

test('Editor gráfico: SVG tem tamanho usável e o desenho aparece', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.locator('#nav-12').click();
  await page.waitForTimeout(400);
  await page.locator('#an-nome').fill('Obra Editor');
  await page.evaluate(() => addAnaloga());
  await page.waitForTimeout(400);
  // abrir editor pelo atalho ✏️
  await page.evaluate(() => {
    const panel = document.getElementById('an-analise-panel');
    [...panel.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('✏️')).click();
  });
  await page.waitForTimeout(400);

  // upload real de imagem
  await page.locator('#ag-file').setInputFiles({ name: 'f.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForTimeout(500);

  const svg = await page.evaluate(() => {
    const el = document.getElementById('ag-svg');
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), temImage: !!el.querySelector('image') };
  });
  expect(svg.temImage).toBe(true);
  expect(svg.w).toBeGreaterThan(300);   // NÃO colapsado (antes era ~2px)
  expect(svg.h).toBeGreaterThan(200);

  // desenhar 2 pontos com o mouse real e conferir que renderizam
  await page.evaluate(() => agSelecionarFerramenta('ponto'));
  await page.waitForTimeout(150);
  const box = await page.locator('#ag-svg').boundingBox();
  const antes = await page.evaluate(() => AG_STATE.diagrama.marks.length);
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.55);
  await page.waitForTimeout(300);
  const depois = await page.evaluate(() => ({ marks: AG_STATE.diagrama.marks.length, render: document.querySelectorAll('#ag-svg circle').length }));
  expect(depois.marks).toBe(antes + 2);
  expect(depois.render).toBeGreaterThanOrEqual(2); // marcas visíveis no SVG
});

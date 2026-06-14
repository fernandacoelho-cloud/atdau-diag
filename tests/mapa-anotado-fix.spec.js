// tests/mapa-anotado-fix.spec.js
// 2026-06-13: dois bugs que travavam o Mapa Anotado (panel-9 urbana), dirigindo
// a UI como o usuário (cliques reais, não chamadas de função):
//  (1) no modo "Adicionar", clicar uma categoria não a selecionava — o onclick
//      só checava shiftKey, nunca o modo. Sem categoria, o clique no mapa não
//      criava nada.
//  (2) o modal de edição nunca abria: o #ma-modal tinha display:none INLINE, que
//      vencia a classe .ma-modal.open{display:flex}.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Mapa Anotado: adicionar e editar funcionam pela UI real', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1280, height: 1000 }); // mapa de 480px cabe sem cair fora da dobra
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('ma-mapa')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(900);

  // (1) modo Adicionar + clique normal na categoria → categoria selecionada
  await page.locator('.ma-mode-btn[data-mode="add"]').click();
  await page.waitForTimeout(200);
  await page.locator('.ma-cat-chip').first().click(); // clique NORMAL (sem shift)
  await page.waitForTimeout(200);
  const addCat = await page.evaluate(() => _maAddCategory);
  expect(addCat).toBeTruthy(); // antes do fix ficava null

  // clicar no mapa cria a anotação
  const antes = await page.evaluate(() => MapaAnotadoStore.getAll().length);
  const box = await page.locator('#ma-mapa canvas').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(700);
  const depois = await page.evaluate(() => MapaAnotadoStore.getAll().length);
  expect(depois).toBe(antes + 1);

  // (2) o modal de edição abre (display != none)
  const modalAberto = await page.evaluate(() => {
    const m = document.getElementById('ma-modal');
    return m.classList.contains('open') && getComputedStyle(m).display !== 'none';
  });
  expect(modalAberto).toBe(true);

  // editar pela lista também abre o modal
  await page.evaluate(() => maCloseModal());
  await page.waitForTimeout(200);
  const editouLista = await page.evaluate(() => {
    document.querySelector('.ma-lista-item').click();
    const m = document.getElementById('ma-modal');
    return m.classList.contains('open') && getComputedStyle(m).display !== 'none';
  });
  expect(editouLista).toBe(true);

  // modo Ver: clique normal ainda alterna a visibilidade da categoria (não regrediu)
  const toggle = await page.evaluate(() => {
    maCloseModal(); maSetMode('view');
    const cat = MA_CATEGORIES[0].id;
    const a = MapaAnotadoStore.isCategoryActive(cat);
    document.querySelector('.ma-cat-chip').click();
    return a !== MapaAnotadoStore.isCategoryActive(cat);
  });
  expect(toggle).toBe(true);
});

test('Mapa Anotado: anexar foto à anotação (multimodal) persiste + miniatura na lista', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('ma-mapa')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);

  await page.evaluate(() => { const id = MapaAnotadoStore.add({ category: 'foto', title: 'Esquina', coords: [-43.8, -19.7] }); maOpenEditModal(id); });

  // anexar uma imagem real pelo input de arquivo
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#ma-edit-foto-input', { name: 'f.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => document.querySelectorAll('#ma-edit-fotos img').length)).toBe(1);

  const r = await page.evaluate(() => {
    maSaveCurrent();
    const ann = MapaAnotadoStore.getAll().find(a => a.title === 'Esquina');
    const thumb = !![...document.querySelectorAll('.ma-lista-item')].find(el => /Esquina/.test(el.textContent) && el.querySelector('img'));
    return { n: (ann?.fotos || []).length, dataUrl: /^data:image/.test(ann?.fotos?.[0] || ''), thumb };
  });
  expect(r.n).toBe(1);
  expect(r.dataUrl).toBe(true);
  expect(r.thumb).toBe(true);

  // persiste no reload
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForTimeout(1500);
  const persist = await page.evaluate(() => (MapaAnotadoStore.getAll().find(a => a.title === 'Esquina')?.fotos || []).length);
  expect(persist).toBe(1);
});

test('Mapa Anotado: clicar no marcador (modo Ver) abre popup de leitura com texto e foto', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);
  await page.locator('#nav-9').click();
  await page.waitForTimeout(900);
  await page.evaluate(() => document.getElementById('ma-mapa')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const id = MapaAnotadoStore.add({ category: 'tombado', title: 'Igreja Matriz', description: 'bem tombado', notes: 'fachada', coords: [-43.8, -19.7], fotos: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='] });
    _maMode = 'view';
    maOpenPopup(MapaAnotadoStore.getAll().find(a => a.id === id));
    const pop = document.querySelector('.maplibregl-popup');
    return { abriu: !!pop, titulo: /Igreja Matriz/.test(pop?.textContent || ''), desc: /bem tombado/.test(pop?.textContent || ''), foto: !!pop?.querySelector('img'), editar: !!pop?.querySelector('button') };
  });
  expect(r.abriu).toBe(true);
  expect(r.titulo).toBe(true);
  expect(r.desc).toBe(true);
  expect(r.foto).toBe(true);
  expect(r.editar).toBe(true);
});

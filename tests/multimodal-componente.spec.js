// tests/multimodal-componente.spec.js
// Multimodal D: componente reutilizável (texto+foto+áudio) montado declarativamente em
// instrumentos de campo (Gehl 12 critérios, observação do entorno, walk-through APO).
// Reusa _imgToDataURL/_fileToDataURL; persiste em MMStore (localStorage atdau-diag-multimodal,
// incluído em PROJ_STORES → viaja no export). Testa montagem, nota, upload de foto/áudio e remoção.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

// PNG 1×1 válido (para _imgToDataURL desenhar no canvas)
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('Multimodal: widget montado nos instrumentos; nota + foto + áudio persistem no MMStore', async ({ page }) => {
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // os 3 instrumentos receberam o widget (montado no init)
  for (const key of ['instr:gehl-12', 'instr:observacao', 'instr:walk-through-nbr']) {
    const w = page.locator(`[data-multimodal="${key}"]`);
    await expect(w).toHaveAttribute('data-mm-ready', '1');
    await expect(w.locator('.mm-nota')).toHaveCount(1);
    await expect(w.locator('.mm-foto-btn')).toHaveCount(1);
    await expect(w.locator('.mm-rec-btn')).toHaveCount(1);
    await expect(w.locator('.mm-aud-btn')).toHaveCount(1);
  }

  // o store está no pacote de export (viaja no .atdau.json)
  const noExport = await page.evaluate(() => PROJ_STORES.includes('atdau-diag-multimodal'));
  expect(noExport).toBe(true);

  const gehl = page.locator('[data-multimodal="instr:gehl-12"]');

  // nota persiste no MMStore + localStorage (instrumento fica em subpainel oculto →
  // dirige o DOM via input event em vez de fill, que exige visibilidade)
  await page.evaluate(() => {
    const t = document.querySelector('[data-multimodal="instr:gehl-12"] .mm-nota');
    t.value = 'Calçada estreita no trecho norte; ruído do tráfego alto.';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const nota = await page.evaluate(() => ({
    mem: MMStore.data['instr:gehl-12'].nota,
    ls: JSON.parse(localStorage.getItem('atdau-diag-multimodal'))['instr:gehl-12'].nota,
  }));
  expect(nota.mem).toContain('Calçada estreita');
  expect(nota.ls).toContain('Calçada estreita');

  // upload de foto (downscale via _imgToDataURL) → thumbnail + persistência
  await gehl.locator('.mm-foto-input').setInputFiles({ name: 'campo.png', mimeType: 'image/png', buffer: PNG_1x1 });
  await page.waitForFunction(() => MMStore.data['instr:gehl-12'].fotos.length === 1, null, { timeout: 5000 });
  await expect(gehl.locator('.mm-fotos img')).toHaveCount(1);
  const fotoData = await page.evaluate(() => MMStore.data['instr:gehl-12'].fotos[0].slice(0, 11));
  expect(fotoData).toBe('data:image/');

  // upload de áudio (caminho de upload, sem MediaRecorder) → player + persistência
  await gehl.locator('.mm-aud-input').setInputFiles({ name: 'nota.webm', mimeType: 'audio/webm', buffer: Buffer.from('fake-audio-bytes') });
  await page.waitForFunction(() => MMStore.data['instr:gehl-12'].audios.length === 1, null, { timeout: 5000 });
  await expect(gehl.locator('.mm-audios audio')).toHaveCount(1);

  // remoção de foto (clique real no botão, via DOM por estar oculto)
  await page.evaluate(() => document.querySelector('[data-multimodal="instr:gehl-12"] .mm-foto-del').click());
  await page.waitForFunction(() => MMStore.data['instr:gehl-12'].fotos.length === 0, null, { timeout: 5000 });
  await expect(gehl.locator('.mm-fotos img')).toHaveCount(0);

  // isolamento: a foto/áudio do Gehl não vazou para outro instrumento
  const outro = await page.evaluate(() => {
    const e = MMStore.data['instr:observacao'];
    return { fotos: (e && e.fotos || []).length, audios: (e && e.audios || []).length };
  });
  expect(outro).toEqual({ fotos: 0, audios: 0 });
});

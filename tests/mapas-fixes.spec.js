// tests/mapas-fixes.spec.js
// Correcoes de QA em mapas/desenho/edicao reportadas pela usuaria:
//  (1) Mapa Anotado: gravacao de audio nao desligava o microfone ao fechar/salvar
//      -> maStopRecording para o recorder e libera o stream (+ guard de corrida).
//  (2) Mapa Anotado: modo Adicionar mostrava "maozinha" e nada criava -> cursor
//      crosshair so quando em add COM categoria.
//  (3) Mapa de Analise: desenho iniciado e nao concluido travava a edicao/cor das
//      feicoes -> botao de desenho vira toggle (clicar de novo PARA).
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test('Mapas: gravacao libera mic, cursor do Adicionar, toggle do desenho', async ({ page }) => {
  page.on('dialog', d => d.accept().catch(() => {}));
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(DIAG_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1700);

  // (1) gravacao: maStopRecording para o recorder (fake) e, em voo, aborta + libera o stream
  const rec = await page.evaluate(() => {
    _maRec = { state: 'recording', stop() { this.state = 'inactive'; } };
    maStopRecording();
    const recStopped = _maRec.state === 'inactive';
    let tracksStopped = 0;
    _maRec = null;
    _maRecStream = { getTracks() { return [{ stop() { tracksStopped++; } }]; } };
    maStopRecording();
    return { recStopped, abort: _maRecAbort === true, streamLimpo: _maRecStream === null, tracksStopped };
  });
  expect(rec.recStopped).toBe(true);
  expect(rec.abort).toBe(true);
  expect(rec.streamLimpo).toBe(true);
  expect(rec.tracksStopped).toBe(1);

  // (2) Mapa Anotado: cursor crosshair so em add+categoria
  await page.locator('#nav-9').click();
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('ma-mapa')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => typeof _maInst !== 'undefined' && _maInst && _maInst.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const cur = await page.evaluate(() => {
    _maAddCategory = 'tombado'; maSetMode('add'); const add = _maInst.getCanvas().style.cursor;
    maSetMode('view'); const view = _maInst.getCanvas().style.cursor;
    _maAddCategory = null; maSetMode('add'); const semCat = _maInst.getCanvas().style.cursor;
    return { add, view, semCat };
  });
  expect(cur.add).toBe('crosshair');
  expect(cur.view).toBe('');
  expect(cur.semCat).toBe('');

  // (3) Mapa de Analise: toggle do desenho (clicar de novo cancela)
  await page.evaluate(() => irPara(6, document.getElementById('nav-6')));
  await page.waitForFunction(() => typeof _mlMap !== 'undefined' && _mlMap && _mlMap.isStyleLoaded(), null, { timeout: 20000 });
  await page.waitForTimeout(400);
  const draw = await page.evaluate(() => {
    mlSelectDraw('notas', 'polyline'); const on = _mlDraw.mode;
    mlSelectDraw('notas', 'polyline'); const off = _mlDraw.mode;
    mlCancelDraw();
    return { on, off };
  });
  expect(draw.on).toBe('drawing');
  expect(draw.off).toBe(null);
});

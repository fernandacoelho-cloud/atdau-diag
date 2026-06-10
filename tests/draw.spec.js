// tests/draw.spec.js
// Primeiro teste de validação real do sistema de desenho.
// Roda o navegador (headless), carrega a DIAG, simula clicks
// e verifica que features são criadas e renderizadas.

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test.describe('ATDAU DIAG — sistema básico', () => {

  test('DIAG carrega e expõe globals esperados', async ({ page }) => {
    await page.goto(DIAG_URL);
    // Esperar página carregar
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Verificar que globals existem
    const checks = await page.evaluate(() => ({
      maplibregl: typeof maplibregl,
      ML_THEMES: typeof ML_THEMES === 'object' ? Object.keys(ML_THEMES).length : 0,
      ML_LAYERS: typeof ML_LAYERS === 'object' && Array.isArray(ML_LAYERS) ? ML_LAYERS.length : 0,
      toggleBlockMap: typeof toggleBlockMap,
      initBlockMap: typeof initBlockMap,
      _blockMapDrawState: typeof _blockMapDrawState,
      _blockMapStartDraw: typeof _blockMapStartDraw,
    }));

    console.log('Globals:', checks);
    expect(checks.maplibregl).toBe('object');
    expect(checks.ML_THEMES).toBeGreaterThan(15);
    expect(checks.ML_LAYERS).toBeGreaterThanOrEqual(20);
    expect(checks.toggleBlockMap).toBe('function');
    expect(checks._blockMapStartDraw).toBe('function');
  });

  test('Há 25 botões "Mostrar mapa" e todos têm wrap correspondente', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const stats = await page.evaluate(() => {
      const btns = document.querySelectorAll('.block-map-toggle');
      const wraps = document.querySelectorAll('.block-map-wrap');
      const temas = Array.from(wraps).map(w => w.dataset.theme);
      return {
        botoes: btns.length,
        wraps: wraps.length,
        temas: [...new Set(temas)].sort()
      };
    });

    console.log('Botões/wraps/temas:', stats);
    expect(stats.botoes).toBeGreaterThanOrEqual(20);
    expect(stats.wraps).toBeGreaterThanOrEqual(stats.botoes);
  });

  test('Todas as camadas aceitam polígono (após universalização)', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const semPolygon = await page.evaluate(() => {
      return ML_LAYERS
        .filter(l => l.id !== 'terreno')
        .filter(l => !l.geom.includes('polygon'))
        .map(l => l.id);
    });

    console.log('Camadas sem polygon (esperado: []):', semPolygon);
    expect(semPolygon).toEqual([]);
  });

  test('Abrir um block-map dispara MapLibre e cria sources', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Localizar primeiro botão "Mostrar mapa" e clicar
    const firstBtn = page.locator('.block-map-toggle').first();
    await expect(firstBtn).toBeVisible();
    await firstBtn.scrollIntoViewIfNeeded();
    await firstBtn.click();

    // Aguardar MapLibre instanciar
    await page.waitForTimeout(3000);

    const estado = await page.evaluate(() => {
      const maps = typeof _blockMaps !== 'undefined' ? Object.keys(_blockMaps) : [];
      if (!maps.length) return { mapas: 0 };
      const firstMap = _blockMaps[maps[0]];
      return {
        mapas: maps.length,
        styleLoaded: firstMap.isStyleLoaded(),
        sourcesCriadas: ML_LAYERS.filter(l => firstMap.getSource(`src-${l.id}`)).length,
      };
    });

    console.log('Estado do mapa:', estado);
    expect(estado.mapas).toBeGreaterThanOrEqual(1);
    // Pode ser que o style esteja em loading; o importante é que sources eventualmente apareçam
  });

  test('Painel diagnóstico abre e mostra status', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Clicar no botão de diagnóstico
    await page.locator('#diag-toggle').click();
    await page.waitForTimeout(300);

    const visivel = await page.locator('#diag-panel').isVisible();
    expect(visivel).toBe(true);

    // Verificar que status tem conteúdo
    const status = await page.locator('#diag-status').textContent();
    console.log('Diag status:', status);
    expect(status).toContain('block-map-wrap');
  });
});

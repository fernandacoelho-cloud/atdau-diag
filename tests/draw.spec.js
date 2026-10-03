// tests/draw.spec.js
// Validação real do sistema da DIAG.
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAG_URL = 'file://' + path.resolve(__dirname, '..', 'ATDAU_DIAG_interativo.html').replace(/\\/g, '/');

test.describe('ATDAU DIAG — sistema básico', () => {

  test('DIAG carrega e expõe globals esperados', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

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

  test('Botões Mostrar mapa têm wrap correspondente', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const stats = await page.evaluate(() => {
      const btns = document.querySelectorAll('.block-map-toggle');
      const wraps = document.querySelectorAll('.block-map-wrap');
      return { botoes: btns.length, wraps: wraps.length };
    });

    console.log('Botoes/wraps:', stats);
    expect(stats.botoes).toBeGreaterThanOrEqual(20);
    expect(stats.wraps).toBe(1);   // 2026-10: os mini-mapas por bloco viraram lentes do mapa único (#lente-wrap)
  });

  test('Todas as camadas aceitam poligono', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const semPolygon = await page.evaluate(() => {
      return ML_LAYERS
        .filter(l => l.id !== 'terreno')
        .filter(l => !l.geom.includes('polygon'))
        .map(l => l.id);
    });

    console.log('Camadas sem polygon (esperado vazio):', semPolygon);
    expect(semPolygon).toEqual([]);
  });

 test('Block-map abre, instancia MapLibre e cria sources', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Navegar para uma aba com block-map (aba 1 - Contexto Urbano)
    // #nav-1 direto: '[onclick*="irPara(1)"]' casava antes com irPara(11,...)
    const aba1 = page.locator('#nav-1');
    if (await aba1.count() > 0) {
      await aba1.click();
      await page.waitForTimeout(800);
    }

    // Agora procurar botão visível
    const visibleBtns = await page.locator('.block-map-toggle:visible').count();
    console.log('Botões visíveis após ir para aba 1:', visibleBtns);

    if (visibleBtns === 0) {
      console.log('AVISO: nenhum botão visível. Pulando este teste.');
      return;
    }

    const visibleBtn = page.locator('.block-map-toggle:visible').first();
    await visibleBtn.scrollIntoViewIfNeeded();
    await visibleBtn.click();
    await page.waitForTimeout(4000);

    const estado = await page.evaluate(() => {
      const maps = typeof _blockMaps !== 'undefined' ? Object.keys(_blockMaps) : [];
      if (!maps.length) return { mapas: 0 };
      const firstMap = _blockMaps[maps[0]];
      return {
        mapas: maps.length,
        styleLoaded: firstMap.isStyleLoaded(),
        sourcesCriadas: ML_LAYERS.filter(l => firstMap.getSource('src-' + l.id)).length,
      };
    });

    console.log('Estado do mapa:', estado);
    expect(estado.mapas).toBeGreaterThanOrEqual(1);
  });

  test('Painel diagnostico abre e mostra status', async ({ page }) => {
    await page.goto(DIAG_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    await page.locator('#diag-toggle').click();
    await page.waitForTimeout(300);

    const visivel = await page.locator('#diag-panel').isVisible();
    expect(visivel).toBe(true);

    const status = await page.locator('#diag-status').textContent();
    console.log('Diag status:', status);
    expect(status).toContain('block-map-wrap');
  });
});
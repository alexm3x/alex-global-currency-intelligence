import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../viajes/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../viajes/tailwind.input.css', import.meta.url), 'utf8');
const visualSystem = readFileSync(new URL('../viajes/asc-visual-system.js', import.meta.url), 'utf8');
const decisionCharts = readFileSync(new URL('../viajes/asc-decision-charts.js', import.meta.url), 'utf8');
const enhancements = readFileSync(new URL('../viajes/enhancements.js', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../viajes/sw.js', import.meta.url), 'utf8');
const audit = readFileSync(new URL('../docs/viajes-visual-audit-phase01.md', import.meta.url), 'utf8');

test('phase 0 audit records the baseline and remote backup', () => {
  assert.match(audit, /86a1b54f6f3a9fc6d07bcb90dc0a01946d4dfbe3/);
  assert.match(audit, /backup\/viajes-pre-visual-phase01-2026-08-22/);
});

test('decision charts explain their purpose without applying 3D to data', () => {
  assert.match(html, /id="costChartPurpose"/);
  assert.match(html, /id="fxChartPurpose"/);
  assert.match(html, /id="costChart" role="img"/);
  assert.doesNotMatch(html, /id="(?:cost|fx)Chart"[^>]*(?:rotate|perspective)/);
});

test('visual controls expose complete interaction and accessibility states', () => {
  for (const state of [':hover', ':active', ':focus-visible', ':disabled', '[aria-busy="true"]', '[data-state="success"]', '[data-state="error"]']) {
    assert.ok(css.includes(state), `missing ${state}`);
  }
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});

test('motion layer pauses when hidden and respects the motion preference', () => {
  assert.match(visualSystem, /visibilitychange/);
  assert.match(visualSystem, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.asc-page-hidden \.travel-motion/);
});

test('new visual runtime is loaded and cached by the PWA shell', () => {
  assert.match(html, /src="asc-visual-system\.js"/);
  assert.match(html, /src="asc-decision-charts\.js"/);
  assert.match(serviceWorker, /'\.\/asc-visual-system\.js'/);
  assert.match(serviceWorker, /'\.\/asc-decision-charts\.js'/);
  assert.match(serviceWorker, /asc-viajes-pwa-v5-visual-phase23/);
});

test('phase 2 ranks exact costs and exposes decision metadata', () => {
  assert.match(decisionCharts, /indexAxis:'y'/);
  assert.match(decisionCharts, /sort\(\(a, b\) => a\.value - b\.value\)/);
  assert.match(decisionCharts, /Costo total estimado · MXN/);
  for (const field of ['Unidad', 'Periodo', 'Fuente', 'Actualizado', 'Confianza', 'Estado']) assert.match(decisionCharts, new RegExp(`label:'${field}'`));
  assert.match(html, /id="costChartSummary"[^>]+aria-live="polite"/);
});

test('FX chart uses observed history only and never synthesizes missing points', () => {
  assert.match(enhancements, /function observedTrend/);
  assert.doesNotMatch(enhancements, /function syntheticTrend/);
  assert.doesNotMatch(enhancements, /Math\.sin\(index/);
  assert.match(enhancements, /data-fx-months="3"/);
  assert.match(enhancements, /Tendencia no disponible/);
});

test('phase 3 background has bounded professional layers and adaptive complexity', () => {
  for (const layer of ['coordinates', 'nodes', 'signals', 'veil']) assert.match(html, new RegExp(`travel-motion__${layer}`));
  assert.match(visualSystem, /Math\.max\(-12, Math\.min\(12/);
  assert.match(visualSystem, /saveData/);
  assert.match(css, /data-asc-motion="limited"/);
  assert.match(css, /travel-data-pulse/);
});

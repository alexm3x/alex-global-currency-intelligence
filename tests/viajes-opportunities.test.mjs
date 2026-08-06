import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../viajes/index.html', import.meta.url), 'utf8');
const desk = await readFile(new URL('../viajes/travel-opportunities.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../viajes/travel-opportunities.css', import.meta.url), 'utf8');
const booking = await readFile(new URL('../viajes/booking-controls.js', import.meta.url), 'utf8');

test('financial decision panel exposes six actionable indicators', () => {
  for (const id of [
    'usdMxn', 'medianFxAdvantage', 'maxFxSavings',
    'greenCount', 'medianVolatility', 'bestOpportunity'
  ]) assert.match(page, new RegExp(`id="${id}"`));
  assert.match(page, /id="bookingSignalBadge"/);
  assert.doesNotMatch(page, />Frecuencia<\/p>/);
});

test('opportunity desk ranks candidates and keeps prices verifiable', () => {
  assert.match(page, /id="dealDesk"/);
  assert.match(desk, /relativeDiscount/);
  assert.match(desk, /fxSaving/);
  assert.match(desk, /volatility_annualized_pct/);
  assert.match(desk, /buildLiveLinks\(destination\)/);
  assert.match(desk, /Verificar precio en Google Travel/);
  assert.match(page, /Sin anuncios ni enlaces patrocinados/);
});

test('deal prices follow the selected display currency and trip length', () => {
  assert.match(booking, /window\.ViajesCurrency/);
  assert.match(desk, /ViajesCurrency\?\.formatMXN/);
  assert.match(desk, /const nights = \(\) =>/);
  assert.match(desk, /destination\.luxury_daily_mxn/);
  assert.match(desk, /destination\.moderate_daily_mxn/);
});

test('new dashboard sections include responsive mobile layouts', () => {
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /\.decision-metrics\{grid-template-columns:1fr\}/);
  assert.match(styles, /\.deal-grid\{grid-template-columns:1fr\}/);
});

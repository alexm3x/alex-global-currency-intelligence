import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bookingControls = await readFile(
  new URL('../viajes/booking-controls.js', import.meta.url),
  'utf8'
);
const viajesPage = await readFile(
  new URL('../viajes/index.html', import.meta.url),
  'utf8'
);

test('budget amount keeps a full-width row separate from the currency selector', () => {
  assert.match(
    bookingControls,
    /wrapper\.className = 'grid min-w-0 grid-cols-1[^']*'/
  );
  assert.match(
    bookingControls,
    /budgetInput\.className = '[^']*w-full[^']*text-lg[^']*'/
  );
  assert.match(
    bookingControls,
    /currencySelect\.className = '[^']*w-full[^']*border-t[^']*'/
  );
  assert.doesNotMatch(bookingControls, /grid-cols-\[1fr_auto\]/);
});

test('budget amount exposes a mobile numeric keyboard and accessible labels', () => {
  assert.match(viajesPage, /id="budgetInput"[^>]*inputmode="decimal"/);
  assert.match(viajesPage, /id="budgetInput"[^>]*enterkeyhint="done"/);
  assert.match(viajesPage, /id="budgetInput"[^>]*aria-label="Importe total del presupuesto"/);
  assert.match(bookingControls, /aria-describedby', 'budgetHelper'/);
  assert.match(bookingControls, /aria-label', 'Moneda del presupuesto y resultados'/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../decision-engine.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../decision-engine.css', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../decision-engine-core.js', import.meta.url), 'utf8');

test('production shell exposes one Decision Engine route and assets', () => {
  assert.equal((index.match(/data-view="decisionEngine"/g) || []).length, 1);
  assert.equal((index.match(/id="decisionEngine"/g) || []).length, 1);
  assert.match(index, /decision-engine\.css\?v=20260810-phase2/);
  assert.match(index, /type="module" src="decision-engine\.js\?v=20260810-phase2"/);
});

test('decision engine reuses the secured AGCI fundamentals endpoint and does not hardcode targets', () => {
  assert.match(app, /agci-equity-fundamentals\.proadmexico\.workers\.dev/);
  assert.match(app, /\/compare\?symbols=/);
  assert.doesNotMatch(app, /fairValue\s*:\s*[0-9]{2,}/);
  assert.match(app, /no (se )?mostrar[aá]n precios objetivo|no fabrica un precio objetivo/i);
});

test('core exposes modular weights and adaptive terrain logic', () => {
  assert.match(core, /quality:\s*20/);
  assert.match(core, /valuation:\s*20/);
  assert.match(core, /growth:\s*15/);
  assert.match(core, /profitability:\s*15/);
  assert.match(core, /balance:\s*10/);
  assert.match(core, /momentum:\s*5/);
  assert.match(core, /risk:\s*15/);
  assert.match(core, /requiredMarginOfSafety/);
  assert.match(core, /fairValueEstimate/);
  assert.match(core, /preparationScore/);
  assert.match(core, /rankRadar/);
});

test('responsive CSS includes phone and tablet breakpoints without hiding the engine', () => {
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.doesNotMatch(css, /#decisionEngine\s*\{[^}]*display\s*:\s*none/i);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
});

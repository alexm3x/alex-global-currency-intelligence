import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const experience = await readFile(path.join(root, 'viajes', 'asc-global-experience.js'), 'utf8');
const imports = await readFile(path.join(root, 'viajes', 'opportunity-imports.js'), 'utf8');

test('Viajes ASC global experience parses as valid JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(experience, { filename: 'asc-global-experience.js' }));
  assert.doesNotThrow(() => new vm.Script(imports, { filename: 'opportunity-imports.js' }));
});

test('global experience is loaded by the existing client chain', () => {
  assert.match(imports, /asc-global-experience\.js/);
  assert.match(imports, /data-asc-global-experience|ascGlobalExperience/);
});

test('phase 1 contains the required international experience primitives', () => {
  assert.match(experience, /ASC TRAVEL COPILOT/);
  assert.match(experience, /asc-primary-nav/);
  assert.match(experience, /asc-mobile-nav/);
  assert.match(experience, /data-asc-theme/);
  assert.match(experience, /prefers-reduced-motion/);
  assert.match(experience, /viajes:natural-language-intent/);
  assert.match(experience, /viajes:global-navigation/);
});

test('phase 1 preserves truthful behavior and does not embed obvious secrets', () => {
  assert.doesNotMatch(experience, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(experience, /OPENAI_API_KEY\s*[:=]/);
  assert.doesNotMatch(experience, /Math\.random\(\).*price|fake.*price|synthetic.*live/i);
});

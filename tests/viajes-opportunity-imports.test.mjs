import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../viajes/index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../viajes/opportunity-imports.js', import.meta.url), 'utf8');
const scraper = await readFile(new URL('../viajes/scripts/scrape_opportunities.py', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/travel-opportunities-daily.yml', import.meta.url), 'utf8');

test('new opportunities workspace is exposed as a fixed tab', () => {
  assert.match(page, /data-workspace-tab="imports"/);
  assert.match(page, /id="opportunityImportPanel"/);
  assert.match(page, /data\/data_dashboard\.csv/);
  assert.match(page, /data\/data_dashboard\.json/);
});

test('local HTML import normalizes price and preserves verifiable links', () => {
  assert.match(client, /DOMParser/);
  assert.match(client, /numericPrice/);
  assert.match(client, /noopener noreferrer/);
  assert.match(client, /localStorage/);
});

test('Python importer uses BeautifulSoup and Pandas with defensive HTTP handling', () => {
  assert.match(scraper, /from bs4 import BeautifulSoup/);
  assert.match(scraper, /import pandas as pd/);
  assert.match(scraper, /requests\.get/);
  assert.match(scraper, /response\.raise_for_status/);
  assert.match(scraper, /def run_daily/);
  assert.match(scraper, /PROTECTED_HOSTS/);
});

test('daily workflow publishes only generated data files', () => {
  assert.match(workflow, /cron:/);
  assert.match(workflow, /scrape_opportunities\.py/);
  assert.match(workflow, /viajes\/data\/data_dashboard\.csv/);
  assert.match(workflow, /viajes\/data\/data_dashboard\.json/);
});

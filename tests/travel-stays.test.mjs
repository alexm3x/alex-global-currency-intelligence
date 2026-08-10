import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync('viajes/index.html', 'utf8');
const script = fs.readFileSync('viajes/stays-intelligence.js', 'utf8');
const styles = fs.readFileSync('viajes/stays-intelligence.css', 'utf8');
const data = JSON.parse(fs.readFileSync('viajes/data/stays-demo.json', 'utf8'));
const workflow = fs.readFileSync('.github/workflows/travel-opportunities-daily.yml', 'utf8');

test('smart stays is a third isolated workspace with an explicit demo disclosure', () => {
  assert.match(page, /data-workspace-tab="stays"/);
  assert.match(page, /data-workspace-panel="stays"/);
  assert.match(page, /Modo demostración/);
  assert.equal(data.meta.dataMode, 'synthetic-demo');
  assert.equal(data.meta.isLive, false);
});

test('stay contract preserves complete cost components and traceability', () => {
  assert.ok(data.items.length >= 8);
  for (const row of data.items) {
    for (const key of ['offerId', 'propertyId', 'propertyName', 'source', 'basePrice', 'cleaningFee', 'serviceFee', 'taxes', 'discount', 'sourceUrl', 'confidence', 'risks']) {
      assert.ok(Object.hasOwn(row, key), key + ' missing');
    }
    assert.match(row.sourceUrl, /^https:\/\//);
    assert.equal(row.availabilityStatus, 'demo-no-verificada');
    assert.equal(row.verifiedAt, null);
  }
});

test('opportunity score uses the six declared weighted components', () => {
  assert.match(script, /priceScore \* \.30/);
  assert.match(script, /qualityScore \* \.20/);
  assert.match(script, /locationScore, 0, 100\) \* \.15/);
  assert.match(script, /feeScore, 0, 100\) \* \.15/);
  assert.match(script, /cancellationScore, 0, 100\) \* \.10/);
  assert.match(script, /freshnessScore \* \.10/);
  assert.match(script, /verifiedRecently/);
  assert.match(script, /availabilityStatus === 'confirmed'/);
});

test('smart stays supports mobile one-column cards and contained tables', () => {
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /\.stays-top-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(styles, /\.stays-table-wrap \{ overflow-x: auto; \}/);
  assert.match(styles, /\.workspace-tabs \{ grid-template-columns: 1fr !important; \}/);
});

test('opportunity ingestion is scheduled twice daily', () => {
  assert.match(workflow, /cron: "15 8,20 \* \* \*"/);
});

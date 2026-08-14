import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFredCsv, parseCboeCsv, scoreMomentum, scoreBreadthProxy, scoreCredit, scoreOptionsTermStructure, scoreVolatility } from '../scripts/update-greed-valuation-data.mjs';

const mkSeries = (n, start=100, step=1) => Array.from({length:n}, (_,i)=>({date:`2026-01-${String((i%28)+1).padStart(2,'0')}`, value:start+i*step}));

test('parseFredCsv reads observation_date and numeric values', () => {
  const rows = parseFredCsv('observation_date,SP500\n2026-08-12,100\n2026-08-13,.\n2026-08-14,102\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1].value, 102);
});

test('parseCboeCsv reads DATE/CLOSE format', () => {
  const rows = parseCboeCsv('DATE,OPEN,HIGH,LOW,CLOSE\n08/13/2026,16,17,15,16.5\n08/14/2026,15,16,14,15.2\n');
  assert.equal(rows[1].date, '2026-08-14');
  assert.equal(rows[1].value, 15.2);
});

test('momentum and breadth score strong rising markets as constructive', () => {
  const rising = mkSeries(220, 100, 0.5);
  assert.ok(scoreMomentum(rising) > 60);
  assert.equal(scoreBreadthProxy({a:rising,b:rising,c:rising}), 100);
});

test('credit score is greedier when spread is near trailing low', () => {
  const rows = Array.from({length:200},(_,i)=>({date:`d${i}`,value:2 + i*0.01}));
  rows.push({date:'latest',value:2.05});
  assert.ok(scoreCredit(rows) > 80);
});

test('options term structure and VIX percentile are bounded', () => {
  assert.ok(scoreOptionsTermStructure(15, 20) > 50);
  assert.ok(scoreOptionsTermStructure(25, 20) < 50);
  assert.equal(scoreVolatility(20), 80);
});

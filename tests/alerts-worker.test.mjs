import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validPayload,
  sourceHealth,
  extractCollections,
  buildExecutiveDigest,
  alignmentReport
} from '../workers/agci-alerts-worker.js';

const env={
  ALERT_TIMEZONE:'America/Mexico_City',
  PORTAL_URL:'https://example.com',
  WHATSAPP_TEMPLATE_NAME:'agci_market_alert',
  MAX_SOURCE_AGE_MINUTES:'180',
  MIN_DIGEST_ITEMS:'1',
  ALLOW_UNDATED_SOURCE:'false',
  WATCHLIST:'USD/MXN,MSFT'
};

test('accepts a complete critical alert payload',()=>{
  assert.equal(validPayload({severity:'critical',title:'AGCI',message:'Material change'}),true);
});

test('rejects incomplete or unsupported alert payloads',()=>{
  assert.equal(validPayload({severity:'urgent',title:'AGCI',message:'x'}),false);
  assert.equal(validPayload({severity:'critical',title:'',message:'x'}),false);
});

test('treats an undated source as stale by default',()=>{
  const result=sourceHealth({},env,Date.parse('2026-08-03T12:00:00Z'));
  assert.equal(result.timestampMissing,true);
  assert.equal(result.stale,true);
});

test('distinguishes fresh and stale timestamps',()=>{
  const now=Date.parse('2026-08-03T12:00:00Z');
  assert.equal(sourceHealth({updatedAt:'2026-08-03T11:00:00Z'},env,now).stale,false);
  assert.equal(sourceHealth({updatedAt:'2026-08-03T06:00:00Z'},env,now).stale,true);
});

test('extracts supported opportunity collections',()=>{
  const data={opportunities:{currencies:[{symbol:'JPY',score:91}],equities:[{ticker:'MSFT',score:88}],etfs:[{ticker:'COWZ',score:82}]},ratings:[{ticker:'GOOGL'}]};
  const collections=extractCollections(data);
  assert.equal(collections.currencies.length,1);
  assert.equal(collections.equities.length,1);
  assert.equal(collections.etfs.length,1);
  assert.equal(collections.ratings.length,1);
});

test('builds a digest with counts and actionable content',()=>{
  const data={opportunities:{currencies:[{symbol:'JPY',score:91,signal:'BUY'}],equities:[{ticker:'MSFT',score:88,signal:'BUY'}],etfs:[{ticker:'COWZ',score:82,signal:'WATCH'}]}};
  const digest=buildExecutiveDigest(data,env);
  assert.equal(digest.actionableCount,3);
  assert.match(digest.payload.message,/JPY/);
  assert.match(digest.payload.message,/MSFT/);
  assert.match(digest.payload.message,/COWZ/);
});

test('flags empty digests as not aligned',()=>{
  const data={updatedAt:'2026-08-03T11:00:00Z'};
  const health=sourceHealth(data,env,Date.parse('2026-08-03T12:00:00Z'));
  const report=alignmentReport(data,env,health);
  assert.equal(report.aligned,false);
  assert.equal(report.actionableCount,0);
  assert.ok(report.warnings.some(x=>x.includes('suficientes elementos accionables')));
});

test('hello_world validates transport but not visible content',()=>{
  const testEnv={...env,WHATSAPP_TEMPLATE_NAME:'hello_world'};
  const data={updatedAt:'2026-08-03T11:00:00Z',currencies:[{symbol:'JPY',score:91}]};
  const health=sourceHealth(data,testEnv,Date.parse('2026-08-03T12:00:00Z'));
  const report=alignmentReport(data,testEnv,health);
  assert.equal(report.transportReady,true);
  assert.equal(report.contentVisible,false);
  assert.equal(report.aligned,false);
});

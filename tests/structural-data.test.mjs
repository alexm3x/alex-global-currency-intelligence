import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRegistry, calculateVixRisk, parseCsv, parseWorldBank} from '../scripts/update-structural-data.mjs';

test('CSV parser preserves quoted BIS fields containing commas',()=>{
  const rows=parseCsv('REF_AREA,TITLE,TIME_PERIOD,OBS_VALUE\nMX,"Policy rate, end of period",2026-07,7.25\n');
  assert.deepEqual(rows,[{REF_AREA:'MX',TITLE:'Policy rate, end of period',TIME_PERIOD:'2026-07',OBS_VALUE:'7.25'}]);
});

test('World Bank parser keeps the latest non-null value per economy',()=>{
  const data=parseWorldBank([{},[
    {countryiso3code:'MX',date:'2024',value:4.7},
    {countryiso3code:'MX',date:'2025',value:null},
    {countryiso3code:'MX',date:'2023',value:5.5},
    {countryiso3code:'EMU',date:'2025',value:2.1}
  ]]);
  assert.deepEqual(data.MX,{value:4.7,period:'2024'});
  assert.deepEqual(data.XM,{value:2.1,period:'2025'});
});

test('VIX calculation reports latest observation and regime',()=>{
  const rows=Array.from({length:20},(_,index)=>({DATE:`2026-07-${String(index+1).padStart(2,'0')}`,CLOSE:String(12+index/2)}));
  const risk=calculateVixRisk(rows);
  assert.equal(risk.vix,21.5);
  assert.equal(risk.regime,'elevado');
  assert.equal(risk.change20d,9.5);
});

test('registry status is derived from provider results',()=>{
  const snapshot={generatedAt:'2026-08-04T18:00:00.000Z',providers:{
    worldBank:{status:'ok',data:{retrievedAt:'2026-08-04T18:00:00.000Z'},error:null},
    bis:{status:'ok',data:{retrievedAt:'2026-08-04T18:00:00.000Z'},error:null},
    cboe:{status:'ok',data:{retrievedAt:'2026-08-04T18:00:00.000Z'},error:null}
  }};
  const registry=buildRegistry(snapshot);
  assert.equal(registry.status,'connected');
  assert.ok(registry.sources.every(source=>source.status==='Conectado'));
  assert.match(registry.note,/automáticamente/);
});

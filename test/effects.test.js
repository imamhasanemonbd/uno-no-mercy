import test from 'node:test';
import assert from 'node:assert/strict';
import {tableEffects} from '../public/effects.js';
const before={code:'ABC',phase:'playing',turn:'a',direction:1,event:{id:1},players:[{id:'a',count:7},{id:'b',count:7},{id:'c',count:7}]};
test('initial load and repeated events never replay animations',()=>{assert.deepEqual(tableEffects(null,before).draws,[]);assert.deepEqual(tableEffects(before,before).draws,[]);assert.equal(tableEffects(before,before).played,null);});
test('draw animations use actual draw events, not hand swaps',()=>{const next={...before,event:{id:2,type:'draw',draws:[{id:'b',count:10}]}};assert.deepEqual(tableEffects(before,next).draws,[{id:'b',count:10}]);assert.equal(tableEffects(before,next).played,null);});
test('skip targets the server-confirmed player',()=>{const next={...before,event:{id:2,type:'play',actor:'a',card:{id:'skip',value:'skip'},target:'c'}};assert.equal(tableEffects(before,next).blocked,'c');});
test('swap and pass animations never fabricate draw penalties',()=>{
 const swap={...before,event:{id:2,type:'play',actor:'a',target:'b',transfer:'swap'}};
 assert.deepEqual(tableEffects(before,swap).transfers,[{from:'a',to:'b'},{from:'b',to:'a'}]);assert.deepEqual(tableEffects(before,swap).draws,[]);
 const pass={...before,event:{id:2,type:'play',actor:'a',transfer:'pass'}};
 assert.deepEqual(tableEffects(before,pass).transfers,[{from:'a',to:'b'},{from:'b',to:'c'},{from:'c',to:'a'}]);
});
test('new rounds animate dealing without treating the hands as penalties',()=>{const next={...before,event:{id:2,type:'deal'}};assert.equal(tableEffects({...before,phase:'lobby'},next).deal,true);assert.deepEqual(tableEffects(before,next).draws,before.players.map(p=>({id:p.id,count:7})));});

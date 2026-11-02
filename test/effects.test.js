import test from 'node:test';
import assert from 'node:assert/strict';
import {tableEffects} from '../public/effects.js';
const before={code:'ABC',phase:'playing',turn:'a',direction:1,top:{id:'old',value:'1'},players:[{id:'a',count:7},{id:'b',count:7},{id:'c',count:7}]};
test('initial load and rematches do not trigger draw effects',()=>{assert.deepEqual(tableEffects(null,before).draws,[]);assert.deepEqual(tableEffects({...before,phase:'finished'},before).draws,[]);});
test('draw effects use actual added counts and no private card data',()=>{const next={...before,players:[{id:'a',count:7},{id:'b',count:17},{id:'c',count:7}]};assert.deepEqual(tableEffects(before,next).draws,[{id:'b',count:10}]);assert.equal(tableEffects(before,next).played,null);});
test('skip targets next active player in either direction',()=>{const next={...before,top:{id:'skip',value:'skip'}};assert.equal(tableEffects(before,next).blocked,'b');assert.equal(tableEffects({...before,direction:-1},next).blocked,'c');assert.equal(tableEffects({...before,players:before.players.map(p=>({...p,out:p.id==='b'}))},next).blocked,'c');});
test('+6 and +10 play effects trigger once, not on connection updates',()=>{for(const value of ['+6','+10']){const next={...before,top:{id:value,value}};assert.equal(tableEffects(before,next).played.value,value);assert.equal(tableEffects(next,{...next,message:'reconnected'}).played,null);}});

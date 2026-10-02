import assert from 'node:assert/strict';
import {sendMove} from '../lib/transport.ts';
const bodies=[];
const result=await sendMove('/test',{action:'play',value:'S14',turnKey:'turn'},async(_url,options)=>{
  bodies.push(options.body);
  if(bodies.length===1)throw new TypeError('Lost acknowledgement');
  return new Response('{}');
});
assert.equal(result.status,200);assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);
assert.ok(JSON.parse(bodies[0]).requestId);
let attempts=0;
const conflict=await sendMove('/test',{action:'play'},async()=>{attempts++;return new Response('{}',{status:409});});
assert.equal(conflict.status,409);assert.equal(attempts,1);
await assert.rejects(sendMove('/test',{},async()=>{throw new TypeError('Offline');}),/Offline/);
console.log('PASS: lost acknowledgements retry with identical IDs, HTTP rejections are not retried, offline retries are bounded.');

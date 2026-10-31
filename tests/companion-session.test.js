const { test } = require('node:test');
const assert = require('node:assert/strict');
const { takeHandoff, createClient } = require('../assets/companion.js');
const id='01234567-89ab-cdef-0123-456789abcdef', secret='a'.repeat(43);
const config={enabled:true,apiOrigin:'https://worker.caffeinetracker.app'};
const data={protocolVersion:1,appId:'caffeine',destination:'today',expiresAt:1600,serverTime:1000};
test('removes all fragments immediately and accepts only the one-use handoff format',()=>{
 const replacements=[]; const history={replaceState:(...args)=>replacements.push(args)};
 assert.deepEqual(takeHandoff({hash:'#connect='+id+'.'+secret,pathname:'/companion.html',search:''},history),{sessionId:id,handoffSecret:secret});
 assert.equal(replacements[0][2],'/companion.html');
 assert.throws(()=>takeHandoff({hash:'#connect=bad',pathname:'/companion.html',search:''},history),/invalid_link/);
 assert.equal(takeHandoff({hash:'',pathname:'/companion.html'},history),null);
});
test('uses credentialed requests and never persists or returns the cookie secret',async()=>{
 const calls=[];const client=createClient(config,async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>data}},()=>1000000);
 assert.deepEqual(await client.redeem({sessionId:id,handoffSecret:secret}),data);
 await client.resume();
 assert.equal(calls[0].options.credentials,'include');assert.equal(calls[0].options.cache,'no-store');
 assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);
 assert.equal(calls[0].url,config.apiOrigin+'/v1/guest/redeem');
});
test('disabled rollout performs no network requests',async()=>{
 let calls=0; const client=createClient({...config,enabled:false},async()=>{calls++});
 await assert.rejects(client.resume(),/unavailable/);assert.equal(calls,0);
});
test('rejects malformed, expired, wrong-product and sliding-expiry responses',async()=>{
 for(const response of [{...data,expiresAt:1000},{...data,expiresAt:1601},{...data,appId:'alcogram'},{...data,destination:'admin'},{...data,protocolVersion:2}]){
  const client=createClient(config,async()=>({ok:true,status:200,json:async()=>response}),()=>1000000);
  await assert.rejects(client.resume(),/invalid_response/);
 }
});
test('serializes requests and cancels pending work when leaving',async()=>{
 let signal;let release;
 const client=createClient(config,async(url,options)=>{signal=options.signal;return new Promise(resolve=>{release=()=>resolve({ok:true,status:200,json:async()=>data})})},()=>1000000);
 const pending=client.resume();await assert.rejects(client.resume(),/busy/);client.close();assert.equal(signal.aborted,true);release();await assert.rejects(pending,/unavailable/);
 await assert.rejects(client.resume(),/unavailable/);
});
test('classifies expired access, rate limits and explicit logout',async()=>{
 for(const [status,code] of [[401,'expired'],[429,'rate_limited'],[503,'unavailable']]){
  const client=createClient(config,async()=>({ok:false,status}));await assert.rejects(client.resume(),new RegExp(code));
 }
 const client=createClient(config,async(url,options)=>{assert.equal(options.method,'DELETE');assert.equal(options.body,'{}');return{ok:true,status:204}});
 assert.equal(await client.logout(),null);
});

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
 const calls=[];const client=createClient(config,async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>data}});
 assert.deepEqual(await client.redeem({sessionId:id,handoffSecret:secret}),data);
 await client.resume();
 assert.equal(calls[0].options.credentials,'include');assert.equal(calls[0].options.cache,'no-store');
 assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);
 assert.equal(calls[1].options.headers['X-Caffeine-Companion'],'1');
 assert.equal(calls[0].options.headers['Content-Type'],'application/json');
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
 const client=createClient(config,async(url,options)=>{signal=options.signal;return new Promise(resolve=>{release=()=>resolve({ok:true,status:200,json:async()=>data})})});
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

test("formats watch time through an offset transition independent of browser zone", () => {
    const { watchTime } = require("../assets/companion.js");
    const midnight = Date.UTC(2026, 9, 25) / 1000;
    const offsets = [{ fromSec: midnight, offsetSeconds: 7200 }, { fromSec: midnight + 3600, offsetSeconds: 3600 }];
    assert.equal(watchTime(midnight + 1800, offsets), "02:30");
    assert.equal(watchTime(midnight + 5400, offsets), "02:30");
});

test("keeps old session-only deployments compatible and rejects malformed Today data", async () => {
    const { createClient, readToday } = require("../assets/companion.js");
    const legacy = createClient({ enabled: true, apiOrigin: "https://staging.caffeinetracker.app" },
        async () => new Response(null, { status: 404 }));
    assert.equal(await legacy.today(), null);
    assert.throws(() => readToday({ serverTime: 100, snapshot: { schemaVersion: 1 } }), /invalid_response/);
    const empty = { serverTime: 100, snapshot: null, receivedAt: null, expiresAt: null };
    assert.deepEqual(readToday(empty), empty);
});

test("retained history preserves duplicates and the watch date across UTC midnight", () => {
    const { retainedHistory } = require("../assets/companion.js");
    const midnight = Date.UTC(2026, 10, 8) / 1000;
    const day = {
        date: "2026-11-08", startSec: midnight - 3600, endSec: midnight + 82800,
        offsetSegments: [{ fromSec: midnight - 3600, offsetSeconds: 3600 }],
    };
    const previous = { time: midnight - 3700, mg: 30, offsetSeconds: 3600 };
    const first = { time: midnight - 1800, mg: 65, offsetSeconds: 3600 };
    const later = { time: midnight + 3600, mg: 20, offsetSeconds: 3600 };
    const history = retainedHistory({ schemaVersion: 2, watchDay: day, events: [previous, first, first, later] }, midnight);
    assert.deepEqual(history.map(group => [group.date, group.total, group.entries.length]), [
        ["2026-11-08", 130, 3], ["2026-11-07", 30, 1],
    ]);
    assert.deepEqual(history[0].entries.map(entry => [entry.time, entry.scheduled]), [
        ["02:00", true], ["00:30", false], ["00:30", false],
    ]);
    const older = retainedHistory({ schemaVersion: 1, watchDay: day, events: [previous, first] }, midnight);
    assert.deepEqual(older.map(group => [group.date, group.usesWatchTime]), [
        ["2026-11-08", true], ["2026-11-07", false],
    ]);
});

test("validates the extra settings and offsets only in an extended snapshot", () => {
    const { readToday } = require("../assets/companion.js");
    const day = Date.UTC(2026, 10, 8) / 1000;
    const snapshot = {
        schemaVersion: 2, capturedAt: day,
        model: { id: "caffeine-constant-absorption-v1", halfLifeMinutes: 300, absorptionMinutes: 20,
            apparentVolumeLiters: 49, belowAtThresholdMgPerL: 0.6 },
        watchDay: { date: "2026-11-08", startSec: day, endSec: day + 86400, offsetSegments: [{ fromSec: day, offsetSeconds: 0 }] },
        events: [{ time: day, mg: 95, offsetSeconds: 0 }],
        watchDisplay: { cachedLevelMgPerL: null, cachedAt: null },
        watchSettings: { smartSorting: true, bedtimeOverrideMinutes: null, effectiveBedtimeMinutes: 1380,
            bedtimeBufferMinutes: 60, backgroundIntervalMinutes: 15 },
    };
    const response = { serverTime: day, receivedAt: day, expiresAt: day + 1, snapshot };
    assert.deepEqual(readToday(response), response);
    assert.doesNotThrow(() => readToday({ ...response, snapshot: { ...snapshot, watchSettings: null } }));
    assert.throws(() => readToday({ ...response, snapshot: { ...snapshot, events: [{ time: day, mg: 95 }] } }), /invalid_response/);
    assert.throws(() => readToday({ ...response, snapshot: { ...snapshot,
        watchSettings: { ...snapshot.watchSettings, backgroundIntervalMinutes: 10 },
    } }), /invalid_response/);
});

test("connected drinks follow the watch's combined preset/custom order", () => {
    const { watchDrinks } = require("../assets/companion.js");
    const presets = [{ name: "Espresso", mg: 64 }, { name: "Black Tea 240ml", mg: 45 }];
    const snapshot = {
        schemaVersion: 4, availablePresets: ["Espresso", "Black Tea 240ml"],
        customDrinks: [{ name: "Travel coffee", mg: 90 }], drinkOrder: [2, 1, 0],
    };
    assert.deepEqual(watchDrinks(snapshot, presets).map(drink => drink.name),
        ["Travel coffee", "Black Tea 240ml", "Espresso"]);
    assert.deepEqual(watchDrinks({ ...snapshot, schemaVersion: 3 }, presets).map(drink => drink.name),
        ["Espresso", "Black Tea 240ml", "Travel coffee"]);
    assert.deepEqual(watchDrinks({ ...snapshot, customDrinks: null, drinkOrder: null }, presets), presets);
});

test("a chosen drink time uses the browser timezone and the watch's 48-hour limit", () => {
    const { drinkTime } = require("../assets/companion.js");
    const now = Math.floor(new Date(2026, 10, 13, 15, 0).getTime() / 1000);
    assert.equal(drinkTime("2026-11-13T14:35", now), Math.floor(new Date(2026, 10, 13, 14, 35).getTime() / 1000));
    assert.equal(drinkTime("2026-11-11T15:00", now), now - 172800);
    assert.throws(() => drinkTime("2026-11-11T14:59", now), /time_range/);
    assert.throws(() => drinkTime("2026-11-13T15:01", now), /time_range/);
    assert.throws(() => drinkTime("2026-02-30T12:00", now), /invalid_time/);
    assert.throws(() => drinkTime("", now), /invalid_time/);
});

const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {buildPreview}=require('../scripts/build-companion-preview.js');
test('prepares an isolated staging artifact while leaving the public configuration disabled',()=>{
 const original=fs.readFileSync(path.join(__dirname,'../assets/companion-config.js'),'utf8');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-preview-'));
 try{
  const output=path.join(temp,'preview');buildPreview(output);
  assert.match(fs.readFileSync(path.join(output,'assets/companion-config.js'),'utf8'),/"enabled":true,"apiOrigin":"https:\/\/staging.caffeinetracker.app"/);
  assert.match(fs.readFileSync(path.join(output,'companion.html'),'utf8'),/https:\/\/www.caffeinetracker.app\/privacy.html/);
  const page=fs.readFileSync(path.join(output,'companion.html'),'utf8');
  const bundle=fs.readFileSync(path.join(output,'assets/companion.js'),'utf8');
  assert.doesNotMatch(page,/src="assets\/caffeine-tracker-(core|graph|ui)\.js"/);
  assert.doesNotMatch(page,/src="assets\/companion-protocol\.js"/);
  assert.ok(bundle.includes('CaffeineCompanionProtocol'));
  assert.ok(bundle.includes('graphFromWatchSnapshot'));
  assert.doesNotMatch(bundle,/\[data-caffeine-tracker\]/);
  assert.ok(bundle.indexOf('env.CaffeineTrackerGraph') < bundle.indexOf('function takeHandoff'));
  assert.throws(()=>buildPreview(output),/EEXIST/);
  assert.equal(fs.readFileSync(path.join(__dirname,'../assets/companion-config.js'),'utf8'),original);assert.match(original,/enabled: false/);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('rejects unapproved API origins before creating output',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-preview-'));
 try{const output=path.join(temp,'preview');assert.throws(()=>buildPreview(output,'https://evil.example'),/approved/);assert.equal(fs.existsSync(output),false)}finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('keeps connection facts in the companion page and labels the existing website privacy policy',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-disclosure-'));
 try{
  const output=path.join(temp,'preview');buildPreview(output);
  const page=fs.readFileSync(path.join(output,'companion.html'),'utf8');
  assert.match(page,/<summary>Connection data<\/summary>/);
  assert.match(page,/Website and purchase privacy<\/a>/);
  for(const name of ['index.html','privacy.html','how-it-works.html']) assert.ok(page.includes('href="https://www.caffeinetracker.app/'+name+'"'));
  assert.match(page,/72 hours/);
  assert.match(page,/profile weight or the app’s fallback/);
  assert.equal(fs.existsSync(path.join(output,'privacy.html')),false);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});

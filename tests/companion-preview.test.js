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
  assert.throws(()=>buildPreview(output),/EEXIST/);
  assert.equal(fs.readFileSync(path.join(__dirname,'../assets/companion-config.js'),'utf8'),original);assert.match(original,/enabled: false/);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
test('rejects unapproved API origins before creating output',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'companion-preview-'));
 try{const output=path.join(temp,'preview');assert.throws(()=>buildPreview(output,'https://evil.example'),/approved/);assert.equal(fs.existsSync(output),false)}finally{fs.rmSync(temp,{recursive:true,force:true})}
});

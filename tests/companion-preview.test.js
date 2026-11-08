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

test('packages the workspace separately with no connected configuration', () => {
    const { buildWorkspace } = require('../scripts/build-workspace-preview.js');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-workspace-'));
    try {
        const output = path.join(temp, 'preview');
        buildWorkspace(output);
        assert.deepEqual(fs.readdirSync(output).sort(),
            ['caffeine-tracker-core.js', 'caffeine-tracker-graph.js', 'index.html', 'workspace.css', 'workspace.js']);
        const page = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
        assert.match(page, /Local preview/);
        assert.match(page, /default-src 'none'/);
        assert.throws(() => buildWorkspace(output), /EEXIST/);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});

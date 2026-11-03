#!/usr/bin/env node
// Prepare static files only. Never publish or change the normal site config.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const allowed = new Set(['https://staging.caffeinetracker.app', 'https://worker.caffeinetracker.app']);
function buildPreview(output, apiOrigin = 'https://staging.caffeinetracker.app') {
    if (!allowed.has(apiOrigin)) throw new Error('Use the approved staging or production API origin');
    fs.mkdirSync(output, { recursive: false });
    fs.mkdirSync(path.join(output, 'assets'));
    let html = fs.readFileSync(path.join(root, 'companion.html'), 'utf8');
    for (const name of ['index.html', 'privacy.html', 'how-it-works.html']) html = html.replace('href="' + name + '"', 'href="https://www.caffeinetracker.app/' + name + '"');
    fs.writeFileSync(path.join(output, 'companion.html'), html);
    for (const name of ['companion.js', 'companion.css']) fs.copyFileSync(path.join(root, 'assets', name), path.join(output, 'assets', name));
    fs.writeFileSync(path.join(output, 'assets/companion-config.js'), 'window.CaffeineCompanionConfig=Object.freeze(' + JSON.stringify({ enabled: true, apiOrigin }) + ');\n');
    fs.writeFileSync(path.join(output, 'fixture.json'), JSON.stringify({ apiOrigin, sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), scope: 'Local artifact only; approved hosting/origin and watch page URL must match before use.' }, null, 2) + '\n');
}
module.exports = { buildPreview };
if (require.main === module) {
    if (process.argv.length < 3 || process.argv.length > 4) throw new Error('Usage: node scripts/build-companion-preview.js NEW_DIRECTORY [API_ORIGIN]');
    buildPreview(path.resolve(process.argv[2]), process.argv[3]);
    console.log('Prepared only. Match the approved frontend Origin/watch page URL and API before authorized hosting.');
}

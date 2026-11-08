#!/usr/bin/env node
// Local-only demonstration. Copy the shared graph and calculation sources once.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function buildWorkspace(output) {
    fs.mkdirSync(output);
    const sources = [
        ["_companion-workspace", ["index.html", "workspace.css", "workspace.js"]],
        ["assets", ["caffeine-tracker-core.js", "caffeine-tracker-graph.js"]],
    ];
    for (const [folder, files] of sources) {
        for (const name of files) fs.copyFileSync(path.join(root, folder, name), path.join(output, name));
    }
}

module.exports = { buildWorkspace };
if (require.main === module) {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/build-workspace-preview.js NEW_DIRECTORY");
    buildWorkspace(path.resolve(process.argv[2]));
}

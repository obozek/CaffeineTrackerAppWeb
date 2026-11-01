// Evaluate the actual workflow selector for trusted/private and public/fork events.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readdirSync, readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const directory = new URL("../.github/workflows/", pathToFileURL(__filename));
for (const file of readdirSync(directory).filter(name => name.endsWith(".yml"))) {
    const source = readFileSync(new URL(file, directory), "utf8");
    const selectors = [...source.matchAll(/runs-on: \$\{\{ (.+) \}\}/g)].map(match => match[1]);
    test(`${file}: hosted default, private opt-in and no public/fork runner access`, () => {
        assert(selectors.length > 0);
        for (const expression of selectors) {
            const select = new Function("vars", "github", "return " + expression.replace("fromJSON(", "JSON.parse("));
            for (const runner of ["", "github-hosted", "invalid", "self-hosted"]) {
                for (const privateRepo of [false, true]) {
                    for (const [event, head] of [["push", "owner/project"], ["release", "owner/project"], ["workflow_dispatch", "owner/project"], ["pull_request", "owner/project"], ["pull_request", "fork/project"]]) {
                        const github = { repository: "owner/project", event_name: event, event: { repository: { private: privateRepo }, pull_request: { head: { repo: { full_name: head } } } } };
                        const own = runner === "self-hosted" && privateRepo && !(event === "pull_request" && head !== github.repository);
                        assert.deepEqual(select({ CI_RUNNER: runner }, github), own ? ["self-hosted", "linux", "x64", "caffeine-web-ci"] : ["ubuntu-24.04"]);
                    }
                }
            }
        }
    });
}

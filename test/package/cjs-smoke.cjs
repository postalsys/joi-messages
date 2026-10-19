'use strict';

// CommonJS smoke test for the built package, run by `npm run test:cjs` as plain Node with
// NODE_OPTIONS=--no-experimental-require-module. EmailEngine bundles this package into a
// @yao-pkg/pkg binary, and pkg can only load a CommonJS module graph. Node 22+ enables
// require(esm) by default, which would hide an ES-module-only dependency (gettext-parser 8 is
// one). With the flag set, any ES module reached through require() throws ERR_REQUIRE_ESM here
// instead of in a binary. Kept as plain JavaScript on purpose: running it through tsx would let
// its loader transpile an ES module dependency to CommonJS and mask exactly that failure.

const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const pkg = require(path.join(root, 'package.json'));
const entry = path.join(root, pkg.exports['.'].require);

async function run() {
    // the way EmailEngine loads it (lib/translations.js)
    const joiMessages = require('@postalsys/joi-messages');
    assert.strictEqual(require.resolve('@postalsys/joi-messages'), entry);
    assert.strictEqual(require(entry), joiMessages);
    assert.strictEqual(typeof joiMessages.messages, 'function');
    assert.strictEqual(joiMessages.default.messages, joiMessages.messages);

    // the old main file path still resolves to the same module
    assert.strictEqual(require('@postalsys/joi-messages/index.js'), joiMessages);

    // translations/ is read from the package root, not from dist/cjs
    const locales = await joiMessages.messages();
    assert.strictEqual(locales.de['any.unknown'], '{{#label}} ist nicht erlaubt');
    assert.strictEqual(locales.et['any.required'], '{{#label}} on nõutav');
    assert.ok(Object.keys(locales.en).length > 100);

    console.log('CommonJS smoke test passed (' + process.version + ', ' + (process.env.NODE_OPTIONS || 'no NODE_OPTIONS') + ')');
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});

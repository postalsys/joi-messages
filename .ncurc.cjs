'use strict';

module.exports = {
    upgrade: true,
    reject: [
        // A devDependency only, scripts/build.js parses translations/*.po with it. 8.x is ESM-only
        // and the build script loads it with require(); the generated messages are pinned against
        // the 7.x output (test/messages.test.ts)
        'gettext-parser'
    ],
    target: name => {
        // @types/node stays on the 20.x line so the compiler rejects APIs that do
        // not exist on Node 20, the oldest supported version
        if (name === '@types/node') {
            return 'minor';
        }
        // typescript-eslint declares a peer range that excludes TypeScript 7
        if (name === 'typescript') {
            return 'minor';
        }
        return 'latest';
    }
};

'use strict';

module.exports = {
    upgrade: true,
    reject: [
        // 8.x is ESM-only; this package is CommonJS and is bundled by pkg in EmailEngine
        'gettext-parser'
    ]
};

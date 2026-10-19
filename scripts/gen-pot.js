// Regenerates translations/messages.pot from the installed joi (npm run pot)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gettextParser from 'gettext-parser';
import joi from 'joi';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Keyed by the English source: several Joi codes share a message (any.unknown and object.unknown,
// alternatives.any, alternatives.match and array.includes), so one entry lists every code as a reference
const messages = new Map();

for (let key of joi._types) {
    let msgs = joi[key]()?._definition?.messages;
    if (!msgs) {
        continue;
    }

    for (let msg of Object.keys(msgs)) {
        if (msgs[msg] && typeof msgs[msg] === 'object' && msgs[msg]?.source) {
            let source = msgs[msg].source;
            if (!messages.has(source)) {
                messages.set(source, new Set());
            }
            messages.get(source).add(msg);
        }
    }
}

const data = {
    charset: 'utf-8',

    headers: {
        'content-type': 'text/plain; charset=utf-8',
        'plural-forms': 'nplurals=2; plural=(n!=1);'
    },

    translations: {
        '': {
            '': {
                msgid: '',
                msgstr: ['Content-Type: text/plain; charset=iso-8859-1\n...']
            }
        }
    }
};

for (let [msgid, codes] of messages) {
    codes = Array.from(codes).sort();
    data.translations[''][msgid] = {
        msgid,
        comments: {
            translator: `Label: ${codes.join(', ')}`,
            reference: codes.join(' ')
        }
    };
}

fs.writeFileSync(path.join(root, 'translations', 'messages.pot'), gettextParser.po.compile(data));
console.log('done');

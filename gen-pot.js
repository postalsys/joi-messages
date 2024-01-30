'use strict';

const joi = require('joi');
const gettextParser = require('gettext-parser');
const fs = require('fs');
const Path = require('path');

const messages = new Map();

for (let key of joi._types) {
    let msgs = joi[key]()?._definition?.messages;
    if (!msgs) {
        continue;
    }

    for (let msg of Object.keys(msgs)) {
        if (msgs[msg] && typeof msgs[msg] === 'object' && msgs[msg]?.source) {
            messages.set(msg, {
                msgid: msgs[msg].source,
                comments: {
                    translator: `Label: ${msg}`,
                    reference: msg
                }
            });
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

for (let [, value] of messages) {
    data.translations[''][value.msgid] = value;
}

fs.writeFileSync(Path.join(__dirname, 'translations', 'messages.pot'), gettextParser.po.compile(data));
console.log('done');

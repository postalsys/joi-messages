'use strict';

const test = require('node:test');
const assert = require('node:assert');
const joi = require('joi');
const { messages } = require('..');

const joiCodes = () => {
    const codes = new Map();
    for (let type of joi._types) {
        let msgs = joi[type]()?._definition?.messages;
        for (let code of Object.keys(msgs || {})) {
            if (msgs[code]?.source) {
                codes.set(code, msgs[code].source);
            }
        }
    }
    return codes;
};

test('every Joi message code resolves in every locale', async () => {
    const result = await messages();
    const codes = joiCodes();
    assert.ok(codes.size > 100);

    for (let locale of Object.keys(result)) {
        for (let code of codes.keys()) {
            assert.strictEqual(typeof result[locale][code], 'string', `${locale}: ${code} missing`);
        }
    }
});

test('codes sharing an English message keep their translation', async () => {
    const result = await messages();
    const codes = joiCodes();

    assert.strictEqual(result.de['any.unknown'], '{{#label}} ist nicht erlaubt');
    assert.strictEqual(result.de['object.unknown'], '{{#label}} ist nicht erlaubt');

    for (let code of ['alternatives.any', 'alternatives.match', 'array.includes']) {
        assert.strictEqual(result.de[code], result.de['array.includes'], code);
        assert.notStrictEqual(result.de[code], codes.get(code), `${code} fell back to English`);
    }
});

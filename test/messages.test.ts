import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import joi from 'joi';
import type * as JoiMessages from '../src/index.js';

// The built ES module build, resolved through the package.json exports map (built by pretest).
// The message map is generated into dist/ by scripts/build.js, so the sources are not run
// directly. A non-literal specifier keeps the type-check independent of dist/.
const packageName: string = '@postalsys/joi-messages';
const { messages } = (await import(packageName)) as typeof JoiMessages;

const joiCodes = (): Map<string, string> => {
    const codes = new Map<string, string>();
    const anyJoi = joi as any;
    for (const type of anyJoi._types as string[]) {
        const msgs = anyJoi[type]()?._definition?.messages;
        for (const code of Object.keys(msgs || {})) {
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

    for (const locale of Object.keys(result)) {
        for (const code of codes.keys()) {
            assert.equal(typeof result[locale]?.[code], 'string', `${locale}: ${code} missing`);
        }
    }
});

test('codes sharing an English message keep their translation', async () => {
    const result = await messages();
    const codes = joiCodes();

    assert.equal(result.de?.['any.unknown'], '{{#label}} ist nicht erlaubt');
    assert.equal(result.de?.['object.unknown'], '{{#label}} ist nicht erlaubt');

    for (const code of ['alternatives.any', 'alternatives.match', 'array.includes']) {
        assert.equal(result.de?.[code], result.de?.['array.includes'], code);
        assert.notEqual(result.de?.[code], codes.get(code), `${code} fell back to English`);
    }
});

test('locale codes are reduced to their language part', async () => {
    const result = await messages();
    const translations = JSON.parse(fs.readFileSync(new URL('../translations/translations.json', import.meta.url), 'utf8'));
    assert.deepEqual(
        Object.keys(result),
        Object.keys(translations).map(code => code.split('_')[0])
    );
});

// The result 1.4.0 produced by parsing translations/*.po at runtime, from before the parsing moved
// into the build. A change to translations/ (or to the generator in scripts/build.js) changes the
// hash: check that the difference is the intended one, then record the new value here.
const MESSAGES_SHA256 = 'e9892ee9bc43c7845ce1cb58283133982968673dd7389b36206257aeb6681d48';

test('the generated messages are the ones the runtime parser produced', async () => {
    const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(await messages()))
        .digest('hex');
    assert.equal(hash, MESSAGES_SHA256);
});

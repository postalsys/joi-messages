import fs from 'node:fs';
import path from 'node:path';
import gettextParser from 'gettext-parser';
import { packageRoot } from './package-root.js';

/** Joi message templates of one language, keyed by Joi error code (such as `any.required`) */
export type LanguageMessages = Record<string, string>;

/** Message templates keyed by language code (such as `de`) */
export type Messages = Record<string, LanguageMessages>;

const translationsDir = path.join(packageRoot, 'translations');

/**
 * Loads the translated Joi error messages of every bundled language. The result is keyed by the
 * language part of the locale code (`de_DE` becomes `de`). A message without a translation falls
 * back to the English template.
 */
export async function messages(): Promise<Messages> {
    const result: Messages = {};

    const jsonContent = await fs.promises.readFile(path.join(translationsDir, 'translations.json'), 'utf-8');
    const translationList = JSON.parse(jsonContent) as Record<string, string>;
    for (const [code, file] of Object.entries(translationList)) {
        // sequential on purpose: a handful of small locale files, read once at startup
        // eslint-disable-next-line no-await-in-loop
        const fileContents = await fs.promises.readFile(path.join(translationsDir, file));
        const translations = gettextParser.po.parse(fileContents);

        const languageMessages: LanguageMessages = {};

        const entries = translations.translations[''] || {};
        for (const [msgid, entry] of Object.entries(entries)) {
            const reference = entry.comments?.reference;
            if (!code || !reference) {
                continue;
            }
            // one entry can carry several Joi codes that share the same English message
            for (const joiCode of reference.trim().split(/\s+/)) {
                languageMessages[joiCode] = entry.msgstr[0] || msgid;
            }
        }

        result[code.split('_')[0]] = languageMessages;
    }

    return result;
}

export default { messages };

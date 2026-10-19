import { MESSAGES_JSON } from './messages-data.js';

/** Joi message templates of one language, keyed by Joi error code (such as `any.required`) */
export type LanguageMessages = Record<string, string>;

/** Message templates keyed by language code (such as `de`) */
export type Messages = Record<string, LanguageMessages>;

/**
 * Returns the translated Joi error messages of every bundled language. The result is keyed by the
 * language part of the locale code (`de_DE` becomes `de`). A message without a translation falls
 * back to the English template. The translations are compiled into the package at build time,
 * and every call returns a new object the caller may modify.
 */
export async function messages(): Promise<Messages> {
    return JSON.parse(MESSAGES_JSON) as Messages;
}

export default { messages };

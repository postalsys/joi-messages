// gettext-parser 7.x ships no type declarations (and @types/gettext-parser tracks 8.x, which is
// ES-module-only and can not be used here). Only the part this package reads is declared.
declare module 'gettext-parser' {
    export interface GetTextTranslation {
        msgid: string;
        msgstr: string[];
        comments?: {
            reference?: string;
        };
    }

    export interface GetTextTranslations {
        translations: Record<string, Record<string, GetTextTranslation>>;
    }

    export const po: {
        parse(buffer: Buffer | string, defaultCharset?: string): GetTextTranslations;
    };
}

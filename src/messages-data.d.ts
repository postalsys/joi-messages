// Declares the module scripts/build.js generates into both builds (dist/<format>/messages-data.js)
// from translations/*.po. The translations are parsed at build time, so nothing reads a file or
// loads a gettext parser at runtime.

/** The Messages map as JSON, parsed by messages() into a fresh object on every call */
export declare const MESSAGES_JSON: string;

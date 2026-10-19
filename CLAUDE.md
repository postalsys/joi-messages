# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build             # produce dist/ (also runs on install and before publish via `prepare`, and before every test script)
npm test                  # build, then run the suite (node --import tsx --test over test/**/*.test.ts)
npm run test:coverage     # same suite under c8
npm run test:cjs          # build, then the CommonJS smoke test with require(esm) disabled
npm run lint              # type-check (tsc -p tsconfig.json), then eslint .
npm run lint:fix          # eslint . --fix
npm run typecheck         # the type-check alone
npm run format            # prettier --write
npm run format:check      # prettier --check
npm run pot               # regenerate translations/messages.pot from the installed joi
npm run update            # rm -rf node_modules package-lock.json && ncu -u && npm install
```

Run a single test by name with Node's built-in test runner (build first):

```bash
node --import tsx --test --test-name-pattern="sharing an English message" test/messages.test.ts
```

## Architecture

A tiny package that ships translations of Joi's validation error messages for EmailEngine. It is written in TypeScript under `src/` and published as a dual package: ES modules in `dist/esm/` and CommonJS in `dist/cjs/`, each with type declarations. The layout follows `../pubface`, `../nodemailer` and `../imapflow`.

- `src/index.ts` exports one async function, `messages()`, the `Messages` / `LanguageMessages` types, and a default export object `{ messages }`. `require('@postalsys/joi-messages')` returns an object with `messages` (plus `default`), the shape the JavaScript package had. `messages()` returns `{ <language>: { <joi code>: <template> } }`, a new object on every call (`JSON.parse` of the generated JSON), with no file reads and no parser at runtime. The package has no runtime dependencies.
- The message map is generated at build time. `scripts/build.js` reads `translations/translations.json` (a map of locale code such as `de_DE` to a `.po` file), parses each `.po` file with `gettext-parser` 7.x (a devDependency), and writes the map as a JSON string into `dist/esm/messages-data.js` and `dist/cjs/messages-data.js`, which `src/index.ts` imports (`src/messages-data.d.ts` declares that module for the type-check). The result is keyed by the language part of the locale (`de_DE` becomes `de`). Each entry's gettext reference comment (`#: any.unknown object.unknown`) lists the Joi codes it applies to; an empty `msgstr` falls back to the English `msgid`. Until 1.4.0 this ran at runtime; `test/messages.test.ts` pins the SHA-256 of `JSON.stringify(await messages())` to the value 1.4.0 produced, so a change to `translations/` or to the generator has to re-record it.
- `scripts/build.js` runs `tsc` with `tsconfig.esm.json` (`module: nodenext`) and `tsconfig.cjs.json` (`module: commonjs`, `--noCheck` since the ESM compile already type-checked), writes the generated `messages-data.js` into both builds, and writes a `package.json` with the module format into each output directory. `dist/` is gitignored and is what gets published.
- `package.json` `exports` maps `.` (import and require), `./index` and `./index.js` (the old main file, to the CommonJS build), `./package.json` and `./translations/*`. `files` publishes `dist/` and `translations/`.
- `scripts/gen-pot.js` (`npm run pot`, an ES module script) walks every type in the installed `joi` (a devDependency), collects each message template and writes `translations/messages.pot`. Several Joi codes share one English message (for example `any.unknown` and `object.unknown`), so one POT entry lists every code that uses it as space-separated references. Do not split them back into one entry per code: gettext keys on `msgid`, so duplicates would collapse and drop translations (fixed in 1.3.1).
- `translations/*.po` are the translations, maintained with Poedit (mostly machine translated). The `.mo` files beside them are Poedit output and are not read by the code. Adding a language means adding its `.po` file and an entry in `translations.json`, then rebuilding. The directory is still published at the package root even though nothing reads it at runtime any more.
- Tests (TypeScript, `node:test` through tsx, all against the build): `test/messages.test.ts` asserts that every Joi code resolves in every locale and that shared-message codes keep their translation; `test/package/package.test.ts` checks both builds, the exports map (old paths and `translations/*` included), the packed file list (translations included, sources left out), that the CommonJS entry loads nothing but its own two files, that a copy of `dist/` alone returns the translations, and consumers type-checked against the shipped declarations; `test/package/cjs-smoke.cjs` (`npm run test:cjs`, plain JavaScript on purpose) requires the package by name and loads translations through the CommonJS entry.
- Compiler settings: `tsconfig.base.json` (strict, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, `isolatedModules`, `stripInternal`). `@types/node` stays on the 20.x line and `typescript` on 6.x (`.ncurc.cjs`). Configs that must stay CommonJS use `.cjs` (`.ncurc.cjs`, `.prettierrc.cjs`) because `package.json` has `"type": "module"`.

## Consumers

EmailEngine (`../emailengine`) is the consumer: `lib/translations.js` does `require('@postalsys/joi-messages')` and calls `messages()` at startup to localize Joi validation errors. EmailEngine's `pkg` config bundles `node_modules/@postalsys/joi-messages/translations/*` as assets. Since the parsing moved into the build nothing reads them at runtime, but the directory stays published so that config keeps resolving.

## Platform constraints

EmailEngine ships as a standalone binary built with `@yao-pkg/pkg`. That binary snapshots a CommonJS module graph and cannot load ES modules, and EmailEngine supports Node 20 and later. Two rules follow:

- **Node.js 20 is the minimum.** Runtime code, tests and tooling must work on Node 20, 22 and 24 (`engines.node` is `>=20.0.0`; CI runs all three).
- **Everything that reaches runtime must be genuinely CommonJS.** The CommonJS build holds the real code, and `require()` of this package and of every runtime dependency must work with `--no-experimental-require-module`: Node 22+ (and 20.19) load ESM through `require()` by default, which would hide an ESM-only dependency until the pkg binary fails. A CJS wrapper around a dynamic `import()` does not count. Never add or upgrade to an ESM-only dependency; pin the last CommonJS major in `.ncurc.cjs` (`reject` or `target`) with a comment giving the reason. `gettext-parser` (a devDependency, used only by the build) is rejected there because 8.x is ESM-only and the generated messages are pinned against the 7.x output; stay on 7.x.

Check with `npm run test:cjs`, which runs `test/package/cjs-smoke.cjs` under `NODE_OPTIONS=--no-experimental-require-module`. CI runs it on Node 22.x, 24.x and latest, the versions where require(esm) is on by default.

## Critical constraints

- **Keep the `translations/` layout.** It stays at the package root with its file names, and in `files`. EmailEngine's binary build lists that directory as a `pkg` asset by path. The builds no longer read it, the build script does.
- **Keep every old require path.** `require('@postalsys/joi-messages')` and `.../index.js` must keep returning the same object.
- **After a joi upgrade**, run `npm run pot`, merge the new POT into each `.po` file, and make sure `npm test` passes (it fails for any Joi code missing from a locale, and the pinned hash of the messages changes, re-record it once the change is the intended one).
- **Releases are automated via release-please.** The version in `package.json` and `CHANGELOG.md` are owned by the bot; do not bump them by hand. npm publication happens from `.github/workflows/release.yaml` through trusted publishing (OIDC), so the workflow filename is load-bearing. Its `npm ci` runs `prepare`, which builds `dist/` before `npm publish`.

## Conventions

These mirror the conventions used across Postal Systems projects (see `../emailengine`).

**Git commits**

- Use Conventional Commits: `fix:` (patch release), `feat:` (minor release), and `chore:`/`docs:`/`ci:`/`build:`/`refactor:`/`style:`/`test:` for changes that should not trigger a release. release-please derives the version and changelog from these prefixes.
- Do not list Claude or any AI assistant as a co-author or co-contributor in commit messages or PR descriptions (no `Co-Authored-By` trailer).
- Append `[skip ci]` to commits that do not change runtime behavior (docs, comments, formatting) to avoid spending CI minutes. Never add it to a `fix:` or `feat:` commit, since those must run so the release workflow triggers. GitHub reads the marker off the HEAD commit of a push, so when a push mixes the two, the release-triggering commit has to be last.

**Code and docs style**

- No emojis anywhere in code or documentation, printable ASCII only.
- Use a single hyphen-minus (`-`) as a dash in user-facing strings and docs. Never use double hyphens, em dashes or en dashes.

**Before committing code changes**

1. `npm run format` and `npm run lint`
2. `npm test` and `npm run test:cjs`
3. For non-trivial changes, consider `/simplify` and `/security-review`.

**After pushing**

- Check the workflow runs for the push (`gh run list --branch <branch>`) and report their status. If a run fails for an unrelated or infrastructure reason (checkout reporting "account suspended", HTTP 403, other auth errors), check https://www.githubstatus.com/ for an active GitHub incident before assuming the change caused it.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # run the suite (node --test test/messages-test.js)
npm run test:coverage     # same suite under c8
npm run test:cjs          # the suite with require(esm) disabled (CommonJS guard)
npm run lint              # eslint .
npm run lint:fix          # eslint . --fix
npm run format            # prettier --write .
npm run format:check      # prettier --check .
npm run pot               # regenerate translations/messages.pot from the installed joi
npm run update            # rm -rf node_modules package-lock.json && ncu -u && npm install
```

Run a single test by name with Node's built-in test runner:

```bash
node --test --test-name-pattern="sharing an English message" test/messages-test.js
```

## Architecture

A tiny CommonJS package that ships translations of Joi's validation error messages for EmailEngine.

- `index.js` exports one async function, `messages()`. It reads `translations/translations.json` (a map of locale code such as `de_DE` to a `.po` file), parses each `.po` file with `gettext-parser`, and returns `{ <language>: { <joi code>: <template> } }`. The result is keyed by the language part of the locale (`de_DE` becomes `de`). Each entry's gettext reference comment (`#: any.unknown object.unknown`) lists the Joi codes it applies to; an empty `msgstr` falls back to the English `msgid`.
- `gen-pot.js` (`npm run pot`) walks every type in the installed `joi` (a devDependency), collects each message template and writes `translations/messages.pot`. Several Joi codes share one English message (for example `any.unknown` and `object.unknown`), so one POT entry lists every code that uses it as space-separated references. Do not split them back into one entry per code: gettext keys on `msgid`, so duplicates would collapse and drop translations (fixed in 1.3.1).
- `translations/*.po` are the translations, maintained with Poedit (mostly machine translated). The `.mo` files beside them are Poedit output and are not read by `index.js`. Adding a language means adding its `.po` file and an entry in `translations.json`.
- Tests (`test/messages-test.js`) assert that every Joi code resolves in every locale and that shared-message codes keep their translation.

## Consumers

EmailEngine (`../emailengine`) is the consumer: `lib/translations.js` calls `messages()` at startup to localize Joi validation errors. EmailEngine's `pkg` config bundles `node_modules/@postalsys/joi-messages/translations/*` as assets, so the runtime keeps reading the translation files from that directory.

## Platform constraints

EmailEngine ships as a standalone binary built with `@yao-pkg/pkg`. That binary snapshots a CommonJS module graph and cannot load ES modules, and EmailEngine supports Node 20 and later. Two rules follow:

- **Node.js 20 is the minimum.** Runtime code, tests and tooling must work on Node 20, 22 and 24 (`engines.node` is `>=20.0.0`; CI runs all three).
- **Everything that reaches runtime must be genuinely CommonJS.** `require()` of this package and of every runtime dependency must work with `--no-experimental-require-module`: Node 22+ (and 20.19) load ESM through `require()` by default, which would hide an ESM-only dependency until the pkg binary fails. A CJS wrapper around a dynamic `import()` does not count. Never add or upgrade to an ESM-only dependency; pin the last CommonJS major in `.ncurc.js` (`reject` or `target`) with a comment giving the reason. `gettext-parser` is rejected there because 8.x is ESM-only; stay on 7.x.

Check with `npm run test:cjs`, which runs the suite under `NODE_OPTIONS=--no-experimental-require-module`. CI runs it on Node 22.x and 24.x, the versions where require(esm) is on by default.

## Critical constraints

- **Keep the `translations/` layout.** EmailEngine's binary build lists that directory as a `pkg` asset by path.
- **After a joi upgrade**, run `npm run pot`, merge the new POT into each `.po` file, and make sure `npm test` passes (it fails for any Joi code missing from a locale).
- **Releases are automated via release-please.** The version in `package.json` and `CHANGELOG.md` are owned by the bot; do not bump them by hand. npm publication happens from `.github/workflows/release.yaml` through trusted publishing (OIDC), so the workflow filename is load-bearing.

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
2. `npm test`
3. For non-trivial changes, consider `/simplify` and `/security-review`.

**After pushing**

- Check the workflow runs for the push (`gh run list --branch <branch>`) and report their status. If a run fails for an unrelated or infrastructure reason (checkout reporting "account suspended", HTTP 403, other auth errors), check https://www.githubstatus.com/ for an active GitHub incident before assuming the change caused it.

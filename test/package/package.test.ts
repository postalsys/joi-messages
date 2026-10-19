import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// These tests exercise the compiled output in dist/ (built by the pretest script) through the
// package.json exports map, the same way an installed copy of the package is loaded. Node
// resolves the package name to the package itself when the specifier is used from inside it.
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tsc = require.resolve('typescript/bin/tsc');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// A non-literal specifier keeps TypeScript from resolving the built types at type-check time,
// when dist/ may not exist yet
const packageName: string = '@postalsys/joi-messages';

const translationFiles = fs.readdirSync(path.join(root, 'translations'));

describe('Built package', { timeout: 120 * 1000 }, () => {
    it('ships both module formats with type declarations', () => {
        for (const format of ['esm', 'cjs']) {
            for (const file of ['index.js', 'index.d.ts', 'messages-data.js']) {
                assert.ok(fs.existsSync(path.join(root, 'dist', format, file)), `${format}/${file}`);
            }
        }
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist', 'esm', 'package.json'), 'utf8')), { type: 'module' });
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'dist', 'cjs', 'package.json'), 'utf8')), { type: 'commonjs' });
    });

    it('points every package.json entry at an existing file', () => {
        assert.equal(pkg.main, './dist/cjs/index.js');
        for (const target of [pkg.main, pkg.types, pkg.exports['.'].import, pkg.exports['.'].require, pkg.exports['./index'], pkg.exports['./index.js']]) {
            assert.ok(fs.existsSync(path.join(root, target)), target);
        }
    });

    it('packs the build and the translations, and leaves the sources and tests out', () => {
        // --ignore-scripts: prepare would rebuild dist/ under the running suite
        const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        const files: string[] = JSON.parse(result.stdout)[0].files.map((file: { path: string }) => file.path);
        for (const required of [
            'package.json',
            'dist/cjs/index.js',
            'dist/cjs/index.d.ts',
            'dist/cjs/messages-data.js',
            'dist/cjs/package.json',
            'dist/esm/index.js',
            'dist/esm/messages-data.js',
            'dist/esm/package.json',
            // EmailEngine lists node_modules/@postalsys/joi-messages/translations/* as pkg assets
            ...translationFiles.map(file => `translations/${file}`)
        ]) {
            assert.ok(files.includes(required), `${required} is packed`);
        }
        for (const file of files) {
            assert.ok(!/^(src|test|scripts|coverage)\//.test(file), `${file} must not be packed`);
        }
    });

    describe('CommonJS build', () => {
        it('resolves require() to the CommonJS entry point, also by the old file path', () => {
            const entry = path.join(root, 'dist', 'cjs', 'index.js');
            assert.equal(require.resolve(packageName), entry);
            assert.equal(require.resolve(`${packageName}/index.js`), entry);
            assert.equal(require.resolve(`${packageName}/index`), entry);
        });

        it('keeps the shape of the pre-TypeScript module', () => {
            const joiMessages = require(packageName);
            assert.equal(typeof joiMessages.messages, 'function');
            assert.equal(joiMessages.default.messages, joiMessages.messages);
        });

        it('has no runtime dependencies and loads nothing but its own build', () => {
            assert.equal(pkg.dependencies, undefined);
            const script = `require(${JSON.stringify(path.join(root, pkg.main))}); console.log(JSON.stringify(Object.keys(require.cache)))`;
            const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
            assert.equal(result.status, 0, result.stderr);
            const cjsRoot = path.join(root, 'dist', 'cjs');
            assert.deepEqual(JSON.parse(result.stdout).sort(), [path.join(cjsRoot, 'index.js'), path.join(cjsRoot, 'messages-data.js')]);
        });

        it('returns the translations without reading translations/ at runtime', async () => {
            // a copy of the build alone, with no translations/ next to it
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joi-messages-dist-'));
            try {
                fs.cpSync(path.join(root, 'dist'), path.join(dir, 'dist'), { recursive: true });
                const copy = require(path.join(dir, 'dist', 'cjs', 'index.js'));
                const result = await copy.messages();
                assert.equal(result.de['any.unknown'], '{{#label}} ist nicht erlaubt');
                assert.deepEqual(result, await require(packageName).messages());
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('returns a new object on every call', async () => {
            const { messages } = require(packageName);
            const first = await messages();
            first.de['any.unknown'] = 'changed';
            assert.equal((await messages()).de['any.unknown'], '{{#label}} ist nicht erlaubt');
        });

        it('exposes the translation files by path', () => {
            assert.equal(require.resolve(`${packageName}/translations/translations.json`), path.join(root, 'translations', 'translations.json'));
            assert.equal(require.resolve(`${packageName}/translations/de.po`), path.join(root, 'translations', 'de.po'));
        });
    });

    describe('ES module build', () => {
        it('resolves import to the ES module entry point', async () => {
            const direct = await import(new URL('../../dist/esm/index.js', import.meta.url).href);
            const byName = await import(packageName);
            assert.equal(byName.messages, direct.messages);
        });

        it('exposes named and default exports and gives the same result as the CommonJS build', async () => {
            const joiMessages = await import(packageName);
            assert.equal(typeof joiMessages.messages, 'function');
            assert.equal(joiMessages.default.messages, joiMessages.messages);
            assert.deepEqual(await joiMessages.messages(), await require(packageName).messages());
        });
    });

    // each tsc run has its own temporary project, so they run side by side
    describe('type declarations', { concurrency: true }, () => {
        const esmConsumer = `
import { messages } from '@postalsys/joi-messages';
import joiMessages from '@postalsys/joi-messages';
import type { Messages, LanguageMessages } from '@postalsys/joi-messages';

export async function run(): Promise<string | undefined> {
    const all: Messages = await messages();
    const other = await joiMessages.messages();
    const de: LanguageMessages | undefined = other['de'];
    void all;
    return de?.['any.required'];
}
`;

        const cjsConsumer = `
import joiMessages = require('@postalsys/joi-messages');

export async function run(): Promise<number> {
    const all = await joiMessages.messages();
    return Object.keys(all).length;
}
`;

        // Type-checks a consumer against the built declarations the way an installed copy is
        // resolved: the package is linked into a temporary project, so the specifier goes
        // through the package.json exports map
        const typeCheck = async (source: string, compilerOptions: Record<string, unknown>, type?: string): Promise<{ status: number; output: string }> => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'joi-messages-types-'));
            try {
                fs.mkdirSync(path.join(dir, 'node_modules', '@types'), { recursive: true });
                fs.mkdirSync(path.join(dir, 'node_modules', '@postalsys'), { recursive: true });
                fs.symlinkSync(root, path.join(dir, 'node_modules', '@postalsys', 'joi-messages'), 'dir');
                fs.symlinkSync(path.join(root, 'node_modules', '@types', 'node'), path.join(dir, 'node_modules', '@types', 'node'), 'dir');
                fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true, ...(type ? { type } : {}) }));
                fs.writeFileSync(path.join(dir, 'consumer.ts'), source);
                fs.writeFileSync(
                    path.join(dir, 'tsconfig.json'),
                    JSON.stringify({
                        compilerOptions: {
                            target: 'ES2022',
                            lib: ['ES2023'],
                            types: ['node'],
                            strict: true,
                            exactOptionalPropertyTypes: true,
                            noEmit: true,
                            ...compilerOptions
                        },
                        include: ['consumer.ts']
                    })
                );
                return await new Promise(resolve => {
                    execFile(process.execPath, [tsc, '-p', path.join(dir, 'tsconfig.json')], (err, stdout, stderr) =>
                        resolve({ status: err ? Number(err.code) || 1 : 0, output: stdout + stderr })
                    );
                });
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        };

        const node16 = { module: 'node16', moduleResolution: 'node16' };

        for (const [label, options, type] of [
            ['a node16 ES module project', node16, 'module'],
            ['a node16 CommonJS project', node16, undefined],
            ['bundler resolution', { module: 'esnext', moduleResolution: 'bundler' }, 'module']
        ] as const) {
            it(`type-check an ES module style consumer in ${label}`, async () => {
                const { status, output } = await typeCheck(esmConsumer, { ...options, esModuleInterop: true }, type);
                assert.equal(status, 0, output);
            });
        }

        it('type-check a CommonJS consumer', async () => {
            const { status, output } = await typeCheck(cjsConsumer, node16);
            assert.equal(status, 0, output);
        });
    });
});

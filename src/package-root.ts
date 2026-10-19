import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The package root, where translations/ lives. This module sits at dist/<format>/package-root.js,
// two levels down. import.meta does not exist in CommonJS, so scripts/build.js replaces the
// CommonJS output of this module with the __dirname equivalent.
export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

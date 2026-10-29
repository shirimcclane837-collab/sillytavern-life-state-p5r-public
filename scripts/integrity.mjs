import { readFile, writeFile } from 'node:fs/promises';
import { createNativeRuntime } from '../src/runtime.js';

const core = createNativeRuntime(globalThis).createCore();
const report = core.getAuthorIntegrityReport();
if (process.argv.includes('--write')) {
    const path = new URL('../src/runtime.js', import.meta.url);
    const source = await readFile(path, 'utf8');
    await writeFile(path, source.replace(
        /const AUTHOR_INTEGRITY_EXPECTED_SHA256 = '[a-f0-9]+';/,
        `const AUTHOR_INTEGRITY_EXPECTED_SHA256 = '${report.actualSha256}';`,
    ));
    console.log('Updated the P5R derived-build fingerprint. This is not an upstream signature.');
} else {
    if (!report.ok) throw new Error('Derived build fingerprint differs. Run npm run integrity after reviewing runtime changes.');
    console.log('P5R derived-build integrity verified.');
}

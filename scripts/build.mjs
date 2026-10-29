import { mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, ['scripts/integrity.mjs'], { cwd: root, stdio: 'inherit' });
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const output = path.join(root, 'release', `sillytavern-life-state-p5r-${manifest.version}`);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.js', 'manifest.json', 'README.md', 'src', 'upstream', 'docs']) {
    await cp(path.join(root, name), path.join(output, name), { recursive: true });
}
const files = {};
async function hashDirectory(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await hashDirectory(file);
        else if (entry.name !== 'checksums.json') files[path.relative(output, file)] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
}
await hashDirectory(output);
await writeFile(path.join(output, 'checksums.json'), JSON.stringify({ schema: 'LIFE_STATE_P5R_CHECKSUMS_V1', version: manifest.version, files }, null, 2) + '\n');
console.log(`Installable extension: ${output}`);

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

await mkdir('src/ui/generated', { recursive: true });
await build({
    entryPoints: ['src/ui/react/menu.jsx'], outfile: 'src/ui/generated/menu.js',
    bundle: true, format: 'esm', minify: true, target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
    external: ['../art.js'], legalComments: 'linked',
});
execFileSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'src/ui/react/tailwind.css', '-o', 'src/ui/generated/tailwind.css', '--minify'], { stdio: 'inherit' });
console.log('Bundled React, Framer Motion and isolated Tailwind utilities.');

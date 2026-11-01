import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist-site');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', '.nojekyll']) {
  await copyFile(path.join(root, file), path.join(out, file));
}

await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
await cp(path.join(root, 'dist-report'), path.join(out, 'report'), { recursive: true });

console.log(`dist-site ready: ${out}`);

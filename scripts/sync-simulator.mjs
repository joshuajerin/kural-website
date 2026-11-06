import { cp, mkdir, rm } from 'node:fs/promises';

// Publish only generated frontend files. Preserve the separately managed robot assets.
await mkdir('public/sim', { recursive: true });
await rm('public/sim/assets', { recursive: true, force: true });
await cp('simulator/dist/assets', 'public/sim/assets', { recursive: true });
await cp('simulator/dist/index.html', 'public/sim/index.html');
await cp('simulator/dist/favicon.svg', 'public/sim/favicon.svg');

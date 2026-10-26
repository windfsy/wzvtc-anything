import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tag = String(pkg.version).includes('-') ? 'next' : 'latest';
console.log(`tag=${tag}`);

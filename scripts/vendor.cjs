const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'app/vendor'), { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/@shiguredo/rnnoise-wasm/dist/rnnoise.js'), path.join(root, 'app/vendor/rnnoise.js'));
fs.copyFileSync(path.join(root, 'node_modules/@shiguredo/rnnoise-wasm/LICENSE'), path.join(root, 'app/vendor/LICENSE-rnnoise-wasm.txt'));

#!/usr/bin/env node
// One-shot precompiler. Transforms every *.jsx in this folder into dist/*.js
// using the vendored babel.min.js loaded into a Node vm sandbox. No npm
// install required — Node 18+ has everything needed. Run after editing JSX:
//   node frontend/build.js
//
// The output is committed to the repo so users can still "just open the
// HTML" with no build step on their machine.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FRONT = __dirname;
const DIST = path.join(FRONT, 'dist');
const BABEL_PATH = path.join(FRONT, 'babel.min.js');

const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(BABEL_PATH, 'utf8'), sandbox, { filename: 'babel.min.js' });
const Babel = sandbox.Babel;
if (!Babel) { console.error('Babel failed to load from babel.min.js'); process.exit(1); }

fs.mkdirSync(DIST, { recursive: true });

const sources = fs.readdirSync(FRONT).filter(f => f.endsWith('.jsx'));
let compiled = 0;
for (const file of sources) {
  const src = fs.readFileSync(path.join(FRONT, file), 'utf8');
  const out = Babel.transform(src, {
    presets: ['react'],
    compact: false,
    filename: file,
  });
  const outName = file.replace(/\.jsx$/, '.js');
  fs.writeFileSync(path.join(DIST, outName), out.code, 'utf8');
  compiled++;
}
console.log(`Compiled ${compiled} JSX file(s) -> ${path.relative(process.cwd(), DIST)}/`);

// Compile the standalone Worker with the project's existing TypeScript compiler.
const fs = require('fs');
const ts = require('typescript');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/server/foodSearch.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
fs.mkdirSync(path.join(root, 'dist/server'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/server/index.js'), output);

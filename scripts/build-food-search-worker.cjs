// Compile the standalone Worker with the project's existing TypeScript compiler.
const fs = require('fs');
const ts = require('typescript');
const path = require('path');
const root = path.resolve(__dirname, '..');
// Each server module becomes its own file; wrangler bundles index.js and what it imports.
const compile = (from, to) => {
  const source = fs.readFileSync(path.join(root, 'src/server', from), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    // Give relative imports their file extension, so the output is valid ES modules as-is.
    .replace(/from '(\.\/[\w-]+)'/g, "from '$1.js'");
  fs.writeFileSync(path.join(root, 'dist/server', to), output);
};
fs.mkdirSync(path.join(root, 'dist/server'), { recursive: true });
compile('foodSearch.ts', 'index.js');
compile('waitlist.ts', 'waitlist.js');

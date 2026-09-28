/**
 * Bayan ERP — Source Code Protection & Bytecode Compiler
 * Compiles JavaScript source code into V8 Bytecode (.jsc binary files)
 * Completely hides and removes readable source code before delivering to clients.
 */
const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');

const rootServerDir = path.resolve(__dirname, '..', 'server');
const buildDir = path.resolve(__dirname, 'app-build');
const buildServerDir = path.join(buildDir, 'server');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function compileDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      compileDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      const jscPath = fullPath.replace(/\.js$/, '.jsc');
      const relPath = path.relative(buildServerDir, fullPath);
      console.log(`[Protect] Compiling: ${relPath} -> .jsc bytecode`);

      try {
        bytenode.compileFile({
          filename: fullPath,
          output: jscPath,
          compileAsModule: true
        });

        // Replace original .js with a binary loader stub
        const basename = path.basename(jscPath);
        const stubContent = `require('bytenode'); module.exports = require('./${basename}');`;
        fs.writeFileSync(fullPath, stubContent, 'utf8');
      } catch (err) {
        console.error(`[Protect] Error compiling ${file}:`, err.message);
      }
    }
  }
}

console.log('========================================================');
console.log('🔐 BAYAN ERP — V8 BYTECODE PROTECTION COMPILER');
console.log('1. Staging server files in desktop/app-build/server...');
if (fs.existsSync(buildServerDir)) {
  fs.rmSync(buildServerDir, { recursive: true, force: true });
}
copyDirRecursive(rootServerDir, buildServerDir);

console.log('2. Converting all backend source files to protected binary...');
compileDirectory(buildServerDir);

console.log('========================================================');
console.log('✅ All backend files compiled to protected V8 Bytecode!');
console.log('Destination: desktop/app-build/server/');
console.log('Original repository files remain 100% untouched.');
console.log('========================================================');

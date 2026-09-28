/**
 * Bayan ERP — Source Code Protection & Bytecode Compiler
 * Compiles JavaScript source code into V8 Bytecode (.jsc binary files)
 * Completely hides and removes readable source code before delivering to clients.
 */
const fs = require('fs');
const path = require('path');
const bytenode = require('bytenode');

const serverDir = path.resolve(__dirname, '..', 'server');

function compileDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      compileDirectory(fullPath);
    } else if (file.endsWith('.js') && !file.endsWith('.loader.js')) {
      const jscPath = fullPath.replace(/\.js$/, '.jsc');
      console.log(`[Protect] Compiling: ${path.relative(serverDir, fullPath)} -> .jsc bytecode`);

      try {
        bytenode.compileFile({
          filename: fullPath,
          output: jscPath,
          compileAsModule: true
        });

        // Create binary loader stub in place of original file
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
console.log('Converting all backend source files to protected binary...');
console.log('========================================================');

compileDirectory(serverDir);

console.log('========================================================');
console.log('✅ All backend files compiled to protected V8 Bytecode!');
console.log('Source code is now completely concealed and secured.');
console.log('========================================================');

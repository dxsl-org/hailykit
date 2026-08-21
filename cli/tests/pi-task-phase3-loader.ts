import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const EXT_ROOT = path.resolve('kit', 'pi', 'extensions', 'hailykit');

function compileFile(outRoot: string, relativePath: string): void {
  const srcPath = path.join(EXT_ROOT, relativePath);
  const outPath = path.join(outRoot, relativePath.replace(/\.ts$/, '.js'));
  const source = fs.readFileSync(srcPath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: srcPath,
    reportDiagnostics: true,
  });
  if (result.diagnostics?.length) {
    const message = ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    });
    throw new Error(message);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, result.outputText, 'utf8');
}

function compileTree(outRoot: string, relativeDir: string): void {
  for (const entry of fs.readdirSync(path.join(EXT_ROOT, relativeDir), { withFileTypes: true })) {
    const next = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) compileTree(outRoot, next);
    else if (entry.isFile() && entry.name.endsWith('.ts')) compileFile(outRoot, next);
  }
}

function compileAll(relativePath: string): string {
  const outRoot = fs.mkdtempSync(path.resolve('.test-build', 'pi-task-'));
  compileTree(outRoot, 'task');
  if (fs.existsSync(path.join(EXT_ROOT, 'plan'))) compileTree(outRoot, 'plan');
  if (fs.existsSync(path.join(EXT_ROOT, 'presets'))) compileTree(outRoot, 'presets');
  if (fs.existsSync(path.join(EXT_ROOT, 'safety'))) compileTree(outRoot, 'safety');
  for (const file of fs.readdirSync(EXT_ROOT).filter((entry) => entry.endsWith('.ts'))) compileFile(outRoot, file);
  return outRoot;
}

export async function loadTaskModule<T>(fileName: string): Promise<T> {
  const relativePath = fileName === 'index.ts' || fileName.includes(path.sep) ? fileName : path.join('task', fileName);
  const outRoot = compileAll(relativePath);
  return require(path.join(outRoot, relativePath.replace(/\.ts$/, '.js'))) as T;
}

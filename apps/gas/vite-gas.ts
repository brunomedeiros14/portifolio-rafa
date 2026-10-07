/**
 * Plugin Vite "gasDeploy" (enforce: 'post').
 *
 * Roda em `generateBundle`, ANTES do Vite escrever qualquer coisa no dist/ —
 * auditoria reprovada ⇒ o build aborta e o dist/ fica intocado.
 *
 * Faz quatro coisas:
 *  1. transpila `src/server/*.ts` arquivo a arquivo (esbuild `transformSync`,
 *     sem bundle) → `dist/*.js`. Falha se qualquer arquivo tiver `import`/
 *     `export` de topo (quebraria o escopo global do GAS).
 *  2. grava `dist/appsscript.json` e `dist/login.html` (cópia do index).
 *  3. audita o `index.html` final (inline 100%, parseável, dentro do orçamento,
 *     envelope IIFE) — ver `cms_spec.md` §11.
 *  4. `conferirApi`: toda função `api*` que a UI chama existe no servidor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import type { OutputAsset, Plugin } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SERVER_DIR = path.join(ROOT, 'src/server');
const UI_DIR = path.join(ROOT, 'src/ui');
const BUDGET_HTML = 400 * 1024;

function fail(msg: string): never {
  throw new Error(`gas-deploy: ${msg}`);
}

function port(name: string): string {
  return name.replace(/\.ts$/, '.js');
}

/** Só strings de saída de esbuild viram arquivo; tipos puros somem. */
function transpilaServer(dir: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .sort()) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    if (/^\s*(?:import|export)\b/m.test(src)) {
      fail(
        `arquivo do servidor ${file} tem import/export de topo — quebra o escopo global do GAS.`,
      );
    }
    const { code } = transformSync(src, {
      loader: 'ts',
      target: 'es2020',
      charset: 'utf8',
    });
    if (code.trim()) result.set(port(file), code);
  }
  return result;
}

function stringSource(source: unknown): string {
  if (typeof source === 'string') return source;
  return Buffer.from(source as Uint8Array).toString('utf8');
}

function auditaHtml(html: string): void {
  const size = Buffer.byteLength(html, 'utf8');
  if (size > BUDGET_HTML) {
    fail(`HTML tem ${(size / 1024).toFixed(0)} KiB e o orçamento é ${BUDGET_HTML / 1024} KiB.`);
  }

  if (!/^<!doctype html>\s*<html lang="pt-BR">/i.test(html)) {
    fail('falta <!doctype html> ou <html lang="pt-BR"> no começo do HTML.');
  }

  const rest = html.replace(html.match(/^<!doctype html>\s*<html[^>]*>/i)?.[0] ?? '', '');
  if (/(?:^|\s)<(?:script|link)\b[^>]*\b(?:src|href)=/i.test(rest)) {
    fail('sobrou <script src> ou <link href> — tudo tem que ser inline.');
  }

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  if (!scripts.some((m) => /\btype=(?:"|')module(?:"|')/.test(m[1]))) {
    fail(
      'o bundle precisa ficar num <script type="module"> (defer implícito; sem isso a tela abre em branco).',
    );
  }

  const code = scripts.map((m) => m[2]).join('\n');
  try {
    new Function(code); // só parseia — o V8 valida o SyntaxError sem executar
  } catch (err) {
    fail(`bundle inline não faz parse: ${err instanceof Error ? err.message : String(err)}`);
  }

  const trimmed = code.trim();
  if (!/^\(function\s*\(\)\s*\{/.test(trimmed) || !/^\(function[\s\S]*\}\)\(\);$/.test(trimmed)) {
    fail(
      'bundle não é o IIFE esperado (o primeiro <script type="module"> precisa começar com "(function () {" e terminar com "})();").',
    );
  }
  if (/^\s*(?:import|export)\b/m.test(code)) {
    fail('bundle tem import/export de topo.');
  }
}

/** Nomes api* que a UI chama — contrato em `src/ui/lib/gas.ts` (array API_NOMES). */
function apiNomesUsados(): string[] {
  const file = path.join(UI_DIR, 'lib', 'gas.ts');
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  const match = src.match(/API_NOMES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/\bapi[A-Z]\w*\b/g)].map((m) => m[0]);
}

function conferirApi(defs: Map<string, string>): void {
  const nomes = apiNomesUsados();
  if (nomes.length === 0) return;
  const server = [...defs.values()].join('\n');
  for (const nome of nomes) {
    if (!new RegExp(`\\bfunction\\s+${nome}\\s*\\(`, 'm').test(server)) {
      fail(`a UI chama ${nome}(), mas o servidor não define essa função.`);
    }
  }
}

export function gasDeploy(): Plugin {
  return {
    name: 'gas-deploy',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const defs = transpilaServer(SERVER_DIR);
      conferirApi(defs);

      for (const [name, code] of defs) {
        this.emitFile({ type: 'asset', fileName: name, source: code });
      }

      const appsscript = fs.readFileSync(path.join(ROOT, 'appsscript.json'), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'appsscript.json', source: appsscript });

      const htmlEntry = Object.entries(bundle).find(
        ([name, asset]) => name.endsWith('.html') && asset.type === 'asset',
      );
      if (!htmlEntry) fail('não achei o index.html no bundle.');
      const [htmlName, htmlAsset] = htmlEntry;
      const html = stringSource((htmlAsset as OutputAsset).source);
      auditaHtml(html);
      // Remove o original do dist e emite o nosso par (o mesmo bundle serve
      // login e painel — doGet.htm diferencia por createHtmlOutputFromFile).
      delete bundle[htmlName];
      this.emitFile({ type: 'asset', fileName: 'index.html', source: html });
      this.emitFile({ type: 'asset', fileName: 'login.html', source: html });
    },
  };
}

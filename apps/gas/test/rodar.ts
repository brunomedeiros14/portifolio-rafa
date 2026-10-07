/**
 * Roda o bundle do servidor num `node:vm` do Bun com mocks do Apps Script.
 * O mock é intencionalmente minimalista: só o que os testes exercitam —
 * planilha em memória, Script Properties, cache com TTL, Drive fake, digest.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { transformSync } from 'esbuild';

const SERVER_DIR = path.join(import.meta.dir, '../src/server');

/** Transpila os `.ts` do servidor juntos (mesmo `loader` do `vite-gas.ts`). */
export function filesToBundleJs(): string {
  const parts = fs
    .readdirSync(SERVER_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => fs.readFileSync(path.join(SERVER_DIR, f), 'utf8'));
  const code = transformSync(parts.join('\n'), { loader: 'ts', target: 'es2020' }).code;
  return (
    code +
    '\n;globalThis.__GAS = { ' +
    [
      'Events',
      'Auth',
      'Files',
      'Publish',
      'Slug',
      'Lock',
      'Serve',
      'apiAuthStatus',
      'apiLogin',
      'apiLogout',
      'apiList',
      'apiConfig',
      'apiCreate',
      'apiGet',
      'apiSave',
      'apiDelete',
      'apiUploadPhoto',
      'apiSetCover',
      'apiRemovePhoto',
      'apiListFiles',
      'apiPublication',
      'apiChecklist',
      'apiPublish',
      'doGet',
      'doPost',
      'repairPhotoNames',
      'republishEvent',
    ].join(', ') +
    ' };'
  );
}

export type GLOBAL_CTX = Record<string, any>;
export type Context = {
  /** Namespace `__GAS` do bundle (Events, Auth, Files, Publish, Slug, api*…). */
  gas: GLOBAL_CTX;
  /** Globals "reais" do sandbox (mocks: PropertiesService, Utilities, …). */
  gl: GLOBAL_CTX;
  /** Falas para os testes controlarem o ambiente. */
  setMacrossUrl: (url: string) => void;
  /** Acha a aba `Eventos` de uma planilha criada pelo `ensureSetup`. */
  sheet: (id: string) => any;
};

// ---------------------------------------------------------------- Sheets ---

class FakeRange {
  constructor(
    private sheet: FakeSheet,
    private row: number,
    private col: number,
    private rows: number,
    private cols: number,
  ) {}
  getValues(): any[][] {
    const out: any[][] = [];
    for (let i = 0; i < this.rows; i++) {
      const line: any[] = [];
      for (let j = 0; j < this.cols; j++) {
        const v = this.sheet.get(this.row + i, this.col + j);
        line.push(v === undefined ? '' : v);
      }
      out.push(line);
    }
    return out;
  }
  setValues(cells: any[][]): FakeRange {
    cells.forEach((row, i) => row.forEach((v, j) => this.sheet.set(this.row + i, this.col + j, v)));
    return this;
  }
  clearContent(): FakeRange {
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < this.cols; j++) this.sheet.set(this.row + i, this.col + j, '');
    return this;
  }
}

export class FakeSheet {
  private grid = new Map<string, unknown>();
  private frozen = false;
  constructor(private name: string) {}
  getLastRow(): number {
    let max = 0;
    for (const key of this.grid.keys()) {
      const r = Number(key.split(',')[0]);
      if (r > max) max = r;
    }
    return max;
  }
  getLastColumn(): number {
    let max = 0;
    for (const key of this.grid.keys()) {
      const c = Number(key.split(',')[1]);
      if (c > max) max = c;
    }
    return max;
  }
  get(r: number, c: number): unknown {
    return this.grid.get(`${r},${c}`);
  }
  set(r: number, c: number, v: unknown): void {
    this.grid.set(`${r},${c}`, v);
  }
  getRange(r: number, c: number, rows = 1, cols = 1): FakeRange {
    return new FakeRange(this, r, c, rows, cols);
  }
  getDataRange(): FakeRange {
    return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
  }
  appendRow(values: unknown[]): FakeSheet {
    const r = this.getLastRow() + 1;
    values.forEach((v, i) => this.set(r, i + 1, v));
    return this;
  }
  setFrozenRows(): FakeSheet {
    this.frozen = true;
    return this;
  }
  isFrozen(): boolean {
    return this.frozen;
  }
  deleteColumns(col: number, num: number): void {
    for (const key of [...this.grid.keys()]) {
      const c = Number(key.split(',')[1]);
      if (c >= col && c < col + num) this.grid.delete(key);
    }
  }
}

class FakeSpreadsheet {
  private sheets: FakeSheet[] = [];
  constructor(private id: string) {}
  getId(): string {
    return this.id;
  }
  getSheetByName(name: string): FakeSheet | null {
    return this.sheets.find((s) => s['name'] === name) || null;
  }
  insertSheet(name: string): FakeSheet {
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }
}

// ---------------------------------------------------------------- Drive ----

class FakeIterator {
  constructor(private items: any[]) {
    this.items = items.slice();
  }
  hasNext(): boolean {
    return this.items.length > 0;
  }
  next(): any {
    return this.items.shift();
  }
}

export class FakeFile {
  private trashed = false;
  private publicLink = false;
  constructor(
    private id: string,
    private name_: string,
    public bytes = 10,
    private folder: FakeFolder | null = null,
  ) {}
  getId(): string {
    return this.id;
  }
  getName(): string {
    return this.name_;
  }
  setName(name: string): FakeFile {
    this.name_ = name;
    return this;
  }
  setTrashed(t: boolean): FakeFile {
    this.trashed = t;
    if (this.folder) this.folder.detach(this);
    return this;
  }
  isTrashed(): boolean {
    return this.trashed;
  }
  setSharing(): FakeFile {
    this.publicLink = true;
    return this;
  }
  isPublic(): boolean {
    return this.publicLink;
  }
}

export class FakeFolder {
  private files: FakeFile[] = [];
  private folders: FakeFolder[] = [];
  private name_: string;
  constructor(
    private id: string,
    name: string,
  ) {
    this.name_ = name;
  }
  getId(): string {
    return this.id;
  }
  getName(): string {
    return this.name_;
  }
  setName(name: string): void {
    this.name_ = name;
  }
  createFolder(name: string): FakeFolder {
    const folder = new FakeFolder(`fld_${name}_${Math.random().toString(36).slice(2)}`, name);
    this.folders.push(folder);
    return folder;
  }
  createFile(blob: any): FakeFile {
    const file = new FakeFile(
      `file_${blob.getName()}_${Math.random().toString(36).slice(2)}`,
      blob.getName(),
      blob.bytes || 10,
      this,
    );
    this.files.push(file);
    return file;
  }
  getFoldersByName(name: string): FakeIterator {
    return new FakeIterator(this.folders.filter((f) => f.getName() === name));
  }
  getFiles(): FakeIterator {
    return new FakeIterator(this.files);
  }
  getFilesByName(name: string): FakeIterator {
    return new FakeIterator(this.files.filter((f) => f.getName() === name));
  }
  detach(file: FakeFile): void {
    this.files = this.files.filter((f) => f !== file);
  }
  findFile(id: string): FakeFile | null {
    for (const file of this.files) if (file.getId() === id) return file;
    for (const sub of this.folders) {
      const hit = sub.findFile(id);
      if (hit) return hit;
    }
    return null;
  }
  findFolder(id: string): FakeFolder | null {
    for (const sub of this.folders) if (sub.getId() === id) return sub;
    for (const sub of this.folders) {
      const hit = sub.findFolder(id);
      if (hit) return hit;
    }
    return null;
  }
  listFilesRec(): FakeFile[] {
    const out: FakeFile[] = this.files.slice();
    for (const sub of this.folders) out.push(...sub.listFilesRec());
    return out;
  }
}

// --------------------------------------------------------------- Mocks -----

function makeMocks() {
  const props = new Map<string, string>();
  const cache = new Map<string, { v: string; exp: number }>();
  const spreadsheets = new Map<string, FakeSpreadsheet>();
  const driveRoot = new FakeFolder('root0', 'root');
  let macrossUrl = 'https://script.google.com/macros/s/AKfycb_TEST/exec';

  const serviceCtx: Record<string, any> = {
    console,
    UrlFetchApp: {
      fetch(_url: string, params?: any) {
        return {
          getResponseCode: () => (params && params.code !== undefined ? params.code : 204),
          getContentText: () => (params && params.body ? String(params.body) : ''),
        };
      },
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
      // Projeto standalone: o lock de documento não existe (null), como num
      // Apps Script sem container — o fallback do Lock.ts é que resolve.
      getDocumentLock: () => null,
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => macrossUrl }),
    },
    Session: {
      getScriptTimeZone: () => 'America/Sao_Paulo',
      getActiveUser: () => ({ getEmail: () => '' }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'utf8' },
      getUuid: () => crypto.randomUUID().replace(/-/g, ''),
      computeDigest(_algo: string, text: string) {
        const digest = crypto.createHash('sha256').update(String(text), 'utf8').digest();
        return [...digest].map((b) => (b >= 128 ? b - 256 : b));
      },
      base64Decode(b64: string) {
        return [...Buffer.from(String(b64), 'base64')];
      },
      base64Encode(bytes: any) {
        return Buffer.from(bytes).toString('base64');
      },
      newBlob(bytes: number[], mime: string, name: string) {
        return { getName: () => name, mime, bytes: bytes.length };
      },
      formatDate() {
        return '1970-01-01';
      },
      sleep() {},
    },
    SpreadsheetApp: {
      create(name: string) {
        const id = `sheet_${name}_${Math.random().toString(36).slice(2)}`;
        const ss = new FakeSpreadsheet(id);
        spreadsheets.set(id, ss);
        return ss;
      },
      openById(id: string) {
        const ss = spreadsheets.get(id);
        if (!ss) throw new Error(`Planilha não encontrada: ${id}`);
        return ss;
      },
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
      createFolder(name: string) {
        return driveRoot.createFolder(name);
      },
      getFolderById(id: string) {
        if (id === 'root0') return driveRoot;
        const found = driveRoot.findFolder(id);
        if (!found) throw new Error(`Pasta não encontrada: ${id}`);
        return found;
      },
      getFileById(id: string) {
        const found = driveRoot.findFile(id);
        if (!found) throw new Error(`Arquivo não encontrado: ${id}`);
        return found;
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty: (k: string) => (props.has(k) ? props.get(k)! : null),
          setProperty: (k: string, v: string) => {
            props.set(k, v);
            return this;
          },
          deleteProperty: (k: string) => {
            props.delete(k);
            return this;
          },
          getProperties: () => Object.fromEntries(props),
        };
      },
    },
    CacheService: {
      getScriptCache() {
        return {
          get: (k: string) => {
            const hit = cache.get(k);
            if (!hit) return null;
            if (hit.exp <= Date.now()) {
              cache.delete(k);
              return null;
            }
            return hit.v;
          },
          put: (k: string, v: string, ttl = 300) => {
            cache.set(k, { v, exp: Date.now() + ttl * 1000 });
          },
          remove: (k: string) => {
            cache.delete(k);
          },
        };
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content: string) {
        return {
          content,
          setMimeType() {
            return this;
          },
        };
      },
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
      createHtmlOutputFromFile(name: string) {
        return {
          name,
          setTitle() {
            return this;
          },
          addMetaTag() {
            return this;
          },
          setXFrameOptionsMode() {
            return this;
          },
        };
      },
    },
  };

  return {
    serviceCtx,
    setMacrossUrl: (u: string) => (macrossUrl = u),
    Sheet: (id: string) => spreadsheets.get(id)?.getSheetByName('Eventos') || null,
    sheet(id: string): any {
      return spreadsheets.get(id)?.getSheetByName('Eventos') || null;
    },
  };
}

export function vmRun(js: string): Context {
  const { serviceCtx, setMacrossUrl, sheet } = makeMocks();
  const context = vm.createContext(serviceCtx);
  vm.runInContext(js, context, { timeout: 10000 });
  return {
    gas: (context as unknown as GLOBAL_CTX).__GAS,
    gl: context as unknown as GLOBAL_CTX,
    setMacrossUrl,
    sheet,
  };
}

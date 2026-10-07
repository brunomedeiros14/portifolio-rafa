/**
 * Regressões críticas do servidor do CMS — rodam no Bun (`bun test test/`)
 * contra o bundle transpilado, com mocks do Apps Script (ver `rodar.ts`).
 */
import { test, expect, describe } from 'bun:test';
import { createHash } from 'node:crypto';
import { contexto } from './gas';
import { FakeFolder, FakeFile } from './rodar';
import type { Context } from './rodar';

function ctx(): Context {
  return contexto();
}

function hashHex(text: string): string {
  const buf = createHash('sha256').update(String(text), 'utf8').digest();
  return [...buf]
    .map((b) => ((b < 0 ? b + 256 : b) >>> 4).toString(16) + (b & 0x0f).toString(16))
    .join('');
}

/** Configura a senha e loga; devolve o token de sessão. */
function logar(c: Context) {
  c.gl.PropertiesService.getScriptProperties().setProperty(
    'ADMIN_PASSWORD_HASH',
    'sha256:' + hashHex('segredo'),
  );
  const res = c.gas.apiLogin('segredo');
  if (!res.ok) throw new Error('login falhou: ' + JSON.stringify(res));
  return res.token;
}

/** Upload falso — o mock só precisa decodificar base64, não de JPEG real. */
function foto(clientId: unknown) {
  return { data: 'iVBORw0KGgo=', name: 'foto.jpg', type: 'image/jpeg', clientId };
}

function names(folder: FakeFolder): string[] {
  const out: string[] = [];
  const it = folder.getFiles();
  while (it.hasNext()) out.push(it.next().getName());
  return out;
}

describe('Slug', () => {
  test('slugify remove acentos, minúsculas, símbolos', () => {
    const c = ctx();
    expect(c.gas.Slug.slugify('Yara e Ataíde')).toBe('yara-e-ataide');
    expect(c.gas.Slug.slugify('  A & B  ')).toBe('a-b');
  });

  test('ensureUnique: base -> base-cidade -> base-N', () => {
    const c = ctx();
    expect(c.gas.Slug.ensureUnique('yara-e-ataide', 'belo-horizonte', [])).toBe('yara-e-ataide');
    expect(
      c.gas.Slug.ensureUnique('yara-e-ataide', 'ouro-preto', [
        'yara-e-ataide',
        'yara-e-ataide-ouro-preto',
      ]),
    ).toBe('yara-e-ataide-2');
  });
});

describe('Schema da planilha', () => {
  test('HEADERS tem 17 colunas e `draft` fica logo após `status`', () => {
    const c = ctx();
    expect(c.gas.Events.HEADERS).toHaveLength(17);
    expect(c.gas.Events.HEADERS.indexOf('draft')).toBe(c.gas.Events.HEADERS.indexOf('status') + 1);
  });

  test('ensureSetup provisiona a aba `Eventos` com os cabeçalhos e linha congelada', () => {
    const c = ctx();
    c.gas.Events.ensureSetup();
    const props = c.gl.PropertiesService.getScriptProperties();
    const sheet = c.sheet(props.getProperty('SHEET_ID'));
    expect(sheet).not.toBeNull();
    expect(sheet.isFrozen()).toBe(true);
    expect(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]).toEqual(
      c.gas.Events.HEADERS,
    );
  });
});

describe('Fotos (Drive fake)', () => {
  test('nextName_ ignora os órfãos `NNN-x.jpg` do bug antigo', () => {
    const folder = new FakeFolder('f1', 'yara-e-ataide');
    ['001.jpg', '002.jpg', '002-1.jpg'].forEach((n) => folder.createFile(new FakeFile(n, n)));
    const c = ctx();
    expect(c.gas.Files.nextName_(folder, '.jpg')).toBe('003.jpg');
  });

  test('upload serializa 001..00N e dedupe por clientId não duplica', () => {
    const c = ctx();
    c.gas.Events.ensureSetup();
    const token = logar(c);
    const ev = c.gas.apiCreate(token, { couple: 'Yara e Ataíde' });

    c.gas.apiUploadPhoto(token, ev.slug, foto(1));
    const files = c.gas.apiUploadPhoto(token, ev.slug, foto(2));
    const deDupe = c.gas.apiUploadPhoto(token, ev.slug, foto(1)); // reenvio

    expect(files.photos).toHaveLength(2);
    expect(files.photos[0].name).toBe('001.jpg');
    expect(files.photos[0].bytes).toBeGreaterThan(0);
    expect(files.photos[1].name).toBe('002.jpg');
    expect(deDupe.photos).toHaveLength(2); // idempotente (nenhuma foto extra)

    const eventFolder = c.gas.Files.root_().getFoldersByName('yara-e-ataide').next();
    expect(names(eventFolder)).toEqual(['001.jpg', '002.jpg']);
  });

  test('removePhoto lixeira o arquivo e limpa a capa quando era a capa', () => {
    const c = ctx();
    c.gas.Events.ensureSetup();
    const token = logar(c);
    const ev = c.gas.apiCreate(token, { couple: 'Yara e Ataíde' });
    c.gas.apiUploadPhoto(token, ev.slug, foto(1));
    c.gas.apiSetCover(token, ev.slug, '001.jpg');

    const after = c.gas.apiRemovePhoto(token, ev.slug, '001.jpg');
    expect(after.cover).toBeNull();
    expect(after.photos).toHaveLength(0);

    const eventFolder = c.gas.Files.root_().getFoldersByName('yara-e-ataide').next();
    expect(names(eventFolder)).toEqual([]); // foi para a "lixeira" do mock
  });
});

describe('Prontidão e publicação', () => {
  test('rascunho releva a falta de galeria mas cobre continua exigida', () => {
    const c = ctx();
    c.gas.Events.ensureSetup();
    const ev = c.gas.Events.create({ couple: 'Yara e Ataíde' });
    expect(ev.draft).toBe(true);

    const check = c.gas.Events.computeStatus(ev);
    expect(check.missed).toContain('cover');

    const blockers = c.gas.Events.publicationBlockers(ev, check);
    expect(blockers.some((m) => m.indexOf('gallery') === 0)).toBe(false); // draft relevou
    expect(blockers).toContain('cover');
  });

  test('apiPublish completo: dispatch 204 -> status published', () => {
    const c = ctx();
    const token = logar(c);
    c.gas.Events.ensureSetup();
    const ev = c.gas.apiCreate(token, { couple: 'Yara e Ataíde' });

    c.gas.apiSave(token, ev.slug, {
      date: '2024-06-15',
      city: 'Belo Horizonte',
      state: 'MG',
      venue: 'Fazenda Vista',
      description: 'Uma celebração linda.',
      excerpt: 'Casamento na Fazenda Vista.',
    });
    for (let i = 0; i < 10; i++) c.gas.apiUploadPhoto(token, ev.slug, foto(i));
    c.gas.apiSetCover(token, ev.slug, '001.jpg');

    expect(c.gas.apiChecklist(token, ev.slug).missed).toEqual([]);

    const props = c.gl.PropertiesService.getScriptProperties();
    props.setProperty('GITHUB_OWNER', 'rafaeldiasfotos');
    props.setProperty('GITHUB_REPO', 'portfolio');
    props.setProperty('GITHUB_TOKEN', 'ghp_TOKEN_TESTE');

    const result = c.gas.apiPublish(token, ev.slug);
    expect(result.ok).toBe(true);
    expect(c.gas.apiGet(token, ev.slug).status).toBe('published');
  });

  test('buildPublication: capa só na capa, galeria a partir do resto, draft fiel, links com confirm=t', () => {
    const c = ctx();
    const token = logar(c);
    c.gas.Events.ensureSetup();
    const ev = c.gas.apiCreate(token, { couple: 'Yara e Ataíde' });
    for (let i = 0; i < 5; i++) c.gas.apiUploadPhoto(token, ev.slug, foto(i));
    c.gas.apiSetCover(token, ev.slug, '001.jpg');

    const pub = c.gas.apiPublication(token, ev.slug);
    expect(pub.draft).toBe(true);
    expect(pub.cover.filename).toBe('001.jpg');
    expect(pub.cover.url).toMatch(/drive\.google\.com\/uc\?export=download&confirm=t/);
    expect(pub.gallery).toHaveLength(4);
    expect(pub.gallery.some((g) => g.filename === '001.jpg')).toBe(false);
    expect(pub.gallery.every((g) => /confirm=t/.test(g.url))).toBe(true);
  });

  test('urlId_ extrai o id do /exec da URL corrente', () => {
    const c = ctx();
    c.setMacrossUrl('https://script.google.com/macros/s/AKfycbMadrugada123/exec');
    expect(c.gas.Publish.urlId_()).toBe('AKfycbMadrugada123');
  });
});

describe('Auth', () => {
  test('sem ADMIN_PASSWORD_HASH o login explica como configurar', () => {
    const c = ctx();
    expect(() => c.gas.apiLogin('x')).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  test('senha certo emite sessão resolvível; logout a invalida', () => {
    const c = ctx();
    const token = logar(c);
    expect(c.gas.apiAuthStatus(token).authenticated).toBe(true);
    expect(c.gas.apiAuthStatus('nao-existe').authenticated).toBe(false);

    const sessao = c.gas.Auth.resolve_(token);
    expect(sessao).not.toBeNull();
    expect(sessao.email).toBe('admin');

    c.gas.apiLogout(token);
    expect(c.gas.apiAuthStatus(token).authenticated).toBe(false);
  });

  test('throttle: erradas acumulam cooldown; senha certa sempre passa', () => {
    const c = ctx();
    c.gl.PropertiesService.getScriptProperties().setProperty(
      'ADMIN_PASSWORD_HASH',
      'sha256:' + hashHex('segredo'),
    );
    for (let i = 0; i < 3; i++) {
      try {
        c.gas.apiLogin('errada');
      } catch (e) {
        /* esperado: senha incorreta durante aquecimento */
      }
    }
    expect(() => c.gas.apiLogin('errada')).toThrow(/Muitas tentativas/);
    expect(c.gas.apiLogin('segredo').ok).toBe(true);
  });
});

describe('Validação de dados', () => {
  test('normalizeDate rejeita dia/mês impossível e garbage', () => {
    const c = ctx();
    expect(c.gas.Events.normalizeDate_('2024-02-30')).toBe('');
    expect(c.gas.Events.normalizeDate_('garbage')).toBe('');
    expect(c.gas.Events.normalizeDate_('2024-06-15')).toBe('2024-06-15');
  });

  test('parseJSON_ devolve a lista ou null (célula corrompida) — nunca lança', () => {
    const c = ctx();
    expect(c.gas.Events.parseJSON_('["a"]', null)).toEqual(['a']);
    expect(c.gas.Events.parseJSON_('{corrompido', null)).toBeNull();
    expect(c.gas.Events.parseJSON_('', null)).toBeNull();
  });
});

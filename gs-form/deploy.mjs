#!/usr/bin/env node
/**
 * Publica código no deployment Web App existente SEM quebrar o entry point.
 *
 * Por que existe: `clasp deploy` cria deployments de biblioteca/API (a API
 * projects.deployments só aceita versionNumber/manifestFileName/description) e,
 * pior, `clasp deploy -i` remove o entry point Web App do deployment (issue
 * google/clasp#63). Este script atualiza a versão do deployment Web App via API
 * REST direta, preservando URL e permissões ("executar como eu" + "qualquer pessoa").
 *
 * Uso:
 *   node deploy.mjs [descricao-do-version]
 *   DEPLOY_ID=<id> node deploy.mjs   # força um deployment específico
 *
 * Requer ~/.clasprc.json (auth do clasp) e .clasp.json (scriptId).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const tokenInfo = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.clasprc.json'), 'utf8'));
const cred = tokenInfo.tokens && tokenInfo.tokens.default;
if (!cred || !cred.refresh_token) {
  console.error('Não achei credenciais do clasp em ~/.clasprc.json. Rode `clasp login` primeiro.');
  process.exit(1);
}

const claspCfg = JSON.parse(fs.readFileSync(path.join(ROOT, '.clasp.json'), 'utf8'));
const scriptId = claspCfg.scriptId;
if (!scriptId) {
  console.error('Falta scriptId em .clasp.json.');
  process.exit(1);
}

const base = `https://script.googleapis.com/v1/projects/${scriptId}`;

let accessToken = cred.access_token || '';
if (!accessToken || Date.now() > (cred.expiry_date || 0) - 300000) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cred.client_id,
      client_secret: cred.client_secret,
      refresh_token: cred.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const t = await r.json();
  if (!t.access_token) {
    console.error('Falha ao renovar token:', t.error_description || JSON.stringify(t));
    process.exit(1);
  }
  accessToken = t.access_token;
}

const h = (json = false) => ({
  Authorization: `Bearer ${accessToken}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

async function api(pathPart, opts = {}) {
  const res = await fetch(`${base}${pathPart}`, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${JSON.stringify(body)}`);
  return body;
}

const { deployments = [] } = await api('/deployments', { headers: h() });
const webApps = deployments.filter(
  (d) => Array.isArray(d.entryPoints) && d.entryPoints.some((e) => e.entryPointType === 'WEB_APP'),
);

if (webApps.length === 0) {
  console.error(
    'Nenhum deployment Web App encontrado neste projeto.\n' +
      'Crie um em script.google.com: Deploy > New deployment > engrenagem Web app,\n' +
      'com "Execute as: Eu" e "Who has access: Anyone", e rode de novo.',
  );
  process.exit(1);
}

let dep = webApps[0];
if (process.env.DEPLOY_ID) {
  const found = webApps.find((d) => d.deploymentId === process.env.DEPLOY_ID);
  if (!found) {
    console.error(`DEPLOY_ID ${process.env.DEPLOY_ID} não é um deployment Web App.`);
    process.exit(1);
  }
  dep = found;
}

const version = await api('/versions', {
  method: 'POST',
  headers: h(true),
  body: JSON.stringify({ description: process.argv[2] || '' }),
});
if (!version.versionNumber) throw new Error('Sem versionNumber na resposta da criação de versão.');

const updated = await api(`/deployments/${dep.deploymentId}`, {
  method: 'PUT',
  headers: h(true),
  body: JSON.stringify({
    scriptId,
    versionNumber: version.versionNumber,
    manifestFileName: 'appsscript',
  }),
});

const entry = (updated.entryPoints || []).find((e) => e.entryPointType === 'WEB_APP');
console.log(`Publicado: versão ${version.versionNumber} em ${dep.deploymentId}`);
if (!entry) {
  console.error('AVISO: o deployment deixou de ser Web App — recrie pela UI.');
  process.exit(1);
}
console.log('URL:', entry.webApp.url);
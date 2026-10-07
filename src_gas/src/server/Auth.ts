/**
 * Autenticação do painel.
 *
 * O Web App roda como "executar como eu / qualquer pessoa" — o único modo que
 * o GAS oferece sem servidor. **Qualquer pessoa que abra a URL pode chamar
 * qualquer função global**, inclusive `apiPublish` (dispara o workflow no
 * GitHub com o seu PAT) e `apiDelete`. Autorizar por URL não é autorização;
 * por isso **toda** função `api*` começa com `requireAuth_(token)`.
 *
 * ## Por que não cookie
 *
 * O servidor não lê cookie (`Session` só expõe `getActiveUser` etc.) e o
 * `HtmlService` não devolve `Set-Cookie`. Sessão é **token opaco**: a UI o
 * guarda em `sessionStorage` e passa como argumento em cada RPC.
 *
 * ## A conta do Google também vale
 *
 * Num deployment "apenas minha conta", `Session.getActiveUser()` devolve o
 * email e o gate aceita sem senha (`via: 'conta'`). No iframe do `/admin` isso
 * costuma falhar por cookie de terceiros (§12), então a config canônica do
 * painel é "qualquer pessoa" + senha.
 */
const Auth = {
  /**
   * TTL da sessão. `CacheService.put` tem teto de 6 h, então 7 dias é
   * impossível: a sessão real dura até 6 h, renovada a cada chamada autenticada
   * (renovação deslizante) e pode ser despejada antes pelo cache.
   */
  SESSION_TTL_S: 6 * 60 * 60,

  CACHE_PREFIX: 'auth_sess_',
  FAILED_PREFIX: 'auth_fail_',

  /** Teto do backoff de tentativa errada de senha, em segundos. */
  MAX_BACKOFF_S: 120,

  sha256_(text) {
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(text),
      Utilities.Charset.UTF_8,
    );
  },

  /**
   * Bytes (com sinal) para hexadecimal. Em V8 o `byte` vai de -128 a 127;
   * `(-1).toString(16)` daria "-1" em vez de "ff", quebrando o hash.
   */
  hex_(bytes) {
    return bytes
      .map((b) => ((b < 0 ? b + 256 : b) >>> 4).toString(16) + (b & 0x0f).toString(16))
      .join('');
  },

  constantTimeEquals_(a, b) {
    const x = String(a === null || a === undefined ? '' : a);
    const y = String(b === null || b === undefined ? '' : b);
    let diff = x.length ^ y.length;
    const len = Math.max(x.length, y.length);
    for (let i = 0; i < len; i++) {
      diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
    }
    return diff === 0;
  },

  // ------------------------------------------------------------------ //
  // Sessão                                                              //
  // ------------------------------------------------------------------ //

  /** Email da conta Google do visitante; vazio num deployment "qualquer pessoa". */
  activeUserEmail_() {
    return String(Session.getActiveUser().getEmail() || '');
  },

  newToken_() {
    return String(Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  },

  /** Só o hash do token vira chave: um dump do cache não entrega a credencial. */
  sessionKey_(token) {
    return Auth.CACHE_PREFIX + Auth.hex_(Auth.sha256_(token));
  },

  issue_(email) {
    const token = Auth.newToken_();
    CacheService.getScriptCache().put(
      Auth.sessionKey_(token),
      JSON.stringify({
        email: email || 'admin',
        expiresAt: Date.now() + Auth.SESSION_TTL_S * 1000,
      }),
      Auth.SESSION_TTL_S,
    );
    return token;
  },

  /** Valida o token; renovação deslizante estende a sessão em cada uso. */
  resolve_(token) {
    const value = String(token || '');
    if (!value || value.length > 200) return null;

    const cache = CacheService.getScriptCache();
    const key = Auth.sessionKey_(value);
    const raw = cache.get(key);
    if (!raw) return null;

    let session: { email?: string; expiresAt?: number } | null = null;
    try {
      session = JSON.parse(raw);
    } catch (err) {
      session = null;
    }
    if (!session || Number(session.expiresAt) < Date.now()) {
      cache.remove(key);
      return null;
    }

    const now = Date.now();
    if (now + Auth.SESSION_TTL_S * 500 > Number(session.expiresAt)) {
      session.expiresAt = now + Auth.SESSION_TTL_S * 1000;
      cache.put(key, JSON.stringify(session), Auth.SESSION_TTL_S);
    }
    return session;
  },

  /** Quem está autorizado agora: sessão com senha ou conta do deployment restrito. */
  authorized_(token) {
    const session = Auth.resolve_(token);
    if (session) return { email: session.email, via: 'senha' };

    const google = Auth.activeUserEmail_();
    if (google) return { email: google, via: 'conta' };

    return null;
  },

  requireAuth_(token) {
    if (!Auth.authorized_(token)) {
      throw new Error('Sessão expirada. Faça login de novo.');
    }
  },

  currentEmail_(token) {
    const auth = Auth.authorized_(token);
    return auth ? auth.email : '';
  },

  status_(token) {
    const auth = Auth.authorized_(token);
    return {
      authenticated: !!auth,
      email: auth ? auth.email : '',
      via: auth ? auth.via : '',
      hasPassword: !!PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH'),
    };
  },

  // ------------------------------------------------------------------ //
  // Login                                                               //
  // ------------------------------------------------------------------ //

  /**
   * Valida a senha e emite token. A senha nunca volta: só o `sha256:<hex>`
   * vive em Script Properties (um dump não recupera a senha nem cai em
   * rainbow table direto).
   */
  login(password) {
    const hasPassword =
      !!PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
    if (!hasPassword) {
      throw new Error(
        'Nenhuma senha configurada. Defina ADMIN_PASSWORD_HASH nas propriedades do script.',
      );
    }

    const stored = String(
      PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') || '',
    );
    const attempt = `sha256:${Auth.hex_(Auth.sha256_(String(password || '')))}`;
    if (Auth.constantTimeEquals_(attempt, stored)) {
      Auth.clearFailedLogins_();
      const email = Auth.activeUserEmail_() || 'admin';
      return { ok: true, email, token: Auth.issue_(email) };
    }

    // A senha certa sempre passa; a trava só atrasa tentativa errada.
    Auth.assertNotThrottled_();
    Auth.recordFailedLogin_();
    throw new Error('Senha incorreta.');
  },

  logout(token) {
    const value = String(token || '');
    if (value) CacheService.getScriptCache().remove(Auth.sessionKey_(value));
    return { ok: true };
  },

  // ------------------------------------------------------------------ //
  // Freio de força bruta                                               //
  // ------------------------------------------------------------------ //

  /**
   * Identidade do contador. Num deployment anônimo `getActiveUser()` é vazio e
   * a chave cai num contador global — o único identificador disponível; o
   * backoff tem teto de 2 min e decai sozinho. No deployment restrito o
   * contador é por email.
   */
  failureKey_() {
    return Auth.FAILED_PREFIX + Auth.hex_(Auth.sha256_(Auth.activeUserEmail_() || 'anon'));
  },

  /** Conta com decaimento: depois do cooldown, um novo ciclo recomeça em 1. */
  readFailures_() {
    const now = Date.now();
    const raw = CacheService.getScriptCache().get(Auth.failureKey_());
    if (!raw) return { count: 0, cooldownUntil: 0 };
    try {
      const parsed = JSON.parse(raw);
      const cooldownUntil = Number(parsed.cooldownUntil) || 0;
      if (cooldownUntil <= now) return { count: 0, cooldownUntil: 0 };
      return { count: Number(parsed.count) || 0, cooldownUntil };
    } catch (err) {
      return { count: 0, cooldownUntil: 0 };
    }
  },

  assertNotThrottled_() {
    const state = Auth.readFailures_();
    const wait = state.cooldownUntil - Date.now();
    if (wait <= 0) return;
    throw new Error(`Muitas tentativas. Tente de novo em ${Math.ceil(wait / 1000)}s.`);
  },

  recordFailedLogin_() {
    const state = Auth.readFailures_();
    const count = Math.min(state.count + 1, 12);
    const backoff = Math.min(Auth.MAX_BACKOFF_S, Math.pow(2, count) * 5);
    CacheService.getScriptCache().put(
      Auth.failureKey_(),
      JSON.stringify({ count, cooldownUntil: Date.now() + backoff * 1000 }),
      Auth.MAX_BACKOFF_S * 2,
    );
  },

  clearFailedLogins_() {
    CacheService.getScriptCache().remove(Auth.failureKey_());
  },
};

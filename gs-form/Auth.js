/**
 * Autenticação do painel.
 *
 * O Web App é implantado como "executar como eu / qualquer pessoa" porque o
 * HtmlService não tem outro jeito de servir o painel sem um servidor. Isso
 * significa que **qualquer pessoa que abra a URL pode chamar qualquer função
 * global do script** — inclusive `apiPublish`, que dispara o workflow no GitHub
 * com o seu PAT, e `apiDelete`, que apaga linhas da planilha. Autorizar por URL
 * não é autorização; por isso todo acesso passa por aqui.
 *
 * ## Por que não cookie
 *
 * Um Web App do GAS não tem como ler cookie no servidor: `Session` só expõe
 * `getActiveUser()`, `getEffectiveUser()`, `getScriptTimeZone()` e
 * `getTemporaryActiveUserKey()`. Devolver um `Set-Cookie` também não existe —
 * `HtmlService` não monta headers de resposta. Qualquer esquema de cookie
 * assinado exigiria a senha de novo em *cada* requisição (o browser nunca
 * reenvia nada sozinho), o que seria pior do que não ter gate.
 *
 * ## O modelo
 *
 *   1. `doGet` sem sessão devolve `login.html` em vez do painel.
 *   2. `apiLogin` compara a senha com o hash em Script Properties e devolve um
 *      **token opaco**; o servidor guarda só o SHA-256 do token no
 *      `CacheService`, com validade de 7 dias.
 *   3. Toda função `api*` recebe esse token como primeiro argumento e chama
 *      `requireAuth_(token)`. Um `google.script.run` não passa por `doGet`,
 *      então o gate no front-end sozinho não protegeria nada.
 *
 * ## A conta do Google também vale
 *
 * Se o deployment estiver em "Quem tem acesso: apenas <sua conta>", o Google
 * já autoriza e `Session.getActiveUser()` devolve o email: o painel abre sem
 * senha e sem token. Esse é o arranjo recomendado — os dois caminhos convivem.
 *
 * Propriedades do script (veja o README):
 *   ADMIN_PASSWORD_HASH  sha256 da senha, no formato `sha256:<hex>`
 *
 * Sem `ADMIN_PASSWORD_HASH` não existe senha nenhuma: o painel fica fechado e a
 * tela de login explica como definir. Fechado por padrão vale mais que um token
 * gerado em silêncio que ninguém anotou.
 */

const Auth = {
  /** Validade da sessão. O teto do `CacheService` é de 30 dias. */
  SESSION_TTL_S: 7 * 24 * 60 * 60,

  CACHE_PREFIX: 'auth_sess_',
  FAILED_PREFIX: 'auth_fail_',

  /** Teto do backoff, em segundos. */
  MAX_BACKOFF_S: 600,

  // ------------------------------------------------------------------ //
  // Utilidades                                                          //
  // ------------------------------------------------------------------ //

  sha256_(text) {
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(text),
      Utilities.Charset.UTF_8,
    );
  },

  /**
   * Bytes (com sinal) para hexadecimal.
   *
   * Não dá para usar `String(byte).padStart(2, '0')`: em V8 `byte` é um inteiro
   * de -128 a 127, e `-1` virava "-1" em vez de "ff" — o hash saía com o sinal
   * e nunca casava com o valor gerado pelo `sha256sum`.
   */
  hex_(bytes) {
    return bytes
      .map((b) => ((b < 0 ? b + 256 : b) >>> 4).toString(16) + (b & 0x0f).toString(16))
      .join('');
  },

  /** Compara dois segredos sem sair no primeiro byte diferente. */
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
  // Propriedades                                                        //
  // ------------------------------------------------------------------ //

  ensureSetup() {
    return {
      hasPassword: !!PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH'),
    };
  },

  // ------------------------------------------------------------------ //
  // Sessão                                                              //
  // ------------------------------------------------------------------ //

  /**
   * Email da conta Google do visitante, quando o deployment está restrito.
   * String vazia num deployment "qualquer pessoa" — e não dá para forjar: o
   * valor vem da camada de autenticação do Google, não do request.
   */
  activeUserEmail_() {
    return String(Session.getActiveUser().getEmail() || '');
  },

  newToken_() {
    return String(Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  },

  /**
   * Só o hash do token vai para o cache: um dump do `CacheService` não entrega
   * nada que dê para usar como credencial.
   */
  sessionKey_(token) {
    return Auth.CACHE_PREFIX + Auth.hex_(Auth.sha256_(token));
  },

  issue_(email) {
    const token = Auth.newToken_();
    const cache = CacheService.getScriptCache();
    cache.put(
      Auth.sessionKey_(token),
      JSON.stringify({
        email: email || 'admin',
        expiresAt: Date.now() + Auth.SESSION_TTL_S * 1000,
      }),
      Auth.SESSION_TTL_S,
    );
    return token;
  },

  /** Valida o token. Devolve `{ email, expiresAt }` ou `null`. */
  resolve_(token) {
    const value = String(token || '');
    // Teto generoso para não fazer digest de lixo gigante a cada chamada.
    if (!value || value.length > 200) return null;

    const cache = CacheService.getScriptCache();
    const key = Auth.sessionKey_(value);
    const raw = cache.get(key);
    if (!raw) return null;

    let session = null;
    try {
      session = JSON.parse(raw);
    } catch (err) {
      session = null;
    }
    if (!session || Number(session.expiresAt) < Date.now()) {
      cache.remove(key);
      return null;
    }
    return session;
  },

  /**
   * Quem está autorizado agora: sessão com senha ou conta Google do
   * deployment restrito. Devolve `{ email, via }` ou `null`.
   */
  authorized_(token) {
    const session = Auth.resolve_(token);
    if (session) return { email: session.email, via: 'senha' };

    const google = Auth.activeUserEmail_();
    if (google) return { email: google, via: 'conta' };

    return null;
  },

  /**
   * Guarda de todas as funções `api*`.
   *
   * `google.script.run` executa no servidor com a autoridade do dono do script,
   * sem passar por `doGet`. Sem esta chamada em cada função, um visitante
   * anônimo que abra a URL consegue ler a planilha, mexer no Drive e disparar
   * publicação — tudo com a sua conta.
   */
  requireAuth_(token) {
    if (!Auth.authorized_(token)) {
      throw new Error('Sessão expirada. Faça login de novo.');
    }
  },

  currentEmail_(token) {
    const auth = Auth.authorized_(token);
    return auth ? auth.email : '';
  },

  /** Estado da sessão para `doGet` decidir entre login e painel. */
  status_(token) {
    const setup = Auth.ensureSetup();
    const auth = Auth.authorized_(token);
    return {
      authenticated: !!auth,
      email: auth ? auth.email : '',
      via: auth ? auth.via : '',
      hasPassword: setup.hasPassword,
    };
  },

  // ------------------------------------------------------------------ //
  // Login                                                               //
  // ------------------------------------------------------------------ //

  /**
   * Verifica a senha e emite o token.
   *
   * A senha nunca volta nem é guardada: só o SHA-256 fica em Script Properties,
   * para que um dump das propriedades não permita recuperar a senha (e para que
   * um hash em hex não caia direto em uma tabela de rainbow).
   */
  login(password) {
    const setup = Auth.ensureSetup();
    if (!setup.hasPassword) {
      throw new Error(
        'Nenhuma senha configurada. Defina ADMIN_PASSWORD_HASH nas propriedades do script.',
      );
    }

    Auth.assertNotThrottled_();

    const stored = String(
      PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') || '',
    );
    const attempt = `sha256:${Auth.hex_(Auth.sha256_(String(password === null || password === undefined ? '' : password)))}`;

    if (!Auth.constantTimeEquals_(attempt, stored)) {
      Auth.recordFailedLogin_();
      throw new Error('Senha incorreta.');
    }

    Auth.clearFailedLogins_();
    const email = Auth.activeUserEmail_() || 'admin';
    return { ok: true, email, token: Auth.issue_(email) };
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
   * Identidade usada para contar tentativas.
   *
   * Num deployment "qualquer pessoa" `getActiveUser()` é vazio e a chave cai
   * num contador global — é o único identificador disponível. O efeito colateral
   * é que um atacante também consegue travar o painel por até 10 minutos; o
   * backoff tem teto e some no primeiro login correto. Se o deployment for
   * restrito a uma conta, o contador é por email e não há esse efeito.
   */
  failureKey_() {
    return Auth.FAILED_PREFIX + Auth.hex_(Auth.sha256_(Auth.activeUserEmail_() || 'anon'));
  },

  /** O `CacheService` só guarda string — daí o JSON. */
  readFailures_() {
    const raw = CacheService.getScriptCache().get(Auth.failureKey_());
    if (!raw) return { count: 0, cooldownUntil: 0 };
    try {
      const parsed = JSON.parse(raw);
      return {
        count: Number(parsed.count) || 0,
        cooldownUntil: Number(parsed.cooldownUntil) || 0,
      };
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
    // O teto no `count` impede que o backoff cresça sem limite; com ele, o
    // máximo realmente alcançável é `MAX_BACKOFF_S`.
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

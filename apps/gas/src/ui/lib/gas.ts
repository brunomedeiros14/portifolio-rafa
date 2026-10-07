/**
 * Ponte com o `google.script.run` do HtmlService. TODA chamada à automação
 * passa por aqui — inclusive o array `API_NOMES`: o `vite-gas.ts` abor­ta o
 * build se a UI chamar um `apiX` que o servidor (Api.ts) não define.
 */
export const API_NOMES = [
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
] as const;

export type ApiNome = (typeof API_NOMES)[number];

declare global {
  interface Window {
    google?: {
      script?: {
        run?: Record<
          string,
          (
            this: { withSuccessHandler: Function; withFailureHandler: Function },
            ...args: unknown[]
          ) => unknown
        >;
      };
    };
  }
}

/** `google.script.run` ausente (dev/vite): fallback grita em vez de mentir. */
function runner() {
  const run = window.google?.script?.run;
  if (!run) {
    throw new Error('Painel aberto fora do aplicativo (google.script.run indisponível).');
  }
  return run as Record<string, (...args: unknown[]) => unknown>;
}

export function call(nome: ApiNome, ...args: unknown[]): Promise<any> {
  return new Promise((resolve, reject) => {
    let chain: any;
    try {
      const run = runner();
      chain = run.withSuccessHandler((resultado: unknown) => resolve(resultado));
      chain = chain.withFailureHandler((erro: unknown) =>
        reject(typeof erro === 'string' ? new Error(erro) : new Error('Falha na automação.')),
      );
      chain[nome](...args);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// ------------------------------------------------------------------ //
// Sessão                                                              //
// ------------------------------------------------------------------ //

const TOKEN_KEY = 'cms_token';

export function tokenAtual(): string {
  return window.sessionStorage.getItem(TOKEN_KEY) || '';
}

export function salvarToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function limparToken(): void {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export interface SessaoStatus {
  authenticated: boolean;
  email: string;
  via: string;
  hasPassword: boolean;
}

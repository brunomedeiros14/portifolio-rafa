import { useState } from 'react';
import type { FormEvent } from 'react';
import { call } from '../lib/gas';

export function Login({
  onEntrar,
  semSenha,
}: {
  onEntrar: (token: string) => void;
  semSenha?: boolean;
}) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const res = await call('apiLogin', senha);
      onEntrar(res.token);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm"
      >
        <p className="font-display text-2xl text-ink">CMS de Casamentos</p>
        <p className="mt-1 text-sm text-muted">Acesso restrito da publicação.</p>

        {semSenha ? (
          <div className="mt-6 rounded-lg border border-line bg-background p-3 text-sm text-muted">
            Nenhuma senha configurada ainda. Defina o{' '}
            <code className="text-accent">ADMIN_PASSWORD_HASH</code> nas Propriedades do script.
          </div>
        ) : (
          <label className="mt-6 block">
            <span className="text-sm font-medium text-ink">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={enviando}
              autoFocus
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </label>
        )}

        {erro ? <p className="mt-3 text-sm text-red-600">{erro}</p> : null}

        <button
          type="submit"
          disabled={enviando || semSenha}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { call } from '../lib/gas';
import { msgErro } from './ui';

/**
 * Criar é uma tela própria e mínima (couple, date, city, state, venue): o slug
 * é gerado no servidor, então não há nada mais para o usuário decidir aqui.
 */
export function Criar({
  token,
  onCriado,
  onVoltar,
  onToast,
}: {
  token: string;
  onCriado: (slug: string) => void;
  onVoltar: () => void;
  onToast: (mensagem: string) => void;
}) {
  const [form, setForm] = useState({ couple: '', date: '', city: '', state: '', venue: '' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.couple.trim() || !form.city.trim()) return;
    setEnviando(true);
    try {
      const ev = await call('apiCreate', token, form);
      onToast(`Evento criado: ${ev.slug}`);
      onCriado(ev.slug);
    } catch (err) {
      setErro(msgErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={criar} className="max-w-xl space-y-4">
      <h2 className="font-display text-2xl">Novo evento</h2>

      <Campo
        rotulo="Casal *"
        valor={form.couple}
        onChange={(v) => setForm({ ...form, couple: v })}
        max={120}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          rotulo="Data"
          valor={form.date}
          onChange={(v) => setForm({ ...form, date: v })}
          placeholder="AAAA-MM-DD"
        />
        <Campo
          rotulo="Cidade *"
          valor={form.city}
          onChange={(v) => setForm({ ...form, city: v })}
          max={80}
        />
        <Campo
          rotulo="Estado *"
          valor={form.state}
          onChange={(v) => setForm({ ...form, state: v })}
          max={40}
        />
      </div>
      <Campo
        rotulo="Local"
        valor={form.venue}
        onChange={(v) => setForm({ ...form, venue: v })}
        max={120}
      />

      {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando || !form.couple.trim() || !form.city.trim() || !form.state.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {enviando ? 'Criando…' : 'Criar e abrir'}
        </button>
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
  max,
  placeholder,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {rotulo}
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value.slice(0, max || 5000))}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
      />
    </label>
  );
}

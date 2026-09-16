import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react';
import { tenantFetch } from '../lib/api';
import type { ConsumptionItem } from '../types';

export function ConsumptionItemsManager({ onChange }: { onChange: (items: ConsumptionItem[]) => void }) {
  const [items, setItems] = useState<ConsumptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ConsumptionItem | null>(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let mounted = true;
    void tenantFetch('/api/consumption-items', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os itens.');
      if (mounted) { setItems(body.items || []); onChange(body.items || []); }
    }).catch(err => { if (mounted) setError(err.message || 'Falha de conexão.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const save = async (method: 'POST' | 'PATCH' | 'DELETE', id?: string) => {
    if (busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      const response = await tenantFetch(`/api/consumption-items${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method, headers: { 'Content-Type': 'application/json' },
        ...(method !== 'DELETE' ? { body: JSON.stringify({ name }) } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar.');
      setItems(body.items); onChange(body.items);
      if (method !== 'DELETE' || id === editing) { setName(''); setEditing(null); }
      setDeleting(null);
      setFeedback(method === 'DELETE' ? 'Item excluído.' : 'Item salvo com sucesso.');
    } catch (err: any) { setError(err?.message || 'Falha de conexão. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return <section className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-7 space-y-5">
    <div className="flex gap-3 items-start"><UtensilsCrossed className="w-6 h-6 text-rose-600 shrink-0" />
      <div><h2 className="font-black text-xl text-stone-900">Itens consumidos</h2>
      <p className="text-sm text-stone-500 mt-1">Cadastre os produtos que o cliente poderá marcar na avaliação, como coxinha, pizza, hambúrguer ou refrigerante.</p></div>
    </div>
    <p className="text-xs text-stone-500">Alterar ou excluir um item não modifica o que já foi registrado nas avaliações anteriores.</p>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{error}</p>}
    {feedback && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3">{feedback}</p>}
    <form onSubmit={e => { e.preventDefault(); void save(editing ? 'PATCH' : 'POST', editing || undefined); }} className="flex gap-2 flex-wrap items-end">
      <label className="flex-1 min-w-48 text-sm font-bold text-stone-700">{editing ? 'Editar item' : 'Novo item'}
        <input required maxLength={100} value={name} disabled={busy || loading} onChange={e => setName(e.target.value)} placeholder="Ex.: Pizza de camarão" className="mt-1 block w-full border border-stone-300 rounded-xl px-3 py-2.5 font-normal" />
      </label>
      <button disabled={busy || loading || !name.trim()} className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex gap-2 items-center"><Plus className="w-4 h-4" />{busy ? 'Salvando...' : editing ? 'Salvar alteração' : 'Cadastrar'}</button>
      {editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setName(''); }} className="px-4 py-2.5 border rounded-xl text-sm">Cancelar</button>}
    </form>
    {loading ? <p className="text-sm text-stone-500">Carregando itens...</p> : <>
      {items.length > 0 && <input aria-label="Buscar item cadastrado" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nos itens cadastrados..." className="w-full border border-stone-300 rounded-xl px-3 py-2" />}
      {items.length === 0 && <p className="text-sm text-stone-500 py-6 text-center">Nenhum item cadastrado. Adicione o primeiro acima.</p>}
      <ul className="divide-y divide-stone-100">{items.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(item => <li key={item.id} className="py-3 flex items-center gap-3 justify-between">
        <span className="text-sm font-semibold text-stone-800 break-words min-w-0">{item.name}</span>
        <div className="flex gap-2 shrink-0"><button aria-label={`Editar ${item.name}`} disabled={busy} onClick={() => { setEditing(item.id); setName(item.name); setFeedback(''); }} className="p-2 rounded-lg border text-stone-600 hover:bg-stone-50"><Pencil className="w-4 h-4" /></button>
        <button aria-label={`Excluir ${item.name}`} disabled={busy} onClick={() => setDeleting(item)} className="p-2 rounded-lg border text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button></div>
      </li>)}</ul>
    </>}
    {deleting && <div role="dialog" aria-modal="true" aria-labelledby="delete-item-title" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4"><h3 id="delete-item-title" className="font-bold text-lg">Excluir {deleting.name}?</h3>
      <p className="text-sm text-stone-600">O item deixará de aparecer nas novas avaliações. O histórico será mantido.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2"><button disabled={busy} onClick={() => setDeleting(null)} className="border rounded-xl px-4 py-2">Cancelar</button><button disabled={busy} onClick={() => void save('DELETE', deleting.id)} className="bg-red-600 text-white rounded-xl px-4 py-2">{busy ? 'Excluindo...' : 'Excluir'}</button></div></div>
    </div>}
  </section>;
}

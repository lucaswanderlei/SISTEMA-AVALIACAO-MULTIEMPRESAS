import React, { useEffect, useState } from 'react';
import { Building2, ExternalLink, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';

type Company = { empresa_id: string; nome: string; slug: string; ativo: boolean; criado_em?: string; atualizado_em?: string };

export function SuperAdmin() {
  const [key, setKey] = useState(() => sessionStorage.getItem('super_admin_key') || '');
  const [draftKey, setDraftKey] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    headers.set('X-Super-Admin-Key', key);
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
  };

  const load = async () => {
    if (!key) return;
    setBusy(true); setError('');
    try {
      const res = await request('/api/admin/companies', { cache: 'no-store' });
      if (res.status === 401) throw new Error('Chave de administrador geral inválida.');
      if (!res.ok) throw new Error('Não foi possível carregar as empresas.');
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (e:any) { setError(e.message || 'Erro ao carregar.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, [key]);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draftKey.trim();
    if (!clean) return;
    sessionStorage.setItem('super_admin_key', clean);
    setKey(clean); setDraftKey('');
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const res = await request('/api/admin/companies', { method:'POST', body:JSON.stringify({ name, slug }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível cadastrar a empresa.');
      setName(''); setSlug(''); await load();
    } catch(e:any) { setError(e.message || 'Erro ao cadastrar.'); }
  };

  const toggle = async (company: Company) => {
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/status`, { method:'PATCH', body:JSON.stringify({ ativo: !company.ativo }) });
      if (!res.ok) throw new Error('Não foi possível alterar o status.');
      await load();
    } catch(e:any) { setError(e.message || 'Erro ao alterar status.'); }
  };

  if (!key) return <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4"><form onSubmit={login} className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-stone-200 p-7 space-y-5"><div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center"><KeyRound className="w-6 h-6"/></div><div><h1 className="text-2xl font-black text-stone-900">Administrador Geral</h1><p className="text-sm text-stone-500 mt-1">Acesso exclusivo à gestão das empresas da plataforma.</p></div><input type="password" value={draftKey} onChange={e=>setDraftKey(e.target.value)} placeholder="SUPER_ADMIN_KEY" autoFocus className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-900"/><button className="w-full bg-stone-900 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4"/>Entrar</button></form></div>;

  return <div className="min-h-screen bg-stone-100"><header className="bg-white border-b border-stone-200"><div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between"><div><h1 className="text-xl font-black text-stone-900">Painel Multiempresas</h1><p className="text-xs text-stone-500">Administrador geral da plataforma</p></div><button onClick={()=>{sessionStorage.removeItem('super_admin_key');setKey('');setCompanies([])}} className="text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100"><LogOut className="w-4 h-4"/>Sair</button></div></header><main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">{error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-sm font-semibold">{error}</div>}<section className="bg-white rounded-2xl border border-stone-200 p-5"><h2 className="font-black text-stone-900 mb-4 flex gap-2 items-center"><Plus className="w-5 h-5"/>Cadastrar nova empresa</h2><form onSubmit={createCompany} className="grid md:grid-cols-[1fr_1fr_auto] gap-3"><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da empresa" className="border border-stone-300 rounded-xl px-4 py-3"/><input required value={slug} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'-'))} placeholder="identificador-ex: pizzaria-teste" className="border border-stone-300 rounded-xl px-4 py-3"/><button className="bg-rose-600 text-white font-bold px-5 py-3 rounded-xl">Cadastrar</button></form></section><section className="bg-white rounded-2xl border border-stone-200 overflow-hidden"><div className="p-5 border-b border-stone-200 flex items-center justify-between"><div><h2 className="font-black text-stone-900 flex gap-2 items-center"><Building2 className="w-5 h-5"/>Empresas</h2><p className="text-xs text-stone-500 mt-1">{companies.length} empresa(s) cadastrada(s)</p></div><button onClick={load} className="p-2 rounded-xl bg-stone-100" title="Atualizar"><RefreshCw className={`w-4 h-4 ${busy?'animate-spin':''}`}/></button></div><div className="divide-y divide-stone-100">{companies.length===0 && !busy ? <div className="p-8 text-center text-stone-400">Nenhuma empresa cadastrada ainda.</div> : companies.map(c=><div key={c.empresa_id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"><div><div className="font-extrabold text-stone-900">{c.nome}</div><div className="text-xs text-stone-500">ID: {c.empresa_id}</div></div><div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.ativo?'bg-emerald-50 text-emerald-700':'bg-stone-100 text-stone-500'}`}>{c.ativo?'Ativa':'Desativada'}</span><a target="_blank" rel="noreferrer" href={`/?empresa=${encodeURIComponent(c.empresa_id)}&cliente=1`} className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-100 flex gap-1.5 items-center">Avaliação <ExternalLink className="w-3.5 h-3.5"/></a><a target="_blank" rel="noreferrer" href={`/?empresa=${encodeURIComponent(c.empresa_id)}&gerencia=1`} className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-100 flex gap-1.5 items-center">Gerência <ExternalLink className="w-3.5 h-3.5"/></a><button onClick={()=>toggle(c)} className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-900 text-white flex gap-1.5 items-center">{c.ativo?<ToggleRight className="w-4 h-4"/>:<ToggleLeft className="w-4 h-4"/>}{c.ativo?'Desativar':'Ativar'}</button></div></div>)}</div></section></main></div>;
}

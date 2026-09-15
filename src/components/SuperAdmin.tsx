import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  ExternalLink,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

type Company = {
  empresa_id: string;
  nome: string;
  slug: string;
  login?: string;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export function SuperAdmin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('super_admin_token') || '');
  const [masterLogin, setMasterLogin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [companyLogin, setCompanyLogin] = useState('');
  const [companyPassword, setCompanyPassword] = useState('');
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingLogin, setEditingLogin] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const request = async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
  };

  const load = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const res = await request('/api/admin/companies', { cache: 'no-store' });
      if (res.status === 401) {
        sessionStorage.removeItem('super_admin_token');
        setToken('');
        throw new Error('Sessão mestre expirada. Entre novamente.');
      }
      if (!res.ok) throw new Error('Não foi possível carregar as empresas.');
      const data = await res.json();
      setCompanies(data.companies || []);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: masterLogin.trim(), password: masterPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || 'Login ou senha mestre inválidos.');
      sessionStorage.setItem('super_admin_token', data.token);
      setToken(data.token);
      setMasterPassword('');
    } catch (e: any) {
      setError(e.message || 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await request('/api/admin/companies', {
        method: 'POST',
        body: JSON.stringify({ name, slug, login: companyLogin, password: companyPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível cadastrar a empresa.');
      setName('');
      setSlug('');
      setCompanyLogin('');
      setCompanyPassword('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao cadastrar.');
    }
  };

  const toggle = async (company: Company) => {
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !company.ativo }),
      });
      if (!res.ok) throw new Error('Não foi possível alterar o status.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao alterar status.');
    }
  };

  const startEdit = (company: Company) => {
    setEditingId(company.empresa_id);
    setEditingName(company.nome);
    setEditingLogin(company.login || company.empresa_id);
    setEditingPassword('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingLogin('');
    setEditingPassword('');
  };

  const saveCompany = async (company: Company) => {
    const cleanName = editingName.trim();
    const cleanLogin = editingLogin.trim().toLowerCase();
    if (!cleanName || cleanLogin.length < 3) {
      setError('Informe nome e login válidos.');
      return;
    }
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome: cleanName, login: cleanLogin, password: editingPassword || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível editar a empresa.');
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao editar empresa.');
    }
  };

  const deleteCompany = async (company: Company) => {
    if (deletingId === company.empresa_id) return;
    const confirmed = window.confirm(
      `Excluir definitivamente a empresa “${company.nome}”?\n\nIsso apagará os dados dessa empresa, incluindo avaliações armazenadas para ela. Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    setDeletingId(company.empresa_id);
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível excluir a empresa.');
      if (editingId === company.empresa_id) cancelEdit();
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir empresa.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <form onSubmit={login} className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-stone-200 p-7 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-stone-900">Administrador Geral</h1>
            <p className="text-sm text-stone-500 mt-1">Use o login e a senha mestre da plataforma.</p>
          </div>
          {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-sm font-semibold">{error}</div>}
          <input
            type="text"
            autoComplete="username"
            value={masterLogin}
            onChange={(e) => setMasterLogin(e.target.value)}
            placeholder="Login mestre"
            className="w-full border border-stone-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-stone-900"
          />
          <div className="relative">
            <input
              type={showMasterPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Senha mestre"
              className="w-full border border-stone-300 rounded-xl px-4 py-3 pr-11 outline-none focus:ring-2 focus:ring-stone-900"
            />
            <button type="button" onClick={() => setShowMasterPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
              {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button disabled={busy} className="w-full bg-stone-900 disabled:opacity-60 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" />{busy ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-stone-900">Painel Multiempresas</h1>
            <p className="text-xs text-stone-500">Administrador geral da plataforma</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('super_admin_token');
              setToken('');
              setCompanies([]);
            }}
            className="text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100"
          >
            <LogOut className="w-4 h-4" />Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-sm font-semibold">{error}</div>}

        <section className="bg-white rounded-2xl border border-stone-200 p-5">
          <h2 className="font-black text-stone-900 mb-4 flex gap-2 items-center"><Plus className="w-5 h-5" />Cadastrar nova empresa</h2>
          <form onSubmit={createCompany} className="grid md:grid-cols-2 gap-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" className="border border-stone-300 rounded-xl px-4 py-3" />
            <input
              required
              value={slug}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                setSlug(value);
                if (!companyLogin) setCompanyLogin(value);
              }}
              placeholder="identificador-ex: pizzaria-teste"
              className="border border-stone-300 rounded-xl px-4 py-3"
            />
            <input required value={companyLogin} onChange={(e) => setCompanyLogin(e.target.value.toLowerCase())} placeholder="Login da empresa" className="border border-stone-300 rounded-xl px-4 py-3" />
            <div className="relative">
              <input required minLength={4} type={showCompanyPassword ? 'text' : 'password'} value={companyPassword} onChange={(e) => setCompanyPassword(e.target.value)} placeholder="Senha inicial" className="w-full border border-stone-300 rounded-xl px-4 py-3 pr-11" />
              <button type="button" onClick={() => setShowCompanyPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showCompanyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button className="md:col-span-2 bg-rose-600 text-white font-bold px-5 py-3 rounded-xl">Cadastrar empresa com acesso</button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="p-5 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-stone-900 flex gap-2 items-center"><Building2 className="w-5 h-5" />Empresas</h2>
              <p className="text-xs text-stone-500 mt-1">{companies.length} empresa(s) cadastrada(s)</p>
            </div>
            <button onClick={load} className="p-2 rounded-xl bg-stone-100" title="Atualizar"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /></button>
          </div>

          <div className="divide-y divide-stone-100">
            {companies.length === 0 && !busy ? (
              <div className="p-8 text-center text-stone-400">Nenhuma empresa cadastrada ainda.</div>
            ) : companies.map((c) => (
              <div key={c.empresa_id} className="p-4 sm:p-5 space-y-3">
                {editingId === c.empresa_id ? (
                  <div className="grid md:grid-cols-3 gap-2">
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="Nome" className="border border-stone-300 rounded-xl px-3 py-2 font-bold" />
                    <input value={editingLogin} onChange={(e) => setEditingLogin(e.target.value.toLowerCase())} placeholder="Login" className="border border-stone-300 rounded-xl px-3 py-2 font-bold" />
                    <input type="password" value={editingPassword} onChange={(e) => setEditingPassword(e.target.value)} placeholder="Nova senha (opcional)" className="border border-stone-300 rounded-xl px-3 py-2" />
                    <div className="md:col-span-3 flex gap-2">
                      <button onClick={() => void saveCompany(c)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1"><Check className="w-4 h-4" />Salvar</button>
                      <button onClick={cancelEdit} className="px-3 py-2 rounded-xl bg-stone-200 text-stone-700 font-bold flex items-center gap-1"><X className="w-4 h-4" />Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-extrabold text-stone-900 truncate">{c.nome}</div>
                        <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100" title="Editar empresa"><Pencil className="w-4 h-4" /></button>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">ID: {c.empresa_id} • Login: <strong>{c.login || c.empresa_id}</strong></div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/gerencia?empresa=${encodeURIComponent(c.empresa_id)}`} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-900 text-white flex items-center gap-1.5" title="Abrir e entrar com credencial da empresa ou credencial mestre">
                        <ExternalLink className="w-3.5 h-3.5" />Entrar na empresa
                      </a>
                      <button onClick={() => toggle(c)} className={`text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 ${c.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
                        {c.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}{c.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                      <button disabled={deletingId === c.empresa_id} onClick={() => void deleteCompany(c)} className="text-xs font-bold px-3 py-2 rounded-xl bg-rose-50 text-rose-700 flex items-center gap-1.5 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

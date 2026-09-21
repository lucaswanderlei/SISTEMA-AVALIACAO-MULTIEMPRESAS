import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import {
  apiCreateUser,
  apiDeleteUser,
  apiFetchUsers,
  apiUpdateUser,
  CompanyUser,
  CompanyUserAccessLevel,
} from '../lib/api';
import { tenantKey } from '../lib/tenant';

const levelLabel = (level: CompanyUserAccessLevel) => {
  if (level === 'owner') return 'Proprietário';
  if (level === 'viewer') return 'Somente leitura';
  if (level === 'redeemer') return 'Validador de brindes';
  return 'Gerente';
};

const formatLastAccess = (value?: string | null) => {
  if (!value) return 'Nunca acessou';
  try { return new Date(value).toLocaleString('pt-BR'); } catch { return value; }
};

export function UserAccessManager() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessLevel, setAccessLevel] = useState<'manager' | 'viewer' | 'redeemer'>('manager');

  const [editing, setEditing] = useState<CompanyUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editLogin, setEditLogin] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editLevel, setEditLevel] = useState<CompanyUserAccessLevel>('manager');
  const [editActive, setEditActive] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await apiFetchUsers();
    if (result.success) setUsers(result.users || []);
    else setError(result.error || 'Não foi possível carregar os usuários.');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setBusyId('new');
    const cpf = login.replace(/\D/g, '');
    if (cpf.length !== 11) { setError('Informe o CPF do usuário com 11 números.'); return; }
    const result = await apiCreateUser({ name: name.trim(), login: cpf, email: email.trim(), password, accessLevel });
    setBusyId(null);
    if (!result.success) { setError(result.error || 'Erro ao criar usuário.'); return; }
    setName(''); setLogin(''); setEmail(''); setPassword(''); setAccessLevel('manager'); setShowCreate(false);
    setSuccess('Usuário criado com sucesso.');
    await load();
  };

  const startEdit = (user: CompanyUser) => {
    clearMessages();
    setEditing(user);
    setEditName(user.nome || '');
    setEditLogin(user.login || '');
    setEditEmail(user.email || '');
    setEditPassword('');
    setEditLevel(user.perfil || 'manager');
    setEditActive(Boolean(user.ativo));
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    clearMessages();
    if (editPassword && editPassword.length < 6) { setError('A nova senha deve ter pelo menos 6 caracteres.'); return; }
    setBusyId(editing.id);
    const document = editLogin.replace(/\D/g, '');
    const validLength = editing.perfil === 'owner' ? (document.length === 11 || document.length === 14) : document.length === 11;
    if (!validLength) { setError(editing.perfil === 'owner' ? 'Informe CPF ou CNPJ do proprietário.' : 'Informe o CPF do usuário com 11 números.'); return; }
    const result = await apiUpdateUser(editing.id, {
      name: editName.trim(),
      login: document,
      email: editEmail.trim(),
      password: editPassword || undefined,
      accessLevel: editing.perfil === 'owner' ? 'owner' : editLevel,
      active: editing.perfil === 'owner' ? true : editActive,
    });
    setBusyId(null);
    if (!result.success) { setError(result.error || 'Erro ao atualizar usuário.'); return; }
    const ownerCredentialsChanged = editing.perfil === 'owner' && Boolean(editPassword || editLogin !== editing.login);
    setEditing(null);
    setSuccess(ownerCredentialsChanged ? 'Acesso principal atualizado. Por segurança, você será desconectado para entrar novamente.' : 'Usuário atualizado com sucesso.');
    if (ownerCredentialsChanged) {
      window.setTimeout(() => {
        try {
          localStorage.removeItem(tenantKey('restaurant_manager_auth'));
          localStorage.removeItem(tenantKey('restaurant_manager_token'));
          localStorage.removeItem(tenantKey('restaurant_manager_role'));
          localStorage.removeItem(tenantKey('restaurant_manager_access'));
        } catch {}
        window.location.reload();
      }, 1200);
    } else {
      await load();
    }
  };

  const removeUser = async (user: CompanyUser) => {
    if (user.perfil === 'owner') return;
    if (!window.confirm(`Excluir o acesso de ${user.nome}?`)) return;
    clearMessages();
    setBusyId(user.id);
    const result = await apiDeleteUser(user.id);
    setBusyId(null);
    if (!result.success) { setError(result.error || 'Erro ao excluir usuário.'); return; }
    setSuccess('Usuário excluído.');
    await load();
  };

  return (
    <div className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="p-2.5 bg-sky-100 text-sky-700 rounded-2xl"><Users className="w-5 h-5" /></span>
          <div>
            <h3 className="font-extrabold text-stone-900 text-base">Usuários e Permissões</h3>
            <p className="text-xs text-stone-500 mt-0.5">Crie acessos individuais. O validador de brindes vê apenas a tela de leitura e resgate por QR Code.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="px-3 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</button>
          <button type="button" onClick={() => { clearMessages(); setShowCreate(v => !v); }} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" />Novo usuário</button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">{error}</div>}
      {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex gap-2"><CheckCircle2 className="w-4 h-4" />{success}</div>}

      {showCreate && (
        <form onSubmit={createUser} className="p-4 rounded-2xl bg-sky-50/60 border border-sky-100 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do usuário" className="p-3 rounded-xl border border-stone-300 bg-white text-sm" />
          <input required inputMode="numeric" value={login} onChange={e=>setLogin(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="CPF do usuário" className="p-3 rounded-xl border border-stone-300 bg-white text-sm" />
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail para recuperação (recomendado)" className="p-3 rounded-xl border border-stone-300 bg-white text-sm" />
          <div className="relative">
            <input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha inicial (mín. 6)" className="w-full p-3 pr-10 rounded-xl border border-stone-300 bg-white text-sm" />
            <button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">{showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
          </div>
          <select value={accessLevel} onChange={e=>setAccessLevel(e.target.value as 'manager'|'viewer'|'redeemer')} className="p-3 rounded-xl border border-stone-300 bg-white text-sm font-bold">
            <option value="manager">Gerente — pode editar e operar</option>
            <option value="viewer">Somente leitura — não pode alterar dados</option>
            <option value="redeemer">Validador de brindes — somente resgate</option>
          </select>
          <div className="flex gap-2 md:justify-end">
            <button type="button" onClick={()=>setShowCreate(false)} className="px-4 py-2.5 rounded-xl bg-white border border-stone-300 text-xs font-bold flex items-center gap-1"><X className="w-4 h-4"/>Cancelar</button>
            <button disabled={busyId==='new'} className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"><UserCog className="w-4 h-4"/>{busyId==='new' ? 'Criando...' : 'Criar acesso'}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {users.map(user => (
          <div key={user.id} className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60">
            {editing?.id === user.id ? (
              <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <input required value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nome" className="p-2.5 rounded-xl border border-stone-300 bg-white text-sm" />
                <input required inputMode="numeric" value={editLogin} onChange={e=>setEditLogin(e.target.value.replace(/\D/g, '').slice(0, user.perfil === 'owner' ? 14 : 11))} placeholder={user.perfil === 'owner' ? 'CPF ou CNPJ do proprietário' : 'CPF do usuário'} className="p-2.5 rounded-xl border border-stone-300 bg-white text-sm" />
                <input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} placeholder="E-mail de recuperação" className="p-2.5 rounded-xl border border-stone-300 bg-white text-sm" />
                <input type="password" minLength={6} value={editPassword} onChange={e=>setEditPassword(e.target.value)} placeholder="Nova senha (opcional)" className="p-2.5 rounded-xl border border-stone-300 bg-white text-sm" />
                {user.perfil === 'owner' ? (
                  <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Proprietário principal</div>
                ) : (
                  <select value={editLevel} onChange={e=>setEditLevel(e.target.value as CompanyUserAccessLevel)} className="p-2.5 rounded-xl border border-stone-300 bg-white text-sm font-bold">
                    <option value="manager">Gerente</option>
                    <option value="viewer">Somente leitura</option>
                    <option value="redeemer">Validador de brindes</option>
                  </select>
                )}
                {user.perfil !== 'owner' && <label className="p-2.5 rounded-xl border border-stone-300 bg-white text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={editActive} onChange={e=>setEditActive(e.target.checked)} />Usuário ativo</label>}
                <div className="lg:col-span-3 flex gap-2 justify-end mt-1">
                  <button type="button" onClick={()=>setEditing(null)} className="px-3 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-bold">Cancelar</button>
                  <button disabled={busyId===user.id} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">{busyId===user.id ? 'Salvando...' : 'Salvar usuário'}</button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-stone-900">{user.nome}</span>
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${user.perfil === 'owner' ? 'bg-amber-50 border-amber-200 text-amber-700' : user.perfil === 'viewer' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>{levelLabel(user.perfil)}</span>
                    {!user.ativo && <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">Inativo</span>}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">{user.perfil === 'owner' ? 'CPF/CNPJ:' : 'CPF:'} <strong>{user.login}</strong>{user.email ? ` • ${user.email}` : ' • sem e-mail de recuperação'}</div>
                  <div className="text-[11px] text-stone-400 mt-1">Último acesso: {formatLastAccess(user.ultimo_acesso_em)}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={()=>startEdit(user)} className="px-3 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold flex items-center gap-1"><KeyRound className="w-4 h-4"/>Editar</button>
                  {user.perfil !== 'owner' && <button type="button" disabled={busyId===user.id} onClick={()=>void removeUser(user)} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 disabled:opacity-50"><Trash2 className="w-4 h-4"/>Excluir</button>}
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && users.length === 0 && <div className="p-5 text-center text-sm text-stone-400">Nenhum usuário encontrado.</div>}
      </div>
    </div>
  );
}

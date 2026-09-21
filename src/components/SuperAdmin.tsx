import { BillingAdmin } from './BillingAdmin';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  History,
  ExternalLink,
  Eye,
  DollarSign,
  Download,
  EyeOff,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type SubscriptionPlan = 'basic' | 'pro' | 'premium';
type SubscriptionStatus = 'trial' | 'active' | 'suspended';
type EffectiveStatus = SubscriptionStatus | 'expired';

type Company = {
  empresa_id: string;
  nome: string;
  slug: string;
  login?: string;
  recovery_email?: string | null;
  ativo: boolean;
  plano?: SubscriptionPlan;
  status_assinatura?: SubscriptionStatus;
  vencimento_em?: string | null;
  status_efetivo?: EffectiveStatus;
  total_avaliacoes?: number;
  criado_em?: string;
  atualizado_em?: string;
};

type PlanPrices = Record<SubscriptionPlan, number>;
type AuditLog = {
  id: number | string;
  companyId?: string | null;
  companyName?: string | null;
  actorRole: 'superadmin' | 'manager' | string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  details?: Record<string, any>;
  createdAt: string;
};

type DashboardData = {
  generatedAt: string;
  totals: {
    companies: number;
    active: number;
    trial: number;
    suspended: number;
    expired: number;
    expiring7Days: number;
    totalReviews: number;
    reviews30d: number;
    uniqueCustomers: number;
    mrr: number;
  };
  plans: {
    counts: PlanPrices;
    prices: PlanPrices;
    mrrByPlan: PlanPrices;
  };
  dailyReviews: Array<{ date: string; count: number }>;
  topCompanies: Array<{
    empresaId: string;
    nome: string;
    plan: SubscriptionPlan;
    status: EffectiveStatus;
    totalReviews: number;
    reviews30d: number;
  }>;
};

const EMPTY_PLAN_PRICES: PlanPrices = { basic: 0, pro: 0, premium: 0 };
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const addDaysToToday = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isoToInputDate = (value?: string | null) => value ? String(value).slice(0, 10) : '';
const inputDateToIso = (value: string) => value ? `${value}T23:59:59.999Z` : null;

const planLabel = (plan?: SubscriptionPlan) => {
  if (plan === 'basic') return 'Básico';
  if (plan === 'premium') return 'Premium';
  return 'Pro';
};

const effectiveStatus = (company: Company): EffectiveStatus => {
  if (company.status_efetivo) return company.status_efetivo;
  if (!company.ativo || company.status_assinatura === 'suspended') return 'suspended';
  if (company.vencimento_em && new Date(company.vencimento_em).getTime() <= Date.now()) return 'expired';
  if (company.status_assinatura === 'trial') return 'trial';
  return 'active';
};

const statusLabel = (status: EffectiveStatus) => {
  if (status === 'trial') return 'Em teste';
  if (status === 'suspended') return 'Suspensa';
  if (status === 'expired') return 'Vencida';
  return 'Ativa';
};

const statusClass = (status: EffectiveStatus) => {
  if (status === 'trial') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'suspended') return 'bg-stone-200 text-stone-700 border-stone-300';
  if (status === 'expired') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem vencimento';
  const datePart = String(value).slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return year && month && day ? `${day}/${month}/${year}` : datePart;
};

export function SuperAdmin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('super_admin_token') || '');
  const [masterLogin, setMasterLogin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [planPrices, setPlanPrices] = useState<PlanPrices>(EMPTY_PLAN_PRICES);
  const [savingPrices, setSavingPrices] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [companyLogin, setCompanyLogin] = useState('');
  const [companyPassword, setCompanyPassword] = useState('');
  const [companyRecoveryEmail, setCompanyRecoveryEmail] = useState('');
  const [showCompanyPassword, setShowCompanyPassword] = useState(false);
  const [companyPlan, setCompanyPlan] = useState<SubscriptionPlan>('pro');
  const [companyStatus, setCompanyStatus] = useState<SubscriptionStatus>('trial');
  const [companyExpiresAt, setCompanyExpiresAt] = useState(addDaysToToday(7));

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingLogin, setEditingLogin] = useState('');
  const [editingPassword, setEditingPassword] = useState('');
  const [editingRecoveryEmail, setEditingRecoveryEmail] = useState('');
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan>('pro');
  const [editingStatus, setEditingStatus] = useState<SubscriptionStatus>('active');
  const [editingExpiresAt, setEditingExpiresAt] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [backupCompanyId, setBackupCompanyId] = useState<string | null>(null);
  const [demoCompanyId, setDemoCompanyId] = useState<string | null>(null);
  const [backupAllBusy, setBackupAllBusy] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditCompanyFilter, setAuditCompanyFilter] = useState('');

  const downloadAdminFile = async (url: string, fallbackName: string) => {
    const res = await request(url, { cache: 'no-store' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Não foi possível gerar o backup.');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const fileName = match?.[1] || fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const backupCompany = async (company: Company) => {
    setBackupCompanyId(company.empresa_id);
    setError('');
    try {
      await downloadAdminFile(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/backup`, `backup_${company.empresa_id}.json`);
    } catch (e: any) {
      setError(e.message || 'Erro ao baixar backup da empresa.');
    } finally {
      setBackupCompanyId(null);
    }
  };

  const seedDemo = async (company: Company, reset: boolean) => {
    if (reset && !window.confirm(`Isso vai apagar os dados fictícios já gerados para "${company.nome}" antes de criar novos. Avaliações reais (se houver) não são afetadas. Continuar?`)) return;
    setDemoCompanyId(company.empresa_id);
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/seed-demo`, {
        method: 'POST',
        body: JSON.stringify({ days: 45, count: 120, reset }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar os dados de demonstração.');
      window.alert(`${data.added} avaliações fictícias geradas para "${company.nome}" (total: ${data.total}).`);
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar dados de demonstração.');
    } finally {
      setDemoCompanyId(null);
    }
  };

  const clearDemo = async (company: Company) => {
    if (!window.confirm(`Remover todos os dados fictícios de "${company.nome}"? Avaliações reais não são afetadas.`)) return;
    setDemoCompanyId(company.empresa_id);
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/demo-data`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível remover os dados de demonstração.');
      window.alert(`${data.removed} avaliações fictícias removidas de "${company.nome}" (restam: ${data.total}).`);
    } catch (e: any) {
      setError(e.message || 'Erro ao remover dados de demonstração.');
    } finally {
      setDemoCompanyId(null);
    }
  };

  const backupAll = async () => {
    setBackupAllBusy(true);
    setError('');
    try {
      await downloadAdminFile('/api/admin/backup', `backup_plataforma_${new Date().toISOString().slice(0,10)}.json`);
    } catch (e: any) {
      setError(e.message || 'Erro ao baixar backup geral.');
    } finally {
      setBackupAllBusy(false);
    }
  };

  const request = async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
  };

  const loadAudit = async () => {
    if (!token) return;
    setAuditLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (auditCompanyFilter) qs.set('companyId', auditCompanyFilter);
      const res = await request(`/api/admin/audit?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar o histórico.');
      setAuditLogs(data.logs || []);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar auditoria.');
    } finally {
      setAuditLoading(false);
    }
  };

  const load = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const [companiesRes, dashboardRes] = await Promise.all([
        request('/api/admin/companies', { cache: 'no-store' }),
        request('/api/admin/dashboard', { cache: 'no-store' }),
      ]);
      if (companiesRes.status === 401 || dashboardRes.status === 401) {
        sessionStorage.removeItem('super_admin_token');
        setToken('');
        throw new Error('Sessão mestre expirada. Entre novamente.');
      }
      if (!companiesRes.ok) throw new Error('Não foi possível carregar as empresas.');
      if (!dashboardRes.ok) throw new Error('Não foi possível carregar os indicadores comerciais.');
      const [companiesData, dashboardData] = await Promise.all([companiesRes.json(), dashboardRes.json()]);
      setCompanies(companiesData.companies || []);
      setDashboard(dashboardData);
      setPlanPrices(dashboardData?.plans?.prices || EMPTY_PLAN_PRICES);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar.');
    } finally {
      setBusy(false);
    }
  };

  const savePlanPrices = async () => {
    if (savingPrices) return;
    setSavingPrices(true);
    setError('');
    try {
      const res = await request('/api/admin/dashboard/plan-prices', {
        method: 'PUT',
        body: JSON.stringify(planPrices),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar os valores dos planos.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar valores dos planos.');
    } finally {
      setSavingPrices(false);
    }
  };

  useEffect(() => {
    void load();
    void loadAudit();
  }, [token]);

  useEffect(() => {
    if (token) void loadAudit();
  }, [auditCompanyFilter]);

  const summary = useMemo(() => {
    const counts = { active: 0, trial: 0, blocked: 0, reviews: 0 };
    for (const company of companies) {
      const status = effectiveStatus(company);
      if (status === 'active') counts.active += 1;
      else if (status === 'trial') counts.trial += 1;
      else counts.blocked += 1;
      counts.reviews += Number(company.total_avaliacoes || 0);
    }
    return counts;
  }, [companies]);

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
        body: JSON.stringify({
          name,
          slug,
          login: companyLogin,
          password: companyPassword,
          recoveryEmail: companyRecoveryEmail,
          plan: companyPlan,
          subscriptionStatus: companyStatus,
          expiresAt: inputDateToIso(companyExpiresAt),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível cadastrar a empresa.');
      setName('');
      setSlug('');
      setCompanyLogin('');
      setCompanyPassword('');
      setCompanyRecoveryEmail('');
      setCompanyPlan('pro');
      setCompanyStatus('trial');
      setCompanyExpiresAt(addDaysToToday(7));
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao cadastrar.');
    }
  };

  const changeStatus = async (company: Company) => {
    if (changingStatusId) return;
    setChangingStatusId(company.empresa_id);
    setError('');
    try {
      const current = effectiveStatus(company);
      const nextStatus: SubscriptionStatus = current === 'suspended' ? 'active' : 'suspended';
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ subscriptionStatus: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível alterar o status.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao alterar status.');
    } finally {
      setChangingStatusId(null);
    }
  };

  const renewCompany = async (company: Company) => {
    if (renewingId) return;
    setRenewingId(company.empresa_id);
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}/renew`, {
        method: 'POST',
        body: JSON.stringify({ days: 30 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Não foi possível renovar a empresa.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao renovar empresa.');
    } finally {
      setRenewingId(null);
    }
  };

  const startEdit = (company: Company) => {
    setEditingId(company.empresa_id);
    setEditingName(company.nome);
    setEditingLogin(company.login || company.empresa_id);
    setEditingPassword('');
    setEditingRecoveryEmail(company.recovery_email || '');
    setEditingPlan(company.plano || 'pro');
    setEditingStatus(company.status_assinatura || (company.ativo ? 'active' : 'suspended'));
    setEditingExpiresAt(isoToInputDate(company.vencimento_em));
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingLogin('');
    setEditingPassword('');
    setEditingRecoveryEmail('');
    setEditingPlan('pro');
    setEditingStatus('active');
    setEditingExpiresAt('');
  };

  const saveCompany = async (company: Company) => {
    const cleanName = editingName.trim();
    const cleanLogin = editingLogin.replace(/\D/g, '');
    if (!cleanName || (cleanLogin.length !== 11 && cleanLogin.length !== 14)) {
      setError('Informe nome e CPF/CNPJ válidos.');
      return;
    }
    setError('');
    try {
      const res = await request(`/api/admin/companies/${encodeURIComponent(company.empresa_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: cleanName,
          login: cleanLogin,
          password: editingPassword || undefined,
          recoveryEmail: editingRecoveryEmail,
          plan: editingPlan,
          subscriptionStatus: editingStatus,
          expiresAt: inputDateToIso(editingExpiresAt),
        }),
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
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-stone-900">Painel Multiempresas</h1>
            <p className="text-xs text-stone-500">Administrador geral da plataforma</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('super_admin_token');
              setToken('');
              setCompanies([]);
              setDashboard(null);
            }}
            className="text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100"
          >
            <LogOut className="w-4 h-4" />Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {error && <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3 text-sm font-semibold">{error}</div>}

        <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-xs font-bold text-stone-500 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />Empresas</div>
            <div className="text-2xl font-black text-stone-900 mt-1">{dashboard?.totals.companies ?? companies.length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Ativas</div>
            <div className="text-2xl font-black text-stone-900 mt-1">{dashboard?.totals.active ?? summary.active}</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-xs font-bold text-sky-600 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Clientes únicos</div>
            <div className="text-2xl font-black text-stone-900 mt-1">{dashboard?.totals.uniqueCustomers ?? 0}</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-xs font-bold text-violet-600 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Avaliações</div>
            <div className="text-2xl font-black text-stone-900 mt-1">{dashboard?.totals.totalReviews ?? summary.reviews}</div>
            <div className="text-[10px] text-stone-400 mt-0.5">{dashboard?.totals.reviews30d ?? 0} nos últimos 30 dias</div>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <div className="text-xs font-bold text-amber-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Vencem em 7 dias</div>
            <div className="text-2xl font-black text-stone-900 mt-1">{dashboard?.totals.expiring7Days ?? 0}</div>
          </div>
          <div className="bg-stone-900 rounded-2xl border border-stone-900 p-4 text-white">
            <div className="text-xs font-bold text-stone-300 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />MRR estimado</div>
            <div className="text-2xl font-black mt-1">{formatCurrency(dashboard?.totals.mrr ?? 0)}</div>
            <div className="text-[10px] text-stone-400 mt-0.5">somente assinaturas ativas</div>
          </div>
        </section>

        <section className="grid xl:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-5 xl:col-span-2">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-black text-stone-900 flex items-center gap-2"><BarChart3 className="w-5 h-5" />Atividade da plataforma</h2>
                <p className="text-xs text-stone-500 mt-1">Avaliações recebidas nos últimos 7 dias</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-stone-400">Últimos 30 dias</div>
                <div className="font-black text-stone-900">{dashboard?.totals.reviews30d ?? 0}</div>
              </div>
            </div>
            <div className="h-44 flex items-end gap-2">
              {(dashboard?.dailyReviews || []).map((item) => {
                const maxValue = Math.max(1, ...(dashboard?.dailyReviews || []).map((d) => d.count));
                const height = Math.max(item.count > 0 ? 10 : 3, Math.round((item.count / maxValue) * 100));
                const date = new Date(`${item.date}T12:00:00`);
                return (
                  <div key={item.date} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
                    <div className="text-[10px] font-bold text-stone-600 mb-1">{item.count}</div>
                    <div className="w-full max-w-12 bg-rose-500 rounded-t-lg transition-all" style={{ height: `${height}%` }} />
                    <div className="text-[10px] text-stone-400 mt-2">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</div>
                  </div>
                );
              })}
              {!dashboard?.dailyReviews?.length && <div className="w-full text-center text-sm text-stone-400 self-center">Carregando atividade...</div>}
            </div>
          </div>

          <BillingAdmin token={token} />

          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-black text-stone-900 flex items-center gap-2"><DollarSign className="w-5 h-5" />Valores dos planos</h2>
            <p className="text-xs text-stone-500 mt-1 mb-4">Defina o valor mensal usado nas novas contratações e no MRR estimado.</p>
            <div className="space-y-3">
              {(['basic', 'pro', 'premium'] as SubscriptionPlan[]).map((plan) => (
                <label key={plan} className="block">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-stone-700">{planLabel(plan)}</span>
                    <span className="text-stone-400">{dashboard?.plans?.counts?.[plan] ?? 0} empresa(s)</span>
                  </div>
                  <div className="flex items-center rounded-xl border border-stone-300 overflow-hidden focus-within:ring-2 focus-within:ring-stone-900">
                    <span className="px-3 text-sm font-bold text-stone-500">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={planPrices[plan]}
                      onChange={(e) => setPlanPrices((current) => ({ ...current, [plan]: Math.max(0, Number(e.target.value) || 0) }))}
                      className="w-full px-2 py-2.5 outline-none"
                    />
                  </div>
                </label>
              ))}
              <button onClick={() => void savePlanPrices()} disabled={savingPrices} className="w-full mt-2 bg-stone-900 text-white rounded-xl py-2.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" />{savingPrices ? 'Salvando...' : 'Salvar valores'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-black text-stone-900 mb-4">Situação das assinaturas</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><div className="text-xs font-bold text-emerald-700">Ativas</div><div className="text-xl font-black mt-1">{dashboard?.totals.active ?? summary.active}</div></div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3"><div className="text-xs font-bold text-amber-700">Em teste</div><div className="text-xl font-black mt-1">{dashboard?.totals.trial ?? summary.trial}</div></div>
              <div className="rounded-xl bg-stone-100 border border-stone-200 p-3"><div className="text-xs font-bold text-stone-700">Suspensas</div><div className="text-xl font-black mt-1">{dashboard?.totals.suspended ?? 0}</div></div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3"><div className="text-xs font-bold text-rose-700">Vencidas</div><div className="text-xl font-black mt-1">{dashboard?.totals.expired ?? 0}</div></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="font-black text-stone-900 mb-4">Empresas com mais atividade</h2>
            <div className="space-y-2">
              {(dashboard?.topCompanies || []).map((company, index) => (
                <div key={company.empresaId} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-stone-900 truncate">{index + 1}. {company.nome}</div>
                    <div className="text-[10px] text-stone-400">{planLabel(company.plan)} • {company.totalReviews} no total</div>
                  </div>
                  <div className="text-right shrink-0"><div className="font-black text-stone-900">{company.reviews30d}</div><div className="text-[10px] text-stone-400">30 dias</div></div>
                </div>
              ))}
              {!dashboard?.topCompanies?.length && <div className="text-sm text-stone-400">Ainda não há avaliações suficientes para ranking.</div>}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-stone-200 p-5">
          <h2 className="font-black text-stone-900 mb-4 flex gap-2 items-center"><Plus className="w-5 h-5" />Cadastrar nova empresa</h2>
          <form onSubmit={createCompany} className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" className="border border-stone-300 rounded-xl px-4 py-3" />
            <input
              required
              value={slug}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                setSlug(value);
              }}
              placeholder="identificador-ex: pizzaria-teste"
              className="border border-stone-300 rounded-xl px-4 py-3"
            />
            <input required inputMode="numeric" value={companyLogin} onChange={(e) => setCompanyLogin(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="CPF ou CNPJ do proprietário" className="border border-stone-300 rounded-xl px-4 py-3" />
            <div className="relative">
              <input required minLength={6} type={showCompanyPassword ? 'text' : 'password'} value={companyPassword} onChange={(e) => setCompanyPassword(e.target.value)} placeholder="Senha inicial" className="w-full border border-stone-300 rounded-xl px-4 py-3 pr-11" />
              <button type="button" onClick={() => setShowCompanyPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showCompanyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input type="email" value={companyRecoveryEmail} onChange={(e) => setCompanyRecoveryEmail(e.target.value)} placeholder="E-mail de recuperação" className="border border-stone-300 rounded-xl px-4 py-3" />
            <select value={companyPlan} onChange={(e) => setCompanyPlan(e.target.value as SubscriptionPlan)} className="border border-stone-300 rounded-xl px-4 py-3 bg-white">
              <option value="basic">Plano Standard</option>
              <option value="pro">Plano Pro</option>
              <option value="premium">Plano Premium</option>
            </select>
            <select
              value={companyStatus}
              onChange={(e) => {
                const next = e.target.value as SubscriptionStatus;
                setCompanyStatus(next);
                if (next === 'trial') setCompanyExpiresAt(addDaysToToday(7));
                if (next === 'active') setCompanyExpiresAt(addDaysToToday(30));
              }}
              className="border border-stone-300 rounded-xl px-4 py-3 bg-white"
            >
              <option value="trial">Em teste</option>
              <option value="active">Ativa</option>
              <option value="suspended">Suspensa</option>
            </select>
            <label className="border border-stone-300 rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-stone-600">
              <CalendarDays className="w-4 h-4" />
              <span className="text-xs font-bold whitespace-nowrap">Vencimento</span>
              <input type="date" value={companyExpiresAt} onChange={(e) => setCompanyExpiresAt(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            <button className="md:col-span-2 lg:col-span-2 bg-rose-600 text-white font-bold px-5 py-3 rounded-xl">Cadastrar empresa com acesso</button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="p-5 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h2 className="font-black text-stone-900 flex gap-2 items-center"><Building2 className="w-5 h-5" />Empresas</h2>
              <p className="text-xs text-stone-500 mt-1">{companies.length} empresa(s) • {summary.reviews} avaliação(ões) armazenada(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void backupAll()} disabled={backupAllBusy} className="px-3 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-black flex items-center gap-1.5 disabled:opacity-50" title="Baixar backup de dados de todas as empresas">
                <Download className="w-4 h-4" />{backupAllBusy ? 'Gerando...' : 'Backup geral'}
              </button>
              <button onClick={load} className="p-2 rounded-xl bg-stone-100" title="Atualizar"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {companies.length === 0 && !busy ? (
              <div className="p-8 text-center text-stone-400">Nenhuma empresa cadastrada ainda.</div>
            ) : companies.map((c) => {
              const currentStatus = effectiveStatus(c);
              return (
                <div key={c.empresa_id} className="p-4 sm:p-5 space-y-3">
                  {editingId === c.empresa_id ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                      <input value={editingName} onChange={(e) => setEditingName(e.target.value)} placeholder="Nome" className="border border-stone-300 rounded-xl px-3 py-2 font-bold" />
                      <input inputMode="numeric" value={editingLogin} onChange={(e) => setEditingLogin(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="CPF ou CNPJ do proprietário" className="border border-stone-300 rounded-xl px-3 py-2 font-bold" />
                      <input type="password" minLength={6} value={editingPassword} onChange={(e) => setEditingPassword(e.target.value)} placeholder="Nova senha (opcional)" className="border border-stone-300 rounded-xl px-3 py-2" />
                      <input type="email" value={editingRecoveryEmail} onChange={(e) => setEditingRecoveryEmail(e.target.value)} placeholder="E-mail de recuperação" className="border border-stone-300 rounded-xl px-3 py-2" />
                      <select value={editingPlan} onChange={(e) => setEditingPlan(e.target.value as SubscriptionPlan)} className="border border-stone-300 rounded-xl px-3 py-2 bg-white">
                        <option value="basic">Plano Standard</option>
                        <option value="pro">Plano Pro</option>
                        <option value="premium">Plano Premium</option>
                      </select>
                      <select value={editingStatus} onChange={(e) => setEditingStatus(e.target.value as SubscriptionStatus)} className="border border-stone-300 rounded-xl px-3 py-2 bg-white">
                        <option value="trial">Em teste</option>
                        <option value="active">Ativa</option>
                        <option value="suspended">Suspensa</option>
                      </select>
                      <label className="border border-stone-300 rounded-xl px-3 py-2 flex items-center gap-2 text-sm">
                        <CalendarDays className="w-4 h-4 text-stone-400" />
                        <input type="date" value={editingExpiresAt} onChange={(e) => setEditingExpiresAt(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" />
                      </label>
                      <div className="md:col-span-2 lg:col-span-3 flex gap-2">
                        <button onClick={() => void saveCompany(c)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1"><Check className="w-4 h-4" />Salvar</button>
                        <button onClick={cancelEdit} className="px-3 py-2 rounded-xl bg-stone-200 text-stone-700 font-bold flex items-center gap-1"><X className="w-4 h-4" />Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-extrabold text-stone-900 truncate">{c.nome}</div>
                          <span className={`text-[10px] uppercase tracking-wide font-black border px-2 py-0.5 rounded-full ${statusClass(currentStatus)}`}>{statusLabel(currentStatus)}</span>
                          <span className="text-[10px] uppercase tracking-wide font-black border border-sky-200 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">{planLabel(c.plano)}</span>
                          <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100" title="Editar empresa"><Pencil className="w-4 h-4" /></button>
                        </div>
                        <div className="text-xs text-stone-500 mt-1">ID: {c.empresa_id} • Login: <strong>{c.login || c.empresa_id}</strong></div>
                        <div className="text-xs text-stone-500 mt-1">Recuperação: <strong>{c.recovery_email || 'não cadastrada'}</strong></div>
                        <div className="text-xs text-stone-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />Vence: <strong>{formatDate(c.vencimento_em)}</strong></span>
                          <span>{Number(c.total_avaliacoes || 0)} avaliação(ões)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a href={`/?empresa=${encodeURIComponent(c.empresa_id)}&cliente=1`} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 flex items-center gap-1.5" title="Abrir página pública de avaliação">
                          <ExternalLink className="w-3.5 h-3.5" />Avaliação
                        </a>
                        <a href={`/gerencia?empresa=${encodeURIComponent(c.empresa_id)}`} target="_blank" rel="noreferrer" className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-900 text-white flex items-center gap-1.5" title="Abrir e entrar com credencial da empresa ou credencial mestre">
                          <ExternalLink className="w-3.5 h-3.5" />Entrar na empresa
                        </a>
                        <button
                          disabled={backupCompanyId === c.empresa_id}
                          onClick={() => void backupCompany(c)}
                          className="text-xs font-bold px-3 py-2 rounded-xl bg-violet-50 text-violet-700 flex items-center gap-1.5 disabled:opacity-50"
                          title="Baixar backup desta empresa"
                        >
                          <Download className="w-3.5 h-3.5" />{backupCompanyId === c.empresa_id ? 'Gerando...' : 'Backup'}
                        </button>
                        <button
                          disabled={demoCompanyId === c.empresa_id}
                          onClick={() => void seedDemo(c, false)}
                          className="text-xs font-bold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 flex items-center gap-1.5 disabled:opacity-50"
                          title="Adicionar avaliações fictícias para mostrar o painel funcionando (não afeta avaliações reais). Cadastre garçons e um brinde antes."
                        >
                          <Sparkles className="w-3.5 h-3.5" />{demoCompanyId === c.empresa_id ? 'Gerando...' : 'Gerar demo'}
                        </button>
                        <button
                          disabled={demoCompanyId === c.empresa_id}
                          onClick={() => void clearDemo(c)}
                          className="text-xs font-bold px-3 py-2 rounded-xl bg-stone-100 text-stone-600 flex items-center gap-1.5 disabled:opacity-50"
                          title="Remover as avaliações fictícias desta empresa (avaliações reais não são afetadas)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />Limpar demo
                        </button>
                        <button
                          disabled={renewingId === c.empresa_id}
                          onClick={() => void renewCompany(c)}
                          className="text-xs font-bold px-3 py-2 rounded-xl bg-sky-50 text-sky-700 flex items-center gap-1.5 disabled:opacity-50"
                          title="Adicionar 30 dias ao vencimento e deixar a empresa ativa"
                        >
                          <CalendarDays className="w-3.5 h-3.5" />{renewingId === c.empresa_id ? 'Renovando...' : '+30 dias'}
                        </button>
                        <button
                          disabled={changingStatusId === c.empresa_id}
                          onClick={() => void changeStatus(c)}
                          className={`text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50 ${currentStatus === 'suspended' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-700'}`}
                        >
                          {currentStatus === 'suspended' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {currentStatus === 'suspended' ? 'Ativar' : 'Suspender'}
                        </button>
                        <button disabled={deletingId === c.empresa_id} onClick={() => void deleteCompany(c)} className="text-xs font-bold px-3 py-2 rounded-xl bg-rose-50 text-rose-700 flex items-center gap-1.5 disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-stone-900 flex gap-2 items-center"><History className="w-5 h-5" />Histórico de Auditoria</h2>
              <p className="text-xs text-stone-500 mt-1">Registra ações administrativas sem armazenar senhas, tokens ou chaves de integração.</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={auditCompanyFilter} onChange={(e) => setAuditCompanyFilter(e.target.value)} className="border border-stone-300 rounded-xl px-3 py-2 bg-white text-xs font-bold max-w-[220px]">
                <option value="">Todas as empresas</option>
                {companies.map((company) => <option key={company.empresa_id} value={company.empresa_id}>{company.nome}</option>)}
              </select>
              <button onClick={() => void loadAudit()} disabled={auditLoading} className="p-2 rounded-xl bg-stone-100 disabled:opacity-50" title="Atualizar histórico"><RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} /></button>
            </div>
          </div>
          <div className="divide-y divide-stone-100 max-h-[520px] overflow-y-auto">
            {auditLoading && auditLogs.length === 0 ? <div className="p-6 text-center text-sm text-stone-400">Carregando histórico...</div> : null}
            {!auditLoading && auditLogs.length === 0 ? <div className="p-6 text-center text-sm text-stone-400">Ainda não há ações registradas.</div> : null}
            {auditLogs.map((log) => (
              <div key={String(log.id)} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-stone-900">{log.summary}</div>
                  <div className="text-[11px] text-stone-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Por: <strong>{log.actorName || (log.actorRole === 'superadmin' ? 'SuperAdmin' : 'Usuário')}</strong></span>
                    <span>Empresa: <strong>{log.companyName || log.companyId || 'Plataforma'}</strong></span>
                    <span className="font-mono text-[10px] text-stone-400">{log.action}</span>
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-stone-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';

type PortalResponse = {
  success?: boolean;
  token?: string;
  role?: 'manager' | 'superadmin';
  companyId?: string;
  userName?: string;
  accessLevel?: 'owner' | 'manager' | 'viewer';
  redirect?: string;
  error?: string;
};

export function AccessPortal() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(() => {
    try { return new URLSearchParams(window.location.search).get('cadastro') === '1' ? 'register' : 'login'; } catch { return 'login'; }
  });
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!login.trim() || !password) {
      setError('Informe seu login e sua senha.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/portal-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = (await response.json().catch(() => ({}))) as PortalResponse;
      if (!response.ok || !data.success || !data.token) {
        setError(data.error || 'Não foi possível entrar. Confira seus dados.');
        return;
      }

      if (data.role === 'superadmin') {
        sessionStorage.setItem('super_admin_token', data.token);
        window.location.assign(data.redirect || '/super-admin');
        return;
      }

      if (!data.companyId) {
        setError('A empresa deste acesso não foi identificada.');
        return;
      }

      const prefix = `${data.companyId}::`;
      sessionStorage.setItem(`${prefix}restaurant_manager_auth`, 'true');
      sessionStorage.setItem(`${prefix}restaurant_manager_token`, data.token);
      sessionStorage.setItem(`${prefix}restaurant_manager_role`, 'manager');
      sessionStorage.setItem(`${prefix}restaurant_manager_access`, data.accessLevel || 'manager');
      localStorage.setItem('multiempresa_current_company', data.companyId);
      window.location.assign(data.redirect || `/gerencia?empresa=${encodeURIComponent(data.companyId)}`);
    } catch {
      setError('Não foi possível conectar ao sistema. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!fullName.trim() || !companyName.trim() || !document.trim() || !email.trim() || !phone.trim() || !newPassword) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError('A confirmação da senha não confere.');
      return;
    }
    if (!acceptedTerms) {
      setError('Você precisa aceitar os termos para criar sua conta.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, companyName, document, email, phone, password: newPassword }),
      });
      const data = (await response.json().catch(() => ({}))) as PortalResponse & { trialEndsAt?: string };
      if (!response.ok || !data.success || !data.token || !data.companyId) {
        setError(data.error || 'Não foi possível concluir seu cadastro.');
        return;
      }
      const prefix = `${data.companyId}::`;
      sessionStorage.setItem(`${prefix}restaurant_manager_auth`, 'true');
      sessionStorage.setItem(`${prefix}restaurant_manager_token`, data.token);
      sessionStorage.setItem(`${prefix}restaurant_manager_role`, 'manager');
      sessionStorage.setItem(`${prefix}restaurant_manager_access`, 'owner');
      localStorage.setItem('multiempresa_current_company', data.companyId);
      window.location.assign(data.redirect || `/gerencia?empresa=${encodeURIComponent(data.companyId)}`);
    } catch {
      setError('Não foi possível conectar ao sistema. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg,#f7f8fa 0%,#fff 52%,#f4f0f5 100%)', color: '#18151a', display: 'grid', gridTemplateRows: 'auto 1fr auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ height: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1180, width: 'calc(100% - 40px)', margin: '0 auto' }}>
        <a href="https://avaliaeganha.com.br" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 11, fontWeight: 900, fontSize: 20 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#5f183e', color: '#fff', boxShadow: '0 8px 20px rgba(95,24,62,.20)' }}><Sparkles size={20}/></span>
          Avalia <span style={{ color: '#5f183e' }}>e Ganha</span>
        </a>
        <a href="https://avaliaeganha.com.br" style={{ color: '#5f183e', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>Voltar ao site</a>
      </header>

      <main style={{ display: 'grid', placeItems: 'center', padding: '36px 20px 64px' }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', background: '#f5e9ef', color: '#7a234f', borderRadius: 999, fontWeight: 800, fontSize: 12 }}><ShieldCheck size={15}/> Área segura</span>
            <h1 style={{ fontSize: 'clamp(30px,5vw,42px)', letterSpacing: '-.045em', lineHeight: 1.02, margin: '14px 0 10px' }}>{mode === 'login' ? 'Entre no seu painel' : 'Crie sua conta grátis'}</h1>
            <p style={{ margin: 0, color: '#6f6870', lineHeight: 1.55 }}>{mode === 'login' ? 'Use seu e-mail e senha. O sistema identifica automaticamente o seu estabelecimento.' : 'Teste o Avalia e Ganha por 7 dias. Sem cobrança agora.'}</p>
          </div>

          <div style={{ display: 'flex', background: '#f5f1f3', padding: 4, borderRadius: 13, marginBottom: 14 }}>
            <button type="button" onClick={() => { setMode('login'); setError(''); }} style={{ flex: 1, border: 0, borderRadius: 10, padding: '10px 8px', fontWeight: 800, color: mode === 'login' ? '#5f183e' : '#756c72', background: mode === 'login' ? '#fff' : 'transparent', cursor: 'pointer', boxShadow: mode === 'login' ? '0 2px 8px rgba(42,26,37,.08)' : 'none' }}>Entrar</button>
            <button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ flex: 1, border: 0, borderRadius: 10, padding: '10px 8px', fontWeight: 800, color: mode === 'register' ? '#5f183e' : '#756c72', background: mode === 'register' ? '#fff' : 'transparent', cursor: 'pointer', boxShadow: mode === 'register' ? '0 2px 8px rgba(42,26,37,.08)' : 'none' }}>Criar conta</button>
          </div>

          {mode === 'login' ? <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #ece8eb', borderRadius: 24, padding: 26, boxShadow: '0 22px 55px rgba(42,26,37,.10)' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Login</label>
            <input autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Seu login" style={{ width: '100%', boxSizing: 'border-box', height: 50, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, outline: 'none', marginBottom: 17 }} />

            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" style={{ width: '100%', boxSizing: 'border-box', height: 50, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 48px 0 14px', fontSize: 16, outline: 'none' }} />
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)} style={{ position: 'absolute', right: 7, top: 6, width: 38, height: 38, border: 0, background: 'transparent', color: '#716b70', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button>
            </div>

            {error && <div style={{ marginTop: 14, padding: '11px 12px', borderRadius: 11, background: '#fff1f1', color: '#a82424', fontSize: 13, fontWeight: 700 }}>{error}</div>}

            <button disabled={loading} type="submit" style={{ width: '100%', height: 52, border: 0, borderRadius: 14, marginTop: 20, background: '#5f183e', color: '#fff', fontSize: 15, fontWeight: 900, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: loading ? .72 : 1 }}>
              <LockKeyhole size={18}/>{loading ? 'Entrando...' : 'Entrar no sistema'}{!loading && <ArrowRight size={18}/>} 
            </button>

            <p style={{ textAlign: 'center', color: '#827b81', fontSize: 12, margin: '16px 0 0', lineHeight: 1.5 }}>Problemas com o acesso? A recuperação de senha continua disponível na página de gerência da sua empresa.</p>
          </form> : <form onSubmit={register} style={{ background: '#fff', border: '1px solid #ece8eb', borderRadius: 24, padding: 26, boxShadow: '0 22px 55px rgba(42,26,37,.10)' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Nome completo</label>
            <input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome e sobrenome" maxLength={140} style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, marginBottom: 14 }} required />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Nome da empresa</label>
            <input autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Restaurante do João" maxLength={140} style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, marginBottom: 14 }} required />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>CPF ou CNPJ</label>
            <input inputMode="numeric" value={document} onChange={(e) => setDocument(e.target.value.replace(/[^\d./-]/g, '').slice(0, 18))} placeholder="Usado nas cobranças" style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, marginBottom: 14 }} required />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>E-mail</label>
            <input autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Usado para entrar, contato e pagamento" maxLength={254} style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, marginBottom: 14 }} required />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Telefone com DDD</label>
            <input autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="Ex.: 82999999999" style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, marginBottom: 14 }} required />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Crie uma senha</label>
            <input autoComplete="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" minLength={8} maxLength={128} style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16, marginBottom: 14 }} required />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 800, marginBottom: 7 }}>Confirme a senha</label>
            <input autoComplete="new-password" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Repita a senha" minLength={8} maxLength={128} style={{ width: '100%', boxSizing: 'border-box', height: 48, border: '1px solid #ded9dd', borderRadius: 13, padding: '0 14px', fontSize: 16 }} required />
            <label style={{ display: 'flex', gap: 8, marginTop: 15, color: '#675f65', fontSize: 12, lineHeight: 1.45 }}><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} required />Li e aceito os <a href="/termos" target="_blank" rel="noreferrer" style={{ color: '#5f183e', fontWeight: 800 }}>termos de uso</a> e a <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: '#5f183e', fontWeight: 800 }}>política de privacidade</a>.</label>
            {error && <div style={{ marginTop: 14, padding: '11px 12px', borderRadius: 11, background: '#fff1f1', color: '#a82424', fontSize: 13, fontWeight: 700 }}>{error}</div>}
            <button disabled={loading} type="submit" style={{ width: '100%', height: 52, border: 0, borderRadius: 14, marginTop: 20, background: '#5f183e', color: '#fff', fontSize: 15, fontWeight: 900, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: loading ? .72 : 1 }}><UserPlus size={18}/>{loading ? 'Criando conta...' : 'Começar 7 dias grátis'}{!loading && <ArrowRight size={18}/>}</button>
            <p style={{ textAlign: 'center', color: '#827b81', fontSize: 12, margin: '14px 0 0', lineHeight: 1.5 }}>Ao concluir, você entra no painel automaticamente. O plano gratuito de teste dura 7 dias.</p>
          </form>}
        </div>
      </main>

      <footer style={{ borderTop: '1px solid #ebe7e9', color: '#8b8589', fontSize: 12, padding: '20px', textAlign: 'center' }}>© {new Date().getFullYear()} Avalia e Ganha · acesso seguro multiempresa</footer>
    </div>
  );
}

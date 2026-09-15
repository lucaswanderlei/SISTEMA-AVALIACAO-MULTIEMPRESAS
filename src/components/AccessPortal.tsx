import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';

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
            <h1 style={{ fontSize: 'clamp(30px,5vw,42px)', letterSpacing: '-.045em', lineHeight: 1.02, margin: '14px 0 10px' }}>Entre no seu painel</h1>
            <p style={{ margin: 0, color: '#6f6870', lineHeight: 1.55 }}>Use o login e a senha cadastrados para sua empresa. O sistema identifica automaticamente o seu estabelecimento.</p>
          </div>

          <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #ece8eb', borderRadius: 24, padding: 26, boxShadow: '0 22px 55px rgba(42,26,37,.10)' }}>
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
          </form>
        </div>
      </main>

      <footer style={{ borderTop: '1px solid #ebe7e9', color: '#8b8589', fontSize: 12, padding: '20px', textAlign: 'center' }}>© {new Date().getFullYear()} Avalia e Ganha · acesso seguro multiempresa</footer>
    </div>
  );
}

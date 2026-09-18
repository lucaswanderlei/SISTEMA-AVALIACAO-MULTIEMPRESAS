import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, CheckCircle2, LockKeyhole, LogOut, QrCode, ShieldCheck, XCircle } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { apiValidateReward } from '../lib/api';
import { getCompanyId, tenantKey } from '../lib/tenant';
import type { Review } from '../types';

const voucherFromScan = (value: string) => {
  try {
    const url = new URL(value);
    return url.searchParams.get('voucher') || url.searchParams.get('codigo') || value;
  } catch { return value; }
};

export function VoucherValidationPortal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const [code, setCode] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [loginCpf, setLoginCpf] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authenticated, setAuthenticated] = useState(() => {
    try { return Boolean(sessionStorage.getItem(tenantKey('restaurant_manager_token'))); } catch { return false; }
  });

  const stopCamera = () => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => () => stopCamera(), []);

  const validate = async (value = code) => {
    const clean = voucherFromScan(value).trim().toUpperCase();
    if (!clean) { setMessage('Aponte a câmera para o QR Code ou informe o código do voucher.'); return; }
    setLoading(true); setMessage(''); setReview(null);
    const result = await apiValidateReward(clean);
    setLoading(false);
    if (!result.success || !result.review) { setMessage(result.error || 'Não foi possível validar este brinde.'); return; }
    setCode(result.review.rewardCode);
    setReview(result.review);
    stopCamera();
  };

  const openCamera = async () => {
    setMessage('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Este navegador não liberou acesso à câmera. Verifique a permissão e tente novamente.');
      return;
    }
    try {
      setCameraOpen(true);
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      if (!videoRef.current) throw new Error('CAMERA_NOT_READY');
      const reader = new BrowserQRCodeReader();
      scannerControlsRef.current = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (!result || loading) return;
          const scannedCode = voucherFromScan(result.getText());
          setCode(scannedCode);
          stopCamera();
          void validate(scannedCode);
        },
      );
    } catch {
      setMessage('Não foi possível abrir a câmera. Verifique a permissão do navegador e tente novamente.');
      stopCamera();
    }
  };

  const logout = () => {
    try {
      sessionStorage.removeItem(tenantKey('restaurant_manager_auth'));
      sessionStorage.removeItem(tenantKey('restaurant_manager_token'));
      sessionStorage.removeItem(tenantKey('restaurant_manager_role'));
      sessionStorage.removeItem(tenantKey('restaurant_manager_access'));
    } catch {}
    window.location.reload();
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    if (!loginCpf || !loginPassword) { setLoginError('Informe CPF ou CNPJ e senha.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/portal-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginCpf, password: loginPassword, companyId: getCompanyId() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token || data.accessLevel === 'viewer') { setLoginError(data.error || 'Este acesso não pode validar brindes.'); return; }
      const prefix = `${getCompanyId()}::`;
      sessionStorage.setItem(`${prefix}restaurant_manager_auth`, 'true');
      sessionStorage.setItem(`${prefix}restaurant_manager_token`, data.token);
      sessionStorage.setItem(`${prefix}restaurant_manager_role`, 'manager');
      sessionStorage.setItem(`${prefix}restaurant_manager_access`, data.accessLevel || 'redeemer');
      setAuthenticated(true);
    } catch { setLoginError('Não foi possível entrar agora. Tente novamente.'); }
    finally { setLoading(false); }
  };

  if (!authenticated) return <main className="min-h-screen bg-stone-100 text-stone-800 p-4 sm:p-8"><section className="max-w-md mx-auto"><header className="mb-8"><img src="/logo-avalia-e-ganha.png" alt="Avalia e Ganha" className="h-12 w-auto max-w-[190px] object-contain object-left" /></header><div className="bg-white rounded-3xl border border-stone-200 shadow-xl p-6 sm:p-7"><div className="text-center mb-6"><span className="inline-flex p-3 rounded-2xl bg-rose-50 text-rose-700"><ShieldCheck className="w-7 h-7" /></span><h1 className="mt-3 text-xl font-black text-stone-900">Validação de brindes</h1><p className="mt-1 text-sm text-stone-500">Acesso exclusivo da equipe desta empresa.</p></div><form onSubmit={login} className="space-y-3"><div><label className="text-xs font-bold text-stone-700">CPF ou CNPJ</label><input autoFocus inputMode="numeric" value={loginCpf} onChange={e => setLoginCpf(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="Digite seu CPF ou CNPJ" className="mt-1.5 w-full p-3 rounded-xl border border-stone-300 text-sm" /></div><div><label className="text-xs font-bold text-stone-700">Senha</label><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Sua senha" className="mt-1.5 w-full p-3 rounded-xl border border-stone-300 text-sm" /></div>{loginError && <p className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold">{loginError}</p>}<button disabled={loading} className="w-full py-3 rounded-xl bg-rose-700 text-white text-sm font-bold flex items-center justify-center gap-2"><LockKeyhole className="w-4 h-4" />{loading ? 'Entrando...' : 'Entrar para validar'}</button></form></div></section></main>;

  return <main className="min-h-screen bg-stone-100 text-stone-800 p-4 sm:p-8">
    <section className="max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <img src="/logo-avalia-e-ganha.png" alt="Avalia e Ganha" className="h-12 w-auto max-w-[190px] object-contain object-left" />
        <button onClick={logout} className="text-xs font-bold text-stone-600 flex items-center gap-1.5"><LogOut className="w-4 h-4" />Sair</button>
      </header>
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xl p-6 sm:p-7">
        <div className="text-center mb-6">
          <span className="inline-flex p-3 rounded-2xl bg-rose-50 text-rose-700"><ShieldCheck className="w-7 h-7" /></span>
          <h1 className="mt-3 text-xl font-black text-stone-900">Validar brinde</h1>
          <p className="mt-1 text-sm text-stone-500">Leia o QR Code do voucher ou informe o código.</p>
        </div>
        {cameraOpen && <div className="mb-4 rounded-2xl overflow-hidden bg-black relative"><video ref={videoRef} muted playsInline className="w-full aspect-square object-cover" /><button onClick={stopCamera} className="absolute right-3 top-3 p-2 rounded-xl bg-black/60 text-white"><XCircle className="w-5 h-5" /></button></div>}
        {!cameraOpen && <button onClick={() => void openCamera()} disabled={loading} className="w-full py-3 rounded-xl bg-stone-900 text-white text-sm font-bold flex items-center justify-center gap-2"><Camera className="w-5 h-5" />Ler QR Code pela câmera</button>}
        <div className="my-5 flex items-center gap-3 text-xs text-stone-400"><span className="h-px bg-stone-200 flex-1" />ou informe o código<span className="h-px bg-stone-200 flex-1" /></div>
        <label className="text-xs font-bold text-stone-700">Código do voucher</label>
        <div className="mt-1.5 flex gap-2"><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') void validate(); }} placeholder="BRINDE-..." className="min-w-0 flex-1 p-3 rounded-xl border border-stone-300 font-mono text-sm" /><button onClick={() => void validate()} disabled={loading} className="px-4 rounded-xl bg-rose-700 text-white text-xs font-bold">{loading ? 'Validando...' : 'Validar'}</button></div>
        {message && <p className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold">{message}</p>}
        {review && <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200"><div className="flex gap-2 text-emerald-800 font-extrabold"><CheckCircle2 className="w-5 h-5" />Brinde validado</div><p className="mt-2 text-sm text-stone-700"><strong>{review.rewardTitle}</strong> para {review.customerName || 'cliente'}.</p><p className="mt-1 text-xs text-stone-500">Código: {review.rewardCode}</p></div>}
        <p className="mt-6 text-center text-[11px] text-stone-400 flex justify-center gap-1"><QrCode className="w-3.5 h-3.5" />Cada validação fica registrada com o usuário que confirmou.</p>
      </div>
    </section>
  </main>;
}

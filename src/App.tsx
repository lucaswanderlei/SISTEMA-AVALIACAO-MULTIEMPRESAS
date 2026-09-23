import { BillingPage } from './components/BillingPage';
import type { PublicReviewInput } from './types';
import { tenantKey, getCompanyId } from './lib/tenant';
import React, { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed,
  Smartphone,
  QrCode,
  BarChart3,
  Sparkles,
  Gift,
  CheckCircle2,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  Wifi,
  BookOpen,
} from 'lucide-react';
import { RestaurantSettings, RewardOption, Review, Waiter } from './types';
import {
  loadReviews,
  saveReviews,
  loadRewards,
  saveRewards,
  loadSettings,
  saveSettings,
  loadWaiters,
  saveWaiters,
  isRewardsCustomized,
  isWaitersCustomized,
  loadWhatsAppConfig,
  saveWhatsAppConfig,
  loadDeletedReviewIds,
  markReviewDeleted,
  clearAllDeletedReviewIds,
  clearAllReviewsStorage,
} from './lib/storage';
import {
  apiFetchSync,
  apiFetchReviews,
  apiDeleteReview,
  apiSubmitReview,
  apiValidateReward,
  apiSaveWaiters,
  apiClearAllReviews,
  apiSyncPush,
  apiSaveWhatsAppSettings,
  apiManagerLogin,
  apiRequestPasswordReset,
  apiResetPassword,
  apiFetchCompanyStatus,
  CompanyAccessStatus,
} from './lib/api';
import { CustomerEvaluation } from './components/CustomerEvaluation';
import { TableQrDisplay } from './components/TableQrDisplay';
import { ManagerDashboard } from './components/ManagerDashboard';
import { SuperAdmin } from './components/SuperAdmin';
import { LegalPage } from './components/LegalPage';
import { AccessPortal } from './components/AccessPortal';
import { HelpCenter } from './components/HelpCenter';
import { VoucherValidationPortal } from './components/VoucherValidationPortal';

function playChimeSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function App() {
  if (typeof window !== 'undefined') {
    const cleanPath = window.location.pathname.replace(/\/$/, '');
    const params = new URLSearchParams(window.location.search);
    if (cleanPath === '/super-admin') return <SuperAdmin />;
    if (cleanPath === '/privacidade') return <LegalPage kind="privacy" />;
    if (cleanPath === '/termos') return <LegalPage kind="terms" />;
    if (cleanPath === '/assinatura') return <BillingPage />;
    if (cleanPath === '/acesso') return <AccessPortal />;
    if (cleanPath === '/validar-brinde') return <VoucherValidationPortal />;

    // app.avaliaeganha.com.br sem empresa/QR é o portal geral de acesso.
    // Avaliações continuam abrindo normalmente quando a URL contém empresa,
    // cliente=1, origem=qrcode ou mesa.
    const hasEvaluationContext = Boolean(
      params.get('empresa') ||
      params.get('cliente') ||
      params.get('origem') === 'qrcode' ||
      params.get('mesa') ||
      params.get('gerencia') === '1' ||
      params.get('reset_token')
    );
    if (cleanPath === '' && !hasEvaluationContext) return <AccessPortal />;
  }
  // Links de QR antigos podem ter sido gerados enquanto o painel estava em /gerencia.
  // Se houver marcadores de cliente/QR/mesa, o modo cliente SEMPRE tem prioridade.
  const initialUrlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialResetToken = initialUrlParams?.get('reset_token') || '';
  const initialIsCustomerUrl = !!(
    initialUrlParams?.get('cliente') ||
    initialUrlParams?.get('origem') === 'qrcode' ||
    initialUrlParams?.get('mesa')
  );
  const directManagerRoute = typeof window !== 'undefined' &&
    window.location.pathname.replace(/\/$/, '') === '/gerencia' &&
    !initialIsCustomerUrl;
  const [settings, setSettings] = useState<RestaurantSettings>(loadSettings);
  const [rewards, setRewards] = useState<RewardOption[]>(loadRewards);
  const [reviews, setReviews] = useState<Review[]>(loadReviews);
  const [waiters, setWaiters] = useState<Waiter[]>(loadWaiters);
  const settingsRef = useRef<RestaurantSettings>(settings);
  const rewardsRef = useRef<RewardOption[]>(rewards);
  const configWriteQueue = useRef<Promise<boolean>>(Promise.resolve(true));
  const [isServerSynced, setIsServerSynced] = useState<boolean>(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [companyAccessStatus, setCompanyAccessStatus] = useState<CompanyAccessStatus | null>(null);
  const [companyStatusChecked, setCompanyStatusChecked] = useState(false);

  // Keep a ref of known review IDs to detect brand new reviews arriving from QR codes
  const knownReviewIdsRef = useRef<Set<string>>(new Set(loadReviews().map((r) => r.id)));
  // Track permanently deleted review IDs to prevent resurrection from server/firestore race conditions
  const deletedReviewIdsRef = useRef<Set<string>>(loadDeletedReviewIds());

  // Determine if manager is authenticated via sessionStorage
  const [isManagerLoggedIn, setIsManagerLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // If customer is opening via QR link (?cliente=1 or ?origem=qrcode or has mesa)
      if (!directManagerRoute && (params.get('cliente') || params.get('origem') === 'qrcode' || params.get('mesa'))) {
        try {
          sessionStorage.removeItem(tenantKey('restaurant_manager_auth'));
          sessionStorage.removeItem(tenantKey('restaurant_manager_token'));
          sessionStorage.removeItem(tenantKey('restaurant_manager_role'));
          sessionStorage.removeItem(tenantKey('restaurant_manager_access'));
        } catch {}
        return false;
      }
      try {
        return sessionStorage.getItem(tenantKey('restaurant_manager_auth')) === 'true';
      } catch {}
    }
    return false;
  });
  const [managerRole, setManagerRole] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem(tenantKey('restaurant_manager_role')) || 'manager';
    } catch {
      return 'manager';
    }
  });
  const [managerAccessLevel, setManagerAccessLevel] = useState<'owner' | 'manager' | 'viewer' | 'redeemer' | 'superadmin'>(() => {
    if (typeof window === 'undefined') return 'owner';
    try {
      return (sessionStorage.getItem(tenantKey('restaurant_manager_access')) as 'owner' | 'manager' | 'viewer' | 'redeemer' | 'superadmin') || 'owner';
    } catch {
      return 'owner';
    }
  });

  const [currentTable, setCurrentTable] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mesaParam = params.get('mesa');
      if (mesaParam) {
        const parsed = parseInt(mesaParam, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    // Default to 0 so customers scanning the universal QR code are invited to select their table
    return 0;
  });

  const [activeView, setActiveView] = useState<'customer' | 'qr_display' | 'manager'>(() => {
    if (typeof window === 'undefined') return 'customer';
    const params = new URLSearchParams(window.location.search);
    const isClientUrl = !!(params.get('cliente') || params.get('origem') === 'qrcode' || params.get('mesa'));
    if (isClientUrl) return 'customer';
    return (directManagerRoute || params.get('gerencia') === '1') ? 'manager' : 'customer';
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [isFirebaseConnected] = useState<boolean>(false);

  // Login + password modal state
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [loginInput, setLoginInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showPinSecret, setShowPinSecret] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [pendingView, setPendingView] = useState<'manager' | 'qr_display'>('manager');
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [forgotFeedback, setForgotFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRequestingReset, setIsRequestingReset] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(Boolean(initialResetToken));
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<string>('');
  const [resetFeedback, setResetFeedback] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);

  // Check URL query parameters for ?mesa=X or ?cliente=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isClientUrl = params.get('cliente') || params.get('origem') === 'qrcode';
      // Cliente tem prioridade até mesmo em URLs antigas como /gerencia?cliente=1&empresa=...
      const isManagerUrl = !isClientUrl && (directManagerRoute || params.get('gerencia') === '1');
      const mesaParam = params.get('mesa');

      if (isManagerUrl && !isClientUrl) {
        setActiveView('manager');
        setPendingView('manager');
        const authenticated = sessionStorage.getItem(tenantKey('restaurant_manager_auth')) === 'true';
        setIsManagerLoggedIn(authenticated);
        if (!authenticated && !initialResetToken) setShowPinModal(true);
      }

      if (isClientUrl && !isManagerUrl) {
        // Enforce customer mode when scanning QR code
        setIsManagerLoggedIn(false);
        setActiveView('customer');
        try {
          sessionStorage.removeItem(tenantKey('restaurant_manager_auth'));
          sessionStorage.removeItem(tenantKey('restaurant_manager_token'));
          sessionStorage.removeItem(tenantKey('restaurant_manager_role'));
          sessionStorage.removeItem(tenantKey('restaurant_manager_access'));
        } catch {}
        setManagerRole('');
        setManagerAccessLevel('owner');
      }

      if (mesaParam) {
        const parsed = parseInt(mesaParam, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setCurrentTable(parsed);
          setActiveView('customer');
        }
      }
    }
  }, []);

  // Subscription/status check. The customer form is not shown until this
  // lightweight endpoint confirms that the company can currently receive
  // evaluations. It is refreshed periodically so a suspension takes effect on
  // already-open pages without requiring the customer to reload manually.
  useEffect(() => {
    let mounted = true;

    const checkCompanyAccess = async () => {
      const status = await apiFetchCompanyStatus();
      if (!mounted) return;
      setCompanyAccessStatus(status);
      setCompanyStatusChecked(true);
    };

    void checkCompanyAccess();
    const timer = window.setInterval(() => {
      void checkCompanyAccess();
    }, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  // 1. Initial Load: PostgreSQL is the ONLY authority.
  // LocalStorage is only a temporary browser cache and is NEVER pushed during boot.
  useEffect(() => {
    let isMounted = true;

    apiFetchSync()
      .then((syncData) => {
        if (!isMounted || !syncData) return;

        if (syncData.settings) {
          const serverSettings = syncData.settings as RestaurantSettings;
          settingsRef.current = serverSettings;
          setSettings(serverSettings);
          saveSettings(serverSettings);
          saveWhatsAppConfig({
            whatsappApiUrl: serverSettings.whatsappApiUrl,
            whatsappApiToken: serverSettings.whatsappApiToken,
            whatsappCustomMessage: serverSettings.whatsappCustomMessage,
          });
        }

        if (Array.isArray(syncData.rewards)) {
          rewardsRef.current = syncData.rewards;
          setRewards(syncData.rewards);
          saveRewards(syncData.rewards);
        }

        if (Array.isArray(syncData.waiters)) {
          setWaiters(syncData.waiters);
          saveWaiters(syncData.waiters);
        }

        if (Array.isArray(syncData.reviews)) {
          const serverReviews = syncData.reviews
            .filter((r) => !deletedReviewIdsRef.current.has(r.id))
            .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());

          setReviews(serverReviews);
          saveReviews(serverReviews);
          serverReviews.forEach((r) => knownReviewIdsRef.current.add(r.id));
        }

        setIsServerSynced(true);
      })
      .catch((err) => {
        console.warn('Initial PostgreSQL sync error:', err);
        setIsServerSynced(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time background sync polling (every 3.5s)
  // Ensures manager dashboard and customer QR code reviews are 100% synchronized across all devices
  useEffect(() => {
    // Avaliações e CRM são dados privados: só a gerência autenticada faz polling.
    if (!isManagerLoggedIn) return;

    const interval = setInterval(async () => {
      try {
        const serverReviews = await apiFetchReviews();
        if (serverReviews && Array.isArray(serverReviews)) {
          setIsServerSynced(true);

          // Purge leaked deleted review IDs from server if any exist
          const cleanServerReviews = serverReviews.filter((r) => !deletedReviewIdsRef.current.has(r.id));
          const leakedDeletedReviews = serverReviews.filter((r) => deletedReviewIdsRef.current.has(r.id));
          if (leakedDeletedReviews.length > 0) {
            leakedDeletedReviews.forEach((r) => {
              apiDeleteReview(r.id).catch(() => {});
            });
          }

          // Check if any brand new review has arrived from server
          const newReviews = cleanServerReviews.filter((r) => !knownReviewIdsRef.current.has(r.id));
          if (newReviews.length > 0) {
            newReviews.forEach((r) => knownReviewIdsRef.current.add(r.id));
            const latest = newReviews[0];
            const tableStr = latest.tableNumber ? `Mesa #${latest.tableNumber}` : 'Salão';
            const customerStr = latest.customerName || 'Cliente';
            showToast(`🔔 Nova avaliação recebida em tempo real da ${tableStr}! (${latest.ratings?.service || 5}★ de ${customerStr})`);
            playChimeSound();
          }

          // Merge reviews safely without resurrecting deleted reviews
          setReviews((prev) => {
            const filteredPrev = prev.filter((r) => !deletedReviewIdsRef.current.has(r.id));
            if (cleanServerReviews.length === 0 && filteredPrev.length === 0) {
              return [];
            }
            if (cleanServerReviews.length === 0 && filteredPrev.length > 0) {
              // Server is empty but client has active reviews; re-sync client reviews to server
              apiSyncPush({ reviews: filteredPrev }).catch(() => {});
              return filteredPrev;
            }
            const map = new Map<string, Review>();
            filteredPrev.forEach((r) => map.set(r.id, r));
            cleanServerReviews.forEach((r) => map.set(r.id, r));
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (JSON.stringify(prev) !== JSON.stringify(merged)) {
              saveReviews(merged);
              return merged;
            }
            return prev;
          });
        }
      } catch {
        setIsServerSynced(false);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isManagerLoggedIn]);

  // Request manager access: company credentials or SuperAdmin master credentials.
  const handleRequestManagerAccess = (targetView: 'manager' | 'qr_display' = 'manager') => {
    if (isManagerLoggedIn) {
      setActiveView(targetView);
    } else {
      setPendingView(targetView);
      setLoginInput(settings.managerLogin || '');
      setPinInput('');
      setPinError('');
      setShowForgotPassword(false);
      setForgotFeedback(null);
      setShowPinModal(true);
    }
  };

  const handleRequestPasswordReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const login = loginInput.trim();
    if (!login) {
      setForgotFeedback({ type: 'error', message: 'Informe seu login para recuperar a senha.' });
      return;
    }
    setIsRequestingReset(true);
    setForgotFeedback(null);
    const result = await apiRequestPasswordReset(login);
    setIsRequestingReset(false);
    setForgotFeedback(result.success
      ? { type: 'success', message: result.message || 'Verifique seu e-mail.' }
      : { type: 'error', message: result.error || 'Não foi possível solicitar a recuperação.' });
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResetFeedback('');
    if (resetPassword.length < 6) {
      setResetFeedback('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setResetFeedback('A confirmação da senha não confere.');
      return;
    }
    setIsResettingPassword(true);
    const result = await apiResetPassword(initialResetToken, resetPassword);
    setIsResettingPassword(false);
    if (!result.success) {
      setResetFeedback(result.error || 'Não foi possível redefinir a senha.');
      return;
    }
    setResetFeedback(result.message || 'Senha redefinida com sucesso.');
    setResetPassword('');
    setResetPasswordConfirm('');
    window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete('reset_token');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      setShowResetModal(false);
      setShowPinModal(true);
      setShowForgotPassword(false);
      setPinError('Senha redefinida. Entre com a nova senha.');
    }, 900);
  };

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginInput.trim() || !pinInput.trim()) {
      setPinError('Informe o login e a senha.');
      return;
    }
    setIsAuthenticating(true);
    setPinError('');
    try {
      const result = await apiManagerLogin(loginInput.trim(), pinInput);
      if (!result.success) {
        setPinError(result.error || 'Login ou senha inválidos.');
        return;
      }
      if (result.accessLevel === 'redeemer') {
        window.location.assign(`/validar-brinde?empresa=${encodeURIComponent(getCompanyId())}`);
        return;
      }
      try {
        sessionStorage.setItem(tenantKey('restaurant_manager_auth'), 'true');
        sessionStorage.setItem(tenantKey('restaurant_manager_role'), result.role || 'manager');
        sessionStorage.setItem(tenantKey('restaurant_manager_access'), result.role === 'superadmin' ? 'superadmin' : (result.accessLevel || 'owner'));
      } catch {}
      setManagerRole(result.role || 'manager');
      setManagerAccessLevel(result.role === 'superadmin' ? 'superadmin' : (result.accessLevel || 'owner'));
      setIsManagerLoggedIn(true);
      setActiveView(pendingView);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      showToast(result.role === 'superadmin' ? 'Acesso mestre autorizado.' : 'Acesso autorizado ao painel do restaurante.');

      // Carrega os dados privados somente depois que a sessão foi autenticada.
      try {
        const privateReviews = await apiFetchReviews();
        if (privateReviews) {
          const ordered = privateReviews
            .filter((r) => !deletedReviewIdsRef.current.has(r.id))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReviews(ordered);
          saveReviews(ordered);
          ordered.forEach((r) => knownReviewIdsRef.current.add(r.id));
        }
      } catch {}

      // A empresa suspensa/vencida bloqueia APIs para a gerência comum, mas o
      // SuperAdmin pode entrar. Recarregar aqui faz o boot repetir a sincronização
      // já com o token mestre anexado às requisições.
      if (result.role === 'superadmin' && companyAccessStatus?.accessible === false) {
        window.location.reload();
        return;
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogoutManager = () => {
    try {
      sessionStorage.removeItem(tenantKey('restaurant_manager_auth'));
      sessionStorage.removeItem(tenantKey('restaurant_manager_token'));
      sessionStorage.removeItem(tenantKey('restaurant_manager_role'));
      sessionStorage.removeItem(tenantKey('restaurant_manager_access'));
    } catch {}
    setIsManagerLoggedIn(false);
    setManagerRole('');
    setManagerAccessLevel('owner');
    setActiveView('customer');
    showToast('Painel do restaurante bloqueado com sucesso.');
  };

  // Sync to local storage & central PostgreSQL server
  const handleReviewsChange = (newReviews: Review[]) => {
    setReviews(newReviews);
    saveReviews(newReviews);
  };

  const persistConfig = (operation: () => Promise<boolean>) => {
    const next = configWriteQueue.current.catch(() => false).then(operation).catch(() => false);
    configWriteQueue.current = next;
    void next.then(ok => { if (!ok) showToast('⚠️ O servidor não confirmou a alteração. Use Salvar novamente.'); });
    return next;
  };

  // Settings and rewards share the same PostgreSQL document. Sending an
  // atomic snapshot prevents a fast sequence of edits from one area undoing
  // the most recent change from another area.
  const persistCurrentConfiguration = () =>
    apiSyncPush({ settings: settingsRef.current, rewards: rewardsRef.current }).then((response) => response.success);

  const handleRewardsChange = (newRewards: RewardOption[]) => {
    rewardsRef.current = newRewards;
    setRewards(newRewards);
    saveRewards(newRewards);
    return persistConfig(persistCurrentConfiguration);
  };
  const handleSettingsChange = (newSettings: RestaurantSettings) => {
    settingsRef.current = newSettings;
    setSettings(newSettings);
    saveSettings(newSettings);
    saveWhatsAppConfig({ whatsappApiUrl: newSettings.whatsappApiUrl, whatsappApiToken: newSettings.whatsappApiToken,
      whatsappCustomMessage: newSettings.whatsappCustomMessage });
    return persistConfig(persistCurrentConfiguration);
  };
  const handleWaitersChange = async (newWaiters: Waiter[]) => {
    // A senha de acesso (quando informada) só deve trafegar até o servidor —
    // nunca fica guardada no estado local nem no localStorage do navegador.
    const sanitized = newWaiters.map(({ senhaAcesso, ...rest }) => rest);
    setWaiters(sanitized);
    saveWaiters(sanitized);
    const response = await apiSaveWaiters(newWaiters);
    if (!response.success) showToast('⚠️ O servidor não confirmou o cadastro do funcionário. Tente novamente.');
    return response;
  };
  const handleForceSaveDatabase = async (explicitSettings?: RestaurantSettings): Promise<boolean> => {
    const confirmed = await persistConfig(async () => {
      const response = await apiSyncPush({ settings: explicitSettings || settings, rewards, waiters });
      return response.success;
    });
    showToast(confirmed ? '💾 Configurações confirmadas no PostgreSQL.' : '⚠️ O servidor não confirmou o salvamento. Tente novamente.');
    return confirmed;
  };

  // Add review from customer (submitted via table QR code or client device)
  const handleSubmitReview = async (input: PublicReviewInput): Promise<{ review: Review; reward: RewardOption }> => {
    const result = await apiSubmitReview(input);
    if (!result.success || !result.review || !result.reward) {
      throw new Error(result.error || 'Não foi possível confirmar a avaliação. Tente novamente.');
    }
    const saved = result.review;
    deletedReviewIdsRef.current.delete(saved.id);
    knownReviewIdsRef.current.add(saved.id);
    setReviews(previous => {
      const updated = [saved, ...previous.filter(r => r.id !== saved.id)];
      saveReviews(updated);
      return updated;
    });
    showToast('Avaliação confirmada e salva com sucesso!');
    return { review: saved, reward: result.reward };
  };

  // Validate voucher code (waiter/manager action) - STRICT SINGLE USE ONLY
  const handleValidateReward = async (code: string): Promise<boolean> => {
    const normalized = code.trim().toUpperCase();
    const cached = reviews.find(r => r.rewardCode.toUpperCase() === normalized || r.rewardCode.replace('BRINDE-', '').toUpperCase() === normalized);
    const result = await apiValidateReward(cached?.rewardCode || normalized, currentTable > 0 ? currentTable : undefined);
    if (!result.success || !result.review) {
      showToast(result.error || 'O servidor não confirmou o resgate. Tente novamente.');
      return false;
    }
    const saved = result.review;
    setReviews(previous => {
      const updated = [saved, ...previous.filter(r => r.id !== saved.id)];
      saveReviews(updated);
      return updated;
    });
    showToast(`✅ Brinde "${saved.rewardTitle}" resgatado com confirmação do servidor.`);
    return true;
  };

  const handleDeleteReview = async (idOrIds: string | string[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const removed = new Set<string>();
    for (const id of ids) {
      if ((await apiDeleteReview(id)).success) {
        removed.add(id);
        deletedReviewIdsRef.current.add(id);
        markReviewDeleted(id);
        knownReviewIdsRef.current.delete(id);
      }
    }
    setReviews(previous => {
      const updated = previous.filter(r => !removed.has(r.id)); saveReviews(updated); return updated;
    });
    showToast(removed.size === ids.length ? 'Exclusão confirmada pelo servidor.' : 'Alguns registros não foram excluídos. Tente novamente.');
  };

  const handleClearAllReviews = async () => {
    if (!(await apiClearAllReviews())) { showToast('O servidor não confirmou a exclusão. Tente novamente.'); return; }
    handleReviewsChange([]);
    knownReviewIdsRef.current.clear();
    clearAllDeletedReviewIds();
    deletedReviewIdsRef.current.clear();
    clearAllReviewsStorage();
    showToast('Exclusão dos registros confirmada pelo servidor.');
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const companyBlocked = companyAccessStatus?.accessible === false;
  const managerCanBypassSubscription = isManagerLoggedIn && managerRole === 'superadmin';
  const blockedTitle = companyAccessStatus?.code === 'SUBSCRIPTION_EXPIRED'
    ? 'Assinatura vencida'
    : companyAccessStatus?.code === 'COMPANY_NOT_FOUND'
      ? 'Empresa indisponível'
      : 'Avaliações temporariamente suspensas';
  const blockedMessage = companyAccessStatus?.message || 'Esta página está temporariamente indisponível. Entre em contato com o estabelecimento.';
  const blockedExpiry = companyAccessStatus?.company?.expiresAt
    ? String(companyAccessStatus.company.expiresAt).slice(0, 10).split('-').reverse().join('/')
    : null;

  const subscriptionBlockedPanel = (
    <div className="max-w-lg mx-auto my-12 p-7 sm:p-9 bg-white rounded-3xl border border-stone-200 shadow-xl text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div>
        <h2 className="text-xl font-black text-stone-900">{blockedTitle}</h2>
        <p className="text-sm text-stone-500 mt-2 leading-relaxed">{blockedMessage}</p>
        {blockedExpiry && companyAccessStatus?.code === 'SUBSCRIPTION_EXPIRED' && (
          <p className="text-xs font-bold text-rose-600 mt-2">Vencimento: {blockedExpiry}</p>
        )}
      </div>
      <a className="inline-block bg-rose-700 text-white px-5 py-3 rounded-xl font-bold" href={`/assinatura?empresa=${encodeURIComponent(getCompanyId())}`}>Gerenciar assinatura</a>
      <p className="text-[11px] text-stone-400">Se você é responsável pelo estabelecimento, use o acesso da Gerência ou entre em contato com o suporte da plataforma.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-800">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white text-xs font-semibold py-3 px-5 rounded-2xl shadow-2xl flex items-center gap-2 border border-stone-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-md overflow-hidden" style={{ backgroundColor: settings.primaryColor || '#e11d48' }}>
              {settings.logoUrl ? <img src={settings.logoUrl} alt={`Logo ${settings.name}`} className="w-full h-full object-cover" /> : <UtensilsCrossed className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight leading-tight flex items-center gap-2">
                <span>{settings.name}</span>
                <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  QR Avaliações & Brindes
                </span>
              </div>
              <div className="text-[11px] text-stone-400 hidden sm:block leading-tight">
                {settings.tagline}
              </div>
            </div>
          </div>

          {/* Right Header Controls: Authenticated Manager Navigation OR Protected Customer Header */}
          {isManagerLoggedIn ? (
            <div className="flex items-center gap-2">
              {isFirebaseConnected && (
                <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Firebase Firestore</span>
                </div>
              )}

              <nav className="flex items-center bg-stone-100 p-1 rounded-2xl border border-stone-200/80">
                <button
                  id="nav-btn-customer"
                  type="button"
                  onClick={() => setActiveView('customer')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeView === 'customer'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Visão do Cliente</span>
                </button>

                <button
                  id="nav-btn-manager"
                  type="button"
                  onClick={() => setActiveView('manager')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeView === 'manager'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Painel do Restaurante</span>
                  <span className="sm:hidden">Gestão</span>
                </button>
              </nav>

              <button type="button" onClick={() => setHelpOpen(true)} className="p-2.5 bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-stone-200" title="Abrir manual de instruções">
                <BookOpen className="w-4 h-4" />
                <span className="hidden lg:inline">Ajuda</span>
              </button>

              <button
                type="button"
                id="btn-logout-manager"
                onClick={handleLogoutManager}
                title="Bloquear Painel / Sair da Gerência"
                className="p-2.5 bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-600 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-stone-200"
              >
                <LogOut className="w-4 h-4 text-stone-500" />
                <span className="hidden md:inline">Bloquear</span>
              </button>
            </div>
          ) : (
            /* Protected Customer Header: Clean, distraction-free with discrete lock button */
            <div className="flex items-center gap-2.5">
              {currentTable > 0 && (
                <span className="bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  Mesa #{currentTable < 10 ? `0${currentTable}` : currentTable}
                </span>
              )}

              <button
                type="button"
                id="btn-request-manager"
                onClick={() => handleRequestManagerAccess('manager')}
                title="Acesso da Gerência (Requer PIN)"
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-stone-200/80 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden sm:inline">Gerência</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} companyName={settings.name} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {activeView === 'customer' && !companyStatusChecked && (
          <div className="max-w-md mx-auto my-16 p-6 bg-white rounded-3xl border border-stone-200 shadow-sm text-center">
            <div className="w-8 h-8 border-4 border-stone-200 border-t-rose-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-stone-500 mt-3">Carregando avaliação...</p>
          </div>
        )}

        {activeView === 'customer' && companyStatusChecked && companyBlocked && !managerCanBypassSubscription && subscriptionBlockedPanel}

        {activeView === 'customer' && companyStatusChecked && (!companyBlocked || managerCanBypassSubscription) && (
          <CustomerEvaluation
            tableNumber={currentTable}
            onTableChange={(newTbl) => setCurrentTable(newTbl)}
            settings={settings}
            rewards={rewards}
            waiters={waiters}
            onSubmitReview={handleSubmitReview}
          />
        )}

        {/* Protected Views: Only accessible if authenticated */}
        {activeView === 'qr_display' && isManagerLoggedIn && companyBlocked && !managerCanBypassSubscription && subscriptionBlockedPanel}

        {activeView === 'qr_display' && isManagerLoggedIn && (!companyBlocked || managerCanBypassSubscription) && (
          <TableQrDisplay
            currentTable={currentTable}
            totalTables={settings.totalTables}
            settings={settings}
            onSelectTable={(tbl) => setCurrentTable(tbl)}
            onOpenCustomerView={(tbl) => {
              setCurrentTable(tbl);
              setActiveView('customer');
            }}
          />
        )}

        {activeView === 'manager' && isManagerLoggedIn && companyBlocked && !managerCanBypassSubscription && subscriptionBlockedPanel}

        {activeView === 'manager' && isManagerLoggedIn && (!companyBlocked || managerCanBypassSubscription) && (
          <ManagerDashboard
            companyPlan={companyAccessStatus?.accessible ? companyAccessStatus.company?.plan : undefined}
            onConsumptionItemsChange={items => {
              const next = { ...settingsRef.current, consumptionItems: items };
              void handleSettingsChange(next);
            }}
            reviews={reviews}
            rewards={rewards}
            settings={settings}
            waiters={waiters}
            onValidateReward={handleValidateReward}
            onUpdateRewards={handleRewardsChange}
            onUpdateSettings={handleSettingsChange}
            onUpdateWaiters={handleWaitersChange}
            onDeleteReview={managerAccessLevel === 'viewer' ? undefined : handleDeleteReview}
            onClearAllReviews={managerAccessLevel === 'viewer' ? undefined : handleClearAllReviews}
            onUpdateReviewsList={managerAccessLevel === 'viewer' ? undefined : ((updated) => setReviews(updated))}
            onSaveDatabase={managerAccessLevel === 'viewer' ? undefined : handleForceSaveDatabase}
            onOpenQrDisplay={() => setActiveView('qr_display')}
            accessLevel={managerAccessLevel}
          />
        )}

        {/* Security Barrier: If a customer or unauthenticated user reaches manager or qr_display */}
        {(activeView === 'manager' || activeView === 'qr_display') && !isManagerLoggedIn && (
          <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white rounded-3xl border border-stone-200 shadow-xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-stone-900">
                Acesso Restrito ao Painel
              </h2>
              <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                Esta área é exclusiva da equipe e gerência do {settings.name}. Clientes não possuem acesso aos dados, relatórios ou configurações do restaurante.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleRequestManagerAccess(activeView)}
                className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                Digitar PIN da Gerência
              </button>
              <button
                type="button"
                onClick={() => setActiveView('customer')}
                className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Voltar para Avaliação na Mesa
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-5 text-center text-xs text-stone-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>{settings.name}</strong> • Sistema de Avaliação nas Mesas com QR Code
          </div>
          <div className="flex items-center gap-3 text-stone-400 text-[11px]">
            <span className="hidden sm:inline">Atendimento • Ambiente • Produtos</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-rose-600 font-semibold flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" /> Ganhe um Brinde
            </span>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleRequestManagerAccess('manager')}
              className="text-stone-400 hover:text-stone-700 font-medium flex items-center gap-1 transition cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              {isManagerLoggedIn ? 'Painel Conectado' : 'Acesso Gerência'}
            </button>
          </div>
        </div>
      </footer>

      {showResetModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200">
            <div className="text-center space-y-2 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-100"><KeyRound className="w-7 h-7" /></div>
              <h3 className="text-lg font-black text-stone-900">Criar nova senha</h3>
              <p className="text-xs text-stone-500">Defina uma nova senha para este acesso. O link pode ser usado apenas uma vez.</p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input type="password" autoFocus minLength={6} value={resetPassword} onChange={e=>{setResetPassword(e.target.value); setResetFeedback('');}} placeholder="Nova senha (mínimo 6 caracteres)" className="w-full py-3 px-4 text-sm font-bold bg-stone-50 border-2 border-stone-300 rounded-2xl outline-none focus:border-sky-600" />
              <input type="password" minLength={6} value={resetPasswordConfirm} onChange={e=>{setResetPasswordConfirm(e.target.value); setResetFeedback('');}} placeholder="Confirmar nova senha" className="w-full py-3 px-4 text-sm font-bold bg-stone-50 border-2 border-stone-300 rounded-2xl outline-none focus:border-sky-600" />
              {resetFeedback && <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs font-bold text-stone-700">{resetFeedback}</div>}
              <button type="submit" disabled={isResettingPassword} className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-black rounded-xl">{isResettingPassword ? 'Salvando...' : 'Redefinir senha'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PIN AUTHENTICATION MODAL (PROTEÇÃO CONTRA ACESSO INDEVIDO DE CLIENTES)   */}
      {/* ========================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-stone-200 relative animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowPinModal(false);
                setPinInput('');
                setPinError('');
              }}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Icon & Header */}
            <div className="text-center space-y-2 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-stone-900">Acesso Restrito à Gerência</h3>
              <p className="text-xs text-stone-500 leading-relaxed px-2">
                Entre com o login e a senha desta empresa. O SuperAdmin também pode usar o login e a senha mestre para acessar qualquer empresa.
              </p>
            </div>

            {!showForgotPassword ? (
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700">CPF (ou CNPJ do proprietário)</label>
                  <input
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={loginInput}
                    inputMode="numeric"
                    onChange={(e) => {
                      // Mantém letras e números (cobre tanto CPF/CNPJ quanto
                      // qualquer login mestre customizado do SuperAdmin) - só
                      // remove pontuação de formatação (pontos, traço, espaço).
                      setLoginInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32));
                      if (pinError) setPinError('');
                    }}
                    placeholder="CPF ou CNPJ do proprietário"
                    className="w-full py-3 px-4 text-sm font-bold bg-stone-50 border-2 border-stone-300 rounded-2xl outline-none focus:border-rose-600 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700">Senha</label>
                  <div className="relative">
                    <input
                      type={showPinSecret ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={pinInput}
                      onChange={(e) => { setPinInput(e.target.value); if (pinError) setPinError(''); }}
                      placeholder="Sua senha"
                      className={`w-full py-3 px-4 pr-12 text-sm font-bold bg-stone-50 border-2 rounded-2xl outline-none transition ${pinError ? 'border-rose-500 bg-rose-50/50 text-rose-900' : 'border-stone-300 focus:border-rose-600 focus:bg-white'}`}
                    />
                    <button type="button" onClick={() => setShowPinSecret(!showPinSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-600">
                      {showPinSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pinError && <p className="text-xs text-rose-600 font-bold text-center flex items-center justify-center gap-1 pt-1"><ShieldAlert className="w-3.5 h-3.5"/><span>{pinError}</span></p>}
                </div>
                <div className="space-y-2 pt-2">
                  <button type="submit" disabled={isAuthenticating} className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-black rounded-xl transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isAuthenticating ? 'Verificando...' : 'Entrar no Painel'}</span>
                  </button>
                  <button type="button" onClick={() => { setShowForgotPassword(true); setForgotFeedback(null); setPinError(''); }} className="w-full py-2 text-rose-600 hover:text-rose-700 text-xs font-bold transition">Esqueci minha senha</button>
                  <button type="button" onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }} className="w-full py-2 text-stone-500 hover:text-stone-800 text-xs font-bold transition">Voltar para Avaliação do Cliente</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-800 leading-relaxed">
                  Informe seu login. Se houver um e-mail de recuperação cadastrado, enviaremos um link válido por 30 minutos.
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700">Login</label>
                  <input type="text" autoFocus value={loginInput} onChange={(e)=>{setLoginInput(e.target.value); setForgotFeedback(null);}} placeholder="Seu login" className="w-full py-3 px-4 text-sm font-bold bg-stone-50 border-2 border-stone-300 rounded-2xl outline-none focus:border-sky-600 focus:bg-white" />
                </div>
                {forgotFeedback && <div className={`p-3 rounded-xl text-xs font-bold ${forgotFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{forgotFeedback.message}</div>}
                <button type="submit" disabled={isRequestingReset} className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-black rounded-xl transition">{isRequestingReset ? 'Enviando...' : 'Enviar link de recuperação'}</button>
                <button type="button" onClick={()=>{setShowForgotPassword(false); setForgotFeedback(null);}} className="w-full py-2 text-stone-500 text-xs font-bold">Voltar ao login</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

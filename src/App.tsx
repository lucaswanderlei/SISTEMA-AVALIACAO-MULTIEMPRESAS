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
  loadSavedPin,
  savePin,
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
  apiSaveSettings,
  apiSaveRewards,
  apiSaveWaiters,
  apiClearAllReviews,
  apiSyncPush,
  apiUpdatePin,
  apiSaveWhatsAppSettings,
} from './lib/api';
import {
  testFirestoreConnection,
  firestoreSaveRewards,
  firestoreSaveWaiters,
  firestoreSaveSettings,
  firestoreFetchSettings,
  firestoreDeleteReview,
} from './lib/firebase';
import { CustomerEvaluation } from './components/CustomerEvaluation';
import { TableQrDisplay } from './components/TableQrDisplay';
import { ManagerDashboard } from './components/ManagerDashboard';
import { SuperAdmin } from './components/SuperAdmin';

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
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/super-admin') {
    return <SuperAdmin />;
  }
  const directManagerRoute = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/gerencia';
  const [settings, setSettings] = useState<RestaurantSettings>(loadSettings);
  const [rewards, setRewards] = useState<RewardOption[]>(loadRewards);
  const [reviews, setReviews] = useState<Review[]>(loadReviews);
  const [waiters, setWaiters] = useState<Waiter[]>(loadWaiters);
  const [isServerSynced, setIsServerSynced] = useState<boolean>(true);

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
        } catch {}
        return false;
      }
      try {
        return sessionStorage.getItem(tenantKey('restaurant_manager_auth')) === 'true';
      } catch {}
    }
    return false;
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
    return (directManagerRoute || params.get('gerencia') === '1') ? 'manager' : 'customer';
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // PIN security modal state
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showPinSecret, setShowPinSecret] = useState<boolean>(false);
  const [pendingView, setPendingView] = useState<'manager' | 'qr_display'>('manager');

  // Check URL query parameters for ?mesa=X or ?cliente=1
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isClientUrl = params.get('cliente') || params.get('origem') === 'qrcode';
      const isManagerUrl = directManagerRoute || params.get('gerencia') === '1';
      const mesaParam = params.get('mesa');

      if (isManagerUrl && !isClientUrl) {
        setActiveView('manager');
        setPendingView('manager');
        const authenticated = sessionStorage.getItem(tenantKey('restaurant_manager_auth')) === 'true';
        setIsManagerLoggedIn(authenticated);
        if (!authenticated) setShowPinModal(true);
      }

      if (isClientUrl && !isManagerUrl) {
        // Enforce customer mode when scanning QR code
        setIsManagerLoggedIn(false);
        setActiveView('customer');
        try {
          sessionStorage.removeItem(tenantKey('restaurant_manager_auth'));
        } catch {}
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

  // 1. Initial Load: Synchronize from Central Server (ensuring local customizations are preserved and synced)
  useEffect(() => {
    let isMounted = true;
    apiFetchSync()
      .then((syncData) => {
        if (!isMounted || !syncData) return;

        // Settings sync: ensure custom PIN and WhatsApp API settings are protected and synced
        if (syncData.settings) {
          const localSettings = loadSettings();
          const localSavedPin = loadSavedPin();
          const localWhatsApp = loadWhatsAppConfig();

          let effectivePin = syncData.settings.managerPin || '1234';
          if (localSavedPin && localSavedPin !== '1234' && (!syncData.settings.managerPin || syncData.settings.managerPin === '1234')) {
            effectivePin = localSavedPin;
            apiUpdatePin(effectivePin).catch(() => {});
          } else if (localSettings.managerPin && localSettings.managerPin !== '1234' && (!syncData.settings.managerPin || syncData.settings.managerPin === '1234')) {
            effectivePin = localSettings.managerPin;
            apiUpdatePin(effectivePin).catch(() => {});
          }

          // WhatsApp API persistence merge - credentials are always tenant-specific.
          const effectiveWhatsAppUrl = syncData.settings.whatsappApiUrl || localWhatsApp?.whatsappApiUrl || localSettings.whatsappApiUrl || '';
          const effectiveWhatsAppToken = syncData.settings.whatsappApiToken || localWhatsApp?.whatsappApiToken || localSettings.whatsappApiToken || '';
          const effectiveWhatsAppMessage = syncData.settings.whatsappCustomMessage || localWhatsApp?.whatsappCustomMessage || localSettings.whatsappCustomMessage || '';

          // If local or server had incomplete WhatsApp credentials, sync the official Meta Cloud API to the server
          if ((effectiveWhatsAppUrl || effectiveWhatsAppToken) && (!syncData.settings.whatsappApiUrl || !syncData.settings.whatsappApiToken)) {
            apiSaveWhatsAppSettings({
              whatsappApiUrl: effectiveWhatsAppUrl,
              whatsappApiToken: effectiveWhatsAppToken,
              whatsappCustomMessage: effectiveWhatsAppMessage,
              autoSendWhatsApp: syncData.settings.autoSendWhatsApp ?? localSettings.autoSendWhatsApp ?? true,
              autoSendMode: syncData.settings.autoSendMode ?? localSettings.autoSendMode ?? 'silent_api',
            }).catch(() => {});
          }

          const mergedSettings: RestaurantSettings = {
            ...syncData.settings,
            managerPin: effectivePin,
            whatsappApiUrl: effectiveWhatsAppUrl,
            whatsappApiToken: effectiveWhatsAppToken,
            whatsappCustomMessage: effectiveWhatsAppMessage,
          };
          setSettings(mergedSettings);
          saveSettings(mergedSettings);
          savePin(effectivePin);
          saveWhatsAppConfig({
            whatsappApiUrl: effectiveWhatsAppUrl,
            whatsappApiToken: effectiveWhatsAppToken,
            whatsappCustomMessage: effectiveWhatsAppMessage,
          });
        }

        // Rewards sync
        const localRewards = loadRewards();
        const customRewards = isRewardsCustomized();
        const defaultRewardTitles = [
          'PORÇÃO DE BATATA FRITA',
          'CHURROS MIX TRADICIONAL',
          '10 % DE DESCONTO',
          '5% DE DESCONTO',
        ];
        const isServerOnlyDefaults =
          Array.isArray(syncData.rewards) &&
          syncData.rewards.length === 4 &&
          syncData.rewards.every((r, i) => r.title === defaultRewardTitles[i]);

        if (customRewards && isServerOnlyDefaults && JSON.stringify(localRewards) !== JSON.stringify(syncData.rewards)) {
          // Keep local custom rewards and push them to the server so the server database is saved!
          setRewards(localRewards);
          apiSaveRewards(localRewards).catch(() => {});
        } else if (Array.isArray(syncData.rewards) && syncData.rewards.length > 0) {
          setRewards(syncData.rewards);
          saveRewards(syncData.rewards);
        } else {
          apiSaveRewards(localRewards).catch(() => {});
        }

        // Waiters sync
        const localWaiters = loadWaiters();
        const customWaiters = isWaitersCustomized();
        const defaultWaiterNames = ['Carlos Oliveira', 'Mariana Santos', 'Lucas Pereira', 'Juliana Costa'];
        const isServerOnlyDefaultWaiters =
          Array.isArray(syncData.waiters) &&
          syncData.waiters.length <= 5 &&
          syncData.waiters.every((w) => defaultWaiterNames.includes(w.name) || w.name === 'Marcos Souza');

        if (customWaiters && isServerOnlyDefaultWaiters && JSON.stringify(localWaiters) !== JSON.stringify(syncData.waiters)) {
          // Keep local custom waiters and push them to the server so the server database is saved!
          setWaiters(localWaiters);
          apiSaveWaiters(localWaiters).catch(() => {});
        } else if (Array.isArray(syncData.waiters) && syncData.waiters.length > 0) {
          setWaiters(syncData.waiters);
          saveWaiters(syncData.waiters);
        } else {
          apiSaveWaiters(localWaiters).catch(() => {});
        }

        // Reviews sync: merge local reviews and server reviews so no reviews are ever lost
        const localReviews = loadReviews();
        const reviewMap = new Map<string, Review>();
        localReviews.forEach((r) => {
          if (!deletedReviewIdsRef.current.has(r.id)) {
            reviewMap.set(r.id, r);
          }
        });
        if (Array.isArray(syncData.reviews)) {
          syncData.reviews.forEach((r) => {
            if (!deletedReviewIdsRef.current.has(r.id)) {
              reviewMap.set(r.id, r);
            }
          });
        }
        const mergedReviews = Array.from(reviewMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setReviews(mergedReviews);
        saveReviews(mergedReviews);
        mergedReviews.forEach((r) => knownReviewIdsRef.current.add(r.id));

        setIsServerSynced(true);
      })
      .catch((err) => {
        console.warn('Initial sync error:', err);
      });

    // Test Firestore connection on boot
    testFirestoreConnection()
      .then((ok) => {
        setIsFirebaseConnected(ok);
        if (ok) {
          console.log('[Firebase] Firestore conectado com sucesso.');
        }
      })
      .catch(() => {
        setIsFirebaseConnected(false);
      });

    // Reviews are persisted and synchronized exclusively by the central server/PostgreSQL.
    // Firestore remains available for the legacy/settings integration only.

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Real-time background sync polling (every 3.5s)
  // Ensures manager dashboard and customer QR code reviews are 100% synchronized across all devices
  useEffect(() => {
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
  }, []);

  // Request manager access: if already logged in, navigate; otherwise ask for PIN
  const handleRequestManagerAccess = (targetView: 'manager' | 'qr_display' = 'manager') => {
    if (isManagerLoggedIn) {
      setActiveView(targetView);
    } else {
      setPendingView(targetView);
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
    }
  };

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const correctPin = (settings.managerPin || '1234').trim();
    if (pinInput.trim() === correctPin) {
      try {
        sessionStorage.setItem(tenantKey('restaurant_manager_auth'), 'true');
      } catch {}
      setIsManagerLoggedIn(true);
      setActiveView(pendingView);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      showToast('Acesso autorizado ao painel do restaurante.');
    } else {
      setPinError('PIN incorreto. Tente novamente.');
    }
  };

  const handleLogoutManager = () => {
    try {
      sessionStorage.removeItem(tenantKey('restaurant_manager_auth'));
    } catch {}
    setIsManagerLoggedIn(false);
    setActiveView('customer');
    showToast('Painel do restaurante bloqueado com sucesso.');
  };

  // Sync to local storage & central server & Firebase Firestore
  const handleReviewsChange = (newReviews: Review[]) => {
    setReviews(newReviews);
    saveReviews(newReviews);
  };

  const handleRewardsChange = (newRewards: RewardOption[]) => {
    setRewards(newRewards);
    saveRewards(newRewards);
    apiSaveRewards(newRewards).catch(() => {});
    apiSyncPush({ rewards: newRewards }).catch(() => {});
    firestoreSaveRewards(newRewards).catch(() => {});
  };

  const handleSettingsChange = (newSettings: RestaurantSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    firestoreSaveSettings(newSettings).catch(() => {});
    if (newSettings.managerPin) {
      savePin(newSettings.managerPin);
      apiUpdatePin(newSettings.managerPin).catch(() => {});
    }
    if (newSettings.whatsappApiUrl !== undefined || newSettings.whatsappApiToken !== undefined || newSettings.whatsappCustomMessage !== undefined) {
      saveWhatsAppConfig({
        whatsappApiUrl: newSettings.whatsappApiUrl,
        whatsappApiToken: newSettings.whatsappApiToken,
        whatsappCustomMessage: newSettings.whatsappCustomMessage,
      });
      apiSaveWhatsAppSettings({
        whatsappApiUrl: newSettings.whatsappApiUrl,
        whatsappApiToken: newSettings.whatsappApiToken,
        whatsappCustomMessage: newSettings.whatsappCustomMessage,
        autoSendWhatsApp: newSettings.autoSendWhatsApp,
        autoSendMode: newSettings.autoSendMode,
      }).catch(() => {});
    }
    // Single authoritative write avoids older concurrent requests overwriting newer settings.
    apiSaveSettings(newSettings).catch(() => {});
  };

  const handleWaitersChange = (newWaiters: Waiter[]) => {
    setWaiters(newWaiters);
    saveWaiters(newWaiters);
    apiSaveWaiters(newWaiters).catch(() => {});
    apiSyncPush({ waiters: newWaiters }).catch(() => {});
    firestoreSaveWaiters(newWaiters).catch(() => {});
  };

  // Force Save Complete Database (both localStorage, server file restaurant_db.json & Firebase Firestore)
  const handleForceSaveDatabase = async (explicitSettings?: RestaurantSettings): Promise<boolean> => {
    const targetSettings = explicitSettings || settings;
    try {
      setSettings(targetSettings);
      saveSettings(targetSettings);
      saveRewards(rewards);
      saveWaiters(waiters);
      saveReviews(reviews);
      firestoreSaveSettings(targetSettings).catch(() => {});
      firestoreSaveRewards(rewards).catch(() => {});
      firestoreSaveWaiters(waiters).catch(() => {});
      if (targetSettings.whatsappApiUrl || targetSettings.whatsappApiToken) {
        apiSaveWhatsAppSettings({
          whatsappApiUrl: targetSettings.whatsappApiUrl,
          whatsappApiToken: targetSettings.whatsappApiToken,
          whatsappCustomMessage: targetSettings.whatsappCustomMessage,
          autoSendWhatsApp: targetSettings.autoSendWhatsApp,
          autoSendMode: targetSettings.autoSendMode,
        }).catch(() => {});
      }
      const res = await apiSyncPush({
        settings: targetSettings,
        rewards,
        waiters,
        reviews,
      });
      if (res.success) {
        showToast('💾 Banco de dados (Firebase Firestore & Servidor) 100% salvo com sucesso!');
        return true;
      } else {
        showToast('⚠️ Erro ao salvar: ' + (res.message || 'tente novamente'));
        return false;
      }
    } catch {
      showToast('⚠️ Erro ao salvar banco de dados.');
      return false;
    }
  };

  // Add review from customer (submitted via table QR code or client device)
  const handleSubmitReview = async (newReview: Review) => {
    deletedReviewIdsRef.current.delete(newReview.id);
    knownReviewIdsRef.current.add(newReview.id);
    const updated = [newReview, ...reviews.filter((r) => r.id !== newReview.id)];
    handleReviewsChange(updated);

    // Synchronize directly with central server
    try {
      await apiSubmitReview(newReview);
    } catch (err) {
      console.warn('Central server sync notice:', err);
    }

    // Redundant atomic push to server
    apiSyncPush({ reviews: updated }).catch(() => {});

    showToast(
      newReview.tableNumber
        ? `Avaliação da Mesa #${newReview.tableNumber} registrada e salva com sucesso!`
        : `Avaliação registrada e salva com sucesso!`
    );
  };

  // Validate voucher code (waiter/manager action) - STRICT SINGLE USE ONLY
  const handleValidateReward = async (code: string): Promise<boolean> => {
    const normalized = code.trim().toUpperCase();
    const index = reviews.findIndex(
      (r) =>
        r.rewardCode.toUpperCase() === normalized ||
        r.rewardCode.replace('BRINDE-', '').toUpperCase() === normalized
    );

    if (index >= 0) {
      const targetReview = reviews[index];
      // STRICT SINGLE USE CHECK
      if (targetReview.rewardClaimed) {
        const dateStr = targetReview.claimedAt
          ? new Date(targetReview.claimedAt).toLocaleString('pt-BR')
          : 'anteriormente';
        showToast(`⛔ VOUCHER DE USO ÚNICO: Este voucher já foi utilizado em ${dateStr} e não pode ser reutilizado!`);
        return false;
      }

      // Check voucher expiration
      const validityDays = settings.rewardValidityDays || 15;
      const expiry = targetReview.expiresAt
        ? new Date(targetReview.expiresAt)
        : new Date(new Date(targetReview.createdAt).getTime() + validityDays * 24 * 60 * 60 * 1000);

      if (Date.now() > expiry.getTime()) {
        showToast(`Voucher expirado! O prazo de ${validityDays} dias encerrou em ${expiry.toLocaleDateString('pt-BR')}.`);
        return false;
      }

      const tableUsed = currentTable > 0 ? currentTable : targetReview.tableNumber;
      const updated = [...reviews];
      updated[index] = {
        ...updated[index],
        rewardClaimed: true,
        claimedAt: new Date().toISOString(),
        claimedTable: tableUsed,
      };
      handleReviewsChange(updated);

      // Validate on central server/PostgreSQL
      apiValidateReward(normalized, tableUsed).catch(() => {});
      apiSyncPush({ reviews: updated }).catch(() => {});

      showToast(
        `✅ Brinde "${updated[index].rewardTitle}" validado para ${
          updated[index].customerName || (updated[index].tableNumber ? `Mesa #${updated[index].tableNumber}` : 'o cliente')
        }! Voucher de uso único baixado no sistema central.`
      );
      return true;
    }

    // Try verifying on server if not present in local list
    try {
      const serverResult = await apiValidateReward(normalized, currentTable > 0 ? currentTable : undefined);
      if (serverResult.success && serverResult.review) {
        const updated = [serverResult.review, ...reviews.filter((r) => r.id !== serverResult.review!.id)];
        handleReviewsChange(updated);
        showToast(`✅ Brinde validado no sistema central com sucesso!`);
        return true;
      } else if (serverResult.error) {
        showToast(serverResult.error);
        return false;
      }
    } catch {}

    showToast(`Código "${code}" não encontrado no sistema.`);
    return false;
  };

  const handleDeleteReview = (id: string) => {
    // 1. Mark as deleted in tombstone storage and ref to block resurrection
    deletedReviewIdsRef.current.add(id);
    markReviewDeleted(id);
    knownReviewIdsRef.current.delete(id);

    // 2. Remove immediately from local state and storage
    const updated = reviews.filter((r) => r.id !== id);
    handleReviewsChange(updated);

    // 3. Delete from central server backend & disk
    apiDeleteReview(id).catch((err) => {
      console.warn('Central server review deletion notice:', err);
    });

    // 4. Delete directly from Firestore
    firestoreDeleteReview(id).catch(() => {});

    // 5. Update authoritative reviews state on server
    apiSyncPush({ reviews: updated }).catch(() => {});

    showToast('Registro de cliente/avaliação excluído com sucesso.');
  };

  const handleClearAllReviews = () => {
    handleReviewsChange([]);
    knownReviewIdsRef.current.clear();
    clearAllDeletedReviewIds();
    deletedReviewIdsRef.current.clear();
    apiClearAllReviews().catch(() => {});
    clearAllReviewsStorage();
    showToast('Todos os registros de clientes foram limpos do sistema central.');
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

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

              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>QR Sincronizado ({reviews.length})</span>
              </div>

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
                  id="nav-btn-qr"
                  type="button"
                  onClick={() => setActiveView('qr_display')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeView === 'qr_display'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span className="hidden sm:inline">Placas & Totens QR</span>
                  <span className="sm:hidden">Placas QR</span>
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {activeView === 'customer' && (
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
        {activeView === 'qr_display' && isManagerLoggedIn && (
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

        {activeView === 'manager' && isManagerLoggedIn && (
          <ManagerDashboard
            reviews={reviews}
            rewards={rewards}
            settings={settings}
            waiters={waiters}
            onValidateReward={handleValidateReward}
            onUpdateRewards={handleRewardsChange}
            onUpdateSettings={handleSettingsChange}
            onUpdateWaiters={handleWaitersChange}
            onDeleteReview={handleDeleteReview}
            onClearAllReviews={handleClearAllReviews}
            onUpdateReviewsList={(updated) => setReviews(updated)}
            onSaveDatabase={handleForceSaveDatabase}
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
              <h3 className="text-lg font-black text-stone-900">
                Acesso Restrito à Gerência
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed px-2">
                Digite o PIN de 4 dígitos para acessar o painel administrativo e as configurações do {settings.name}.
              </p>
            </div>

            {/* PIN Form */}
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type={showPinSecret ? 'text' : 'password'}
                    maxLength={8}
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (pinError) setPinError('');
                    }}
                    placeholder="••••"
                    className={`w-full py-3.5 px-4 text-center tracking-[0.4em] font-mono text-xl font-bold bg-stone-50 border-2 rounded-2xl outline-none transition ${
                      pinError
                        ? 'border-rose-500 bg-rose-50/50 text-rose-900'
                        : 'border-stone-300 focus:border-rose-600 bg-stone-50 focus:bg-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinSecret(!showPinSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  >
                    {showPinSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {pinError && (
                  <p className="text-xs text-rose-600 font-bold text-center flex items-center justify-center gap-1 pt-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              {/* Quick Touch Keypad for Tablets & Mobiles */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (pinInput.length < 8) {
                        setPinInput((prev) => prev + digit);
                        if (pinError) setPinError('');
                      }
                    }}
                    className="py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-black rounded-xl transition active:scale-95 cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPinInput('')}
                  className="py-2.5 bg-stone-100 hover:bg-rose-100 text-stone-500 hover:text-rose-700 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pinInput.length < 8) {
                      setPinInput((prev) => prev + '0');
                      if (pinError) setPinError('');
                    }
                  }}
                  className="py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-black rounded-xl transition active:scale-95 cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                  className="py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer"
                >
                  ⌫
                </button>
              </div>

              {/* Submit & Cancel */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Entrar no Painel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="w-full py-2 text-stone-500 hover:text-stone-800 text-xs font-bold transition cursor-pointer"
                >
                  Voltar para Avaliação do Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


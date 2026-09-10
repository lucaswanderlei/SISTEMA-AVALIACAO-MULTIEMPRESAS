import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Star,
  Users,
  UtensilsCrossed,
  Clock,
  HeartHandshake,
  Gift,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  Check,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  MessageSquareWarning,
  MessageSquarePlus,
  BadgeAlert,
  ArrowUpDown,
  UserCheck,
  Trophy,
  Award,
  Edit2,
  ThumbsUp,
  X,
  Phone,
  Database,
  Save,
  Download,
  Upload,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { RestaurantSettings, RewardOption, Review, Waiter } from '../types';
import { CustomerDatabaseView } from './CustomerDatabaseView';
import { apiUpdatePin } from '../lib/api';
import { RatingChoiceIcon } from './RatingChoiceIcon';
import { QUICK_TAGS_OPTIONS } from '../data/mockData';
import type { RatingIconType } from '../types';

interface ManagerDashboardProps {
  reviews: Review[];
  rewards: RewardOption[];
  settings: RestaurantSettings;
  waiters: Waiter[];
  onValidateReward: (code: string) => boolean;
  onUpdateRewards: (rewards: RewardOption[]) => void;
  onUpdateSettings: (settings: RestaurantSettings) => void;
  onUpdateWaiters: (waiters: Waiter[]) => void;
  onDeleteReview?: (id: string) => void;
  onClearAllReviews?: () => void;
  onUpdateReviewsList?: (reviews: Review[]) => void;
  onSaveDatabase?: () => Promise<boolean> | void;
}

const DEFAULT_VOUCHER_TEMPLATE = `*VOUCHER DE CORTESIA - {{empresa}}* 🥟✨

Olá {{cliente}}! Aqui estão os detalhes do seu brinde conquistado na avaliação:

🎁 *Brinde:* {{brinde}}
🎟️ *Código de Resgate:* {{codigo}}
📅 *Prazo de Início:* Liberado para resgate a partir de {{inicio}} (24h após o sorteio)
⏳ *Prazo para Expirar:* Válido até {{expira}} ({{validade_dias}} dias de validade)
⚠️ *Regra Importante:* Só é válido utilizar 1 cortesia/brinde por mesa!

Apresente este voucher durante sua próxima visita ao {{empresa}}. Esperamos você! 💛`;

const renderVoucherPreview = (template: string, settings: RestaurantSettings) =>
  template
    .replace(/{{\s*cliente\s*}}/gi, 'Cliente')
    .replace(/{{\s*empresa\s*}}/gi, (settings.name || 'Empresa').toUpperCase())
    .replace(/{{\s*brinde\s*}}/gi, 'PORÇÃO DE BATATA FRITA')
    .replace(/{{\s*codigo\s*}}/gi, 'BRINDE-7777')
    .replace(/{{\s*inicio\s*}}/gi, 'amanhã')
    .replace(/{{\s*expira\s*}}/gi, `em ${settings.rewardValidityDays || 15} dias`)
    .replace(/{{\s*validade_dias\s*}}/gi, String(settings.rewardValidityDays || 15));

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  reviews,
  rewards,
  settings,
  waiters = [],
  onValidateReward,
  onUpdateRewards,
  onUpdateSettings,
  onUpdateWaiters,
  onDeleteReview,
  onClearAllReviews,
  onUpdateReviewsList,
  onSaveDatabase,
}) => {
  // Tabs within dashboard
  const [activeTab, setActiveTab] = useState<
    'metrics' | 'reviews' | 'customers' | 'waiters' | 'validator' | 'rewards' | 'settings'
  >(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (window.location.pathname.replace(/\/$/, '') === '/gerencia' || params.get('config') === '1') return 'settings';
    }
    return 'metrics';
  });

  const quickTagsOptions =
    settings.quickTagsOptions && settings.quickTagsOptions.length > 0
      ? settings.quickTagsOptions
      : QUICK_TAGS_OPTIONS;

  const updateQuickTag = (index: number, value: string) => {
    const next = [...quickTagsOptions];
    next[index] = value;
    onUpdateSettings({ ...settings, quickTagsOptions: next });
  };

  const removeQuickTag = (index: number) => {
    const next = quickTagsOptions.filter((_, i) => i !== index);
    onUpdateSettings({ ...settings, quickTagsOptions: next });
  };

  const addQuickTag = () => {
    if (quickTagsOptions.length >= 20) return;
    onUpdateSettings({
      ...settings,
      quickTagsOptions: [...quickTagsOptions, `Novo destaque ${quickTagsOptions.length + 1}`],
    });
  };

  // Database Save state
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveDbStatus, setSaveDbStatus] = useState<string | null>(null);

  const handleManualSaveDb = async () => {
    if (onSaveDatabase) {
      setIsSavingDb(true);
      try {
        await onSaveDatabase();
        setSaveDbStatus('Salvo!');
        setTimeout(() => setSaveDbStatus(null), 3500);
      } catch {
        setSaveDbStatus('Erro ao salvar');
        setTimeout(() => setSaveDbStatus(null), 3500);
      } finally {
        setIsSavingDb(false);
      }
    }
  };

  // PIN / Password management state
  const [pinFormValue, setPinFormValue] = useState<string>('');
  const [pinConfirmValue, setPinConfirmValue] = useState<string>('');
  const [showPinPassword, setShowPinPassword] = useState<boolean>(false);
  const [showCurrentPinValue, setShowCurrentPinValue] = useState<boolean>(false);
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false);
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveNewPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinFeedback(null);
    const trimmed = pinFormValue.trim();
    const confirmTrimmed = pinConfirmValue.trim();

    if (!trimmed) {
      setPinFeedback({ type: 'error', message: 'Digite a nova senha desejada.' });
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 12) {
      setPinFeedback({ type: 'error', message: 'A senha deve conter entre 3 e 12 dígitos ou letras.' });
      return;
    }
    if (trimmed !== confirmTrimmed) {
      setPinFeedback({ type: 'error', message: 'A confirmação não confere com a nova senha digitada.' });
      return;
    }

    setIsSavingPin(true);
    try {
      const updatedSettings = {
        ...settings,
        managerPin: trimmed,
      };
      onUpdateSettings(updatedSettings);

      await apiUpdatePin(trimmed);
      if (onSaveDatabase) {
        await onSaveDatabase();
      }

      setPinFormValue('');
      setPinConfirmValue('');
      setPinFeedback({
        type: 'success',
        message: `✓ Nova senha salva com sucesso no banco de dados permanente! Ela continuará ativa mesmo se a página for recarregada.`,
      });
      setTimeout(() => setPinFeedback(null), 6000);
    } catch {
      setPinFeedback({
        type: 'error',
        message: 'Erro ao salvar a nova senha no servidor. Tente novamente.',
      });
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleResetDefaultPin = async () => {
    if (!window.confirm('Deseja restaurar a senha padrão de acesso para "1234"?')) return;
    setIsSavingPin(true);
    try {
      const updatedSettings = {
        ...settings,
        managerPin: '1234',
      };
      onUpdateSettings(updatedSettings);
      await apiUpdatePin('1234');
      if (onSaveDatabase) {
        await onSaveDatabase();
      }
      setPinFormValue('');
      setPinConfirmValue('');
      setPinFeedback({
        type: 'success',
        message: '✓ Senha padrão (1234) restaurada e salva com sucesso no banco de dados!',
      });
      setTimeout(() => setPinFeedback(null), 4000);
    } catch {
      setPinFeedback({
        type: 'error',
        message: 'Erro ao redefinir a senha.',
      });
    } finally {
      setIsSavingPin(false);
    }
  };

  // Reviews filtering
  const [filterRating, setFilterRating] = useState<'all' | 'low' | 'critics' | 'suggestions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [filterWaiter, setFilterWaiter] = useState<string>('all');

  // Waiter Management State (Modal / Form)
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
  const [editingWaiterId, setEditingWaiterId] = useState<string | null>(null);
  const [waiterName, setWaiterName] = useState('');
  const [waiterNickname, setWaiterNickname] = useState('');
  const [waiterBadgeNumber, setWaiterBadgeNumber] = useState('');
  const [waiterRole, setWaiterRole] = useState<'Garçom' | 'Garçonete' | 'Atendente' | 'Cumim'>('Garçom');
  const [waiterActive, setWaiterActive] = useState(true);

  // Validator state
  const [inputCode, setInputCode] = useState('');
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    review?: Review;
  } | null>(null);
  const [showClearReviewsModal, setShowClearReviewsModal] = useState(false);
  const [waiterToDelete, setWaiterToDelete] = useState<Waiter | null>(null);
  const [rewardToDelete, setRewardToDelete] = useState<RewardOption | null>(null);
  const [rewardWarningMessage, setRewardWarningMessage] = useState<string | null>(null);

  // New reward modal/form
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [newRewardCategory, setNewRewardCategory] = useState<'dessert' | 'drink' | 'discount' | 'appetizer'>(
    'dessert'
  );
  const [newRewardWeight, setNewRewardWeight] = useState<number>(45);

  // WhatsApp Testing & Persistence State
  const [testPhone, setTestPhone] = useState('');
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isTestingMetaTemplate, setIsTestingMetaTemplate] = useState(false);
  const [testWhatsAppResult, setTestWhatsAppResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [whatsappSavedSuccess, setWhatsappSavedSuccess] = useState(false);

  const handleSaveWhatsAppApi = async () => {
    setIsSavingWhatsApp(true);
    setWhatsappSavedSuccess(false);
    try {
      onUpdateSettings({ ...settings });
      if (onSaveDatabase) {
        await onSaveDatabase();
      }
      setWhatsappSavedSuccess(true);
      setTimeout(() => setWhatsappSavedSuccess(false), 5000);
    } catch {
      // ignore
    } finally {
      setIsSavingWhatsApp(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!testPhone || testPhone.replace(/\D/g, '').length < 10) {
      setTestWhatsAppResult({
        success: false,
        message: 'Por favor, insira um número válido com DDD (ex: 11999999999).',
      });
      return;
    }
    if (!settings.whatsappApiUrl || settings.whatsappApiUrl.trim().length < 5) {
      setTestWhatsAppResult({
        success: false,
        message: 'Por favor, preencha a URL do Gateway de WhatsApp antes de testar.',
      });
      return;
    }

    setIsTestingWhatsApp(true);
    setTestWhatsAppResult(null);

    try {
      const res = await fetch('/api/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          apiUrl: settings.whatsappApiUrl,
          apiToken: settings.whatsappApiToken,
          message: renderVoucherPreview(settings.voucherMessageTemplate || DEFAULT_VOUCHER_TEMPLATE, settings),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestWhatsAppResult({
          success: true,
          message: data.message || 'Mensagem oficial enviada com sucesso para o seu WhatsApp!',
        });
      } else {
        setTestWhatsAppResult({
          success: false,
          message: data.error || 'Erro ao enviar mensagem pelo Gateway.',
        });
      }
    } catch (err: any) {
      setTestWhatsAppResult({
        success: false,
        message: err?.message || 'Falha na conexão com o servidor local.',
      });
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const handleTestMetaTemplate = async () => {
    if (!testPhone || testPhone.replace(/\D/g, '').length < 10) {
      setTestWhatsAppResult({
        success: false,
        message: 'Por favor, insira um número válido com DDD (ex: 82993259566).',
      });
      return;
    }
    if (!settings.whatsappApiUrl || settings.whatsappApiUrl.trim().length < 5) {
      setTestWhatsAppResult({
        success: false,
        message: 'Por favor, preencha a URL do Gateway de WhatsApp antes de testar.',
      });
      return;
    }

    setIsTestingMetaTemplate(true);
    setTestWhatsAppResult(null);

    try {
      const res = await fetch('/api/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          apiUrl: settings.whatsappApiUrl,
          apiToken: settings.whatsappApiToken,
          template: 'avaliacao_brinde',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestWhatsAppResult({
          success: true,
          message: 'Template de teste da Meta (avaliacao_brinde) enviado com sucesso! Verifique seu WhatsApp.',
        });
      } else {
        setTestWhatsAppResult({
          success: false,
          message: data.error || 'Erro ao enviar template pela Meta Cloud API.',
        });
      }
    } catch (err: any) {
      setTestWhatsAppResult({
        success: false,
        message: err?.message || 'Falha na conexão com o servidor local.',
      });
    } finally {
      setIsTestingMetaTemplate(false);
    }
  };

  // Calculations for Metrics
  const stats = useMemo(() => {
    if (reviews.length === 0) {
      return {
        total: 0,
        avgOverall: 0,
        avgService: 0,
        avgAmbiance: 0,
        avgProducts: 0,
        avgWaitTime: 0,
        claimedRewardsCount: 0,
        unclaimedRewardsCount: 0,
        criticsCount: 0,
      };
    }

    let sumService = 0;
    let sumAmbiance = 0;
    let sumProducts = 0;
    let sumWaitTime = 0;
    let claimed = 0;
    let critics = 0;

    reviews.forEach((r) => {
      sumService += r.ratings.service;
      sumAmbiance += r.ratings.ambiance;
      sumProducts += r.ratings.products;
      sumWaitTime += r.ratings.waitTime;
      if (r.rewardClaimed) claimed++;
      if (r.criticism && r.criticism.trim().length > 0) critics++;
    });

    const total = reviews.length;
    const avgService = sumService / total;
    const avgAmbiance = sumAmbiance / total;
    const avgProducts = sumProducts / total;
    const avgWaitTime = sumWaitTime / total;
    const avgOverall = (avgService + avgAmbiance + avgProducts + avgWaitTime) / 4;

    return {
      total,
      avgOverall: Number(avgOverall.toFixed(1)),
      avgService: Number(avgService.toFixed(1)),
      avgAmbiance: Number(avgAmbiance.toFixed(1)),
      avgProducts: Number(avgProducts.toFixed(1)),
      avgWaitTime: Number(avgWaitTime.toFixed(1)),
      claimedRewardsCount: claimed,
      unclaimedRewardsCount: total - claimed,
      criticsCount: critics,
    };
  }, [reviews]);

  // Vouchers expiring in 5 days calculation for CRM tab alert
  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    return reviews.filter((r) => {
      if (r.rewardClaimed) return false;
      const expiryMs = r.expiresAt
        ? new Date(r.expiresAt).getTime()
        : new Date(r.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000;
      const diff = expiryMs - now;
      return diff > 0 && diff <= fiveDaysMs;
    }).length;
  }, [reviews]);

  // Filtered reviews
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // Table filter
      if (filterTable !== 'all') {
        if (filterTable === 'without_table' && r.tableNumber) {
          return false;
        }
        if (filterTable !== 'without_table' && r.tableNumber !== Number(filterTable)) {
          return false;
        }
      }

      // Waiter filter
      if (filterWaiter !== 'all') {
        if (filterWaiter === 'with_waiter' && !r.waiterId) {
          return false;
        }
        if (filterWaiter !== 'with_waiter' && r.waiterId !== filterWaiter) {
          return false;
        }
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText =
          r.customerName?.toLowerCase().includes(q) ||
          r.waiterName?.toLowerCase().includes(q) ||
          r.waiterCompliment?.toLowerCase().includes(q) ||
          r.waiterCompliments?.some((c) => c.toLowerCase().includes(q)) ||
          r.criticism?.toLowerCase().includes(q) ||
          r.suggestion?.toLowerCase().includes(q) ||
          r.rewardCode.toLowerCase().includes(q) ||
          r.quickTags.some((t) => t.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      // Type filter
      if (filterRating === 'low') {
        const lowestPillar = Math.min(
          r.ratings.service,
          r.ratings.ambiance,
          r.ratings.products,
          r.ratings.waitTime
        );
        return lowestPillar <= 3;
      }

      if (filterRating === 'critics') {
        return Boolean(r.criticism && r.criticism.trim().length > 0);
      }

      if (filterRating === 'suggestions') {
        return Boolean(r.suggestion && r.suggestion.trim().length > 0);
      }

      return true;
    });
  }, [reviews, filterTable, filterWaiter, searchQuery, filterRating]);

  const handleValidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const code = inputCode.trim().toUpperCase();
    const targetReview = reviews.find(
      (r) =>
        r.rewardCode.toUpperCase() === code ||
        r.rewardCode.replace('BRINDE-', '').toUpperCase() === code
    );

    if (targetReview && targetReview.rewardClaimed) {
      const dateStr = targetReview.claimedAt
        ? new Date(targetReview.claimedAt).toLocaleString('pt-BR')
        : 'data anterior';
      const mesaStr = targetReview.tableNumber ? `Mesa #${targetReview.tableNumber}` : 'Balcão';
      setValidationResult({
        success: false,
        message: `⛔ VOUCHER DE USO ÚNICO JÁ UTILIZADO! Este cupom (${code}) já foi baixado em ${dateStr} (${mesaStr} - ${targetReview.customerName || 'Cliente'}). Por regra, este voucher não pode ser reutilizado.`,
        review: targetReview,
      });
      return;
    }

    const success = onValidateReward(code);

    if (success && targetReview) {
      setValidationResult({
        success: true,
        message: `✅ Brinde "${targetReview.rewardTitle}" validado com sucesso para ${targetReview.customerName || 'cliente'} (${targetReview.tableNumber ? `Mesa #${targetReview.tableNumber}` : 'Balcão'})! Cupom baixado (uso único).`,
        review: targetReview,
      });
      setInputCode('');
    } else {
      setValidationResult({
        success: false,
        message: `Código "${code}" não encontrado ou inválido no sistema. Verifique os dígitos digitados.`,
      });
    }
  };

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRewardTitle.trim()) return;

    const newR: RewardOption = {
      id: `reward-${Date.now()}`,
      title: newRewardTitle.trim(),
      description: newRewardDesc.trim() || 'Cortesia especial da casa.',
      iconName: 'Gift',
      category: newRewardCategory,
      enabled: true,
      probabilityWeight: newRewardWeight || 20,
    };

    const updated = [...rewards, newR];
    onUpdateRewards(updated);
    if (onSaveDatabase) {
      onSaveDatabase().catch(() => {});
    }
    setNewRewardTitle('');
    setNewRewardDesc('');
  };

  const handleToggleReward = (id: string) => {
    const updated = rewards.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    onUpdateRewards(updated);
    if (onSaveDatabase) {
      onSaveDatabase().catch(() => {});
    }
  };

  const handleUpdateRewardWeight = (id: string, weight: number) => {
    const validWeight = Math.max(1, Math.min(100, Math.round(weight)));
    const updated = rewards.map((r) => (r.id === id ? { ...r, probabilityWeight: validWeight } : r));
    onUpdateRewards(updated);
    if (onSaveDatabase) {
      onSaveDatabase().catch(() => {});
    }
  };

  const handleDeleteReward = (reward: RewardOption) => {
    if (rewards.length <= 1) {
      setRewardWarningMessage('Mantenha pelo menos um brinde cadastrado na roleta de prêmios.');
      return;
    }
    setRewardToDelete(reward);
  };

  const confirmDeleteReward = () => {
    if (!rewardToDelete) return;
    const updated = rewards.filter((r) => r.id !== rewardToDelete.id);
    onUpdateRewards(updated);
    if (onSaveDatabase) {
      onSaveDatabase().catch(() => {});
    }
    setRewardToDelete(null);
  };

  // Waiter calculations & rankings
  const waiterStats = useMemo(() => {
    return waiters
      .map((waiter) => {
        const waiterReviews = reviews.filter((r) => r.waiterId === waiter.id);
        const count = waiterReviews.length;
        const ratingsWithWaiter = waiterReviews.filter(
          (r) => typeof r.waiterRating === 'number' && r.waiterRating > 0
        );
        const avgRating =
          ratingsWithWaiter.length > 0
            ? ratingsWithWaiter.reduce((acc, r) => acc + (r.waiterRating || 0), 0) /
              ratingsWithWaiter.length
            : 0;

        const fiveStarCount = ratingsWithWaiter.filter((r) => r.waiterRating === 5).length;
        const fiveStarPercent =
          ratingsWithWaiter.length > 0
            ? Math.round((fiveStarCount / ratingsWithWaiter.length) * 100)
            : 0;

        // Compliments count
        const compMap: Record<string, number> = {};
        waiterReviews.forEach((r) => {
          if (r.waiterCompliments && Array.isArray(r.waiterCompliments)) {
            r.waiterCompliments.forEach((comp) => {
              if (comp) compMap[comp] = (compMap[comp] || 0) + 1;
            });
          } else if (r.waiterCompliment) {
            const parts = r.waiterCompliment.includes(' • ')
              ? r.waiterCompliment.split(' • ')
              : [r.waiterCompliment];
            parts.forEach((p) => {
              const clean = p.trim();
              if (clean) compMap[clean] = (compMap[clean] || 0) + 1;
            });
          }
        });
        const compliments = Object.entries(compMap)
          .map(([compliment, freq]) => ({ compliment, freq }))
          .sort((a, b) => b.freq - a.freq);

        return {
          waiter,
          count,
          avgRating: Number(avgRating.toFixed(1)),
          fiveStarPercent,
          compliments,
        };
      })
      .sort((a, b) => {
        // Active first
        if (a.waiter.active !== b.waiter.active) return a.waiter.active ? -1 : 1;
        // High rating first
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        // Count next
        return b.count - a.count;
      });
  }, [waiters, reviews]);

  // Overall Waiter Metrics
  const waiterSummary = useMemo(() => {
    const totalWaiters = waiters.length;
    const activeWaiters = waiters.filter((w) => w.active).length;
    const reviewsWithWaiters = reviews.filter((r) => r.waiterId);
    const validRatings = reviews
      .map((r) => r.waiterRating)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgTeam =
      validRatings.length > 0
        ? Number((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1))
        : 0;

    const topWaiter = waiterStats.find((ws) => ws.count > 0 && ws.waiter.active);

    return {
      totalWaiters,
      activeWaiters,
      totalEvaluatedReviews: reviewsWithWaiters.length,
      avgTeam,
      topWaiter,
    };
  }, [waiters, reviews, waiterStats]);

  // Waiter CRUD handlers
  const handleOpenAddWaiter = () => {
    setEditingWaiterId(null);
    setWaiterName('');
    setWaiterNickname('');
    setWaiterBadgeNumber('');
    setWaiterRole('Garçom');
    setWaiterActive(true);
    setIsWaiterModalOpen(true);
  };

  const handleOpenEditWaiter = (waiter: Waiter) => {
    setEditingWaiterId(waiter.id);
    setWaiterName(waiter.name);
    setWaiterNickname(waiter.nickname || '');
    setWaiterBadgeNumber(waiter.badgeNumber || '');
    setWaiterRole(waiter.role);
    setWaiterActive(waiter.active);
    setIsWaiterModalOpen(true);
  };

  const handleSaveWaiter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiterName.trim()) return;

    if (editingWaiterId) {
      const updated = waiters.map((w) =>
        w.id === editingWaiterId
          ? {
              ...w,
              name: waiterName.trim(),
              nickname: waiterNickname.trim() || undefined,
              badgeNumber: waiterBadgeNumber.trim() || undefined,
              role: waiterRole,
              active: waiterActive,
            }
          : w
      );
      onUpdateWaiters(updated);
      if (onSaveDatabase) {
        onSaveDatabase().catch(() => {});
      }
    } else {
      const newW: Waiter = {
        id: `w-${Date.now()}`,
        name: waiterName.trim(),
        nickname: waiterNickname.trim() || undefined,
        badgeNumber: waiterBadgeNumber.trim() || undefined,
        role: waiterRole,
        active: waiterActive,
        createdAt: new Date().toISOString(),
      };
      const updated = [...waiters, newW];
      onUpdateWaiters(updated);
      if (onSaveDatabase) {
        onSaveDatabase().catch(() => {});
      }
    }
    setIsWaiterModalOpen(false);
  };

  const handleToggleWaiterActive = (id: string) => {
    const updated = waiters.map((w) => (w.id === id ? { ...w, active: !w.active } : w));
    onUpdateWaiters(updated);
    if (onSaveDatabase) {
      onSaveDatabase().catch(() => {});
    }
  };

  const handleDeleteWaiter = (waiter: Waiter) => {
    setWaiterToDelete(waiter);
  };

  const confirmDeleteWaiter = () => {
    if (!waiterToDelete) return;
    const updated = waiters.filter((w) => w.id !== waiterToDelete.id);
    onUpdateWaiters(updated);
    if (onSaveDatabase) {
      onSaveDatabase().catch(() => {});
    }
    setWaiterToDelete(null);
  };

  return (
    <div id="manager-dashboard-container" className="space-y-6">
      {/* Navigation Sub-Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-stone-200 shadow-sm flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'metrics'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Métricas dos 4 Pilares</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition relative ${
            activeTab === 'reviews'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>Feed de Avaliações & Críticas</span>
          <span className="ml-1 bg-stone-900/10 px-1.5 py-0.5 rounded-full text-[10px]">
            {reviews.length}
          </span>
          {stats.criticsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-2 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition relative ${
            activeTab === 'customers'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Banco de Clientes (CRM)</span>
          <span className="ml-1 bg-stone-900/10 px-1.5 py-0.5 rounded-full text-[10px]">
            {reviews.length}
          </span>
          {expiringSoonCount > 0 && (
            <span
              className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-xs ml-1"
              title={`${expiringSoonCount} clientes com brinde a expirar nos próximos 5 dias!`}
            >
              ⚠️ {expiringSoonCount} a expirar
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('waiters')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'waiters'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Garçons & Atendentes</span>
          <span className="ml-1 bg-stone-900/10 px-1.5 py-0.5 rounded-full text-[10px]">
            {waiters.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('validator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'validator'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Validar Brindes (Garçom/Caixa)</span>
          {stats.unclaimedRewardsCount > 0 && (
            <span className="ml-1 bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {stats.unclaimedRewardsCount} pendentes
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rewards')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'rewards'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Gerenciar Brindes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'settings'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configurações</span>
        </button>
      </div>

      {/* TAB 1: METRICS */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Top Stat Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Nota Média Geral */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Nota Geral da Casa</span>
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-stone-900">{stats.avgOverall}</span>
                <span className="text-sm text-stone-400 font-bold">/ 5.0</span>
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Baseado em {stats.total} avaliações das mesas
              </p>
            </div>

            {/* Total Avaliações */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total de Feedbacks</span>
                <Users className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-4xl font-black text-stone-900">{stats.total}</div>
              <p className="text-xs text-stone-500 mt-2">
                Clientes que responderam via QR Code
              </p>
            </div>

            {/* Brindes Entregues */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Brindes Resgatados</span>
                <Gift className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-emerald-700">{stats.claimedRewardsCount}</span>
                <span className="text-xs text-stone-400">/ {stats.total} emitidos</span>
              </div>
              <p className="text-xs text-emerald-600 font-semibold mt-2">
                {stats.unclaimedRewardsCount} vouchers válidos (prazo de {settings.rewardValidityDays || 15} dias para resgate)
              </p>
            </div>

            {/* Críticas Ativas */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Críticas & Alertas</span>
                <BadgeAlert className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-4xl font-black text-amber-600">{stats.criticsCount}</div>
              <p className="text-xs text-stone-500 mt-2">
                Feedbacks que requerem atenção da gerência
              </p>
            </div>
          </div>

          {/* Breakdown dos 4 Pilares Solicitados */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-600" />
                Desempenho por Pilar Avaliado
              </h3>
              <p className="text-xs text-stone-500">
                Acompanhamento individual dos 4 critérios pedidos no sistema:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Atendimento */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Atendimento & Garçons</h4>
                      <p className="text-xs text-stone-500">Simpatia, educação e presteza</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-stone-900">{stats.avgService}</span>
                    <span className="text-xs text-stone-400">/5</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full transition-all duration-500"
                    style={{ width: `${(stats.avgService / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* 2. Ambiente */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Ambiente & Conforto</h4>
                      <p className="text-xs text-stone-500">Limpeza, som e climatização</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-stone-900">{stats.avgAmbiance}</span>
                    <span className="text-xs text-stone-400">/5</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${(stats.avgAmbiance / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* 3. Produtos */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Produtos & Gastronomia</h4>
                      <p className="text-xs text-stone-500">Sabor, temperatura e apresentação</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-stone-900">{stats.avgProducts}</span>
                    <span className="text-xs text-stone-400">/5</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500"
                    style={{ width: `${(stats.avgProducts / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* 4. Tempo de Espera */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Tempo de Espera</h4>
                      <p className="text-xs text-stone-500">Chegada dos pratos e da conta</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-stone-900">{stats.avgWaitTime}</span>
                    <span className="text-xs text-stone-400">/5</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.avgWaitTime < 3.5
                        ? 'bg-rose-500'
                        : stats.avgWaitTime < 4.2
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${(stats.avgWaitTime / 5) * 100}%` }}
                  />
                </div>
                {stats.avgWaitTime < 4.0 && stats.total > 0 && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg flex items-center gap-1.5 border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Atenção: O tempo de espera está abaixo da média recomendada. Verifique gargalos na cozinha ou no fechamento de conta.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Waiter Team Performance Module in Metrics */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">
                    Avaliação Individual da Equipe de Garçons
                  </h4>
                  <p className="text-xs text-stone-500">
                    Média dos atendentes avaliados individualmente pelos clientes nas mesas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('waiters')}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <span>Ver & Gerenciar Garçons</span>
                <span className="text-xs">→</span>
              </button>
            </div>

            {waiterStats.length === 0 ? (
              <p className="text-xs text-stone-500">Nenhum garçom cadastrado ainda.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {waiterStats.slice(0, 4).map(({ waiter, count, avgRating, compliments }) => (
                  <div
                    key={waiter.id}
                    className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="font-bold text-stone-900 text-xs truncate">
                          {waiter.name}
                          {waiter.nickname && (
                            <span className="font-normal text-stone-500 ml-1">
                              ({waiter.nickname})
                            </span>
                          )}
                        </div>
                        {waiter.active ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Ativo" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-stone-300 shrink-0" title="Inativo" />
                        )}
                      </div>

                      <div className="flex items-center gap-1 mb-2">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                        <span className="text-sm font-extrabold text-stone-900">
                          {avgRating > 0 ? `${avgRating}` : '-'}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          ({count} {count === 1 ? 'avaliação' : 'avaliações'})
                        </span>
                      </div>

                      {compliments.length > 0 && (
                        <div className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-medium truncate">
                          Principal elogio: {compliments[0].compliment}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REVIEWS FEED */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, texto ou código..."
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
              />
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setFilterRating('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterRating === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Todas ({reviews.length})
              </button>

              <button
                type="button"
                onClick={() => setFilterRating('critics')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  filterRating === 'critics'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <MessageSquareWarning className="w-3.5 h-3.5" />
                Com Críticas ({stats.criticsCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterRating('suggestions')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterRating === 'suggestions'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Sugestões
              </button>

              <button
                type="button"
                onClick={() => setFilterRating('low')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterRating === 'low'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Notas Baixas (≤ 3★)
              </button>

              {/* Mesa selector */}
              <select
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-semibold outline-none"
              >
                <option value="all">Todas as Avaliações</option>
                <option value="without_table">Salão (Sem Mesa Especificada)</option>
                {Array.from({ length: settings.totalTables }, (_, i) => i + 1).map((t) => (
                  <option key={t} value={String(t)}>
                    Mesa #{t < 10 ? `0${t}` : t}
                  </option>
                ))}
              </select>

              {/* Waiter selector */}
              <select
                value={filterWaiter}
                onChange={(e) => setFilterWaiter(e.target.value)}
                className="text-xs py-1.5 px-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-semibold outline-none"
              >
                <option value="all">Todos os Atendentes</option>
                <option value="with_waiter">Apenas c/ Garçom Identificado</option>
                {waiters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.nickname ? `(${w.nickname})` : ''}
                  </option>
                ))}
              </select>

              {onClearAllReviews && reviews.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearReviewsModal(true)}
                  className="text-xs py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Limpar todos os registros de avaliações"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Limpar Avaliações</span>
                </button>
              )}
            </div>
          </div>

          {/* List of Reviews */}
          {reviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-14 text-center border border-stone-200 text-stone-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <Star className="w-7 h-7 text-stone-400" />
              </div>
              <h4 className="text-base font-bold text-stone-800">
                Nenhuma Avaliação Cadastrada
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                O banco de avaliações está limpo. Assim que os clientes avaliarem o restaurante pelas mesas, as avaliações completas aparecerão aqui.
              </p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 text-stone-400">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold text-stone-600">
                Nenhuma avaliação encontrada com estes filtros.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((rev) => {
                const lowestPillar = Math.min(
                  rev.ratings.service,
                  rev.ratings.ambiance,
                  rev.ratings.products,
                  rev.ratings.waitTime
                );
                const isAlert = lowestPillar <= 2 || Boolean(rev.criticism && rev.criticism.length > 5);

                return (
                  <div
                    key={rev.id}
                    id={`review-card-${rev.id}`}
                    className={`bg-white rounded-2xl p-5 border shadow-sm transition hover:shadow-md ${
                      isAlert ? 'border-rose-300 bg-rose-50/20' : 'border-stone-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        {rev.tableNumber && rev.tableNumber > 0 ? (
                          <span className="px-3 py-1 bg-stone-900 text-white font-extrabold text-xs rounded-xl">
                            MESA #{rev.tableNumber < 10 ? `0${rev.tableNumber}` : rev.tableNumber}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-stone-100 text-stone-700 font-bold text-xs rounded-xl border border-stone-200 flex items-center gap-1">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-rose-600" />
                            <span>Salão</span>
                          </span>
                        )}
                        <div>
                          <div className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                            <span>{rev.customerName || 'Cliente Cadastrado'}</span>
                            {rev.customerPhone && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">
                                Cadastro Ativo
                              </span>
                            )}
                          </div>
                          {rev.customerPhone && (
                            <div className="text-[11px] text-stone-600 font-mono flex items-center gap-1.5 mt-0.5">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{rev.customerPhone}</span>
                              <a
                                href={`https://wa.me/55${rev.customerPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition shadow-xs"
                                title="Abrir conversa no WhatsApp"
                              >
                                <span>Abrir WhatsApp</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-stone-400">
                          {new Date(rev.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {/* Reward status badge */}
                        {(() => {
                          const validityDays = settings.rewardValidityDays || 15;
                          const expiryDate = rev.expiresAt
                            ? new Date(rev.expiresAt)
                            : new Date(new Date(rev.createdAt).getTime() + validityDays * 24 * 60 * 60 * 1000);
                          const isExpired = !rev.rewardClaimed && Date.now() > expiryDate.getTime();
                          const diffDays = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                          const formattedExpiry = expiryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                          return (
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              <span className="font-mono text-xs font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded border">
                                {rev.rewardCode}
                              </span>
                              {rev.rewardClaimed ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Resgatado
                                </span>
                              ) : isExpired ? (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Expirado ({formattedExpiry})
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                                    title={`Válido até ${expiryDate.toLocaleDateString('pt-BR')}`}
                                  >
                                    <Clock className="w-2.5 h-2.5 text-emerald-600" />
                                    {diffDays}d válidos (até {formattedExpiry})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onValidateReward(rev.rewardCode)}
                                    className="text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200 transition cursor-pointer"
                                  >
                                    Validar Brinde
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Waiter Evaluation Tag if customer evaluated individual waiter */}
                    {rev.waiterName && (
                      <div className="mb-3 p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="p-1 bg-amber-100 text-amber-800 rounded-lg">
                            <UserCheck className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-stone-600">Atendido por:</span>
                          <span className="font-bold text-stone-900">{rev.waiterName}</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5">
                          {rev.waiterRating && (
                            <span className="flex items-center gap-1 font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full text-[11px]">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              {rev.waiterRating}.0
                            </span>
                          )}
                          {rev.waiterCompliments && rev.waiterCompliments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {rev.waiterCompliments.map((comp, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] text-amber-900 bg-white px-2 py-0.5 rounded-md border border-amber-200 font-medium"
                                >
                                  {comp}
                                </span>
                              ))}
                            </div>
                          ) : rev.waiterCompliment ? (
                            <span className="text-[11px] text-stone-800 bg-white px-2 py-0.5 rounded-md border border-amber-200 font-medium italic">
                              "{rev.waiterCompliment}"
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* 4 Pillars Ratings display */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-stone-50 p-3 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-stone-400">
                          Atendimento
                        </span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-stone-800">
                            {rev.ratings.service}.0
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-stone-400">
                          Ambiente
                        </span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-stone-800">
                            {rev.ratings.ambiance}.0
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-stone-400">
                          Produtos
                        </span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-stone-800">
                            {rev.ratings.products}.0
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-stone-400">
                          Tempo Espera
                        </span>
                        <div className="flex items-center gap-1">
                          <Star
                            className={`w-3.5 h-3.5 ${
                              rev.ratings.waitTime <= 2
                                ? 'fill-rose-400 text-rose-400'
                                : 'fill-amber-400 text-amber-400'
                            }`}
                          />
                          <span
                            className={`text-xs font-bold ${
                              rev.ratings.waitTime <= 2 ? 'text-rose-600' : 'text-stone-800'
                            }`}
                          >
                            {rev.ratings.waitTime}.0
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick tags */}
                    {rev.quickTags && rev.quickTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {rev.quickTags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Criticism Box */}
                    {rev.criticism && rev.criticism.trim().length > 0 && (
                      <div className="mb-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-1 font-bold text-rose-800 mb-1">
                          <MessageSquareWarning className="w-3.5 h-3.5 text-rose-600" />
                          <span>Crítica do Cliente:</span>
                        </div>
                        <p className="text-stone-800 italic">{rev.criticism}</p>
                      </div>
                    )}

                    {/* Suggestion Box */}
                    {rev.suggestion && rev.suggestion.trim().length > 0 && (
                      <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-1 font-bold text-emerald-800 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sugestão / Elogio:</span>
                        </div>
                        <p className="text-stone-800">{rev.suggestion}</p>
                      </div>
                    )}

                    {/* Reward Title */}
                    <div className="text-[11px] text-stone-500 pt-2 flex items-center justify-between border-t border-stone-100">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-rose-500" />
                        <span>Brinde conquistado: <strong>{rev.rewardTitle}</strong></span>
                      </div>
                      {onDeleteReview && (
                        <button
                          type="button"
                          onClick={() => onDeleteReview(rev.id)}
                          className="text-stone-400 hover:text-rose-600 text-[10px]"
                          title="Remover avaliação de teste"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: CUSTOMER DATABASE (CRM) */}
      {activeTab === 'customers' && (
        <CustomerDatabaseView
          reviews={reviews}
          settings={settings}
          onValidateVoucher={onValidateReward}
          onDeleteCustomer={onDeleteReview}
          onClearAllCustomers={onClearAllReviews}
          onUpdateReviews={onUpdateReviewsList}
        />
      )}

      {/* TAB: WAITERS MANAGEMENT & EVALUATION */}
      {activeTab === 'waiters' && (
        <div className="space-y-6">
          {/* Header & Quick Action */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-stone-900">
                  Gestão & Avaliação Individual de Garçons
                </h3>
              </div>
              <p className="text-xs text-stone-500 max-w-2xl">
                Cadastre a equipe do <strong>{settings.name}</strong> para que os clientes possam avaliá-los pelo nome ou crachá se desejarem. Acompanhe a pontuação média, taxa de excelência e elogios mais recebidos.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {onSaveDatabase && (
                <button
                  type="button"
                  onClick={handleManualSaveDb}
                  disabled={isSavingDb}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Salvar garçons no banco de dados permanente do servidor"
                >
                  <Database className="w-4 h-4" />
                  <span>{isSavingDb ? 'Salvando...' : saveDbStatus ? '✓ Banco Salvo!' : 'Salvar Garçons no Banco'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenAddWaiter}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-200 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Novo Atendente</span>
              </button>
            </div>
          </div>

          {/* Waiters KPI Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[11px] font-bold text-stone-400 uppercase block mb-1">
                Equipe Cadastrada
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-stone-900">
                  {waiterSummary.totalWaiters}
                </span>
                <span className="text-xs text-emerald-600 font-semibold">
                  ({waiterSummary.activeWaiters} ativos)
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[11px] font-bold text-stone-400 uppercase block mb-1">
                Avaliações com Garçom
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-stone-900">
                  {waiterSummary.totalEvaluatedReviews}
                </span>
                <span className="text-xs text-stone-400">
                  de {reviews.length} clientes
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[11px] font-bold text-stone-400 uppercase block mb-1">
                Nota Média da Equipe
              </span>
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                <span className="text-2xl font-extrabold text-stone-900">
                  {waiterSummary.avgTeam > 0 ? `${waiterSummary.avgTeam}` : '-'}
                </span>
                <span className="text-xs text-stone-400">/ 5.0</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
              <span className="text-[11px] font-bold text-stone-400 uppercase block mb-1 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                Destaque do Salão
              </span>
              {waiterSummary.topWaiter ? (
                <div>
                  <div className="text-sm font-bold text-stone-900 truncate">
                    {waiterSummary.topWaiter.waiter.nickname
                      ? `${waiterSummary.topWaiter.waiter.name.split(' ')[0]} (${waiterSummary.topWaiter.waiter.nickname})`
                      : waiterSummary.topWaiter.waiter.name}
                  </div>
                  <div className="text-xs text-amber-600 font-bold flex items-center gap-1">
                    <span>{waiterSummary.topWaiter.avgRating} ★</span>
                    <span className="text-stone-400 font-normal">
                      • {waiterSummary.topWaiter.count} avaliações
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-stone-400">Nenhuma avaliação ainda</span>
              )}
            </div>
          </div>

          {/* Waiters Cards Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-stone-900">
                Lista de Atendentes & Garçons ({waiters.length})
              </h4>
              <span className="text-xs text-stone-500">
                Classificados por status e nota de atendimento
              </span>
            </div>

            {waiterStats.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 text-stone-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-stone-700">
                  Nenhum garçom cadastrado ainda.
                </p>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  Cadastre sua equipe para permitir que os clientes os avaliem diretamente na mesa.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddWaiter}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Primeiro Garçom
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {waiterStats.map(({ waiter, count, avgRating, fiveStarPercent, compliments }) => {
                  return (
                    <div
                      key={waiter.id}
                      className={`bg-white rounded-2xl p-5 border shadow-sm transition hover:shadow-md relative flex flex-col justify-between ${
                        waiter.active ? 'border-stone-200' : 'border-stone-200 bg-stone-50/70 opacity-75'
                      }`}
                    >
                      <div>
                        {/* Top: Avatar, Name, Role & Status Toggle */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base text-white shadow-xs ${
                                waiter.active
                                  ? 'bg-gradient-to-tr from-rose-600 to-amber-600'
                                  : 'bg-stone-400'
                              }`}
                            >
                              {waiter.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-bold text-stone-900 text-sm">
                                  {waiter.name}
                                </h5>
                                {waiter.nickname && (
                                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                    "{waiter.nickname}"
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                                <span>{waiter.role}</span>
                                {waiter.badgeNumber && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono font-medium">Crachá #{waiter.badgeNumber}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Active / Inactive badge button */}
                          <button
                            type="button"
                            onClick={() => handleToggleWaiterActive(waiter.id)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              waiter.active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
                            }`}
                            title="Clique para alternar disponibilidade nas mesas"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                waiter.active ? 'bg-emerald-500' : 'bg-stone-400'
                              }`}
                            />
                            {waiter.active ? 'Ativo no Salão' : 'Inativo'}
                          </button>
                        </div>

                        {/* Middle: Performance Metrics */}
                        <div className="grid grid-cols-3 gap-2 bg-stone-50 rounded-xl p-3 mb-3 border border-stone-100">
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block">
                              Média
                            </span>
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                              <span className="text-xs font-extrabold text-stone-900">
                                {avgRating > 0 ? `${avgRating} ★` : '-'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block">
                              Avaliações
                            </span>
                            <span className="text-xs font-bold text-stone-800">
                              {count} {count === 1 ? 'cliente' : 'clientes'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase block">
                              5 Estrelas
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              {count > 0 ? `${fiveStarPercent}%` : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Compliments received */}
                        {compliments.length > 0 && (
                          <div className="mb-3">
                            <span className="text-[11px] font-semibold text-stone-500 block mb-1.5 flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3 text-amber-500" />
                              Elogios dos Clientes:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {compliments.map((comp) => (
                                <span
                                  key={comp.compliment}
                                  className="text-[11px] bg-amber-50 text-amber-900 border border-amber-200/80 px-2 py-0.5 rounded-md font-medium"
                                >
                                  {comp.compliment}
                                  {comp.freq > 1 && (
                                    <strong className="ml-1 text-amber-700">({comp.freq}x)</strong>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom actions: Edit and Delete */}
                      <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenEditWaiter(waiter)}
                          className="text-stone-600 hover:text-stone-900 font-semibold flex items-center gap-1.5 transition py-1"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-stone-400" />
                          <span>Editar Dados</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteWaiter(waiter)}
                          className="text-stone-400 hover:text-rose-600 font-semibold flex items-center gap-1.5 transition py-1 cursor-pointer"
                          title={`Remover ${waiter.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal for Adding / Editing Waiter */}
          {isWaiterModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-stone-200 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                      <UserCheck className="w-5 h-5" />
                    </span>
                    <h3 className="font-bold text-stone-900 text-base">
                      {editingWaiterId ? 'Editar Dados do Atendente' : 'Cadastrar Garçom / Atendente'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsWaiterModalOpen(false)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveWaiter} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={waiterName}
                      onChange={(e) => setWaiterName(e.target.value)}
                      placeholder="Ex: Carlos Henrique Oliveira"
                      className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Apelido / Crachá
                      </label>
                      <input
                        type="text"
                        value={waiterNickname}
                        onChange={(e) => setWaiterNickname(e.target.value)}
                        placeholder="Ex: Carlinhos"
                        className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Número do Crachá
                      </label>
                      <input
                        type="text"
                        value={waiterBadgeNumber}
                        onChange={(e) => setWaiterBadgeNumber(e.target.value)}
                        placeholder="Ex: 04"
                        className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Cargo / Função
                    </label>
                    <select
                      value={waiterRole}
                      onChange={(e) => setWaiterRole(e.target.value as any)}
                      className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-rose-500 outline-none bg-white font-medium"
                    >
                      <option value="Garçom">Garçom</option>
                      <option value="Garçonete">Garçonete</option>
                      <option value="Atendente">Atendente</option>
                      <option value="Cumim">Cumim</option>
                    </select>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={waiterActive}
                        onChange={(e) => setWaiterActive(e.target.checked)}
                        className="rounded border-stone-300 text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>Ativo no salão (visível para avaliação dos clientes)</span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsWaiterModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
                    >
                      {editingWaiterId ? 'Atualizar Atendente' : 'Salvar Atendente'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VALIDATOR */}
      {activeTab === 'validator' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-1">
              Validador de Brindes das Mesas
            </h3>
            <p className="text-xs text-stone-500 mb-6">
              Quando o cliente apresentar o cupom na mesa ou no caixa, digite o código de 4 dígitos ou código completo para validar a entrega da cortesia.
            </p>

            <form onSubmit={handleValidateSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Ex: BRINDE-8931 ou 8931"
                  className="w-full text-center font-mono text-2xl tracking-widest font-extrabold uppercase p-4 rounded-2xl border-2 border-stone-300 focus:border-rose-500 outline-none shadow-inner"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-200 transition"
              >
                Validar e Marcar como Entregue
              </button>
            </form>

            {validationResult && (
              <div
                className={`mt-5 p-4 rounded-2xl text-xs font-semibold text-left border ${
                  validationResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {validationResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-bold text-sm">
                    {validationResult.success ? 'Brinde Liberado!' : 'Atenção'}
                  </span>
                </div>
                <p>{validationResult.message}</p>
              </div>
            )}
          </div>

          {/* Quick list of recently claimed / unclaimed vouchers */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <h4 className="font-bold text-stone-900 text-sm mb-3">
              Vouchers Emitidos Recentemente
            </h4>
            <div className="space-y-2">
              {reviews.slice(0, 5).map((rev) => (
                <div
                  key={rev.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-stone-800 mr-2">
                      {rev.rewardCode}
                    </span>
                    <span className="font-semibold text-stone-600">
                      Mesa #{rev.tableNumber} - {rev.rewardTitle}
                    </span>
                  </div>
                  <div>
                    {rev.rewardClaimed ? (
                      <span className="text-[10px] text-stone-500 font-bold bg-stone-200 px-2 py-0.5 rounded-full">
                        Entregue
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onValidateReward(rev.rewardCode)}
                        className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition"
                      >
                        Validar Agora
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REWARDS MANAGEMENT */}
      {activeTab === 'rewards' && (
        <div className="space-y-6">
          {/* Top Settings: Roulette vs Fixed */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-stone-900 text-base">Modo de Premiação dos Brindes</h3>
              <p className="text-xs text-stone-500">
                Escolha se o cliente gira uma roleta da sorte com múltiplos prêmios ou ganha um brinde fixo definido por você.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, activeRewardMode: 'wheel' })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  settings.activeRewardMode === 'wheel'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Roleta da Sorte
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, activeRewardMode: 'fixed' })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  settings.activeRewardMode === 'fixed'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Brinde Fixo
              </button>
            </div>
          </div>

          {/* List of Active Rewards */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-stone-900 text-base">
                  Cardápio de Brindes Cadastrados
                </h3>
                <p className="text-xs text-stone-500">
                  Configure as cortesias e a probabilidade de cada uma sair na roleta da sorte.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onSaveDatabase && (
                  <button
                    type="button"
                    onClick={handleManualSaveDb}
                    disabled={isSavingDb}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Salvar brindes no banco de dados permanente do servidor"
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>{isSavingDb ? 'Salvando...' : saveDbStatus ? '✓ Salvo!' : 'Salvar Brindes no Banco'}</span>
                  </button>
                )}
                <div className="text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-lg">
                  Total de peso ativo: {rewards.filter((r) => r.enabled).reduce((acc, curr) => acc + (curr.probabilityWeight || 10), 0)} pts
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.map((rew) => {
                const totalActiveWeight = rewards
                  .filter((r) => r.enabled)
                  .reduce((acc, curr) => acc + (curr.probabilityWeight || 10), 0);
                const weight = rew.probabilityWeight || 10;
                const pctChance = totalActiveWeight > 0 ? Math.round((weight / totalActiveWeight) * 100) : 0;
                const isLowest = pctChance <= 10;
                const isHighest = pctChance >= 35;

                return (
                  <div
                    key={rew.id}
                    className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                      rew.enabled
                        ? isLowest
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-stone-200 bg-white'
                        : 'border-stone-200 bg-stone-50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-900 text-sm">{rew.title}</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                              {rew.category}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500">{rew.description}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleReward(rew.id)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition ${
                              rew.enabled
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                            }`}
                          >
                            {rew.enabled ? 'Ativo' : 'Pausado'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReward(rew)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 transition cursor-pointer"
                            title="Excluir brinde"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Probability Badge */}
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {isLowest ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            🎯 Probabilidade Mais Baixa ({pctChance}%)
                          </span>
                        ) : isHighest ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                            ✨ Probabilidade Alta ({pctChance}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300">
                            🎲 Probabilidade Média ({pctChance}%)
                          </span>
                        )}
                        <span className="text-[11px] text-stone-500 font-mono">
                          (peso: {weight})
                        </span>
                      </div>
                    </div>

                    {/* Quick Probability Controls */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] font-semibold text-stone-500">
                        Chance de sair:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateRewardWeight(rew.id, 5)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                            weight <= 5
                              ? 'bg-amber-600 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                          title="Chance mais baixa (~5%)"
                        >
                          Mais Baixa (5%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRewardWeight(rew.id, 20)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                            weight === 20
                              ? 'bg-blue-600 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                          title="Chance média (~20%)"
                        >
                          Média (20%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRewardWeight(rew.id, 45)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                            weight >= 45
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                          title="Chance alta (~45%)"
                        >
                          Alta (45%)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form: Add New Reward */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
            <h4 className="font-bold text-stone-900 text-sm mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-rose-600" />
              Adicionar Novo Brinde / Cortesia
            </h4>

            <form onSubmit={handleAddReward} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Nome do Brinde
                </label>
                <input
                  type="text"
                  value={newRewardTitle}
                  onChange={(e) => setNewRewardTitle(e.target.value)}
                  placeholder="Ex: Taça de Vinho Tinto da Casa"
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Categoria
                </label>
                <select
                  value={newRewardCategory}
                  onChange={(e) => setNewRewardCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                >
                  <option value="dessert">Sobremesa</option>
                  <option value="drink">Bebida / Café</option>
                  <option value="appetizer">Entrada / Petisco</option>
                  <option value="discount">Desconto %</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Probabilidade
                </label>
                <select
                  value={newRewardWeight}
                  onChange={(e) => setNewRewardWeight(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                >
                  <option value={5}>Mais Baixa (~5%)</option>
                  <option value={20}>Média (~20%)</option>
                  <option value={45}>Alta (~45%)</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Descrição / Instrução de Consumo
                </label>
                <input
                  type="text"
                  value={newRewardDesc}
                  onChange={(e) => setNewRewardDesc(e.target.value)}
                  placeholder="Ex: Válido para consumo de hoje na mesa ou taça de cortesia."
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
                />
              </div>

              <div className="sm:col-span-4 pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Salvar Brinde
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-900 text-base mb-2">
            Dados do Estabelecimento & Mesas
          </h3>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nome do Restaurante
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => onUpdateSettings({ ...settings, name: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Slogan / Mensagem de Boas-Vindas
            </label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => onUpdateSettings({ ...settings, tagline: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Cor principal da empresa</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.primaryColor || '#e11d48'} onChange={(e) => onUpdateSettings({ ...settings, primaryColor: e.target.value })} className="h-10 w-14 rounded-lg border border-stone-200 p-1 bg-white" />
                <input type="text" value={settings.primaryColor || '#e11d48'} onChange={(e) => onUpdateSettings({ ...settings, primaryColor: e.target.value })} className="flex-1 text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Cor do destaque / cabeçalho</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.secondaryColor || '#7f1d1d'} onChange={(e) => onUpdateSettings({ ...settings, secondaryColor: e.target.value })} className="h-10 w-14 rounded-lg border border-stone-200 p-1 bg-white" />
                <input type="text" value={settings.secondaryColor || '#7f1d1d'} onChange={(e) => onUpdateSettings({ ...settings, secondaryColor: e.target.value })} className="flex-1 text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none font-mono" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">URL da logomarca</label>
            <input type="url" value={settings.logoUrl || ''} onChange={(e) => onUpdateSettings({ ...settings, logoUrl: e.target.value })} placeholder="https://.../logo.png" className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none" />
            {settings.logoUrl && <div className="mt-2 flex items-center gap-2"><img src={settings.logoUrl} alt="Prévia da logo" className="w-12 h-12 rounded-xl object-cover border border-stone-200"/><span className="text-[11px] text-stone-400">Prévia da logomarca</span></div>}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <div>
              <h4 className="text-xs font-black text-stone-800">Texto da página de avaliação</h4>
              <p className="text-[11px] text-stone-500">Cada empresa pode usar sua própria chamada para os clientes.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Título</label>
              <input type="text" value={settings.evaluationTitle || 'Como foi sua experiência hoje?'} onChange={(e) => onUpdateSettings({ ...settings, evaluationTitle: e.target.value })} className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Descrição</label>
              <textarea rows={3} value={settings.evaluationDescription || 'Adoramos ter você aqui! Conte para nós o que achou da sua visita e receba um mimo especial em agradecimento.'} onChange={(e) => onUpdateSettings({ ...settings, evaluationDescription: e.target.value })} className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none resize-y" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Ícone da avaliação (1 a 5)
            </label>
            <p className="text-[11px] text-stone-400 mb-3">
              Escolha o símbolo que seus clientes tocarão para dar as notas.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([
                ['star', 'Estrelas'],
                ['coxinha', 'Coxinhas'],
                ['brigadeiro', 'Brigadeiros'],
                ['cake', 'Fatias de bolo'],
                ['pizza', 'Fatias de pizza'],
              ] as [RatingIconType, string][]).map(([value, label]) => {
                const selected = (settings.ratingIcon || 'coxinha') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, ratingIcon: value })}
                    className={`rounded-xl border p-3 flex flex-col items-center gap-2 text-[11px] font-bold transition ${
                      selected
                        ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-100'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <RatingChoiceIcon
                      type={value}
                      filled
                      className={`w-8 h-8 ${selected ? 'text-rose-600' : 'text-stone-500'}`}
                    />
                    <span className="text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-stone-800">Destaques Rápidos</label>
                <p className="text-[11px] text-stone-500 mt-1">
                  Edite as opções que aparecem para o cliente tocar durante a avaliação.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-stone-500 bg-white border border-stone-200 rounded-full px-2 py-1 whitespace-nowrap">
                {quickTagsOptions.length}/20
              </span>
            </div>

            <div className="space-y-2">
              {quickTagsOptions.map((tag, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tag}
                    maxLength={60}
                    onChange={(e) => updateQuickTag(index, e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-rose-500 outline-none"
                    placeholder={`Destaque ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeQuickTag(index)}
                    className="shrink-0 w-9 h-9 rounded-xl border border-stone-200 bg-white text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition"
                    title="Excluir destaque"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addQuickTag}
              disabled={quickTagsOptions.length >= 20}
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar destaque
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Total de Mesas no Salão
            </label>
            <input
              type="number"
              min="1"
              max="150"
              value={settings.totalTables}
              onChange={(e) =>
                onUpdateSettings({ ...settings, totalTables: Math.max(1, Number(e.target.value)) })
              }
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Usado para gerar as plaquinhas de QR Code numeradas.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
              <span>Carência para Liberação do Brinde (Horas)</span>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Padrão: 24 horas
              </span>
            </label>
            <input
              type="number"
              min="0"
              max="720"
              value={settings.rewardDelayHours ?? 24}
              onChange={(e) =>
                onUpdateSettings({ ...settings, rewardDelayHours: Math.max(0, Number(e.target.value)) })
              }
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none font-bold text-stone-800"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Tempo mínimo de espera para o brinde sorteado ser ativado para consumo (24 horas após o sorteio).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
              <span>Validade dos Vouchers de Brinde (Dias)</span>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Configurado: {settings.rewardValidityDays || 15} dias
              </span>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.rewardValidityDays || 15}
              onChange={(e) =>
                onUpdateSettings({ ...settings, rewardValidityDays: Math.max(1, Number(e.target.value)) })
              }
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 focus:border-rose-500 outline-none font-bold text-stone-800"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Prazo limite em que o cliente pode resgatar seu brinde com a equipe após o sorteio ({settings.rewardValidityDays || 15} dias).
            </p>
          </div>

          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div>
              <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Integração e Envio para WhatsApp</span>
              </label>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Defina como os vouchers de cortesia serão entregues aos clientes no WhatsApp.
              </p>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
              <div className="flex items-start gap-2.5 text-stone-800 text-xs bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950">
                    Meta WhatsApp Cloud API
                  </p>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    O sistema dispara a mensagem do voucher automaticamente para o cliente via <strong>Meta Cloud API</strong>, sem abrir tela no celular dele.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  URL da Meta Cloud API
                </label>
                <input
                  type="url"
                  value={settings.whatsappApiUrl || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, whatsappApiUrl: e.target.value })}
                  placeholder="https://graph.facebook.com/v25.0/SEU_PHONE_NUMBER_ID/messages"
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-rose-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Token de Acesso da Meta
                </label>
                <input
                  type="password"
                  value={settings.whatsappApiToken || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, whatsappApiToken: e.target.value })}
                  placeholder="Cole o Token de Acesso da Meta"
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-rose-500 outline-none font-mono"
                />
              </div>

                {/* Template fallback for customers outside 24h window */}
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-blue-950">
                        Template de Notificação (avaliacao_brinde)
                      </p>
                      <p className="text-[10px] text-blue-800/80 leading-relaxed">
                        Quando uma avaliação e concluída, o sistema envia este template aprovado pela Meta. O cliente responde SIM e o brinde e enviado automaticamente.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">Nome do Template</label>
                      <input
                        type="text"
                        value={settings.whatsappTemplateName || ''}
                        onChange={(e) => onUpdateSettings({ ...settings, whatsappTemplateName: e.target.value })}
                        placeholder="avaliacao_brinde"
                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-rose-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">Idioma (codigo)</label>
                      <input
                        type="text"
                        value={settings.whatsappTemplateLanguage || ''}
                        onChange={(e) => onUpdateSettings({ ...settings, whatsappTemplateLanguage: e.target.value })}
                        placeholder="pt_BR"
                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-rose-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Explicit WhatsApp API Save Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="text-[11px] text-stone-500">
                    {settings.whatsappApiUrl ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        URL configurada no sistema
                      </span>
                    ) : (
                      <span>Preencha os dados e clique em Salvar para gravar no banco de dados.</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveWhatsAppApi}
                    disabled={isSavingWhatsApp}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingWhatsApp ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Salvando no Banco...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Salvar Dados da API no Banco</span>
                      </>
                    )}
                  </button>
                </div>

                {whatsappSavedSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✓ Dados da API do WhatsApp salvos com sucesso no banco de dados permanente! Não serão resetados.</span>
                  </div>
                )}

                {/* Clean Official Message Preview */}
                <div className="p-3.5 bg-white border border-stone-200 rounded-xl space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Texto Oficial Enviado pelo Sistema (100% Limpo, sem "Teste" ou "Desconsiderar"):
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Oficial Formatado
                    </span>
                  </div>
                  <div className="space-y-2">
                    <textarea
                      rows={13}
                      value={settings.voucherMessageTemplate || DEFAULT_VOUCHER_TEMPLATE}
                      onChange={(e) => onUpdateSettings({ ...settings, voucherMessageTemplate: e.target.value })}
                      className="w-full p-3 bg-white rounded-lg border border-stone-200 text-[11px] font-mono text-stone-800 leading-relaxed outline-none focus:border-rose-500 resize-y"
                    />
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-600">
                      <span className="font-bold">Campos automáticos:</span>
                      {['{{cliente}}','{{empresa}}','{{brinde}}','{{codigo}}','{{inicio}}','{{expira}}','{{validade_dias}}'].map((tag) => (
                        <code key={tag} className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200">{tag}</code>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, voucherMessageTemplate: DEFAULT_VOUCHER_TEMPLATE })}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-[10px] font-bold text-stone-700"
                      >
                        Restaurar texto padrão
                      </button>
                      <span className="text-[10px] text-stone-500">Clique em “Salvar Dados da API no Banco” para gravar.</span>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-[11px] font-mono text-stone-800 whitespace-pre-wrap leading-relaxed">
                      {renderVoucherPreview(settings.voucherMessageTemplate || DEFAULT_VOUCHER_TEMPLATE, settings)}
                    </div>
                  </div>
                </div>

                {/* Meta Cloud API Info */}
                <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-xl text-xs space-y-3 text-blue-950">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 text-sm">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Meta WhatsApp Cloud API Oficial</span>
                  </div>
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-[11px] space-y-1.5 text-amber-950 leading-relaxed">
                    <p className="font-bold text-amber-900">
                      Como funciona o novo fluxo de envio
                    </p>
                    <p>O sistema envia o template <strong>avaliacao_brinde</strong> assim que o cliente termina a avaliação. O cliente responde <strong>SIM</strong> no WhatsApp, o que abre a janela de 24h da Meta. O sistema então envia automaticamente os detalhes do brinde conquistado.</p>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-amber-900/90">
                      <li><strong>Cliente novo:</strong> Recebe o template, responde SIM e ganha o brinde por mensagem normal.</li>
                      <li><strong>Cliente que já conversou:</strong> Recebe o template e o brinde após responder SIM.</li>
                      <li><strong>Proteção contra duplicidade:</strong> Webhooks repetidos são ignorados automaticamente.</li>
                    </ul>
                    <p className="pt-1.5 text-[10px] text-blue-900 bg-blue-50/80 border border-blue-200 rounded-lg p-2">
                      <strong>Configuração necessária na Meta:</strong> Configure o webhook em Gerenciador da Meta &gt; WhatsApp &gt; Configuração do Webhook. URL: <code>https://seu-dominio/api/whatsapp-webhook</code>. Token de verificação: <code>srcoxita_webhook_2026</code>. Inscreva-se no campo <strong>messages</strong>.
                    </p>
                  </div>
                </div>

                {/* Interactive Test Tool */}
                <div className="pt-3 border-t border-stone-200 space-y-2.5">
                  <label className="block text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Enviar Mensagem Oficial para Meu WhatsApp</span>
                  </label>
                  <p className="text-[11px] text-stone-500">
                    Digite seu número abaixo e clique para testar o envio.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="DDD + Telefone (ex: 82993259566)"
                      className="flex-1 text-xs p-2.5 rounded-xl border border-stone-200 bg-white focus:border-rose-500 outline-none font-bold text-stone-900"
                    />
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                      <button
                        type="button"
                        onClick={handleTestWhatsApp}
                        disabled={isTestingWhatsApp || isTestingMetaTemplate}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                        title="Envia a mensagem oficial completa do voucher"
                      >
                        {isTestingWhatsApp ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Phone className="w-3.5 h-3.5 fill-white" />
                            <span>Enviar Texto do Voucher</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleTestMetaTemplate}
                        disabled={isTestingWhatsApp || isTestingMetaTemplate}
                        className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Testa envio do template 'avaliacao_brinde' aprovado pela Meta"
                      >
                        {isTestingMetaTemplate ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Disparando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Testar Template Meta (avaliacao_brinde)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {testWhatsAppResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs leading-relaxed ${
                        testWhatsAppResult.success
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-rose-50 border-rose-300 text-rose-900'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {testWhatsAppResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <strong className="block font-bold">
                            {testWhatsAppResult.success ? 'Envio Concluído com Sucesso!' : 'Falha no Envio'}
                          </strong>
                          <span>{testWhatsAppResult.message}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>

          {/* Security & Access Protection Card */}
          <div className="p-5 sm:p-6 bg-white rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl shadow-xs">
                  <KeyRound className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base flex items-center gap-2">
                    <span>Segurança e Senha de Acesso do Painel</span>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Protegido
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Define a senha necessária para desbloquear o Painel da Gerência e as Placas QR.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-stone-100 rounded-xl border border-stone-200 text-xs font-mono font-bold text-stone-700 flex items-center gap-2">
                  <span className="text-[10px] text-stone-400 font-sans font-semibold">Senha Atual:</span>
                  <span>{showCurrentPinValue ? (settings.managerPin || '1234') : '••••'}</span>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPinValue(!showCurrentPinValue)}
                    className="p-1 hover:text-stone-900 text-stone-400 transition cursor-pointer"
                    title={showCurrentPinValue ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                  >
                    {showCurrentPinValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleSaveNewPin} className="p-4 sm:p-5 bg-stone-50/80 rounded-2xl border border-stone-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Nova Senha de Acesso
                  </label>
                  <div className="relative">
                    <input
                      type={showPinPassword ? 'text' : 'password'}
                      value={pinFormValue}
                      onChange={(e) => {
                        setPinFormValue(e.target.value);
                        if (pinFeedback) setPinFeedback(null);
                      }}
                      maxLength={12}
                      placeholder="Ex: 4892 ou senha2026"
                      className="w-full text-sm font-mono font-bold p-3 pr-10 rounded-xl border border-stone-300 bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinPassword(!showPinPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPinPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Mínimo de 3 dígitos ou letras.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type={showPinPassword ? 'text' : 'password'}
                    value={pinConfirmValue}
                    onChange={(e) => {
                      setPinConfirmValue(e.target.value);
                      if (pinFeedback) setPinFeedback(null);
                    }}
                    maxLength={12}
                    placeholder="Repita a nova senha"
                    className="w-full text-sm font-mono font-bold p-3 rounded-xl border border-stone-300 bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Digite exatamente a mesma senha.
                  </p>
                </div>
              </div>

              {/* Feedback messages */}
              {pinFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    pinFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {pinFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{pinFeedback.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResetDefaultPin}
                  disabled={isSavingPin}
                  className="text-xs text-stone-500 hover:text-stone-700 underline font-medium cursor-pointer self-start sm:self-auto"
                >
                  Restaurar Senha Padrão (1234)
                </button>

                <button
                  type="submit"
                  disabled={isSavingPin || !pinFormValue}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSavingPin ? 'Salvando no Banco...' : 'Salvar Nova Senha no Banco de Dados'}</span>
                </button>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 mt-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Persistência Garantida:</strong> A nova senha é gravada permanentemente no arquivo do servidor e sincronizada. Mesmo se você recarregar a página, fechar a aba ou reiniciar, a sua nova senha permanecerá ativa.
                </span>
              </div>
            </form>
          </div>

          {/* General Save Settings Action */}
          {onSaveDatabase && (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-stone-800">
                  Salvar Todas as Configurações do Restaurante
                </h4>
                <p className="text-[11px] text-stone-500">
                  Grava imediatamente o nome do restaurante, carência de brindes, mesas e WhatsApp no servidor.
                </p>
              </div>
              <button
                type="button"
                onClick={handleManualSaveDb}
                disabled={isSavingDb}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingDb ? 'Salvando...' : saveDbStatus ? '✓ Configurações Salvas!' : 'Salvar Configurações no Banco'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clear Reviews Confirmation Modal */}
      {showClearReviewsModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                Limpar Todas as Avaliações e Registros?
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Esta ação irá apagar todas as avaliações de clientes recebidas, zerando o painel de métricas e a base de vouchers.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Esta operação é definitiva. Os registros anteriores serão excluídos do sistema.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearReviewsModal(false)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearReviewsModal(false);
                  if (onClearAllReviews) {
                    onClearAllReviews();
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Limpar Todas</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Waiter Confirmation Modal */}
      {waiterToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                Excluir Atendente?
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Deseja remover <strong>{waiterToDelete.name}</strong> ({waiterToDelete.role}) da lista de atendentes ativos?
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-[11px] text-stone-600">
              <span>As avaliações e notas registradas anteriormente para este atendente serão preservadas no histórico do restaurante.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWaiterToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteWaiter}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Reward Confirmation Modal */}
      {rewardToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                Excluir Brinde?
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Deseja remover <strong>{rewardToDelete.title}</strong> da roleta de prêmios?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRewardToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteReward}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Brinde</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward Warning Modal */}
      {rewardWarningMessage && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                Atenção
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {rewardWarningMessage}
              </p>
            </div>

            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={() => setRewardWarningMessage(null)}
                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

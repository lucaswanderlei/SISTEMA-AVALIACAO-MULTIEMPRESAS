import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Phone,
  Calendar,
  Gift,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  Star,
  MessageSquare,
  ThumbsUp,
  Filter,
  Check,
  RotateCcw,
  Flame,
  Send,
  Copy,
  Sparkles,
  AlertTriangle,
  BellRing,
  Trash2,
  X,
} from 'lucide-react';
import { Review, RestaurantSettings } from '../types';
import { apiTriggerExpiringNotifications } from '../lib/api';

interface CustomerDatabaseViewProps {
  reviews: Review[];
  settings: RestaurantSettings;
  onValidateVoucher: (rewardCode: string) => void;
  onDeleteCustomer?: (id: string) => void;
  onClearAllCustomers?: () => void;
  onUpdateReviews?: (updated: Review[]) => void;
}

export const CustomerDatabaseView: React.FC<CustomerDatabaseViewProps> = ({
  reviews,
  settings,
  onValidateVoucher,
  onDeleteCustomer,
  onClearAllCustomers,
  onUpdateReviews,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expiring_1d' | 'expiring_5d' | 'pending_24h' | 'available' | 'claimed' | 'expired'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Review | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Review | null>(null);
  const [sendingApiId, setSendingApiId] = useState<string | null>(null);
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);
  const [triggeringExpiring, setTriggeringExpiring] = useState<boolean>(false);
  const [expiringSuccessNotice, setExpiringSuccessNotice] = useState<string | null>(null);
  const [whatsappModalCustomer, setWhatsappModalCustomer] = useState<{
    customerName: string;
    phone: string;
    rewardTitle: string;
    code: string;
    daysLeft: number;
    expiryDate: Date;
    availableFrom?: string;
    createdAt?: string;
    reminderType: '5_days' | '1_day';
  } | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const nowMs = Date.now();

  // Helper to determine customer voucher status
  const getCustomerStatus = (r: Review) => {
    if (r.rewardClaimed) return 'claimed';
    
    // Check expiration
    const validityMs = (settings.rewardValidityDays ?? 15) * 24 * 60 * 60 * 1000;
    const expiry = r.expiresAt
      ? new Date(r.expiresAt).getTime()
      : new Date(new Date(r.createdAt).getTime() + validityMs).getTime();
    if (nowMs > expiry) return 'expired';

    // Check 24h delay
    const availableFrom = r.availableFrom
      ? new Date(r.availableFrom).getTime()
      : new Date(new Date(r.createdAt).getTime() + 24 * 60 * 60 * 1000).getTime();
    if (nowMs < availableFrom) return 'pending_24h';

    return 'available';
  };

  // Helper to check if voucher is expiring within 5 days or 1 day (not claimed and not already expired)
  const getExpiringDaysInfo = (r: Review) => {
    if (r.rewardClaimed) return null;
    const validityDays = settings.rewardValidityDays ?? 15;
    const validityMs = validityDays * 24 * 60 * 60 * 1000;
    const expiry = r.expiresAt
      ? new Date(r.expiresAt).getTime()
      : new Date(new Date(r.createdAt).getTime() + validityMs).getTime();
    const diffMs = expiry - nowMs;
    if (diffMs <= 0) return null; // Already expired

    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    if (diffMs <= fiveDaysMs) {
      const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      const hoursLeft = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)));
      const isOneDayLeft = daysLeft <= 1;
      const isFiveDaysLeft = daysLeft <= 5 && !isOneDayLeft;

      return {
        isExpiringSoon: true,
        daysLeft,
        hoursLeft,
        expiryDate: new Date(expiry),
        isOneDayLeft,
        isFiveDaysLeft,
        isUrgent: isOneDayLeft,
      };
    }
    return null;
  };

  // 5-day expiration polite reminder text
  const get5DaysExpiringWhatsAppText = (
    customerName: string,
    rewardTitle: string,
    code: string,
    daysLeft: number,
    expiryDate: Date
  ) => {
    const firstName = customerName?.trim().split(' ')[0] || 'Cliente';
    const formattedExpiryDate = expiryDate.toLocaleDateString('pt-BR');
    const daysStr = daysLeft === 5 ? '5 DIAS' : `${daysLeft} dias`;

    return (
      `*LEMBRETE DE CORTESIA - ${settings.name.toUpperCase()}* 🥟⏳\n\n` +
      `Olá ${firstName}! Tudo bem? Passando para te avisar com carinho que o seu brinde exclusivo da roleta (*${rewardTitle}*, código: *${code}*) VAI EXPIRAR EM ${daysStr}!\n\n` +
      `📅 *Prazo Limite:* Válido até ${formattedExpiryDate} (restam ${daysLeft} dias).\n` +
      `🎟️ *Código de Resgate:* ${code}\n` +
      `⚠️ *Regra:* Válido 1 cortesia por mesa.\n\n` +
      `Não deixe sua cortesia vencer! Venha nos visitar esta semana e saboreie seu presente no ${settings.name}. Esperamos você com muito carinho! 💛`
    );
  };

  // 1-day expiration urgent notification text
  const get1DayExpiringWhatsAppText = (
    customerName: string,
    rewardTitle: string,
    code: string,
    expiryDate: Date
  ) => {
    const firstName = customerName?.trim().split(' ')[0] || 'Cliente';
    const formattedExpiryDate = expiryDate.toLocaleDateString('pt-BR');

    return (
      `🚨 *ÚLTIMA CHANCE: SEU BRINDE EXPIRA AMANHÃ!* 🥟🔥\n\n` +
      `Olá ${firstName}! Aqui é do ${settings.name}.\n\n` +
      `⚠️ O prazo de ${settings.rewardValidityDays ?? 15} dias para resgate do seu brinde exclusivo (*${rewardTitle}*, código: *${code}*) VENCE AMANHÃ (${formattedExpiryDate})!\n\n` +
      `⏰ Amanhã é o ÚLTIMO DIA para resgatar seu presente antes que o código seja cancelado automaticamente pelo sistema.\n` +
      `🎟️ *Código de Resgate:* ${code}\n` +
      `⚠️ *Regra:* Válido 1 cortesia por mesa.\n\n` +
      `Apresente este código ao garçom amanhã no restaurante e garanta sua cortesia especial. Te esperamos! 💛`
    );
  };

  // Unified expiration WhatsApp text generator
  const getExpiringWhatsAppText = (
    customerName: string,
    rewardTitle: string,
    code: string,
    daysLeft: number,
    expiryDate: Date,
    type?: '5_days' | '1_day'
  ) => {
    if (type === '1_day' || daysLeft <= 1) {
      return get1DayExpiringWhatsAppText(customerName, rewardTitle, code, expiryDate);
    }
    return get5DaysExpiringWhatsAppText(customerName, rewardTitle, code, daysLeft, expiryDate);
  };

  // Generate WhatsApp message link for expiring reminder
  const getExpiringWhatsAppLink = (
    customerName: string,
    phone: string,
    rewardTitle: string,
    code: string,
    daysLeft: number,
    expiryDate: Date,
    type?: '5_days' | '1_day'
  ) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = getExpiringWhatsAppText(customerName, rewardTitle, code, daysLeft, expiryDate, type);
    return `https://wa.me/${phoneWithDDI}?text=${encodeURIComponent(text)}`;
  };

  // Customers data filtered
  const filteredCustomers = useMemo(() => {
    return reviews.filter((r) => {
      // Must have at least name or phone to be considered registered customer, but we show all review respondents
      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matchesName = r.customerName?.toLowerCase().includes(term);
        const matchesPhone = r.customerPhone?.toLowerCase().includes(term);
        const matchesCode = r.rewardCode.toLowerCase().includes(term);
        const matchesReward = r.rewardTitle.toLowerCase().includes(term);
        const matchesWaiter = r.waiterName?.toLowerCase().includes(term);
        if (!matchesName && !matchesPhone && !matchesCode && !matchesReward && !matchesWaiter) {
          return false;
        }
      }

      if (statusFilter === 'expiring_1d') {
        const expInfo = getExpiringDaysInfo(r);
        if (!expInfo || !expInfo.isOneDayLeft) return false;
      } else if (statusFilter === 'expiring_5d') {
        const expInfo = getExpiringDaysInfo(r);
        if (!expInfo || !expInfo.isFiveDaysLeft) return false;
      } else if (statusFilter !== 'all') {
        const status = getCustomerStatus(r);
        if (status !== statusFilter) return false;
      }

      return true;
    });
  }, [reviews, searchTerm, statusFilter, nowMs]);

  // Key metrics
  const metrics = useMemo(() => {
    const total = reviews.length;
    let withPhone = 0;
    let pending24h = 0;
    let available = 0;
    let claimed = 0;
    let expired = 0;
    let expiringIn5Days = 0;
    let expiringIn1Day = 0;

    reviews.forEach((r) => {
      if (r.customerPhone && r.customerPhone.trim().length >= 8) withPhone++;
      const st = getCustomerStatus(r);
      if (st === 'pending_24h') pending24h++;
      else if (st === 'available') available++;
      else if (st === 'claimed') claimed++;
      else if (st === 'expired') expired++;

      const expInfo = getExpiringDaysInfo(r);
      if (expInfo) {
        if (expInfo.isOneDayLeft) {
          expiringIn1Day++;
        } else if (expInfo.isFiveDaysLeft) {
          expiringIn5Days++;
        }
      }
    });

    return { total, withPhone, pending24h, available, claimed, expired, expiringIn5Days, expiringIn1Day };
  }, [reviews, nowMs]);

  // Export to CSV functionality
  const handleExportCSV = () => {
    if (reviews.length === 0) return;

    const headers = [
      'Nome do Cliente',
      'WhatsApp',
      'Mesa',
      'Garçom Avaliado',
      'Nota Atendimento',
      'Nota Ambiente',
      'Nota Produtos',
      'Nota Tempo de Espera',
      'Média Geral',
      'Elogios do Atendimento',
      'Crítica',
      'Sugestão',
      'Brinde Sorteado',
      'Código Voucher',
      'Status Voucher',
      'Data da Avaliação',
      'Liberado a Partir de (24h)',
      `Validade Limite (${settings.rewardValidityDays || 15} dias)`,
      'Data de Resgate',
    ];

    const rows = reviews.map((r) => {
      const st = getCustomerStatus(r);
      const statusLabel =
        st === 'claimed'
          ? 'Resgatado'
          : st === 'pending_24h'
          ? 'Aguardando 24h'
          : st === 'available'
          ? 'Liberado para Uso'
          : 'Expirado';

      const avg = (
        (r.ratings.service + r.ratings.ambiance + r.ratings.products + r.ratings.waitTime) /
        4
      ).toFixed(1);

      const compliments = r.waiterCompliments?.join('; ') || r.waiterCompliment || '';

      const escapeCSV = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      return [
        escapeCSV(r.customerName || 'Não informado'),
        escapeCSV(r.customerPhone || 'Não informado'),
        escapeCSV(r.tableNumber ? `Mesa ${r.tableNumber}` : 'Balcão/Sem Mesa'),
        escapeCSV(r.waiterName || 'Não selecionado'),
        r.ratings.service,
        r.ratings.ambiance,
        r.ratings.products,
        r.ratings.waitTime,
        avg,
        escapeCSV(compliments),
        escapeCSV(r.criticism || ''),
        escapeCSV(r.suggestion || ''),
        escapeCSV(r.rewardTitle),
        escapeCSV(r.rewardCode),
        escapeCSV(statusLabel),
        escapeCSV(new Date(r.createdAt).toLocaleString('pt-BR')),
        escapeCSV(r.availableFrom ? new Date(r.availableFrom).toLocaleString('pt-BR') : ''),
        escapeCSV(r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('pt-BR') : ''),
        escapeCSV(r.claimedAt ? new Date(r.claimedAt).toLocaleString('pt-BR') : ''),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `base_clientes_${settings.name.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Trigger expiring notifications in batch
  const handleTriggerExpiringBatch = async (type?: '5_days' | '1_day') => {
    setTriggeringExpiring(true);
    setExpiringSuccessNotice(null);
    try {
      const res = await apiTriggerExpiringNotifications({ type });
      if (res.success) {
        setExpiringSuccessNotice(res.message);
        if (res.reviews && onUpdateReviews) {
          onUpdateReviews(res.reviews);
        }
        setTimeout(() => setExpiringSuccessNotice(null), 6000);
      } else {
        alert(res.message || 'Não foi possível disparar as notificações');
      }
    } catch (err: any) {
      alert('Erro ao disparar notificações: ' + (err?.message || 'erro'));
    } finally {
      setTriggeringExpiring(false);
    }
  };

  // Trigger notification for a single customer card
  const handleSingleCustomerNotify = async (
    cust: Review,
    type: '5_days' | '1_day'
  ) => {
    setSendingApiId(cust.id);
    try {
      const res = await apiTriggerExpiringNotifications({
        reviewId: cust.id,
        type,
      });
      if (res.success) {
        setSentSuccessId(cust.id);
        if (res.reviews && onUpdateReviews) {
          onUpdateReviews(res.reviews);
        }
        setTimeout(() => setSentSuccessId(null), 3500);
      }
    } catch (err) {
      console.warn('Notification trigger error', err);
    } finally {
      setSendingApiId(null);
    }
  };

  // Generate WhatsApp message link with start date, expiration date, and 1 per table rule
  const getWhatsAppLink = (
    customerName: string,
    phone: string,
    rewardTitle: string,
    code: string,
    availableFrom?: string,
    expiresAt?: string,
    createdAt?: string
  ) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const firstName = customerName.split(' ')[0] || 'Cliente';

    // Calculate start & expiry dates
    const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now();
    const availableDate = availableFrom
      ? new Date(availableFrom)
      : new Date(createdTime + (settings.rewardDelayHours ?? 24) * 60 * 60 * 1000);
    const expiryDate = expiresAt
      ? new Date(expiresAt)
      : new Date(createdTime + (settings.rewardValidityDays ?? 15) * 24 * 60 * 60 * 1000);

    const formattedAvailable = availableDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const formattedExpiry = expiryDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const validityDaysText = settings.rewardValidityDays ?? 15;

    const message = encodeURIComponent(
      `Olá ${firstName}! Tudo bem? Aqui é do ${settings.name} 🥟✨\n\n` +
      `Passando para agradecer muito a sua avaliação! O seu brinde especial da roleta (*${rewardTitle}*, código *${code}*) já está confirmado no nosso sistema.\n\n` +
      `📅 *Prazo de Início:* Liberado para resgate a partir de ${formattedAvailable} (24h após a avaliação).\n` +
      `⏳ *Prazo para Expirar:* Válido até ${formattedExpiry} (${validityDaysText} dias de prazo para resgate).\n` +
      `⚠️ *Regra:* É válido utilizar apenas 1 cortesia/brinde por mesa.\n\n` +
      `Esperamos você em breve para saborear sua cortesia! Se desejar reservar uma mesa, é só nos responder aqui. 💛`
    );
    return `https://wa.me/${phoneWithDDI}?text=${message}`;
  };

  return (
    <div id="customer-database-view" className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-black text-stone-900 leading-none">{metrics.total}</div>
            <div className="text-xs text-stone-500 font-medium mt-1">Clientes Avaliadores</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-black text-stone-900 leading-none">{metrics.withPhone}</div>
            <div className="text-xs text-stone-500 font-medium mt-1">WhatsApps Capturados</div>
          </div>
        </div>

        {/* 5-Day Expiring KPI Highlight */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'expiring_5d' ? 'all' : 'expiring_5d')}
          className={`rounded-2xl p-4 border transition cursor-pointer shadow-xs flex items-center gap-3.5 ${
            metrics.expiringIn5Days > 0
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-200 hover:bg-amber-100/70'
              : 'bg-white border-stone-200'
          }`}
          title="Clique para filtrar clientes com brinde a expirar em até 5 dias"
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              metrics.expiringIn5Days > 0
                ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                : 'bg-stone-100 text-stone-400'
            }`}
          >
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <div
                className={`text-xl font-black leading-none ${
                  metrics.expiringIn5Days > 0 ? 'text-amber-700' : 'text-stone-900'
                }`}
              >
                {metrics.expiringIn5Days}
              </div>
              {metrics.expiringIn5Days > 0 && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                  Avisar
                </span>
              )}
            </div>
            <div className="text-xs text-stone-600 font-bold mt-1">Expira em 5 dias</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-black text-stone-900 leading-none">{metrics.pending24h}</div>
            <div className="text-xs text-stone-500 font-medium mt-1">Aguardando 24h</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-black text-stone-900 leading-none">{metrics.available}</div>
            <div className="text-xs text-stone-500 font-medium mt-1">Prontos p/ Resgate</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-black text-stone-900 leading-none">{metrics.claimed}</div>
            <div className="text-xs text-stone-500 font-medium mt-1">Brindes Utilizados</div>
          </div>
        </div>
      </div>

      {/* Success notice after triggering expiring reminders */}
      {expiringSuccessNotice && (
        <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{expiringSuccessNotice}</span>
          </div>
          <button
            onClick={() => setExpiringSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-black px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recommended Action Banner: Dual 1-day urgency and 5-day reminder broadcast */}
      {(metrics.expiringIn1Day > 0 || metrics.expiringIn5Days > 0) && (
        <div className="space-y-3">
          {/* CRITICAL URGENCY: 1 DAY LEFT */}
          {metrics.expiringIn1Day > 0 && (
            <div className="bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border-2 border-rose-400 rounded-3xl p-5 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200">
                  <Flame className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-rose-950">
                      🚨 URGENTE: {metrics.expiringIn1Day} {metrics.expiringIn1Day === 1 ? 'cliente com brinde que EXPIRA AMANHÃ!' : 'clientes com brindes que EXPIRAM AMANHÃ!'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase tracking-wide">
                      Último Dia (1 dia restante)
                    </span>
                  </div>
                  <p className="text-xs text-rose-900/80 mt-1 max-w-2xl leading-relaxed">
                    A validade de {settings.rewardValidityDays ?? 15} dias para estes clientes se esgota amanhã. O sistema já programa o envio automático via WhatsApp, mas você pode disparar ou filtrar agora para garantir a visita deles hoje à noite ou amanhã!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'expiring_1d' ? 'all' : 'expiring_1d')}
                  className={`flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                    statusFilter === 'expiring_1d'
                      ? 'bg-rose-700 text-white ring-2 ring-rose-400'
                      : 'bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {statusFilter === 'expiring_1d'
                      ? 'Mostrando todos'
                      : `Ver ${metrics.expiringIn1Day} de 1 dia`}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={triggeringExpiring}
                  onClick={() => handleTriggerExpiringBatch('1_day')}
                  className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md bg-rose-600 hover:bg-rose-700 active:scale-95 text-white cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {triggeringExpiring ? 'Disparando...' : '📢 Disparar Alertas de 1 Dia'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* POLITE REMINDER: 5 DAYS LEFT */}
          {metrics.expiringIn5Days > 0 && (
            <div className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-100/50 border-2 border-amber-300 rounded-3xl p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
                  <BellRing className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-stone-900">
                      ⏳ LEMBRETE PREVENTIVO: {metrics.expiringIn5Days} {metrics.expiringIn5Days === 1 ? 'cliente com brinde a expirar em 5 dias' : 'clientes com brindes a expirar em 5 dias'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 uppercase tracking-wide">
                      Faltam 5 dias
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
                    Estes clientes ganharam cortesias com validade de {settings.rewardValidityDays ?? 15} dias e ainda têm 5 dias para usar. O envio amigável pelo WhatsApp reativa o cliente para planejar a ida ao restaurante esta semana.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'expiring_5d' ? 'all' : 'expiring_5d')}
                  className={`flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                    statusFilter === 'expiring_5d'
                      ? 'bg-amber-700 text-white ring-2 ring-amber-400'
                      : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>
                    {statusFilter === 'expiring_5d'
                      ? 'Mostrando todos'
                      : `Ver ${metrics.expiringIn5Days} de 5 dias`}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={triggeringExpiring}
                  onClick={() => handleTriggerExpiringBatch('5_days')}
                  className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md bg-stone-900 hover:bg-stone-800 active:scale-95 text-white cursor-pointer disabled:opacity-60"
                >
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>
                    {triggeringExpiring ? 'Disparando...' : '📢 Disparar Lembretes de 5 Dias'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Search, Filters & CSV Export */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, WhatsApp, código, brinde ou garçom..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/70 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition text-stone-800 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-stone-400 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos ({metrics.total})
          </button>

          {/* 1-day expiration filter button */}
          <button
            type="button"
            onClick={() => setStatusFilter('expiring_1d')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'expiring_1d'
                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                : metrics.expiringIn1Day > 0
                ? 'bg-rose-100 text-rose-900 border border-rose-300 hover:bg-rose-200 font-black animate-pulse'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-500" />
            <span>🚨 Expira Amanhã ({metrics.expiringIn1Day})</span>
          </button>

          {/* 5-day expiration filter button */}
          <button
            type="button"
            onClick={() => setStatusFilter('expiring_5d')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'expiring_5d'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                : metrics.expiringIn5Days > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 font-black'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <BellRing className="w-3.5 h-3.5 text-amber-600" />
            <span>⏳ Faltam 5 dias ({metrics.expiringIn5Days})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending_24h')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'pending_24h'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            ⏳ Carência 24h ({metrics.pending24h})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'available'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
            }`}
          >
            ✨ Disponíveis ({metrics.available})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('claimed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'claimed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            ✅ Resgatados ({metrics.claimed})
          </button>
        </div>

        {/* Actions: Clear & Export */}
        <div className="flex items-center gap-2 shrink-0">
          {onClearAllCustomers && reviews.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirmModal(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition shrink-0 cursor-pointer"
              title="Apagar todos os registros de clientes"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Limpar Registros</span>
            </button>
          )}

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={reviews.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Base (CSV / Excel)</span>
          </button>
        </div>
      </div>

      {/* Customer List Table / Cards */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-stone-900 text-sm">
              Registros no Banco de Dados ({filteredCustomers.length})
            </h3>
            <span className="text-[11px] text-stone-400">
              {statusFilter !== 'all' ? 'Filtrado' : 'Todos os clientes'}
            </span>
          </div>
          <span className="text-xs text-stone-500">
            Regra: Liberado em 24h • Uso em até {settings.rewardValidityDays ?? 15} dias
          </span>
        </div>

        {reviews.length === 0 ? (
          <div className="p-14 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto shadow-inner">
              <Users className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-base font-bold text-stone-800">
              Registros de Clientes Limpos
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
              O banco de dados de clientes está limpo e zerado. Quando os clientes avaliarem as mesas pelo QR Code, os nomes, telefones de WhatsApp, notas e vouchers aparecerão aqui automaticamente.
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Users className="w-12 h-12 mx-auto text-stone-300" />
            <p className="text-sm font-semibold text-stone-600">Nenhum cliente encontrado com os filtros atuais</p>
            <p className="text-xs text-stone-400">Tente ajustar o termo de pesquisa ou trocar o filtro.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredCustomers.map((cust) => {
              const status = getCustomerStatus(cust);
              const initials = (cust.customerName || 'C')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              const createdDate = new Date(cust.createdAt).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });

              const availableDate = cust.availableFrom
                ? new Date(cust.availableFrom)
                : new Date(new Date(cust.createdAt).getTime() + 24 * 60 * 60 * 1000);

              const expiryDate = cust.expiresAt
                ? new Date(cust.expiresAt)
                : new Date(new Date(cust.createdAt).getTime() + (settings.rewardValidityDays ?? 15) * 24 * 60 * 60 * 1000);

              const avgRating = (
                (cust.ratings.service + cust.ratings.ambiance + cust.ratings.products + cust.ratings.waitTime) /
                4
              ).toFixed(1);

              const expInfo = getExpiringDaysInfo(cust);

              return (
                <div
                  key={cust.id}
                  className={`p-4 sm:p-5 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    expInfo
                      ? 'bg-amber-50/40 border-l-4 border-l-amber-500 hover:bg-amber-50/70'
                      : 'hover:bg-stone-50/80'
                  }`}
                >
                  {/* Left: Customer Info */}
                  <div className="flex items-start gap-3.5 min-w-[280px]">
                    <div className={`w-11 h-11 rounded-2xl font-bold text-sm flex items-center justify-center shrink-0 shadow-xs text-white ${
                      expInfo ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-300' : 'bg-gradient-to-br from-rose-500 to-amber-500'
                    }`}>
                      {initials}
                    </div>
                    <div className="space-y-1 w-full">
                      {/* 5-day expiration badge on top */}
                      {expInfo && (
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300 shadow-xs">
                            <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500 animate-pulse" />
                            <span>
                              {expInfo.daysLeft === 1
                                ? '🚨 EXPIRA AMANHÃ!'
                                : `⚠️ BRINDE EXPIRA EM ${expInfo.daysLeft} DIAS!`}
                            </span>
                            <span className="font-normal opacity-80">
                              (Até {expInfo.expiryDate.toLocaleDateString('pt-BR')})
                            </span>
                          </span>
                          <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            Disparar WhatsApp
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 text-sm">
                          {cust.customerName || 'Cliente não identificado'}
                        </span>
                        {cust.tableNumber && (
                          <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                            Mesa #{cust.tableNumber < 10 ? `0${cust.tableNumber}` : cust.tableNumber}
                          </span>
                        )}
                        <span className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {createdDate}
                        </span>
                      </div>

                      {/* Phone with direct WhatsApp button */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {cust.customerPhone ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-stone-700 font-semibold bg-stone-100 px-2 py-0.5 rounded-md">
                              {cust.customerPhone}
                            </span>

                            {/* Button to resend via API in background without opening WhatsApp */}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!cust.customerPhone) return;
                                setSendingApiId(cust.id);
                                try {
                                  const availDate = cust.availableFrom ? new Date(cust.availableFrom).toLocaleDateString('pt-BR') : 'amanhã';
                                  const expDate = cust.expiresAt ? new Date(cust.expiresAt).toLocaleDateString('pt-BR') : `em ${settings.rewardValidityDays ?? 15} dias`;
                                  const firstName = cust.customerName ? cust.customerName.trim().split(' ')[0] : 'Cliente';
                                  const officialMessage =
                                    `*VOUCHER DE CORTESIA - ${settings.name.toUpperCase()}* 🥟✨\n\n` +
                                    `Olá ${firstName}! Aqui estão os detalhes do seu brinde conquistado:\n\n` +
                                    `🎁 *Brinde:* ${cust.rewardTitle}\n` +
                                    `🎟️ *Código de Resgate:* ${cust.rewardCode}\n` +
                                    `📅 *Prazo de Início:* Liberado para resgate a partir de ${availDate} (24h após o sorteio)\n` +
                                    `⏳ *Prazo para Expirar:* Válido até ${expDate} (${settings.rewardValidityDays ?? 15} dias de validade)\n` +
                                    `⚠️ *Regra Importante:* Só é válido utilizar 1 cortesia/brinde por mesa!\n\n` +
                                    `Apresente este voucher ao garçom no ${settings.name} durante sua próxima visita. Esperamos você! 💛`;

                                  const res = await fetch('/api/send-whatsapp', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      phone: cust.customerPhone,
                                      customerName: cust.customerName || 'Cliente',
                                      rewardTitle: cust.rewardTitle,
                                      rewardCode: cust.rewardCode,
                                      restaurantName: settings.name,
                                      availableFrom: cust.availableFrom,
                                      expiresAt: cust.expiresAt,
                                      message: officialMessage,
                                    }),
                                  });
                                  const data = await res.json().catch(() => null);
                                  if (res.ok && data?.success) {
                                    setSentSuccessId(cust.id);
                                    setTimeout(() => setSentSuccessId(null), 3000);
                                  } else {
                                    alert(data?.error || data?.message || 'Falha ao reenviar via API. Verifique o status do Gateway.');
                                  }
                                } catch (err: any) {
                                  console.warn('API resend error', err);
                                  alert('Erro de conexão com o servidor: ' + (err?.message || 'Falha de rede'));
                                } finally {
                                  setSendingApiId(null);
                                }
                              }}
                              disabled={sendingApiId === cust.id}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                sentSuccessId === cust.id
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                              }`}
                              title="Reenviar voucher em segundo plano via API (sem abrir o WhatsApp)"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                              <span>
                                {sendingApiId === cust.id
                                  ? 'Enviando API...'
                                  : sentSuccessId === cust.id
                                  ? '✅ Enviado API'
                                  : 'Reenviar via API'}
                              </span>
                            </button>
                            
                            {/* If expiring, show prominent expiring alert button, else regular WhatsApp */}
                            {!expInfo && (
                              <a
                                href={getWhatsAppLink(
                                  cust.customerName || 'Cliente',
                                  cust.customerPhone,
                                  cust.rewardTitle,
                                  cust.rewardCode,
                                  cust.availableFrom,
                                  cust.expiresAt,
                                  cust.createdAt
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition"
                                title="Abrir conversa no WhatsApp manualmente (opcional)"
                              >
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>Abrir Zap</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-[11px]">Telefone não cadastrado</span>
                        )}

                        {cust.waiterName && (
                          <span className="text-stone-500 text-[11px]">
                            • Atendido por: <strong className="text-stone-700">{cust.waiterName}</strong>
                          </span>
                        )}
                      </div>

                      {/* Prominent WhatsApp expiration notification button when expiring in 1 or 5 days */}
                      {expInfo && (
                        <div className="pt-2 space-y-2">
                          {cust.customerPhone ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Open WhatsApp link with tailored message */}
                              <a
                                href={getExpiringWhatsAppLink(
                                  cust.customerName || 'Cliente',
                                  cust.customerPhone,
                                  cust.rewardTitle,
                                  cust.rewardCode,
                                  expInfo.daysLeft,
                                  expInfo.expiryDate,
                                  expInfo.isOneDayLeft ? '1_day' : '5_days'
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95 cursor-pointer ${
                                  expInfo.isOneDayLeft
                                    ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-200'
                                    : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-200'
                                }`}
                                title={
                                  expInfo.isOneDayLeft
                                    ? 'Abrir WhatsApp com alerta urgente de que o brinde expira amanhã'
                                    : 'Abrir WhatsApp com lembrete amigável de que faltam 5 dias para expirar'
                                }
                              >
                                <Phone className="w-4 h-4 text-white" />
                                <span>
                                  {expInfo.isOneDayLeft
                                    ? 'Avisar no WhatsApp (Expira Amanhã!)'
                                    : `Avisar no WhatsApp (Faltam ${expInfo.daysLeft}d)`}
                                </span>
                                <ExternalLink className="w-3 h-3 opacity-80" />
                              </a>

                              {/* Trigger single notification via server API */}
                              <button
                                type="button"
                                disabled={sendingApiId === cust.id}
                                onClick={() =>
                                  handleSingleCustomerNotify(
                                    cust,
                                    expInfo.isOneDayLeft ? '1_day' : '5_days'
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                  sentSuccessId === cust.id
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                                title="Disparar notificação automaticamente via servidor"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                <span>
                                  {sendingApiId === cust.id
                                    ? 'Enviando...'
                                    : sentSuccessId === cust.id
                                    ? '✅ Enviado!'
                                    : 'Disparar no Servidor'}
                                </span>
                              </button>

                              {/* Preview message modal button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setWhatsappModalCustomer({
                                    customerName: cust.customerName || 'Cliente',
                                    phone: cust.customerPhone || '',
                                    rewardTitle: cust.rewardTitle,
                                    code: cust.rewardCode,
                                    daysLeft: expInfo.daysLeft,
                                    expiryDate: expInfo.expiryDate,
                                    availableFrom: cust.availableFrom,
                                    createdAt: cust.createdAt,
                                    reminderType: expInfo.isOneDayLeft ? '1_day' : '5_days',
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 transition cursor-pointer"
                                title="Ver texto completo da mensagem antes de enviar"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-stone-500" />
                                <span>Ver texto</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Sem telefone no cadastro para disparo do WhatsApp</span>
                            </div>
                          )}

                          {/* Historical dispatch badges */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px]">
                            {cust.notified5DaysAt && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-medium">
                                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                                <span>
                                  Lembrete 5d enviado em{' '}
                                  {new Date(cust.notified5DaysAt).toLocaleDateString('pt-BR')}{' '}
                                  {new Date(cust.notified5DaysAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </span>
                            )}
                            {cust.notified1DayAt && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200 font-bold">
                                <CheckCircle2 className="w-3 h-3 text-rose-600" />
                                <span>
                                  Alerta 1d enviado em{' '}
                                  {new Date(cust.notified1DayAt).toLocaleDateString('pt-BR')}{' '}
                                  {new Date(cust.notified1DayAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Rating and feedback pill */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          Nota {avgRating}
                        </span>

                        {cust.waiterCompliments && cust.waiterCompliments.length > 0 && (
                          <span className="text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ThumbsUp className="w-3 h-3 text-amber-600" />
                            {cust.waiterCompliments.length} {cust.waiterCompliments.length === 1 ? 'elogio' : 'elogios'}
                          </span>
                        )}

                        {cust.criticism && (
                          <span className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-medium">
                            Com crítica construtiva
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Reward won & Validity Rules */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-4 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="font-bold text-stone-900 text-xs">{cust.rewardTitle}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-800 bg-white px-2 py-0.5 rounded border border-stone-200">
                          {cust.rewardCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(cust.rewardCode)}
                          className="text-[10px] text-stone-500 hover:text-stone-800 underline font-medium cursor-pointer"
                        >
                          {copiedCode === cust.rewardCode ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>

                      {/* Status Badges & Validity Timestamps */}
                      <div className="pt-0.5 text-[11px]">
                        {status === 'claimed' ? (
                          <div className="space-y-1 text-emerald-800 font-bold">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Resgatado no Restaurante</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                USO ÚNICO BAIXADO
                              </span>
                            </div>
                            <div className="text-stone-500 text-[10px] font-normal">
                              {cust.claimedAt && (
                                <>Entregue em: <strong>{new Date(cust.claimedAt).toLocaleString('pt-BR')}</strong></>
                              )}
                              {(cust.claimedTable || cust.tableNumber) && (
                                <> • <strong>Mesa #{cust.claimedTable || cust.tableNumber}</strong></>
                              )}
                            </div>
                          </div>
                        ) : status === 'pending_24h' ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-amber-700 font-bold">
                              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                              <span>Aguardando liberação de 24h</span>
                            </div>
                            <div className="text-stone-500 text-[10px]">
                              Liberado a partir de: <strong>{availableDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
                              <br />
                              Válido até: <strong>{expiryDate.toLocaleDateString('pt-BR')}</strong> ({settings.rewardValidityDays ?? 15} dias)
                            </div>
                          </div>
                        ) : status === 'available' ? (
                          <div className="space-y-1">
                            {expInfo ? (
                              expInfo.isOneDayLeft ? (
                                <div className="flex items-center gap-1.5 text-rose-900 font-black bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md animate-pulse">
                                  <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-500" />
                                  <span>EXPIRA AMANHÃ (1 DIA RESTANTE)!</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-amber-900 font-black bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Expira em {expInfo.daysLeft} dias (5 dias restantes)</span>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center gap-1 text-sky-700 font-bold">
                                <Check className="w-3.5 h-3.5 text-sky-600" />
                                <span>Pronto para uso pelo cliente!</span>
                              </div>
                            )}
                            <div className="text-stone-500 text-[10px]">
                              Validade limite: <strong>{expiryDate.toLocaleDateString('pt-BR')}</strong> ({settings.rewardValidityDays ?? 15} dias)
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-rose-700 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Expirado (prazo de {settings.rewardValidityDays ?? 15} dias esgotado)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick actions for staff */}
                    <div className="shrink-0 flex items-center gap-2">
                      {!cust.rewardClaimed && (
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => onValidateVoucher(cust.rewardCode)}
                            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Validar Resgate</span>
                          </button>
                          {status === 'pending_24h' && (
                            <span className="text-[10px] text-amber-700 text-center font-medium">
                              (Antecipar validação)
                            </span>
                          )}
                        </div>
                      )}

                      {onDeleteCustomer && (
                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(cust)}
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Apagar este registro de cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WhatsApp Message Preview Modal */}
      {whatsappModalCustomer && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div
              className={`p-5 text-white flex items-center justify-between ${
                whatsappModalCustomer.reminderType === '1_day' || whatsappModalCustomer.daysLeft <= 1
                  ? 'bg-gradient-to-r from-rose-600 to-red-700'
                  : 'bg-gradient-to-r from-amber-600 to-orange-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  {whatsappModalCustomer.reminderType === '1_day' || whatsappModalCustomer.daysLeft <= 1 ? (
                    <Flame className="w-5 h-5 text-white" />
                  ) : (
                    <BellRing className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-black text-base">
                    {whatsappModalCustomer.reminderType === '1_day' || whatsappModalCustomer.daysLeft <= 1
                      ? '🚨 Alerta Urgente: Expira Amanhã!'
                      : '⏳ Lembrete: Faltam 5 Dias para Expirar'}
                  </h3>
                  <p className="text-xs text-white/90">
                    Mensagem no WhatsApp para {whatsappModalCustomer.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWhatsappModalCustomer(null);
                  setCopiedMessage(false);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div
                className={`rounded-2xl p-3.5 flex items-center gap-2.5 text-xs ${
                  whatsappModalCustomer.reminderType === '1_day' || whatsappModalCustomer.daysLeft <= 1
                    ? 'bg-rose-50 border border-rose-200 text-rose-950 font-bold'
                    : 'bg-amber-50 border border-amber-200 text-amber-900'
                }`}
              >
                {whatsappModalCustomer.reminderType === '1_day' || whatsappModalCustomer.daysLeft <= 1 ? (
                  <Flame className="w-5 h-5 text-rose-600 shrink-0" />
                ) : (
                  <BellRing className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <span>
                  O brinde <strong>{whatsappModalCustomer.rewardTitle}</strong> (Código: <code>{whatsappModalCustomer.code}</code>) expira{' '}
                  <strong>
                    {whatsappModalCustomer.daysLeft <= 1
                      ? 'AMANHÃ'
                      : `em ${whatsappModalCustomer.daysLeft} dias`}
                  </strong>{' '}
                  ({whatsappModalCustomer.expiryDate.toLocaleDateString('pt-BR')}).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1.5 uppercase tracking-wide">
                  Mensagem que será enviada para {whatsappModalCustomer.phone}:
                </label>
                <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 text-xs text-stone-800 whitespace-pre-line leading-relaxed font-sans shadow-inner">
                  {getExpiringWhatsAppText(
                    whatsappModalCustomer.customerName,
                    whatsappModalCustomer.rewardTitle,
                    whatsappModalCustomer.code,
                    whatsappModalCustomer.daysLeft,
                    whatsappModalCustomer.expiryDate,
                    whatsappModalCustomer.reminderType
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const txt = getExpiringWhatsAppText(
                      whatsappModalCustomer.customerName,
                      whatsappModalCustomer.rewardTitle,
                      whatsappModalCustomer.code,
                      whatsappModalCustomer.daysLeft,
                      whatsappModalCustomer.expiryDate,
                      whatsappModalCustomer.reminderType
                    );
                    navigator.clipboard?.writeText(txt);
                    setCopiedMessage(true);
                    setTimeout(() => setCopiedMessage(false), 2500);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedMessage ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-black">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-stone-500" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                <a
                  href={getExpiringWhatsAppLink(
                    whatsappModalCustomer.customerName,
                    whatsappModalCustomer.phone,
                    whatsappModalCustomer.rewardTitle,
                    whatsappModalCustomer.code,
                    whatsappModalCustomer.daysLeft,
                    whatsappModalCustomer.expiryDate,
                    whatsappModalCustomer.reminderType
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setWhatsappModalCustomer(null);
                  }}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer ${
                    whatsappModalCustomer.reminderType === '1_day' || whatsappModalCustomer.daysLeft <= 1
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-200'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200'
                  }`}
                >
                  <Send className="w-4 h-4 text-white" />
                  <span>Abrir no WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Customers Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                Limpar Todos os Registros de Clientes?
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Esta ação irá apagar permanentemente todas as avaliações, dados de contato dos clientes e vouchers de cortesia cadastrados até o momento. O banco de dados ficará completamente zerado.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5 text-[11px] text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Esta operação não pode ser desfeita. Recomendamos exportar a base em CSV antes de limpar se desejar guardar backup.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  if (onUpdateReviews) {
                    onUpdateReviews([]);
                  }
                  if (onClearAllCustomers) {
                    onClearAllCustomers();
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Limpar Todos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-stone-900">
                Apagar Registro?
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Deseja remover o registro de <strong>{customerToDelete.customerName}</strong> ({customerToDelete.customerPhone || 'Sem telefone'})?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const idToDelete = customerToDelete.id;
                  if (onUpdateReviews) {
                    onUpdateReviews(reviews.filter((r) => r.id !== idToDelete));
                  }
                  if (onDeleteCustomer) {
                    onDeleteCustomer(idToDelete);
                  }
                  setCustomerToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-200 transition cursor-pointer"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

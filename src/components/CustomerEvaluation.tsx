import { tenantKey } from '../lib/tenant';
import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  UtensilsCrossed,
  Clock,
  HeartHandshake,
  MessageSquare,
  Gift,
  HelpCircle,
  RotateCcw,
  CheckCircle,
  Check,
  Tag,
  AlertCircle,
  ChevronRight,
  User,
  Phone,
  UserCheck,
  Star,
  ThumbsUp,
  X,
  MapPin,
} from 'lucide-react';
import { RatingCriteria, RestaurantSettings, RewardOption, Review, Waiter } from '../types';
import { QUICK_TAGS_OPTIONS, WAITER_COMPLIMENTS } from '../data/mockData';
import { RatingStarScale } from './RatingStarScale';
import { CoxinhaIcon } from './CoxinhaIcon';
import { RatingChoiceIcon } from './RatingChoiceIcon';
import { RewardRoulette } from './RewardRoulette';
import { RewardVoucherCard } from './RewardVoucherCard';
import { generateRewardCode, loadReviews } from '../lib/storage';

interface CustomerEvaluationProps {
  tableNumber?: number;
  onTableChange?: (newTable: number) => void;
  settings: RestaurantSettings;
  rewards: RewardOption[];
  waiters?: Waiter[];
  onSubmitReview: (review: Review) => void;
}

export const CustomerEvaluation: React.FC<CustomerEvaluationProps> = ({
  tableNumber,
  onTableChange,
  settings,
  rewards,
  waiters = [],
  onSubmitReview,
}) => {
  // Table Selection State
  const [selectedTable, setSelectedTable] = useState<number>(tableNumber && tableNumber > 0 ? tableNumber : 0);
  const [isBalcao, setIsBalcao] = useState<boolean>(false);
  const [customTableInput, setCustomTableInput] = useState<string>(
    tableNumber && tableNumber > 0 ? String(tableNumber) : ''
  );
  const [isChangingTable, setIsChangingTable] = useState<boolean>(false);
  const [showAllTables, setShowAllTables] = useState<boolean>(false);

  // Sync when prop tableNumber changes
  useEffect(() => {
    if (tableNumber !== undefined && tableNumber > 0) {
      setSelectedTable(tableNumber);
      setCustomTableInput(String(tableNumber));
      setIsBalcao(false);
    }
  }, [tableNumber]);

  const handleSelectTable = (tbl: number) => {
    setSelectedTable(tbl);
    setIsBalcao(false);
    setCustomTableInput(String(tbl));
    setIsChangingTable(false);
    onTableChange?.(tbl);
    if (validationError) setValidationError(null);
  };

  const handleSelectBalcao = () => {
    setSelectedTable(0);
    setIsBalcao(true);
    setCustomTableInput('');
    setIsChangingTable(false);
    onTableChange?.(0);
    if (validationError) setValidationError(null);
  };

  const handleCustomTableChange = (val: string) => {
    const clean = val.replace(/\D/g, '');
    setCustomTableInput(clean);
    const parsed = parseInt(clean, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedTable(parsed);
      setIsBalcao(false);
      onTableChange?.(parsed);
    } else {
      setSelectedTable(0);
    }
    if (validationError) setValidationError(null);
  };

  // Evaluation state
  const [ratings, setRatings] = useState<RatingCriteria>({
    service: 0,
    ambiance: 0,
    products: 0,
    waitTime: 0,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [criticism, setCriticism] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Optional Waiter Evaluation State
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
  const [waiterRating, setWaiterRating] = useState<number>(0);
  const [waiterCompliments, setWaiterCompliments] = useState<string[]>([]);

  // Flow State
  const [stage, setStage] = useState<'form' | 'roulette' | 'voucher'>('form');
  const [generatedReview, setGeneratedReview] = useState<Review | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardOption | null>(null);

  // Daily limit state (Only 1 evaluation per day)
  const [todayEvaluatedReview, setTodayEvaluatedReview] = useState<Review | null>(null);
  const [existingTodayReview, setExistingTodayReview] = useState<Review | null>(null);

  // Check localStorage on mount for today's evaluation on this browser
  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastDate = localStorage.getItem(tenantKey('restaurant_last_eval_date'));
      if (lastDate === todayStr) {
        const saved = localStorage.getItem(tenantKey('restaurant_last_eval_review'));
        if (saved) {
          const parsed: Review = JSON.parse(saved);
          setTodayEvaluatedReview(parsed);
        }
      }
    } catch (err) {
      console.error('Error loading today evaluation', err);
    }
  }, []);

  const activeWaiters = waiters.filter((w) => w.active);
  const selectedWaiter = waiters.find((w) => w.id === selectedWaiterId);

  const formatBrazilianPhone = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBrazilianPhone(e.target.value);
    setCustomerPhone(formatted);
    if (validationError) setValidationError(null);
    if (existingTodayReview) setExistingTodayReview(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerName(e.target.value);
    if (validationError) setValidationError(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleWaiterCompliment = (compliment: string) => {
    setWaiterCompliments((prev) =>
      prev.includes(compliment)
        ? prev.filter((c) => c !== compliment)
        : [...prev, compliment]
    );
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 0. Validate Table selection (Customer must mark which table they are sitting at)
    if (!isBalcao && selectedTable <= 0) {
      setValidationError('Por favor, marque em qual mesa você está sentado para podermos localizar seu atendimento.');
      const tableEl = document.getElementById('table-selector-card');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // 1. Validate that all 4 criteria have been rated
    if (
      ratings.service === 0 ||
      ratings.ambiance === 0 ||
      ratings.products === 0 ||
      ratings.waitTime === 0
    ) {
      setValidationError('Por favor, avalie todos os 4 quesitos antes de continuar.');
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    // 2. Validate Customer Name (Required to win the gift)
    if (!customerName.trim() || customerName.trim().length < 2) {
      setValidationError('Por favor, informe seu Nome para cadastrar e liberar o seu brinde.');
      const nameEl = document.getElementById('input-customer-name');
      if (nameEl) {
        nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nameEl.focus();
      }
      return;
    }

    // 3. Validate Customer Phone / WhatsApp (Required to win the gift)
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setValidationError('Por favor, informe seu WhatsApp/Telefone com DDD (mínimo 10 dígitos) para cadastrar e liberar o seu brinde.');
      const phoneEl = document.getElementById('input-customer-phone');
      if (phoneEl) {
        phoneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneEl.focus();
      }
      return;
    }

    // 4. Validate Daily Limit: Only 1 evaluation per day per customer/phone
    const todayStr = new Date().toISOString().slice(0, 10);
    const allReviews = loadReviews();
    const reviewFoundToday = allReviews.find((r) => {
      if (!r.customerPhone) return false;
      const rPhone = r.customerPhone.replace(/\D/g, '');
      const rDate = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '';
      return rPhone === phoneDigits && rDate === todayStr;
    });

    if (reviewFoundToday) {
      setExistingTodayReview(reviewFoundToday);
      setValidationError(
        `⚠️ Limite diário atingido: Este número de WhatsApp (${customerPhone}) já realizou uma avaliação hoje. Para garantir a transparência das cortesias, só é permitida 1 avaliação por dia por cliente.`
      );
      const phoneEl = document.getElementById('input-customer-phone');
      if (phoneEl) {
        phoneEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneEl.focus();
      }
      return;
    }

    setValidationError(null);
    setExistingTodayReview(null);

    // If wheel mode is active, proceed to spin wheel first
    if (settings.activeRewardMode === 'wheel') {
      setStage('roulette');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Fixed reward
      const fixed =
        rewards.find((r) => r.id === settings.fixedRewardId && r.enabled) ||
        rewards.find((r) => r.enabled) ||
        rewards[0];
      completeEvaluation(fixed);
    }
  };

  const handleRouletteWon = (reward: RewardOption) => {
    setSelectedReward(reward);
    setTimeout(() => {
      completeEvaluation(reward);
    }, 1800);
  };

  const completeEvaluation = (reward: RewardOption) => {
    const rewardCode = generateRewardCode();
    const now = new Date();
    const delayHours = settings.rewardDelayHours ?? 24;
    const validityDays = settings.rewardValidityDays || 15;
    const availableFrom = new Date(now.getTime() + delayHours * 60 * 60 * 1000).toISOString();
    const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const finalTable = !isBalcao && selectedTable > 0 ? selectedTable : undefined;

    const newReview: Review = {
      id: `rev-${Date.now()}`,
      tableNumber: finalTable,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      waiterId: selectedWaiterId || undefined,
      waiterName: selectedWaiter
        ? selectedWaiter.nickname
          ? `${selectedWaiter.name} (${selectedWaiter.nickname})`
          : selectedWaiter.name
        : undefined,
      waiterRating: selectedWaiterId && waiterRating > 0 ? waiterRating : undefined,
      waiterCompliment:
        selectedWaiterId && waiterCompliments.length > 0 ? waiterCompliments.join(' • ') : undefined,
      waiterCompliments:
        selectedWaiterId && waiterCompliments.length > 0 ? waiterCompliments : undefined,
      ratings,
      quickTags: selectedTags,
      criticism: criticism.trim(),
      suggestion: suggestion.trim(),
      rewardCode,
      rewardTitle: reward.title,
      rewardClaimed: false,
      availableFrom,
      expiresAt,
      whatsappStatus: 'sent_silently',
      whatsappSentAt: now.toISOString(),
      createdAt: now.toISOString(),
    };

    // Save today's evaluation to local device state to prevent multiple daily submissions
    const todayStr = now.toISOString().slice(0, 10);
    try {
      localStorage.setItem(tenantKey('restaurant_last_eval_date'), todayStr);
      localStorage.setItem(tenantKey('restaurant_last_eval_phone'), customerPhone.replace(/\D/g, ''));
      localStorage.setItem(tenantKey('restaurant_last_eval_review'), JSON.stringify(newReview));
      setTodayEvaluatedReview(newReview);
    } catch (err) {
      console.error('Error saving today evaluation', err);
    }

    setGeneratedReview(newReview);
    onSubmitReview(newReview);
    setStage('voucher');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetForNextCustomer = () => {
    setRatings({ service: 0, ambiance: 0, products: 0, waitTime: 0 });
    setSelectedTags([]);
    setCriticism('');
    setSuggestion('');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedWaiterId('');
    setWaiterRating(0);
    setWaiterCompliments([]);
    setValidationError(null);
    setGeneratedReview(null);
    setSelectedReward(null);
    setStage('form');
  };

  return (
    <div id="customer-evaluation-view" className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      {/* Welcome Banner - Warm, friendly, and inviting */}
      <div className="bg-gradient-to-br from-stone-900 via-rose-950/80 to-stone-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl mb-6 relative overflow-hidden border border-rose-500/20">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-medium text-rose-200 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{settings.name}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>Leva apenas 1 minuto para responder</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Como foi sua experiência hoje?
            </h1>
            <p className="text-sm text-stone-300/90 leading-relaxed mt-1.5 max-w-xl">
              Adoramos ter você aqui! Conte para nós o que achou da sua visita e receba um mimo especial em agradecimento.
            </p>
          </div>
        </div>
      </div>

      {/* Daily limit reminder banner if already evaluated today on this device */}
      {todayEvaluatedReview && stage === 'form' && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-4 sm:p-5 text-amber-950 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-amber-950">
                  Olá novamente! Você já avaliou sua visita hoje.
                </h4>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  1 por dia
                </span>
              </div>
              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                Seu brinde (<strong>{todayEvaluatedReview.rewardTitle}</strong>) já foi sorteado e está guardado para o seu próximo resgate!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setGeneratedReview(todayEvaluatedReview);
                setStage('voucher');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Gift className="w-4 h-4" />
              <span>Ver Meu Brinde</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 1: FORM */}
      {stage === 'form' && (
        <form onSubmit={handleStartSubmit} className="space-y-6">
          {validationError && (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl space-y-2.5 text-rose-900 text-sm font-medium">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug font-semibold">{validationError}</span>
              </div>
              {existingTodayReview && (
                <div className="pt-2 border-t border-rose-200/80 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-rose-800">
                    Brinde já sorteado hoje: <strong>{existingTodayReview.rewardTitle}</strong> (Código: {existingTodayReview.rewardCode})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedReview(existingTodayReview);
                      setStage('voucher');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Acessar Meu Voucher de Hoje</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. Table Selection Card (Customer marks which table they are sitting at) */}
          <div
            id="table-selector-card"
            className={`p-5 sm:p-6 rounded-3xl border transition-all ${
              !isBalcao && selectedTable <= 0 && validationError
                ? 'bg-rose-50/90 border-rose-300 ring-2 ring-rose-300'
                : 'bg-white border-stone-200 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shadow-xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
                    <span>1. Em qual mesa você está sentado?</span>
                    <span className="text-rose-600 font-black">*</span>
                  </h2>
                  <p className="text-xs text-stone-500">
                    Marque sua mesa para identificarmos seu atendimento e vincular com seu brinde.
                  </p>
                </div>
              </div>

              {(selectedTable > 0 || isBalcao) && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {isBalcao
                      ? 'Área do Balcão / Viagem'
                      : `Mesa #${selectedTable < 10 ? `0${selectedTable}` : selectedTable}`}
                  </span>
                  {!isChangingTable && (
                    <button
                      type="button"
                      onClick={() => setIsChangingTable(true)}
                      className="text-xs font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer"
                    >
                      Trocar mesa
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick table picker */}
            {(isChangingTable || (selectedTable <= 0 && !isBalcao)) && (
              <div className="pt-3 border-t border-stone-100 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wide">
                  <span>Toque para marcar a sua mesa:</span>
                  <span className="text-rose-600">* Obrigatório</span>
                </div>

                {/* Table grid buttons */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
                  {Array.from(
                    { length: showAllTables ? (settings.totalTables || 30) : Math.min(settings.totalTables || 20, 20) },
                    (_, i) => i + 1
                  ).map((tbl) => {
                    const isSelected = selectedTable === tbl && !isBalcao;
                    return (
                      <button
                        key={tbl}
                        type="button"
                        onClick={() => handleSelectTable(tbl)}
                        className={`py-2 px-1 rounded-xl text-xs font-black transition flex flex-col items-center justify-center cursor-pointer min-h-[46px] ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-200 border-2 border-rose-600 ring-2 ring-rose-300 scale-105'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200/90 active:scale-95'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-wider opacity-75 leading-tight">Mesa</span>
                        <span className="text-sm font-black leading-none">{tbl < 10 ? `0${tbl}` : tbl}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Options: Balcão & Custom Number Input */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectBalcao}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isBalcao
                          ? 'bg-stone-800 text-white shadow-xs'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                      }`}
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span>Estou no Balcão / Viagem</span>
                    </button>

                    {(settings.totalTables || 20) > 20 && (
                      <button
                        type="button"
                        onClick={() => setShowAllTables(!showAllTables)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold underline px-2 py-1"
                      >
                        {showAllTables ? 'Ver menos mesas' : `Ver todas (${settings.totalTables} mesas)`}
                      </button>
                    )}
                  </div>

                  {/* Direct input for specific or higher table numbers */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500 font-medium whitespace-nowrap">Ou digite o nº:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={customTableInput}
                      onChange={(e) => handleCustomTableChange(e.target.value)}
                      placeholder="Ex: 24"
                      className="w-16 p-2 rounded-xl border border-stone-300 text-center font-black text-sm text-stone-900 bg-white focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Collapsed state confirmation */}
            {!isChangingTable && (selectedTable > 0 || isBalcao) && (
              <div className="mt-2 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-stone-700">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Atendimento vinculado à{' '}
                    <strong className="text-stone-900 font-black">
                      {isBalcao
                        ? 'Área do Balcão / Viagem'
                        : `Mesa ${selectedTable < 10 ? `0${selectedTable}` : selectedTable}`}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingTable(true)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 transition"
                >
                  Alterar Mesa
                </button>
              </div>
            )}
          </div>

          {/* 4 Core Pillars Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-600" />
                2. Avalie os 4 Pilares da sua Visita
              </h2>
              <span className="text-xs text-stone-500 font-medium">* Todos obrigatórios</span>
            </div>

            {/* Atendimento */}
            <RatingStarScale
              id="service"
              label="Atendimento & Garçons"
              subtitle="Cordialidade, atenção, simpatia e presteza"
              icon={<Users className="w-5 h-5" />}
              value={ratings.service}
              onChange={(val) => setRatings((prev) => ({ ...prev, service: val }))}
              required
              ratingIcon={settings.ratingIcon || 'coxinha'}
            />

            {/* Ambiente */}
            <RatingStarScale
              id="ambiance"
              label="Ambiente & Conforto"
              subtitle="Limpeza, climatização, iluminação e música"
              icon={<HeartHandshake className="w-5 h-5" />}
              value={ratings.ambiance}
              onChange={(val) => setRatings((prev) => ({ ...prev, ambiance: val }))}
              required
              ratingIcon={settings.ratingIcon || 'coxinha'}
            />

            {/* Produtos / Comida */}
            <RatingStarScale
              id="products"
              label="Produtos & Gastronomia"
              subtitle="Sabor, temperatura, frescor e apresentação"
              icon={<UtensilsCrossed className="w-5 h-5" />}
              value={ratings.products}
              onChange={(val) => setRatings((prev) => ({ ...prev, products: val }))}
              required
              ratingIcon={settings.ratingIcon || 'coxinha'}
            />

            {/* Tempo de Espera */}
            <RatingStarScale
              id="waitTime"
              label="Tempo de Espera"
              subtitle="Velocidade da chegada das bebidas, pratos e conta"
              icon={<Clock className="w-5 h-5" />}
              value={ratings.waitTime}
              onChange={(val) => setRatings((prev) => ({ ...prev, waitTime: val }))}
              required
              ratingIcon={settings.ratingIcon || 'coxinha'}
            />
          </div>

          {/* Quick Tags Section */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-stone-900 text-base">
                Destaques Rápidos (Toque para marcar)
              </h3>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Marque o que mais chamou sua atenção durante a refeição:
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS_OPTIONS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-200'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Individual Waiter Evaluation */}
          {activeWaiters.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                      Quem te atendeu hoje?
                      <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                        Opcional
                      </span>
                    </h3>
                    <p className="text-xs text-stone-500">
                      Caso queira, avalie o(a) garçom ou atendente individualmente:
                    </p>
                  </div>
                </div>

                {selectedWaiterId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWaiterId('');
                      setWaiterRating(0);
                      setWaiterCompliments([]);
                    }}
                    className="text-xs text-stone-400 hover:text-rose-600 font-semibold flex items-center gap-1 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Desmarcar</span>
                  </button>
                )}
              </div>

              {/* Waiter Selection Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {activeWaiters.map((waiter) => {
                  const isSelected = selectedWaiterId === waiter.id;
                  return (
                    <button
                      key={waiter.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedWaiterId('');
                          setWaiterRating(0);
                          setWaiterCompliments([]);
                        } else {
                          setSelectedWaiterId(waiter.id);
                          if (waiterRating === 0) setWaiterRating(5);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-200 shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/60 hover:bg-stone-100/80'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {waiter.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-stone-900 truncate">
                          {waiter.nickname ? `${waiter.name.split(' ')[0]} (${waiter.nickname})` : waiter.name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1">
                          <span>{waiter.role}</span>
                          {waiter.badgeNumber && <span>#{waiter.badgeNumber}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Waiter Detail Rating & Compliment (shown when a waiter is picked) */}
              {selectedWaiter && (
                <div className="pt-3 border-t border-stone-100 space-y-3 bg-amber-50/40 p-4 rounded-2xl border border-amber-200/50 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                      <RatingChoiceIcon type={settings.ratingIcon || 'coxinha'} filled className="w-4 h-4 inline-block" />
                      Avaliação do atendimento de {selectedWaiter.name.split(' ')[0]}:
                    </span>

                    {/* Escala usa o ícone escolhido pela empresa */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((ratingValue) => (
                        <button
                          key={ratingValue}
                          type="button"
                          onClick={() => setWaiterRating(ratingValue)}
                          className="p-1 text-stone-300 hover:text-amber-400 transition cursor-pointer hover:scale-110"
                          title={`${ratingValue} de 5`}
                        >
                          <RatingChoiceIcon
                            type={settings.ratingIcon || 'coxinha'}
                            filled={ratingValue <= waiterRating}
                            className={`w-6 h-6 transition-all ${
                              ratingValue <= waiterRating
                                ? 'scale-105'
                                : 'text-stone-300 hover:text-amber-400'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-black text-amber-800 ml-1.5 min-w-8">
                        {waiterRating > 0 ? `${waiterRating}.0` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Compliment suggestions (supports multi-selection) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="text-[11px] font-semibold text-stone-700 flex items-center gap-1.5">
                        <ThumbsUp className="w-3.5 h-3.5 text-amber-600" />
                        <span>Deixe um elogio rápido para o(a) {selectedWaiter.name.split(' ')[0]}:</span>
                      </label>
                      <span className="text-[10px] text-amber-800 bg-amber-100/90 border border-amber-200/60 px-2 py-0.5 rounded-full font-bold">
                        Pode selecionar mais de um
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {WAITER_COMPLIMENTS.map((compliment) => {
                        const isCompSelected = waiterCompliments.includes(compliment);
                        return (
                          <button
                            key={compliment}
                            type="button"
                            onClick={() => toggleWaiterCompliment(compliment)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                              isCompSelected
                                ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                                : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            {isCompSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                            <span>{compliment}</span>
                          </button>
                        );
                      })}
                    </div>

                    {waiterCompliments.length > 0 && (
                      <div className="flex items-center justify-between pt-0.5 text-[11px]">
                        <span className="text-amber-900 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                          {waiterCompliments.length} {waiterCompliments.length === 1 ? 'elogio selecionado' : 'elogios selecionados'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWaiterCompliments([])}
                          className="text-[11px] text-stone-400 hover:text-rose-600 font-medium underline cursor-pointer"
                        >
                          Limpar elogios
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Criticisms & Suggestions (Specific user requested fields) */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-rose-600" />
              2. Críticas e Sugestões
            </h2>

            {/* Críticas */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
              <label
                htmlFor="input-criticism"
                className="block font-bold text-stone-900 text-sm mb-1"
              >
                Críticas ou Pontos a Melhorar (Opcional)
              </label>
              <p className="text-xs text-stone-500 mb-2.5">
                Algo não saiu como esperado? Conte com total franqueza para corrigirmos!
              </p>
              <textarea
                id="input-criticism"
                rows={3}
                value={criticism}
                onChange={(e) => setCriticism(e.target.value)}
                placeholder="Ex.: O ponto da carne veio diferente do solicitado, o ar-condicionado estava direto na mesa..."
                className="w-full text-sm p-3.5 rounded-xl border border-stone-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none text-stone-800 placeholder-stone-400 resize-none"
              />
            </div>

            {/* Sugestões */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
              <label
                htmlFor="input-suggestion"
                className="block font-bold text-stone-900 text-sm mb-1"
              >
                Sugestões & Elogios (Opcional)
              </label>
              <p className="text-xs text-stone-500 mb-2.5">
                Gostaria de sugerir novos pratos, elogiar um garçom específico ou deixar uma dica?
              </p>
              <textarea
                id="input-suggestion"
                rows={3}
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Ex.: Adorei o atendimento do garçom Lucas. Seria ótimo ter opções de sobremesas sem lactose..."
                className="w-full text-sm p-3.5 rounded-xl border border-stone-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none text-stone-800 placeholder-stone-400 resize-none"
              />
            </div>
          </div>

          {/* Customer Registration for Gift (Name & WhatsApp Mandatory to Win) */}
          <div
            id="customer-registration-card"
            className="bg-gradient-to-br from-white via-rose-50/40 to-amber-50/50 rounded-3xl p-5 sm:p-6 border-2 border-rose-300 shadow-lg space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-rose-100">
              <div className="flex items-center gap-3">
                <span className="p-3 bg-gradient-to-br from-rose-600 to-amber-500 text-white rounded-2xl shadow-md shadow-rose-200">
                  <Gift className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-stone-900 text-base">
                      Cadastre-se para Ganhar seu Brinde
                    </h3>
                    <span className="text-[10px] bg-rose-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      Obrigatório
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Informe seu nome e WhatsApp para desbloquear o voucher da sua cortesia exclusiva
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="input-customer-name"
                  className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5"
                >
                  <User className="w-4 h-4 text-rose-600" />
                  <span>Seu Nome Completo *</span>
                </label>
                <input
                  id="input-customer-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={handleNameChange}
                  placeholder="Ex.: Mariana Silva"
                  className="w-full text-sm p-3 rounded-xl border border-stone-300 bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none text-stone-900 font-medium"
                />
                <p className="text-[11px] text-stone-400 mt-1">
                  Como prefere ser chamado ao retirar seu brinde.
                </p>
              </div>

              <div>
                <label
                  htmlFor="input-customer-phone"
                  className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4 text-rose-600" />
                  <span>WhatsApp / Telefone com DDD *</span>
                </label>
                <input
                  id="input-customer-phone"
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="w-full text-sm p-3 rounded-xl border border-stone-300 bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none text-stone-900 font-bold font-mono"
                />
                <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                  <span>📲 O voucher de cortesia será enviado para seu WhatsApp.</span>
                </p>
              </div>
            </div>

            <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-200/80 space-y-1.5 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-stone-600 font-medium">
                  Seus dados são protegidos e usados com carinho para liberar seu voucher exclusivo.
                </span>
              </div>
              <div className="flex items-center gap-2 text-stone-400 text-[11px] pt-1 border-t border-stone-200/60">
                <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>
                  Válido 1 brinde cortesia por mesa • Liberado após 24h para sua próxima visita
                </span>
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              id="btn-submit-evaluation"
              type="submit"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-black text-lg tracking-wide shadow-xl shadow-rose-600/30 transform active:scale-[0.98] transition flex items-center justify-center gap-3 cursor-pointer"
            >
              <Gift className="w-6 h-6 animate-bounce" />
              <span>
                {settings.activeRewardMode === 'wheel'
                  ? 'Girar Roleta & Receber Voucher no WhatsApp'
                  : 'Cadastrar & Receber Voucher no WhatsApp'}
              </span>
              <ChevronRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-stone-400 mt-2.5">
              Ao concluir, seu voucher digital é liberado com validade de {settings.rewardValidityDays || 15} dias.
            </p>
          </div>
        </form>
      )}

      {/* STAGE 2: ROULETTE */}
      {stage === 'roulette' && (
        <div className="space-y-6">
          <RewardRoulette
            rewards={rewards}
            onRewardSelected={handleRouletteWon}
            alreadySelectedReward={selectedReward}
            restaurantName={settings.name}
            rewardDelayHours={settings.rewardDelayHours ?? 24}
            rewardValidityDays={settings.rewardValidityDays ?? 15}
          />
        </div>
      )}

      {/* STAGE 3: DIGITAL VOUCHER */}
      {stage === 'voucher' && generatedReview && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Avaliação Concluída • Salve seu Voucher no WhatsApp!
            </span>
            <h2 className="text-2xl font-black text-stone-900">
              Obrigado por nos ajudar a melhorar!
            </h2>
            <p className="text-sm text-stone-600 max-w-md mx-auto">
              Aqui está seu prêmio de cortesia! Toque no botão verde do voucher para abrir seu WhatsApp e salvar seu brinde com segurança. Liberado para consumo em 24h e válido por {settings.rewardValidityDays || 15} dias no {settings.name}.
            </p>
          </div>

          <RewardVoucherCard
            rewardCode={generatedReview.rewardCode}
            rewardTitle={generatedReview.rewardTitle}
            tableNumber={generatedReview.tableNumber}
            customerName={generatedReview.customerName}
            customerPhone={generatedReview.customerPhone}
            restaurantName={settings.name}
            isClaimed={generatedReview.rewardClaimed}
            claimedAt={generatedReview.claimedAt}
            claimedTable={generatedReview.claimedTable ?? generatedReview.tableNumber}
            availableFrom={generatedReview.availableFrom}
            expiresAt={generatedReview.expiresAt}
            createdAt={generatedReview.createdAt}
            autoSendWhatsApp={settings.autoSendWhatsApp ?? true}
            autoSendMode={settings.autoSendMode ?? 'silent_api'}
            whatsappApiUrl={settings.whatsappApiUrl}
            whatsappApiToken={settings.whatsappApiToken}
          />

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={handleResetForNextCustomer}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1.5 mx-auto transition py-2 px-4 rounded-xl hover:bg-stone-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Realizar outra avaliação
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

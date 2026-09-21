import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, X, Sparkles, ChevronRight } from 'lucide-react';
import { tenantKey } from '../lib/tenant';
import type { Review, RewardOption, Waiter, RestaurantSettings } from '../types';

interface OnboardingChecklistProps {
  settings: RestaurantSettings;
  waiters: Waiter[];
  rewards: RewardOption[];
  reviews: Review[];
  onOpenQrDisplay?: () => void;
  onGoToTab: (tab: 'waiters' | 'rewards' | 'settings') => void;
}

const DISMISS_KEY = tenantKey('onboarding_dismissed');
const QR_OPENED_KEY = tenantKey('onboarding_qr_opened');

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({
  settings,
  waiters,
  rewards,
  reviews,
  onOpenQrDisplay,
  onGoToTab,
}) => {
  const [dismissed, setDismissed] = useState(true);
  const [qrOpened, setQrOpened] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
      setQrOpened(localStorage.getItem(QR_OPENED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const steps = [
    {
      key: 'identity',
      label: 'Personalize sua empresa',
      hint: 'Adicione a logo e confira o nome do estabelecimento.',
      done: Boolean(settings.logoUrl),
      action: () => onGoToTab('settings'),
      actionLabel: 'Ir para Configurações',
    },
    {
      key: 'waiters',
      label: 'Cadastre seus atendentes',
      hint: 'Cada garçom/atendente ganha um código para aparecer nas avaliações.',
      done: waiters.length > 0,
      action: () => onGoToTab('waiters'),
      actionLabel: 'Cadastrar atendente',
    },
    {
      key: 'rewards',
      label: 'Configure o brinde da roleta',
      hint: 'Defina qual cortesia o cliente ganha ao avaliar.',
      done: rewards.length > 0,
      action: () => onGoToTab('rewards'),
      actionLabel: 'Configurar brinde',
    },
    {
      key: 'qr',
      label: 'Gere e imprima as placas de QR Code',
      hint: 'Coloque nas mesas para os clientes escanearem.',
      done: qrOpened,
      action: () => {
        try { localStorage.setItem(QR_OPENED_KEY, '1'); } catch {}
        setQrOpened(true);
        onOpenQrDisplay?.();
      },
      actionLabel: 'Gerar placas',
    },
    {
      key: 'test',
      label: 'Faça uma avaliação de teste',
      hint: 'Escaneie o QR Code com seu celular e complete uma avaliação para ver o fluxo do cliente.',
      done: reviews.length > 0,
      action: null,
      actionLabel: '',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 sm:p-6 relative overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar guia de primeiros passos"
        className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-white transition cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-1">
        <span className="p-1.5 bg-rose-600 text-white rounded-lg shadow-xs">
          <Sparkles className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-black text-stone-900">
          {allDone ? 'Tudo pronto! Sua empresa está configurada' : 'Primeiros passos para começar a receber avaliações'}
        </h3>
      </div>

      <div className="flex items-center gap-2 mb-4 ml-9">
        <div className="flex-1 max-w-xs h-1.5 rounded-full bg-white overflow-hidden border border-rose-100">
          <div
            className="h-full bg-rose-600 transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-[11px] font-bold text-stone-500">{doneCount}/{steps.length}</span>
      </div>

      <div className="space-y-2 ml-1">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition ${
              step.done ? 'bg-white/60 border-emerald-100' : 'bg-white border-stone-200'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {step.done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-stone-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className={`text-xs font-bold ${step.done ? 'text-stone-500 line-through' : 'text-stone-900'}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">{step.hint}</p>
              </div>
            </div>
            {step.action && !step.done && (
              <button
                type="button"
                onClick={step.action}
                className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
              >
                {step.actionLabel}
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 ml-1 text-[11px] font-bold text-stone-500 hover:text-stone-800 underline"
        >
          Ocultar este guia
        </button>
      )}
    </div>
  );
};

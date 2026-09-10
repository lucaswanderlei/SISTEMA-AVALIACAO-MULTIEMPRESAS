import React, { useEffect, useRef, useState } from 'react';
import { Gift, CheckCircle2, Clock, Copy, Check, Sparkles, AlertCircle, UtensilsCrossed, Calendar, Phone, ExternalLink } from 'lucide-react';
import { generateQrCodeDataUrl } from '../lib/storage';

interface RewardVoucherCardProps {
  rewardCode: string;
  rewardTitle: string;
  tableNumber?: number;
  claimedTable?: number;
  restaurantName: string;
  isClaimed: boolean;
  claimedAt?: string;
  customerName?: string;
  customerPhone?: string;
  availableFrom?: string;
  expiresAt?: string;
  createdAt?: string;
  autoSendWhatsApp?: boolean;
  autoSendMode?: 'silent_api' | 'auto_open' | 'open_app';
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
}

export const RewardVoucherCard: React.FC<RewardVoucherCardProps> = ({
  rewardCode,
  rewardTitle,
  tableNumber,
  claimedTable,
  restaurantName,
  isClaimed,
  claimedAt,
  customerName,
  customerPhone,
  availableFrom,
  expiresAt,
  createdAt,
  autoSendWhatsApp = true,
  autoSendMode = 'silent_api',
  whatsappApiUrl,
  whatsappApiToken,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [hasRealGateway, setHasRealGateway] = useState<boolean | null>(null);
  const [autoSendStatus, setAutoSendStatus] = useState<'idle' | 'sending' | 'delivered' | 'failed'>('idle');
  const hasTriggeredAutoSend = useRef(false);

  const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now();

  // 24h Delay Calculation
  const availableDate = availableFrom
    ? new Date(availableFrom)
    : new Date(createdTime + 24 * 60 * 60 * 1000);

  // 15-Day Expiration Calculation
  const expiryDate = expiresAt
    ? new Date(expiresAt)
    : new Date(createdTime + 15 * 24 * 60 * 60 * 1000);

  const formattedAvailableDate = availableDate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedExpiryDate = expiryDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const nowMs = Date.now();
  const isAvailableNow = nowMs >= availableDate.getTime();
  const isExpired = !isClaimed && nowMs > expiryDate.getTime();
  const isPending24h = !isClaimed && !isExpired && !isAvailableNow;

  // Remaining hours for 24h unlock
  const remainingHours24 = Math.max(0, Math.ceil((availableDate.getTime() - nowMs) / (1000 * 60 * 60)));
  const diffDays = Math.max(0, Math.ceil((expiryDate.getTime() - nowMs) / (1000 * 60 * 60 * 24)));

  useEffect(() => {
    // Generate validation QR payload
    const payload = JSON.stringify({
      code: rewardCode,
      table: tableNumber || undefined,
      availableFrom: availableDate.toISOString(),
      expiresAt: expiryDate.toISOString(),
      action: 'validate_reward',
    });
    generateQrCodeDataUrl(payload).then(setQrCodeUrl);
  }, [rewardCode, tableNumber, availableDate, expiryDate]);

  const copyCode = () => {
    navigator.clipboard?.writeText(rewardCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // WhatsApp formatted message with start date, expiration date, and 1 per table rule
  const getVoucherWhatsAppMessage = () => {
    const firstName = customerName ? customerName.trim().split(' ')[0] : 'Cliente';
    return (
      `*VOUCHER DE CORTESIA - ${restaurantName.toUpperCase()}* 🥟✨\n\n` +
      `Olá ${firstName}! Aqui estão os detalhes do seu brinde conquistado na avaliação:\n\n` +
      `🎁 *Brinde:* ${rewardTitle}\n` +
      `🎟️ *Código de Resgate:* ${rewardCode}\n` +
      `📅 *Prazo de Início:* Liberado para resgate a partir de ${formattedAvailableDate} (24h após o sorteio)\n` +
      `⏳ *Prazo para Expirar:* Válido até ${formattedExpiryDate} (15 dias de validade)\n` +
      `⚠️ *Regra Importante:* Só é válido utilizar 1 cortesia/brinde por mesa!\n\n` +
      `Apresente este voucher ao garçom no ${restaurantName} durante sua próxima visita. Esperamos você! 💛`
    );
  };

  const getVoucherWhatsAppLink = () => {
    const text = encodeURIComponent(getVoucherWhatsAppMessage());
    if (customerPhone) {
      const clean = customerPhone.replace(/\D/g, '');
      const withDDI = clean.startsWith('55') ? clean : `55${clean}`;
      return `https://api.whatsapp.com/send?phone=${withDDI}&text=${text}`;
    }
    return `https://api.whatsapp.com/send?text=${text}`;
  };

  // Trigger silent WhatsApp send via server API
  const triggerSilentWhatsAppSend = async () => {
    if (!customerPhone || customerPhone.trim().length < 8) return;
    setAutoSendStatus('sending');
    try {
      const res = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customerPhone,
          customerName: customerName || 'Cliente',
          rewardTitle,
          rewardCode,
          restaurantName,
          availableFrom,
          expiresAt,
          apiUrl: whatsappApiUrl,
          apiToken: whatsappApiToken,
          templateMode: 'brinde_template',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setHasRealGateway(Boolean(data.hasRealGateway && data.success));
        setAutoSendStatus('delivered');
      } else {
        setHasRealGateway(false);
        setAutoSendStatus('delivered');
      }
    } catch (err) {
      console.warn('Silent WhatsApp send fallback:', err);
      setHasRealGateway(false);
      setAutoSendStatus('delivered');
    }
  };

  // Auto-send WhatsApp on mount
  useEffect(() => {
    if (
      autoSendWhatsApp &&
      customerPhone &&
      customerPhone.trim().length >= 8 &&
      !isClaimed &&
      !isExpired &&
      !hasTriggeredAutoSend.current
    ) {
      hasTriggeredAutoSend.current = true;

      if (autoSendMode === 'auto_open') {
        // Automatic direct launch of WhatsApp on the client's screen
        const timer = setTimeout(() => {
          try {
            window.open(getVoucherWhatsAppLink(), '_blank');
          } catch (e) {
            console.warn('Could not auto-open window:', e);
          }
        }, 1200);
        return () => clearTimeout(timer);
      } else {
        // Silent server-side API dispatch
        triggerSilentWhatsAppSend();
      }
    }
  }, [customerPhone, isClaimed, isExpired, autoSendWhatsApp, autoSendMode]);

  return (
    <div
      id={`voucher-card-${rewardCode}`}
      className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden max-w-md mx-auto"
    >
      {/* Top Header Ticket Band */}
      <div className="bg-stone-900 text-white p-5 text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-600/30 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-center gap-2 mb-1">
          <UtensilsCrossed className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-semibold tracking-wider uppercase text-stone-300">
            {restaurantName}
          </span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
          <span>Voucher de Cortesia</span>
          <Sparkles className="w-5 h-5 text-amber-400" />
        </h2>
        
        {/* Table info & 1 per table rule highlight */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {tableNumber && tableNumber > 0 ? (
            <div className="inline-flex items-center gap-1.5 bg-stone-800/90 px-3 py-1 rounded-full text-xs font-medium text-stone-300 border border-stone-700">
              <span>Mesa:</span>
              <strong className="text-white font-bold text-sm">#{tableNumber < 10 ? `0${tableNumber}` : tableNumber}</strong>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-stone-800/90 px-3 py-1 rounded-full text-xs font-semibold text-amber-300 border border-stone-700">
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              <span>Apresente ao garçom</span>
            </div>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
            ⚠️ 1 por mesa
          </span>
        </div>
      </div>

      {/* Ticket Cutout Divider */}
      <div className="relative flex items-center justify-between px-3 bg-white">
        <div className="w-6 h-6 bg-stone-100 rounded-full -ml-6 border-r border-stone-200" />
        <div className="flex-1 border-b-2 border-dashed border-stone-200 mx-2" />
        <div className="w-6 h-6 bg-stone-100 rounded-full -mr-6 border-l border-stone-200" />
      </div>

      {/* Body Content */}
      <div className="p-6 text-center">
        {/* Status when Claimed or Expired */}
        {isClaimed ? (
          <div className="mb-4">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border-2 border-rose-300 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>⛔ VOUCHER JÁ UTILIZADO • USO ÚNICO</span>
            </div>
          </div>
        ) : isExpired ? (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Voucher Expirado (Prazo de 15 dias encerrado)
            </span>
          </div>
        ) : null}

        {/* Reward Title */}
        <div className={`border rounded-2xl p-4 mb-4 transition-all ${
          isClaimed
            ? 'bg-stone-50 border-stone-200 opacity-80'
            : 'bg-rose-50/70 border-rose-100'
        }`}>
          <div className={`w-12 h-12 mx-auto mb-2 rounded-xl flex items-center justify-center shadow-md ${
            isClaimed
              ? 'bg-stone-400 text-white'
              : 'bg-rose-600 text-white shadow-rose-200'
          }`}>
            <Gift className="w-6 h-6" />
          </div>
          <div className="text-xs uppercase font-bold text-rose-600 tracking-wider mb-1">
            Seu Prêmio Conquistado na Roleta
          </div>
          <div className={`text-xl font-bold leading-tight ${isClaimed ? 'line-through text-stone-500' : 'text-stone-900'}`}>
            {rewardTitle}
          </div>
          <div className="mt-3 pt-2.5 border-t border-rose-200/60 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-700">
            {customerName && (
              <div className="flex items-center gap-1">
                <span className="text-stone-500 font-medium">Cliente:</span>
                <span className="font-extrabold text-stone-900">{customerName}</span>
              </div>
            )}
            {tableNumber && tableNumber > 0 ? (
              <span className="bg-stone-200/80 px-2 py-0.5 rounded-md font-bold text-stone-800">
                Mesa #{tableNumber < 10 ? `0${tableNumber}` : tableNumber}
              </span>
            ) : (
              <span className="bg-stone-200/80 px-2 py-0.5 rounded-md text-stone-600 text-[11px]">
                Balcão / Geral
              </span>
            )}
            {customerPhone && (
              <span className="text-stone-500 font-mono text-[11px]">({customerPhone})</span>
            )}
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 mb-4 flex flex-col items-center relative">
          <div className="text-xs font-medium text-stone-500 mb-2">
            {isClaimed
              ? 'Código baixado e inutilizado no sistema:'
              : 'Apresente este código ao seu garçom ou no caixa:'}
          </div>
          {qrCodeUrl ? (
            <div className="p-2 bg-white rounded-xl shadow-sm border border-stone-200 relative overflow-hidden">
              <img
                src={qrCodeUrl}
                alt="QR Code de Resgate"
                className={`w-44 h-44 object-contain transition-all ${
                  isClaimed ? 'opacity-25 grayscale' : ''
                }`}
              />
              {isClaimed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900/40 backdrop-blur-[1px]">
                  <div className="bg-rose-600 text-white font-black text-sm uppercase px-4 py-1.5 rounded-lg shadow-lg rotate-[-12deg] tracking-wider border-2 border-white">
                    UTILIZADO
                  </div>
                  <span className="text-[10px] text-white font-bold mt-1.5 bg-black/60 px-2 py-0.5 rounded">
                    Uso Único
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="w-44 h-44 bg-stone-200 rounded-xl animate-pulse flex items-center justify-center text-xs text-stone-500">
              Carregando QR...
            </div>
          )}

          {/* Numeric Code */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className={`font-mono text-xl font-extrabold tracking-widest px-3 py-1.5 rounded-lg border shadow-sm ${
              isClaimed
                ? 'bg-stone-100 text-stone-400 border-stone-200 line-through'
                : 'bg-white text-stone-800 border-stone-300'
            }`}>
              {rewardCode}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="p-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 transition"
              title="Copiar código"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 24h & 30-Day Validity Highlight Card */}
        <div
          className={`flex items-start gap-3 text-left rounded-2xl p-4 mb-4 border transition-all ${
            isClaimed
              ? 'bg-stone-50 border-stone-200 text-stone-700'
              : isExpired
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : isPending24h
              ? 'bg-amber-50/90 border-amber-200 text-amber-950 shadow-xs'
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-xs'
          }`}
        >
          <div
            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              isClaimed
                ? 'bg-stone-200 text-stone-600'
                : isExpired
                ? 'bg-rose-200 text-rose-700'
                : isPending24h
                ? 'bg-amber-200 text-amber-800'
                : 'bg-emerald-200 text-emerald-800'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-black text-sm">
                {isClaimed
                  ? 'Cortesia Utilizada'
                  : isExpired
                  ? 'Prazo Expirado'
                  : isPending24h
                  ? 'Carência de 24h (Próxima Visita)'
                  : 'Pronto para Consumo!'}
              </span>
              <span
                className={`text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full ${
                  isClaimed
                    ? 'bg-stone-200 text-stone-700'
                    : isExpired
                    ? 'bg-rose-200 text-rose-800'
                    : isPending24h
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                Válido até: {formattedExpiryDate}
              </span>
            </div>

            {isClaimed ? (
              <p className="text-xs leading-relaxed opacity-90">
                Este brinde já foi resgatado e entregue pela equipe do {restaurantName}.
              </p>
            ) : isExpired ? (
              <p className="text-xs leading-relaxed opacity-90">
                O prazo de 15 dias para uso deste voucher se encerrou em {formattedExpiryDate}.
              </p>
            ) : isPending24h ? (
              <div className="space-y-1">
                <p className="text-xs leading-relaxed font-medium">
                  ⏰ <strong>Liberado a partir de:</strong> {formattedAvailableDate} (aproximadamente {remainingHours24}h restantes).
                </p>
                <p className="text-[11px] leading-relaxed opacity-85">
                  Conforme o regulamento, o brinde é ativado 24 horas após o sorteio e você tem até <strong>15 dias</strong> para saborear no restaurante!
                </p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed opacity-90">
                Seu brinde está liberado para resgate! Apresente este voucher ao garçom no {restaurantName}. Você ainda tem <strong>{diffDays} dias</strong> para utilizar.
              </p>
            )}
          </div>
        </div>

        {/* Regulation / Terms & 1-per-table rule */}
        <div className="flex items-start gap-2 text-left bg-stone-50 border border-stone-200/80 rounded-xl p-3 text-[11px] text-stone-600 mb-5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p>
              <strong>Regulamento:</strong> <span className="text-amber-800 font-extrabold">Válido utilizar apenas 1 voucher por mesa.</span> Brinde liberado para resgate a partir de 24h após o sorteio, com prazo total de 15 dias para uso. Apresente este código ao garçom durante o atendimento no {restaurantName}.
            </p>
            <p className="text-stone-700">
              ⚠️ <strong>Limite por Mesa:</strong> Não é cumulativo; cada mesa pode resgatar no máximo 1 cortesia por visita.
            </p>
            <p className="text-amber-900 font-semibold">
              🔒 <strong>Uso Único:</strong> Este voucher só pode ser utilizado uma única vez. Após a validação da cortesia pelo garçom ou no caixa, o voucher é baixado e fica permanentemente inativo.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!isClaimed && !isExpired && (
            <div className="space-y-2.5">
              <a
                id="btn-primary-open-whatsapp"
                href={getVoucherWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-4 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-2xl text-base font-black transition flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/30 active:scale-[0.98] text-center cursor-pointer"
              >
                <Phone className="w-5 h-5 fill-white" />
                <span>📲 Abrir no WhatsApp e Guardar Voucher</span>
                <ExternalLink className="w-4 h-4 opacity-90" />
              </a>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-copy-code"
                  onClick={copyCode}
                  className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Código Copiado!' : 'Copiar Código'}</span>
                </button>

                <button
                  type="button"
                  id="btn-copy-message"
                  onClick={() => {
                    navigator.clipboard?.writeText(getVoucherWhatsAppMessage());
                    setCopiedMessage(true);
                    setTimeout(() => setCopiedMessage(false), 2500);
                  }}
                  className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  {copiedMessage ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedMessage ? 'Mensagem Copiada!' : 'Copiar Texto Zap'}</span>
                </button>
              </div>
            </div>
          )}

          {isClaimed && (
            <div className="p-3.5 rounded-xl bg-stone-100 border border-stone-300 text-stone-500 text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-stone-400" />
              <span>Voucher já utilizado e baixado (Uso Único)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

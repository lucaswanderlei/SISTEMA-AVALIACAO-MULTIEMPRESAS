import React, { useEffect, useState } from 'react';
import {
  QrCode,
  Printer,
  Sparkles,
  UtensilsCrossed,
  Gift,
  ExternalLink,
  ChevronRight,
  Download,
  Check,
  Smartphone,
  Layers,
  Copy,
  Info,
  Sliders,
  Scissors,
  RotateCcw,
  Globe,
  Radio,
} from 'lucide-react';
import { RestaurantSettings } from '../types';
import { generateQrCodeDataUrl } from '../lib/storage';

interface TableQrDisplayProps {
  currentTable: number;
  totalTables: number;
  settings: RestaurantSettings;
  onSelectTable: (tbl: number) => void;
  onOpenCustomerView: (tbl: number) => void;
}

export const TableQrDisplay: React.FC<TableQrDisplayProps> = ({
  currentTable,
  totalTables,
  settings,
  onSelectTable,
  onOpenCustomerView,
}) => {
  // Mode: 'universal' (one QR code for all tables) vs 'individual' (per-table QR codes)
  const [qrMode, setQrMode] = useState<'universal' | 'individual'>('universal');
  const [universalPrintFormat, setUniversalPrintFormat] = useState<'display_10x8' | 'grid_10x8' | 'stand_10x15'>('display_10x8');
  const [individualPrintFormat, setIndividualPrintFormat] = useState<'single' | 'all'>('single');

  const [selectedMesa, setSelectedMesa] = useState<number>(currentTable > 0 ? currentTable : 1);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [showDomainEditor, setShowDomainEditor] = useState<boolean>(false);

  // Plaque personalization
  const [plaqueTitle, setPlaqueTitle] = useState('Sua opinião vale brinde!');
  const [plaqueSubtitle, setPlaqueSubtitle] = useState('Aponte a câmera do celular e avalie sua experiência');

  const getAutoDetectedDomain = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}`;
    }
    return 'https://seurestaurante.com.br/';
  };

  // Custom base domain if manager wants to customize (defaults to current location)
  const [customDomain, setCustomDomain] = useState<string>(getAutoDetectedDomain);

  // Calculate clean universal URL (for customers scanning the table QR code - locks out manager panel)
  const getUniversalUrl = () => {
    try {
      const url = new URL(customDomain.trim());
      url.searchParams.delete('mesa');
      url.searchParams.set('cliente', '1');
      return url.toString();
    } catch {
      const base = customDomain.trim();
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}cliente=1`;
    }
  };

  // Calculate table-specific URL (for customers scanning table QR code - locks out manager panel)
  const getTableUrl = (tbl: number) => {
    try {
      const url = new URL(customDomain.trim());
      url.searchParams.set('mesa', String(tbl));
      url.searchParams.set('cliente', '1');
      return url.toString();
    } catch {
      const base = customDomain.trim();
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}mesa=${tbl}&cliente=1`;
    }
  };

  // Target URL based on active mode
  const currentTargetUrl = qrMode === 'universal' ? getUniversalUrl() : getTableUrl(selectedMesa);

  useEffect(() => {
    generateQrCodeDataUrl(currentTargetUrl).then(setQrCodeUrl);
  }, [currentTargetUrl, qrMode, selectedMesa]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQr = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download =
      qrMode === 'universal'
        ? `qrcode-universal-${settings.name.toLowerCase().replace(/\s+/g, '-')}.png`
        : `qrcode-mesa-${selectedMesa}-${settings.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="table-qr-display-container" className="space-y-6">
      {/* Top Header & Mode Selector (hidden in print) */}
      <div className="no-print bg-white rounded-3xl p-6 border border-stone-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-100 text-rose-700 rounded-xl shadow-xs">
              <QrCode className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">
              Placas & QR Codes de Avaliação • {settings.name}
            </h2>
          </div>
          <p className="text-sm text-stone-600 max-w-2xl">
            Gere totens de acrílico ou adesivos para seus clientes avaliarem os 4 quesitos
            (atendimento, ambiente, produtos, tempo de espera) e ganharem brindes na hora — sem necessidade de identificar a mesa.
          </p>
        </div>

        {/* Primary QR Mode Switcher: Universal vs Individual */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              id="qr-mode-universal-btn"
              type="button"
              onClick={() => setQrMode('universal')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
                qrMode === 'universal'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>QR Code Único (Recomendado)</span>
            </button>

            <button
              id="qr-mode-individual-btn"
              type="button"
              onClick={() => setQrMode('individual')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                qrMode === 'individual'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Placas com Número de Mesa</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: QR CODE ÚNICO (RECOMENDADO PARA TODAS AS MESAS DO SR. COXITA)     */}
      {/* ========================================================================= */}
      {qrMode === 'universal' && (
        <div className="space-y-6">
          {/* Informative Banner */}
          <div className="no-print p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-amber-950 text-sm sm:text-base">
                  Como funciona o QR Code no {settings.name}?
                </h3>
                <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                  Você só precisa imprimir <strong>um modelo único de plaquinha ou adesivo</strong> e espalhar pelo salão, balcão e mesas!
                  O cliente aponta a câmera do celular, dá a nota de 1 a 5 estrelas e ganha o brinde na hora — <strong>sem precisar digitar nem identificar mesa</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setUniversalPrintFormat('display_10x8')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  universalPrintFormat === 'display_10x8'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Plaquinha 10x8 cm (Mesa)</span>
              </button>

              <button
                type="button"
                onClick={() => setUniversalPrintFormat('grid_10x8')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  universalPrintFormat === 'grid_10x8'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Folha A4 (4 por Folha)</span>
              </button>

              <button
                type="button"
                onClick={() => setUniversalPrintFormat('stand_10x15')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  universalPrintFormat === 'stand_10x15'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Totem 10x15 cm</span>
              </button>
            </div>
          </div>

          {/* Grid Layout: Config & Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Control Column (no-print) */}
            <div className="no-print lg:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm space-y-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Configurações Rápidas
                </span>
                <h3 className="text-base font-extrabold text-stone-900 mt-0.5">
                  Display de Mesa Personalizado
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Gere a plaquinha com o QR Code para colocar no display de acrílico 10x8 cm das mesas.
                </p>
              </div>

              {/* Personalization Fields */}
              <div className="space-y-3 p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Personalizar Textos da Plaquinha:</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Título / Chamada Principal:
                  </label>
                  <input
                    type="text"
                    value={plaqueTitle}
                    onChange={(e) => setPlaqueTitle(e.target.value)}
                    placeholder="Sua opinião vale brinde!"
                    className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white focus:border-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Subtítulo / Instrução:
                  </label>
                  <input
                    type="text"
                    value={plaqueSubtitle}
                    onChange={(e) => setPlaqueSubtitle(e.target.value)}
                    placeholder="Aponte a câmera do celular e avalie sua experiência"
                    className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Real-time Central Sync Badge */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>Sincronização com o Sistema: ATIVA</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-tight">
                  Quando o cliente escaneia o QR Code na mesa e finaliza a avaliação no celular, ela <strong>cai instantaneamente na tela do seu painel</strong> com som de aviso.
                </p>
              </div>

              {/* URL & Domain Configuration Box */}
              <div className="space-y-2 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-rose-600" />
                    <span>Link do QR Code:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDomainEditor(!showDomainEditor)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                  >
                    {showDomainEditor ? 'Ocultar ajuste' : 'Ajustar URL base'}
                  </button>
                </div>

                {showDomainEditor && (
                  <div className="space-y-1.5 pt-1 border-t border-stone-200">
                    <span className="text-[11px] text-stone-500 block">
                      Endereço base do seu restaurante ou link de acesso:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customDomain}
                        onChange={(e) => setCustomDomain(e.target.value)}
                        placeholder="https://seurestaurante.com.br"
                        className="w-full text-xs p-2 rounded-xl border border-stone-300 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomDomain(getAutoDetectedDomain())}
                        title="Restaurar endereço padrão detectado"
                        className="p-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl transition shrink-0 cursor-pointer text-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Encoded URL preview */}
                <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-[11px] font-mono text-stone-700 break-all select-all flex items-center justify-between gap-2">
                  <span className="truncate">{currentTargetUrl}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(currentTargetUrl)}
                      className="p-1 hover:bg-stone-100 rounded text-stone-600 transition cursor-pointer"
                      title="Copiar URL para testar"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={currentTargetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:bg-stone-100 rounded text-stone-600 transition"
                      title="Abrir em Nova Aba"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <Check className="w-3 h-3" />
                    Modo Cliente Protegido (sem painel)
                  </span>
                  {copied && <span className="text-emerald-600 font-bold">Link copiado!</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-3 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-black flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  Imprimir Plaquinha de Mesa (10x8 cm)
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-stone-600" />
                  Baixar Imagem do QR Code (PNG)
                </button>

                <a
                  href={currentTargetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer text-center"
                >
                  <ExternalLink className="w-4 h-4" />
                  Simular Escaneamento no Celular (Nova Aba)
                </a>
              </div>

              {/* Instructions Guide */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-2 text-xs text-stone-600">
                <div className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-rose-600" />
                  Dica de Aplicação para Display 10x8 cm:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-600 pl-1 leading-relaxed">
                  <li><strong>Formato 10x8 cm:</strong> Dimensão padrão para displays de mesa acrílicos horizontais (tipo T ou L).</li>
                  <li><strong>Papel Recomendado:</strong> Papel fotográfico ou couchê 180g a 240g para cores vívidas e alta durabilidade.</li>
                  <li><strong>Segurança Garantida:</strong> O cliente nunca consegue navegar para métricas, histórico de pedidos ou configurações do restaurante.</li>
                </ul>
              </div>
            </div>

            {/* Right Printable Display Preview Column */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="no-print flex items-center justify-between w-full max-w-md mb-3 px-1">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  {universalPrintFormat === 'display_10x8'
                    ? 'Prévia: Plaquinha de Mesa 10x8 cm'
                    : universalPrintFormat === 'grid_10x8'
                    ? 'Prévia: Folha A4 com 4 Plaquinhas 10x8 cm'
                    : 'Prévia: Totem Vertical 10x15 cm'}
                </span>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>

              {/* FORMAT 1: Display 10x8 cm (Padrão de Mesa) */}
              {universalPrintFormat === 'display_10x8' && (
                <div className="printable-area w-full flex justify-center">
                  <TableDisplayCard10x8
                    settings={settings}
                    qrCodeUrl={qrCodeUrl}
                    title={plaqueTitle}
                    subtitle={plaqueSubtitle}
                  />
                </div>
              )}

              {/* FORMAT 2: Grid 4 on A4 */}
              {universalPrintFormat === 'grid_10x8' && (
                <div className="printable-area w-full max-w-2xl bg-white p-4 sm:p-6 rounded-3xl border border-stone-200 shadow-lg">
                  <div className="no-print text-center text-xs text-stone-500 mb-4 pb-3 border-b border-stone-100 flex items-center justify-center gap-2">
                    <Scissors className="w-4 h-4 text-stone-400" />
                    <span>Folha A4 com 4 plaquinhas 10x8 cm prontas para recorte</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TableDisplayCard10x8 settings={settings} qrCodeUrl={qrCodeUrl} title={plaqueTitle} subtitle={plaqueSubtitle} compact />
                    <TableDisplayCard10x8 settings={settings} qrCodeUrl={qrCodeUrl} title={plaqueTitle} subtitle={plaqueSubtitle} compact />
                    <TableDisplayCard10x8 settings={settings} qrCodeUrl={qrCodeUrl} title={plaqueTitle} subtitle={plaqueSubtitle} compact />
                    <TableDisplayCard10x8 settings={settings} qrCodeUrl={qrCodeUrl} title={plaqueTitle} subtitle={plaqueSubtitle} compact />
                  </div>
                </div>
              )}

              {/* FORMAT 3: Stand 10x15 cm */}
              {universalPrintFormat === 'stand_10x15' && (
                <div className="printable-area w-full flex justify-center">
                  <AcrylicStandCard settings={settings} qrCodeUrl={qrCodeUrl} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: PLACAS INDIVIDUAIS POR MESA (OPCIONAL)                            */}
      {/* ========================================================================= */}
      {qrMode === 'individual' && (
        <div className="space-y-6">
          <div className="no-print bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs text-stone-700 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-stone-600" />
              <span>
                Modo de Placas Individuais: cada mesa recebe uma placa impressa com seu próprio número embutido no QR Code.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIndividualPrintFormat('single')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  individualPrintFormat === 'single'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Mesa Individual
              </button>
              <button
                type="button"
                onClick={() => setIndividualPrintFormat('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  individualPrintFormat === 'all'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Todas as {totalTables} Mesas
              </button>
            </div>
          </div>

          {individualPrintFormat === 'single' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Table Selector bar */}
              <div className="no-print lg:col-span-4 bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
                <h3 className="font-bold text-stone-900 text-sm flex items-center justify-between">
                  <span>Selecione a Mesa</span>
                  <span className="text-xs font-normal text-stone-500">Total: {totalTables}</span>
                </h3>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
                  {Array.from({ length: totalTables }, (_, i) => i + 1).map((tbl) => {
                    const isSelected = tbl === selectedMesa;
                    return (
                      <button
                        key={tbl}
                        type="button"
                        onClick={() => {
                          setSelectedMesa(tbl);
                          onSelectTable(tbl);
                        }}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        #{tbl < 10 ? `0${tbl}` : tbl}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <div className="text-xs text-stone-500">
                    Link com parâmetro pré-definido:
                  </div>
                  <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-[11px] font-mono text-stone-600 break-all select-all">
                    {getTableUrl(selectedMesa)}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenCustomerView(selectedMesa)}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Smartphone className="w-4 h-4" />
                    Abrir como Cliente na Mesa #{selectedMesa}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Realistic Printable 10x8 Display Card for Specific Table */}
              <div className="lg:col-span-8 flex flex-col items-center">
                <div className="no-print flex items-center justify-between w-full max-w-md mb-3 px-1">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    Prévia: Plaquinha Mesa #{selectedMesa} (10x8 cm)
                  </span>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Plaquinha
                  </button>
                </div>
                <div className="printable-area w-full flex justify-center">
                  <TableDisplayCard10x8
                    settings={settings}
                    qrCodeUrl={qrCodeUrl}
                    tableNumber={selectedMesa}
                    title={plaqueTitle}
                    subtitle={plaqueSubtitle}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ALL TABLES GRID */
            <div className="space-y-4">
              <div className="no-print p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center justify-between">
                <span>
                  Exibindo todas as <strong>{totalTables} mesas</strong>. Use o botão <strong>"Imprimir"</strong> para imprimir todas as placas em lote.
                </span>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Lote
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {Array.from({ length: totalTables }, (_, i) => i + 1).map((tbl) => (
                  <SingleIndividualTableCard
                    key={tbl}
                    tableNumber={tbl}
                    settings={settings}
                    targetUrl={getTableUrl(tbl)}
                    onOpenCustomerView={onOpenCustomerView}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =========================================================================
// TABLE DISPLAY CARD (PLAQUINHA HORIZONTAL 10x8 CM PARA MESAS)
// =========================================================================
interface TableDisplayCard10x8Props {
  settings: RestaurantSettings;
  qrCodeUrl: string;
  tableNumber?: number;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const TableDisplayCard10x8: React.FC<TableDisplayCard10x8Props> = ({
  settings,
  qrCodeUrl,
  tableNumber,
  title = 'Sua opinião vale brinde!',
  subtitle = 'Aponte a câmera do celular e avalie sua experiência',
  compact = false,
}) => {
  return (
    <div
      className={`relative w-full ${
        compact ? 'max-w-xs p-3.5 rounded-xl' : 'max-w-[430px] p-5 sm:p-6 rounded-2xl'
      } bg-stone-950 text-white shadow-2xl border-2 border-stone-800 text-left overflow-hidden flex flex-col justify-between print:border print:border-stone-400 print:shadow-none print:bg-stone-950`}
      style={{ aspectRatio: '10 / 8' }}
    >
      {/* Acrylic Glare Effect */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      <div className="absolute -top-12 -right-12 w-28 h-28 bg-rose-600/20 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header: Brand & Table Number */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-600 text-white flex items-center justify-center shadow-xs">
            <UtensilsCrossed className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-sm font-black tracking-tight leading-none text-white">
              {settings.name}
            </div>
            <div className="text-[9px] text-stone-400 leading-tight mt-0.5">
              {settings.tagline}
            </div>
          </div>
        </div>

        {tableNumber ? (
          <span className="bg-rose-600 text-white font-black text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            MESA #{tableNumber < 10 ? `0${tableNumber}` : tableNumber}
          </span>
        ) : (
          <span className="bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
            <Sparkles className="w-2.5 h-2.5 text-amber-200" />
            AVALIE & GANHE
          </span>
        )}
      </div>

      {/* Card Body: QR Code (Left) + Text & Steps (Right) */}
      <div className="flex items-center gap-4 my-auto py-2">
        {/* QR Code Container */}
        <div className="bg-white p-2 rounded-xl shadow-md border border-stone-300 text-center shrink-0">
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="QR Code de Avaliação"
              className={`${compact ? 'w-24 h-24' : 'w-28 h-28 sm:w-32 sm:h-32'} object-contain`}
            />
          ) : (
            <div className={`${compact ? 'w-24 h-24' : 'w-28 h-28 sm:w-32 sm:h-32'} bg-stone-100 flex items-center justify-center text-[10px] text-stone-400`}>
              Gerando QR...
            </div>
          )}
          <div className="text-[8px] font-black text-stone-800 mt-1 uppercase tracking-wider">
            Aponte a Câmera
          </div>
        </div>

        {/* Right Call to Action & Steps */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <h4 className={`${compact ? 'text-xs' : 'text-sm sm:text-base'} font-black text-amber-300 leading-tight`}>
            {title}
          </h4>
          <p className="text-[10px] sm:text-[11px] text-stone-300 leading-tight">
            {subtitle}
          </p>

          <div className="space-y-0.5 pt-1 text-[9px] sm:text-[10px] text-stone-300 font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">1</span>
              <span>Aponte a câmera do celular</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">2</span>
              <span>Dê sua nota de 1 a 5 estrelas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">3</span>
              <span className="text-amber-300 font-bold">Gire a roleta e ganhe seu brinde!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[9px] text-stone-400">
        <span>Rápido • Menos de 1 minuto</span>
        <span className="text-amber-400 font-semibold flex items-center gap-1">
          <Gift className="w-2.5 h-2.5" />
          Cortesia Válida por {settings.rewardValidityDays || 15} dias
        </span>
      </div>
    </div>
  );
};

// =========================================================================
// ACRYLIC STAND CARD (DISPLAY REALISTA 10x15 CM)
// =========================================================================
interface AcrylicStandCardProps {
  settings: RestaurantSettings;
  qrCodeUrl: string;
  tableNumber?: number; // if provided, shows specific table number; if omitted, shows universal badge
  compact?: boolean;
}

const AcrylicStandCard: React.FC<AcrylicStandCardProps> = ({
  settings,
  qrCodeUrl,
  tableNumber,
  compact = false,
}) => {
  return (
    <div
      className={`relative w-full ${
        compact ? 'max-w-xs p-4 rounded-2xl' : 'max-w-sm p-6 sm:p-7 rounded-3xl'
      } bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white shadow-2xl border-4 border-stone-800 text-center overflow-hidden`}
    >
      {/* Glossy Acrylic Reflections */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-500/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center justify-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white flex items-center justify-center shadow-md shadow-rose-900/50">
          <UtensilsCrossed className="w-4 h-4" />
        </div>
        <div className="text-left">
          <div className="text-base font-black tracking-tight leading-none text-white">
            {settings.name}
          </div>
          <div className="text-[10px] text-stone-400 leading-tight mt-0.5">
            {settings.tagline}
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="my-2.5 inline-block">
        {tableNumber ? (
          <span className="bg-rose-600 text-white font-black text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow">
            MESA #{tableNumber < 10 ? `0${tableNumber}` : tableNumber}
          </span>
        ) : (
          <span className="bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-[11px] px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-200" />
            AVALIE & GANHE SEU BRINDE
          </span>
        )}
      </div>

      {/* Call to action */}
      <h3
        className={`${
          compact ? 'text-base' : 'text-lg'
        } font-black text-amber-300 leading-tight mb-1`}
      >
        Cadastre Nome & WhatsApp • Ganhe Brinde!
      </h3>
      <p className="text-[11px] text-stone-300 mb-3 px-1 leading-relaxed">
        Aponte a câmera do celular, avalie sua visita e cadastre seus dados para receber um brinde válido por {settings.rewardValidityDays || 15} dias.
      </p>

      {/* High-Resolution QR Code Frame */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xl inline-block mx-auto border-2 border-stone-200">
        {qrCodeUrl ? (
          <img
            src={qrCodeUrl}
            alt="QR Code de Avaliação"
            className={`${compact ? 'w-36 h-36' : 'w-48 h-48'} object-contain mx-auto`}
          />
        ) : (
          <div
            className={`${
              compact ? 'w-36 h-36' : 'w-48 h-48'
            } bg-stone-100 flex items-center justify-center text-xs text-stone-400`}
          >
            Gerando QR Code...
          </div>
        )}
        <div className="text-[10px] font-bold text-stone-800 mt-1 uppercase tracking-wider">
          Abra a câmera e aponte
        </div>
      </div>

      {/* Step guide */}
      <div className="mt-3 text-[11px] text-stone-300 space-y-0.5">
        <div className="text-stone-400 font-medium">
          1. Aponte a câmera • 2. Cadastre Nome & Telefone • 3. Brinde válido por {settings.rewardValidityDays || 15} dias!
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// INDIVIDUAL MINI CARD (FOR BATCH VIEW)
// =========================================================================
interface SingleIndividualTableCardProps {
  tableNumber: number;
  settings: RestaurantSettings;
  targetUrl: string;
  onOpenCustomerView: (tbl: number) => void;
}

const SingleIndividualTableCard: React.FC<SingleIndividualTableCardProps> = ({
  tableNumber,
  settings,
  targetUrl,
  onOpenCustomerView,
}) => {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    generateQrCodeDataUrl(targetUrl).then(setQrUrl);
  }, [targetUrl]);

  return (
    <div className="bg-stone-900 text-white rounded-2xl p-5 border border-stone-800 text-center relative shadow">
      <div className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
        {settings.name}
      </div>
      <div className="bg-rose-600 text-white font-extrabold text-xs px-3 py-0.5 rounded-full inline-block mb-2">
        MESA #{tableNumber < 10 ? `0${tableNumber}` : tableNumber}
      </div>
      <div className="text-sm font-bold text-amber-300 mb-2">
        Avalie & Ganhe Brinde
      </div>

      <div className="bg-white p-2.5 rounded-xl inline-block mx-auto mb-2">
        {qrUrl ? (
          <img src={qrUrl} alt={`QR Mesa ${tableNumber}`} className="w-32 h-32 object-contain" />
        ) : (
          <div className="w-32 h-32 bg-stone-100" />
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-300 font-medium">
        <Gift className="w-3.5 h-3.5 text-amber-400" />
        <span>Cortesia garantida (Válida {settings.rewardValidityDays || 15} dias)</span>
      </div>

      <button
        type="button"
        onClick={() => onOpenCustomerView(tableNumber)}
        className="no-print mt-3 w-full py-1.5 text-[11px] font-bold text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg transition cursor-pointer"
      >
        Testar mesa #{tableNumber}
      </button>
    </div>
  );
};

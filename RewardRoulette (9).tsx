import React, { useState, useRef, useEffect } from 'react';
import { Gift, Sparkles, Award, Clock, Calendar, CheckCircle2, ChevronRight, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';
import { RewardOption } from '../types';

interface RewardRouletteProps {
  rewards: RewardOption[];
  onRewardSelected: (reward: RewardOption) => void;
  alreadySelectedReward?: RewardOption | null;
  restaurantName?: string;
  rewardDelayHours?: number;
  rewardValidityDays?: number;
}

// Harmonious slice color palette for food & rewards
const SLICE_COLORS = [
  { bg: '#e11d48', text: '#ffffff', border: '#be123c' }, // Ruby Rose
  { bg: '#d97706', text: '#ffffff', border: '#b45309' }, // Warm Amber
  { bg: '#059669', text: '#ffffff', border: '#047857' }, // Emerald
  { bg: '#4f46e5', text: '#ffffff', border: '#4338ca' }, // Indigo
  { bg: '#ea580c', text: '#ffffff', border: '#c2410c' }, // Orange
  { bg: '#7c3aed', text: '#ffffff', border: '#6d28d9' }, // Violet
  { bg: '#0284c7', text: '#ffffff', border: '#0369a1' }, // Sky
  { bg: '#db2777', text: '#ffffff', border: '#be185d' }, // Pink
];

/**
 * Web Audio API synthesizer for the roulette spinning music & fanfare.
 * Generates an energetic game-show / carnival melody + decelerating peg clicks.
 */
class RouletteSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private activeNodes: Array<{ osc?: OscillatorNode; gain?: GainNode }> = [];
  private tickTimeouts: number[] = [];

  constructor() {}

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getAudioContext(): AudioContext | null {
    if (this.isMuted) return null;
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!this.ctx || this.ctx.state === 'closed') {
          this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return this.ctx;
      }
    } catch (e) {
      console.warn('AudioContext error', e);
    }
    return null;
  }

  // Play a musical note with smooth envelope
  private playTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume: number = 0.12
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack & decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);

      this.activeNodes.push({ osc, gain });
    } catch {}
  }

  // Play roulette wheel mechanical peg click
  private playClick(ctx: AudioContext, time: number, pitch = 750) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, time);
      osc.frequency.exponentialRampToValueAtTime(160, time + 0.035);

      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.04);

      this.activeNodes.push({ osc, gain });
    } catch {}
  }

  // Play upbeat game show / carnival music while wheel is spinning (4.2 seconds)
  public playSpinMusic() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.stop();
    const now = ctx.currentTime;

    // 1. Cheerful upbeat melody (Major scale arpeggios & bouncy carnival notes)
    // Notes: C5=523.25, D5=587.33, E5=659.25, F5=698.46, G5=783.99, A5=880.00, B5=987.77, C6=1046.50
    const melody = [
      // Bar 1: Fast exciting opening (0.0s to 1.3s)
      { freq: 523.25, time: 0.00, dur: 0.12, type: 'triangle' }, // C5
      { freq: 659.25, time: 0.13, dur: 0.12, type: 'triangle' }, // E5
      { freq: 783.99, time: 0.26, dur: 0.12, type: 'triangle' }, // G5
      { freq: 1046.50, time: 0.39, dur: 0.16, type: 'sine' },     // C6
      { freq: 880.00, time: 0.55, dur: 0.12, type: 'triangle' },  // A5
      { freq: 783.99, time: 0.68, dur: 0.12, type: 'triangle' },  // G5
      { freq: 659.25, time: 0.81, dur: 0.12, type: 'triangle' },  // E5
      { freq: 587.33, time: 0.94, dur: 0.14, type: 'triangle' },  // D5
      { freq: 523.25, time: 1.10, dur: 0.12, type: 'triangle' },  // C5
      { freq: 659.25, time: 1.23, dur: 0.12, type: 'triangle' },  // E5

      // Bar 2: Bouncy variation & high sparkle (1.35s to 2.7s)
      { freq: 783.99, time: 1.38, dur: 0.14, type: 'triangle' },  // G5
      { freq: 987.77, time: 1.54, dur: 0.16, type: 'sine' },      // B5
      { freq: 1046.50, time: 1.72, dur: 0.14, type: 'sine' },     // C6
      { freq: 1174.66, time: 1.90, dur: 0.16, type: 'sine' },     // D6
      { freq: 1046.50, time: 2.10, dur: 0.15, type: 'triangle' }, // C6
      { freq: 880.00, time: 2.28, dur: 0.15, type: 'triangle' },  // A5
      { freq: 783.99, time: 2.46, dur: 0.16, type: 'triangle' },  // G5
      { freq: 659.25, time: 2.65, dur: 0.18, type: 'triangle' },  // E5

      // Bar 3: Dramatic deceleration suspense (2.8s to 4.1s)
      { freq: 587.33, time: 2.88, dur: 0.22, type: 'sine' },      // D5
      { freq: 659.25, time: 3.14, dur: 0.25, type: 'sine' },      // E5
      { freq: 783.99, time: 3.44, dur: 0.28, type: 'sine' },      // G5
      { freq: 987.77, time: 3.78, dur: 0.32, type: 'sine' },      // B5
    ];

    melody.forEach((note) => {
      this.playTone(ctx, note.freq, now + note.time, note.dur, note.type as OscillatorType, 0.13);
    });

    // 2. Bouncy bass rhythm (C3, G3, F3, G3)
    const bass = [
      { freq: 130.81, time: 0.00, dur: 0.18 }, // C3
      { freq: 196.00, time: 0.39, dur: 0.18 }, // G3
      { freq: 130.81, time: 0.78, dur: 0.18 }, // C3
      { freq: 196.00, time: 1.17, dur: 0.18 }, // G3
      { freq: 174.61, time: 1.56, dur: 0.18 }, // F3
      { freq: 196.00, time: 1.95, dur: 0.18 }, // G3
      { freq: 130.81, time: 2.34, dur: 0.20 }, // C3
      { freq: 196.00, time: 2.80, dur: 0.24 }, // G3
      { freq: 261.63, time: 3.35, dur: 0.32 }, // C4
    ];

    bass.forEach((b) => {
      this.playTone(ctx, b.freq, now + b.time, b.dur, 'sine', 0.15);
    });

    // 3. Wheel peg clicks that decelerate realistically as rotation slows down
    let clickTime = 0.04;
    let clickInterval = 0.065;
    while (clickTime < 4.1) {
      this.playClick(ctx, now + clickTime, 650 + Math.random() * 220);
      clickTime += clickInterval;
      if (clickTime > 1.0) clickInterval *= 1.06;
      if (clickTime > 2.0) clickInterval *= 1.11;
      if (clickTime > 2.9) clickInterval *= 1.20;
    }
  }

  // Play triumph victory fanfare when winner is revealed
  public playVictoryFanfare() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Victory fanfare notes: C5 -> E5 -> G5 -> High C6 chord
    const fanfareNotes = [
      { freq: 523.25, time: 0.00, dur: 0.11 }, // C5
      { freq: 659.25, time: 0.11, dur: 0.11 }, // E5
      { freq: 783.99, time: 0.22, dur: 0.14 }, // G5
      { freq: 1046.50, time: 0.38, dur: 0.65 }, // High C6 (sustained!)
    ];

    fanfareNotes.forEach((n) => {
      this.playTone(ctx, n.freq, now + n.time, n.dur, 'triangle', 0.18);
    });

    // Harmonizing celebration chord on final high note
    this.playTone(ctx, 659.25, now + 0.38, 0.65, 'sine', 0.14); // E5
    this.playTone(ctx, 783.99, now + 0.38, 0.65, 'sine', 0.14); // G5
    this.playTone(ctx, 1318.51, now + 0.40, 0.60, 'sine', 0.10); // E6 shimmer
  }

  public stop() {
    this.activeNodes.forEach(({ osc, gain }) => {
      try {
        osc?.stop();
        osc?.disconnect();
        gain?.disconnect();
      } catch {}
    });
    this.activeNodes = [];
    this.tickTimeouts.forEach((id) => clearTimeout(id));
    this.tickTimeouts = [];
  }
}

export const RewardRoulette: React.FC<RewardRouletteProps> = ({
  rewards,
  onRewardSelected,
  alreadySelectedReward,
  restaurantName = 'Sr. Coxita',
  rewardDelayHours = 24,
  rewardValidityDays = 15,
}) => {
  const [spinning, setSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(Boolean(alreadySelectedReward));
  const [wonReward, setWonReward] = useState<RewardOption | null>(alreadySelectedReward || null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const currentRotationRef = useRef(0);
  const soundEngineRef = useRef<RouletteSoundEngine | null>(null);

  // Initialize sound engine
  useEffect(() => {
    soundEngineRef.current = new RouletteSoundEngine();
    return () => {
      soundEngineRef.current?.stop();
    };
  }, []);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundEngineRef.current?.setMuted(nextMuted);
  };

  const activeRewards = rewards.filter((r) => r.enabled);
  const items = activeRewards.length > 0 ? activeRewards : rewards;
  const numSlices = items.length;
  const sliceAngle = 360 / numSlices;

  // Geometry: SVG 360x360 with center at (180, 180) and radius 155
  const cx = 180;
  const cy = 180;
  const r = 155;

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#e11d48', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#f97316'],
      });
    } catch (e) {
      console.warn('Confetti error', e);
    }
  };

  const handleSpin = () => {
    if (spinning || hasSpun || items.length === 0) return;

    setSpinning(true);

    // Start playing lively roulette music & decelerating clicks
    soundEngineRef.current?.playSpinMusic();

    // Pick winner based on weights if present
    const totalWeight = items.reduce((acc, curr) => acc + (curr.probabilityWeight || 10), 0);
    let rand = Math.random() * totalWeight;
    let winningIndex = 0;
    for (let i = 0; i < items.length; i++) {
      const w = items[i].probabilityWeight || 10;
      if (rand <= w) {
        winningIndex = i;
        break;
      }
      rand -= w;
    }

    const winner = items[winningIndex];

    // Angle calculation:
    // Pointer is at TOP (12 o'clock, 0 degrees).
    // Slice i starts at i * sliceAngle and ends at (i + 1) * sliceAngle.
    // Center of slice i is midAngle = (i + 0.5) * sliceAngle.
    // When the wheel rotates clockwise by θ degrees, the point that was at angle α moves to (α + θ) mod 360.
    // We want the slice center to land at top (0 deg).
    // (midAngle + θ) mod 360 = 0  =>  θ mod 360 = (360 - midAngle) mod 360.
    const midAngle = (winningIndex + 0.5) * sliceAngle;
    const targetOffset = (360 - (midAngle % 360)) % 360;

    // Give it 6 full spins plus target offset and a small natural jitter
    const extraJitter = (Math.random() - 0.5) * (sliceAngle * 0.45);
    const fullSpins = 6 * 360;
    const nextRotation = currentRotationRef.current + fullSpins + targetOffset + extraJitter;
    currentRotationRef.current = nextRotation;
    setRotationDegrees(nextRotation);

    // Spin animation duration: 4.2 seconds
    setTimeout(() => {
      setSpinning(false);
      setHasSpun(true);
      setWonReward(winner);
      triggerConfetti();
      // Victory fanfare when wheel stops on the prize!
      soundEngineRef.current?.playVictoryFanfare();
      onRewardSelected(winner);
    }, 4200);
  };

  // Helper to construct SVG slice arc path
  // Coordinate convention: 0 deg = 12 o'clock (top)
  const getCoordinatesForAngle = (angleInDegrees: number, radius: number) => {
    const rad = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  return (
    <div
      id="reward-roulette-container"
      className="bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white rounded-3xl p-5 sm:p-7 border-2 border-stone-800 shadow-2xl text-center relative overflow-hidden"
    >
      {/* Sound mute/unmute control */}
      <button
        type="button"
        onClick={toggleSound}
        className="absolute top-4 right-4 z-20 px-3 py-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700 text-stone-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
        title={isMuted ? 'Ativar som da roleta' : 'Desativar som da roleta'}
      >
        {isMuted ? (
          <>
            <VolumeX className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-[11px]">Mudo</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-[11px] text-amber-300">Som Ativo</span>
          </>
        )}
      </button>

      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Badge & Title */}
      <div className="relative z-10 space-y-2 mb-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Roleta de Cortesia Exclusiva</span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          {hasSpun && wonReward ? '🎉 Parabéns! Você Ganhou!' : 'Gire a Roleta e Ganhe seu Brinde!'}
        </h3>

        <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto">
          {hasSpun && wonReward
            ? `Seu brinde exclusivo foi sorteado! Regra: liberado em 24h para você usar em até ${rewardValidityDays} dias no ${restaurantName}.`
            : `Agradecemos por sua avaliação! Cada fatia traz um presente especial da casa preparado para você.`}
        </p>
      </div>

      {/* CIRCULAR ROULETTE WHEEL CONTAINER */}
      <div className="relative z-10 flex flex-col items-center justify-center my-4">
        <div className="relative w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] flex items-center justify-center">
          
          {/* Top Pointer (Seta / Indicador da Roleta) */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] pointer-events-none">
            <svg width="36" height="42" viewBox="0 0 36 42" fill="none">
              <path
                d="M 18 40 L 4 10 C 2 6 5 2 10 2 L 26 2 C 31 2 34 6 32 10 Z"
                fill="#e11d48"
                stroke="#ffffff"
                strokeWidth="3"
              />
              <circle cx="18" cy="12" r="4.5" fill="#f59e0b" />
            </svg>
          </div>

          {/* Outer Bezel (Anel Externo com Pinos de Luz) */}
          <div className="absolute inset-0 rounded-full border-8 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.35)] pointer-events-none z-20 flex items-center justify-center">
            {/* Studs/pegs around the rim */}
            {Array.from({ length: 16 }).map((_, idx) => {
              const angle = (idx * 360) / 16;
              const rad = ((angle - 90) * Math.PI) / 180;
              const pegRadius = 142;
              const x = pegRadius * Math.cos(rad);
              const y = pegRadius * Math.sin(rad);
              return (
                <div
                  key={idx}
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                  className={`absolute w-2.5 h-2.5 rounded-full border border-stone-800 ${
                    spinning ? (idx % 2 === 0 ? 'bg-amber-300 shadow-amber-300' : 'bg-white shadow-white') : 'bg-amber-100'
                  } shadow-xs`}
                />
              );
            })}
          </div>

          {/* Rotating Wheel Disc */}
          <div
            className="w-full h-full rounded-full overflow-hidden shadow-inner flex items-center justify-center transition-transform"
            style={{
              transform: `rotate(${rotationDegrees}deg)`,
              transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.95, 0.22, 1)' : 'none',
            }}
          >
            <svg
              viewBox="0 0 360 360"
              className="w-full h-full"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#be123c" />
                  <stop offset="100%" stopColor="#881337" />
                </radialGradient>
              </defs>

              {/* Slices */}
              {items.map((reward, i) => {
                const startAngle = i * sliceAngle;
                const endAngle = (i + 1) * sliceAngle;
                const p1 = getCoordinatesForAngle(startAngle, r);
                const p2 = getCoordinatesForAngle(endAngle, r);
                const largeArcFlag = sliceAngle > 180 ? 1 : 0;
                const pathData = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} Z`;

                const color = SLICE_COLORS[i % SLICE_COLORS.length];
                const midAngle = (startAngle + endAngle) / 2;

                // Title shortened for slice display
                const shortTitle = reward.title
                  .replace(/\(.*?\)/g, '')
                  .replace(/PORÇÃO DE BATATA FRITA/i, 'Batata Frita')
                  .replace(/CHURROS MIX TRADICIONAL/i, 'Churros Mix')
                  .replace(/10\s*%\s*DE\s*DESCONTO/i, '10% Desconto')
                  .replace(/5\s*%\s*DE\s*DESCONTO/i, '5% Desconto')
                  .replace(/Refrigerante Lata ou Suco Natural Gelado/i, 'Refrigerante')
                  .replace(/Porção de Mini Coxinhas Gourmet/i, 'Mini Coxinhas')
                  .replace(/Coxinha Doce de Nutella ou Doce de Leite/i, 'Coxinha Doce')
                  .replace(/Café Espresso Cremoso/i, 'Café Espresso')
                  .replace(/10% de Desconto na Comanda/i, '10% Desconto')
                  .trim();

                return (
                  <g key={reward.id}>
                    {/* Slice Wedge */}
                    <path
                      d={pathData}
                      fill={color.bg}
                      stroke={color.border}
                      strokeWidth="2"
                    />

                    {/* Slice Radial Text Label */}
                    <g transform={`rotate(${midAngle}, ${cx}, ${cy})`}>
                      <text
                        x={cx}
                        y={cy - r * 0.65}
                        fill={color.text}
                        fontSize="11"
                        fontWeight="800"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(90, ${cx}, ${cy - r * 0.65})`}
                        style={{
                          letterSpacing: '0.02em',
                          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                        }}
                      >
                        {shortTitle}
                      </text>

                      {/* Small Icon / Star Dot */}
                      <circle
                        cx={cx}
                        cy={cy - r * 0.9}
                        r="3"
                        fill="#ffffff"
                        opacity="0.9"
                      />
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Central Hub Button */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || hasSpun}
            className={`absolute z-30 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-amber-400/90 shadow-2xl flex flex-col items-center justify-center text-white transition transform ${
              spinning
                ? 'bg-rose-800 scale-95 opacity-90 cursor-not-allowed'
                : hasSpun
                ? 'bg-stone-800 border-stone-600 cursor-default'
                : 'bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 hover:scale-105 active:scale-95 cursor-pointer shadow-rose-600/50'
            }`}
          >
            {spinning ? (
              <Gift className="w-7 h-7 animate-spin text-amber-300" />
            ) : hasSpun ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : (
              <>
                <Gift className="w-5 h-5 text-amber-200 animate-bounce" />
                <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-white mt-0.5">
                  GIRAR!
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Won Prize Details & 24h / 30-Day Rules Card */}
      {hasSpun && wonReward ? (
        <div className="relative z-10 max-w-md mx-auto bg-stone-800/90 border-2 border-amber-400/70 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 animate-fade-in text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                Prêmio Sorteado
              </span>
              <h4 className="text-lg font-black text-white leading-tight mt-0.5">
                {wonReward.title}
              </h4>
              <p className="text-xs text-stone-300 mt-0.5">
                {wonReward.description}
              </p>
            </div>
          </div>

          {/* 24h & Expiry Notice & 1 por mesa rule */}
          <div className="bg-stone-900/90 rounded-xl p-3 border border-stone-700/80 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Regra de Validade: Liberado em 24h • Válido por {rewardValidityDays} dias</span>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              ⏰ Seu brinde ficará disponível para resgate no restaurante a partir de <strong>24 horas após este sorteio</strong>. Você terá até <strong>{rewardValidityDays} dias</strong> para saborear e resgatar na sua próxima visita ao {restaurantName}!
            </p>
            <div className="pt-2 border-t border-stone-800 flex items-center gap-2 text-amber-300 font-bold text-[11px]">
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 text-[10px] uppercase font-black shrink-0">
                Regra da Mesa
              </span>
              <span>⚠️ É válido utilizar apenas 1 brinde por mesa.</span>
            </div>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => onRewardSelected(wonReward)}
              className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Acessar Meu Voucher Digital</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Action spin button below wheel */
        <div className="relative z-10 max-w-xs mx-auto pt-2">
          <button
            id="btn-spin-reward"
            type="button"
            onClick={handleSpin}
            disabled={spinning}
            className={`w-full py-4 px-6 rounded-2xl font-black text-base shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer ${
              spinning
                ? 'bg-stone-700 text-stone-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-700 hover:to-amber-600 text-white shadow-rose-600/40'
            }`}
          >
            <Gift className={`w-5 h-5 ${spinning ? 'animate-spin' : 'animate-bounce'}`} />
            <span>{spinning ? 'Girando a roleta...' : 'Girar Roleta!'}</span>
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Válido a partir de 24h após o sorteio para usar em até {rewardValidityDays} dias</span>
          </div>
        </div>
      )}
    </div>
  );
};

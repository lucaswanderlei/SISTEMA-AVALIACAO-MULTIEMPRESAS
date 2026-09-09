import React from 'react';
import { RatingChoiceIcon } from './RatingChoiceIcon';
import type { RatingIconType } from '../types';

interface RatingStarScaleProps {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  value: number;
  onChange: (val: number) => void;
  required?: boolean;
  ratingIcon?: RatingIconType;
}

const DESCRIPTIONS = [
  '',
  'Muito insatisfeito',
  'Precisa melhorar',
  'Dentro do esperado',
  'Muito bom',
  'Excepcional / Perfeito!',
];

export const RatingStarScale: React.FC<RatingStarScaleProps> = ({
  id,
  label,
  subtitle,
  icon,
  value,
  onChange,
  ratingIcon = 'coxinha',
}) => {
  const getBadgeColor = (score: number) => {
    if (score === 5) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score === 4) return 'bg-lime-50 text-lime-700 border-lime-200';
    if (score === 3) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (score >= 1) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-stone-50 text-stone-500 border-stone-200';
  };

  return (
    <div
      id={`rating-block-${id}`}
      className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-sm hover:border-stone-300 transition"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h4 className="font-bold text-stone-900 text-base leading-snug">{label}</h4>
            {subtitle && <p className="text-xs text-stone-500 leading-tight">{subtitle}</p>}
          </div>
        </div>

        {value > 0 && (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${getBadgeColor(
              value
            )}`}
          >
            {DESCRIPTIONS[value]}
          </span>
        )}
      </div>

      {/* Escala de avaliação personalizável */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5].map((score) => {
            const isFilled = score <= value;
            return (
              <button
                key={score}
                type="button"
                id={`btn-rate-${id}-${score}`}
                onClick={() => onChange(score)}
                className={`p-1.5 sm:p-2 rounded-xl transition transform active:scale-90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer ${
                  isFilled ? 'bg-amber-50' : 'hover:bg-stone-100'
                }`}
                title={`${score} de 5 - ${DESCRIPTIONS[score]}`}
              >
                <RatingChoiceIcon
                  type={ratingIcon}
                  filled={isFilled}
                  className={`w-7 h-7 sm:w-8 sm:h-8 transition-all ${
                    isFilled
                      ? 'scale-105 text-amber-500'
                      : 'text-stone-300 hover:text-amber-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="text-right flex items-baseline justify-end gap-1">
          <span className="text-xl font-extrabold text-stone-900">
            {value > 0 ? `${value}.0` : '-'}
          </span>
          <span className="text-xs text-stone-400 font-medium">/ 5</span>
        </div>
      </div>
    </div>
  );
};

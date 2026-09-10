import React from 'react';
import { Star } from 'lucide-react';
import { CoxinhaIcon } from './CoxinhaIcon';
import type { RatingIconType } from '../types';

interface RatingChoiceIconProps {
  type?: RatingIconType;
  filled?: boolean;
  className?: string;
}

const SvgBase: React.FC<React.SVGProps<SVGSVGElement>> = ({ children, ...props }) => (
  <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    {children}
  </svg>
);

// Brigadeiro: formato clássico de docinho redondo em forminha, com granulado.
const BrigadeiroIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path
      d="M8.2 24.2c2.7 1.8 6 2.7 9.8 2.7s7.1-.9 9.8-2.7l-2.3 7H10.5l-2.3-7Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path
      d="M10.2 24.6 7 22.4M25.8 24.6l3.2-2.2M13.3 26.1l-.8 4.4M18 26.8v4.4M22.7 26.1l.8 4.4"
      stroke={filled ? 'white' : 'currentColor'}
      strokeWidth="1.15"
      strokeLinecap="round"
      opacity=".75"
    />
    <circle cx="18" cy="15.8" r="9.2" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
    <g stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.35" strokeLinecap="round" opacity=".9">
      <path d="m12.4 12.2 2 1"/><path d="m17.2 9.7.8 2"/><path d="m21.9 11.7 1.8-1"/>
      <path d="m11.5 16.5 2.1-.5"/><path d="m16.5 15.2 1.7 1.2"/><path d="m21.8 16.1 2 .7"/>
      <path d="m13.2 20 1.5 1.3"/><path d="m18.2 20.7 1.7-1.1"/><path d="m22.4 20.1 1.5.3"/>
    </g>
  </SvgBase>
);

// Bolo: fatia triangular reconhecível, com camadas, recheio, cobertura e cereja.
const CakeSliceIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path
      d="M5.8 27.8 10.2 11l19.5 7.1-4.1 11.2H7.2c-.9 0-1.6-.7-1.4-1.5Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="m10.2 11 19.5 7.1"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path
      d="m8.2 20.1 19 6.2"
      stroke={filled ? 'white' : 'currentColor'}
      strokeWidth="1.45"
      strokeLinecap="round"
      opacity=".9"
    />
    <path
      d="M9.2 16.1c1.5 1.3 2.8 1.5 4.1.6 1.2 1.5 2.6 1.8 4.1.7 1.2 1.5 2.7 1.8 4.2.7 1.1 1.4 2.4 1.7 3.9.9"
      stroke={filled ? 'white' : 'currentColor'}
      strokeWidth="1.15"
      strokeLinecap="round"
      opacity=".85"
    />
    <path d="M17.2 13.4c.3-3.1 1.7-5.1 4.3-6.1" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
    <circle cx="22.1" cy="6.6" r="2.2" fill="currentColor" />
  </SvgBase>
);

const PizzaSliceIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M6 8.5c8-2.7 16-2.7 24 0L18 31 6 8.5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7.4 11c7-2.1 14.1-2.1 21.2 0" stroke={filled ? 'white' : 'currentColor'} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="14.2" cy="16.2" r="2" fill={filled ? 'white' : 'currentColor'} opacity=".92" />
    <circle cx="21.6" cy="19.2" r="2" fill={filled ? 'white' : 'currentColor'} opacity=".92" />
  </SvgBase>
);

export const RatingChoiceIcon: React.FC<RatingChoiceIconProps> = ({ type = 'coxinha', filled = false, className = 'w-8 h-8' }) => {
  if (type === 'star') return <Star className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.9} />;
  if (type === 'brigadeiro') return <BrigadeiroIcon filled={filled} className={className} />;
  if (type === 'cake') return <CakeSliceIcon filled={filled} className={className} />;
  if (type === 'pizza') return <PizzaSliceIcon filled={filled} className={className} />;
  return <CoxinhaIcon filled={filled} className={className} />;
};

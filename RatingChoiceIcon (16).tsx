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

// Brigadeiro: modelo clássico com granulado e forminha canelada.
const BrigadeiroIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M6.2 18.2C6.2 10.8 11.4 5.4 18 5.4s11.8 5.4 11.8 12.8" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <g stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round">
      <path d="m11 11.5 1.8 1.2"/><path d="m15.8 9.3 1.8-.2"/><path d="m21.2 9.5.5 1.9"/><path d="m24.8 12.3 1.6-1.2"/>
      <path d="m9.4 15.5 1.5-1.4"/><path d="m14.2 15.4 2-.2"/><path d="m19.3 13.8 1 2"/><path d="m24.3 15.8 1.1-1.8"/>
    </g>
    <path d="M5.2 18.2c2.1-.9 4.2-.8 6.2.5 2.2-1.4 4.4-1.4 6.6 0 2.2-1.4 4.4-1.4 6.6 0 2-1.3 4.1-1.4 6.2-.5L26.6 31H9.4L5.2 18.2Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="m10.2 20.7 3.2 10.1M18 20.5V31M25.8 20.7l-3.2 10.1" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round"/>
  </SvgBase>
);

// Bolo: fatia lateral com cobertura, camadas e cereja.
const CakeSliceIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M4.5 16.8 26.8 8.5 32 16.8H4.5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round"/>
    <path d="M4.5 16.8H32v14H4.5v-14Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round"/>
    <path d="M4.8 20.4c1.5 2 3.1 2 4.6 0 1.5 2 3.1 2 4.6 0 1.5 2 3.1 2 4.6 0 1.5 2 3.1 2 4.6 0 1.5 2 3.1 2 4.6 0 1.3 1.7 2.7 1.9 4.1.5" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" fill="none"/>
    <path d="M4.8 27.2h26.9" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.8"/>
    <circle cx="26.2" cy="8.3" r="3.1" fill={filled ? 'white' : 'none'} stroke="currentColor" strokeWidth="2"/>
    <path d="M25 5.5c-.5-2.5-2-3.8-4.5-4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </SvgBase>
);

// Sorvete: casquinha com duas bolas, simples e legível em tamanho pequeno.
const IceCreamIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M11.2 15.5c-2.4-1-3.5-3.8-2.3-6.1 1-2 3.2-3 5.3-2.3C15 4.7 17.1 3 19.7 3c3.1 0 5.7 2.4 5.9 5.5 2.3.4 4 2.4 4 4.8 0 2.8-2.3 5.1-5.1 5.1H12.8c-2.7 0-4.8-2.1-4.8-4.7 0-1.7.9-3.2 2.2-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.8 18.4h11.7L18.7 33 12.8 18.4Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m14.7 22.1 7 5.2m-5.4-6.8 5.8 4.3m-6.1 3.3 4.5-3.4" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.25" strokeLinecap="round" opacity=".9"/>
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
  if (type === 'icecream') return <IceCreamIcon filled={filled} className={className} />;
  if (type === 'pizza') return <PizzaSliceIcon filled={filled} className={className} />;
  return <CoxinhaIcon filled={filled} className={className} />;
};

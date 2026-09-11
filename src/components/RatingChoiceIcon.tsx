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


const IceCreamIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M10.5 17c-2.3-.7-3.9-2.8-3.9-5.2 0-3 2.4-5.4 5.4-5.4.7 0 1.4.1 2 .4C15 4.5 17.2 3 19.8 3c3.5 0 6.4 2.7 6.6 6.2 2.1.6 3.6 2.5 3.6 4.8 0 2.8-2.2 5-5 5H12c-2.8 0-5-2.2-5-5 0-1.8 1-3.5 2.5-4.4"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11.5 19 18 33l6.5-14H11.5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m14.2 22.2 7.3 5.8M21.8 22.2l-6.3 5" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.4" strokeLinecap="round"/>
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


// Café: xícara com pires e vapor, seguindo a referência enviada.
const CoffeeCupIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M7 14.5h19v5.8c0 6.1-4 10.2-9.5 10.2S7 26.4 7 20.3v-5.8Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>
    <path d="M26 16h2.7c2.2 0 3.8 1.6 3.8 3.8s-1.8 4-4.3 4H26" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>
    <path d="M5 31c3.2 2.1 7.2 3 12 3s8.8-.9 12-3M9 29.5h15" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
    <path d="M13 11c-2.2-2.6 2.3-4.1.3-7M19 11c-2.2-2.6 2.3-4.1.3-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M8.5 17.2c5.4-2.1 11-2.1 16.5 0" fill="none" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round"/>
  </SvgBase>
);

// Hambúrguer: pão com gergelim, salada/queijo e carne, seguindo a referência enviada.
const HamburgerFoodIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M5.5 15.5C5.5 8.8 10.7 4 18 4s12.5 4.8 12.5 11.5H5.5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>
    <g fill={filled ? 'white' : 'currentColor'}><circle cx="11" cy="9" r=".8"/><circle cx="15" cy="7.5" r=".8"/><circle cx="19" cy="9.2" r=".8"/><circle cx="23" cy="7.7" r=".8"/><circle cx="27" cy="10" r=".8"/></g>
    <path d="M5 16c-2.5 1.4-3.4 4.4-.5 5.4 1.8.6 3.3-.1 4.8-1.1 1.6 1.1 3.2 1.1 4.8 0l4 3.1 4-3.1c1.6 1.1 3.2 1.1 4.8 0 1.5 1 3 1.7 4.8 1.1 2.9-1 2-4-.5-5.4H5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M7 23h22M7.5 23v3.5h21V23M7.5 27.5c-1.2 0-2 1-2 2.2 0 1.3 1 2.3 2.3 2.3h20.4c1.3 0 2.3-1 2.3-2.3 0-1.2-.8-2.2-2-2.2" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
  </SvgBase>
);

// Batata frita: embalagem com palitos altos, seguindo a referência enviada.
const FriesFoodIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M10 15 9 4.5l5-1 .7 10M15 14.5 15.5 2h5v12M21 14.5 22 4l4.5 1-.7 10M7.5 15 6.5 7.5l4-1" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
    <path d="M4 14.5c4.2-1 7.1-.2 9.4 1.6 3 2.4 6.2 2.4 9.2 0 2.3-1.8 5.2-2.6 9.4-1.6L28.5 33h-21L4 14.5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>
    <path d="M8 19v6" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round"/>
  </SvgBase>
);

export const RatingChoiceIcon: React.FC<RatingChoiceIconProps> = ({ type = 'coxinha', filled = false, className = 'w-8 h-8' }) => {
  if (type === 'star') return <Star className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.9} />;
  if (type === 'brigadeiro') return <BrigadeiroIcon filled={filled} className={className} />;
  if (type === 'cake') return <CakeSliceIcon filled={filled} className={className} />;
  if (type === 'pizza') return <PizzaSliceIcon filled={filled} className={className} />;
  if (type === 'icecream') return <IceCreamIcon filled={filled} className={className} />;
  if (type === 'coffee') return <CoffeeCupIcon filled={filled} className={className} />;
  if (type === 'hamburger') return <HamburgerFoodIcon filled={filled} className={className} />;
  if (type === 'fries') return <FriesFoodIcon filled={filled} className={className} />;
  return <CoxinhaIcon filled={filled} className={className} />;
};

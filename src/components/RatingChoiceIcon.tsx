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

// Brigadeiro: bolinha arredondada, granulado visível e forminha canelada.
const BrigadeiroIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path
      d="M8 23.8 10.2 31h15.6l2.2-7.2c-2.8 1.7-6.1 2.5-10 2.5s-7.2-.8-10-2.5Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
    />
    <path d="M12 25.8 13.2 31M17 26.3 17.4 31M22 26.1 21.2 31" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.1" opacity=".65" />
    <circle cx="18" cy="16.2" r="10" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
    <g stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.45" strokeLinecap="round" opacity={filled ? .9 : .8}>
      <path d="m12.2 11.6 2.2 1"/><path d="m17 9.5.7 2.2"/><path d="m22.2 11.1 1.8-1"/>
      <path d="m10.8 16.1 2.1-.4"/><path d="m16 15 1.7 1.2"/><path d="m22.1 16.4 2.1.6"/>
      <path d="m13 20.2 1.4 1.6"/><path d="m18.5 21.5 1.8-1.2"/><path d="m22.7 20.8 1.6.3"/>
    </g>
  </SvgBase>
);

// Bolo: fatia em perspectiva com duas camadas, recheio e cobertura cremosa.
const CakeSliceIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path
      d="M7 13.5 28 8.5 26.2 29H8.8L7 13.5Z"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
    />
    <path d="M7.5 14 28 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M9.2 19.3h17.9M9.8 24.3h16.8" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.5" opacity=".9" />
    <path d="M11.5 19.3c1.7 1.2 3.4 1.2 5.1 0 1.7 1.2 3.4 1.2 5.1 0 1.5 1.1 3 1.1 4.7.1" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.15" opacity=".75" />
    <path d="M23.9 9.6c.2-2.5 1.5-4.2 3.8-5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="28.2" cy="4.2" r="2.1" fill="currentColor" />
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

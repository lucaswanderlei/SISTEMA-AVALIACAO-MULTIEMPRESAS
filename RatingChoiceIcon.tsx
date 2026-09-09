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
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
    {children}
  </svg>
);

const BrigadeiroIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M7 23.5h18l-2.2 5H9.2l-2.2-5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="16" cy="15" r="9" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" />
    <g stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.4" strokeLinecap="round" opacity={filled ? 0.85 : 0.8}>
      <path d="m11 11 2 1"/><path d="m17 9 1 2"/><path d="m20 13 2-1"/><path d="m12 16 2-1"/><path d="m18 17 2 1"/><path d="m14 20 1 2"/>
    </g>
  </SvgBase>
);

const CakeSliceIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M6 25 24 8l2 17H6Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9.5 21.5h15.8M13 18h11.8" stroke={filled ? 'white' : 'currentColor'} strokeWidth="1.5" opacity={0.9} />
    <path d="M22.8 8.8c.2-2.2 1.3-3.5 3.3-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="26" cy="4.8" r="1.8" fill="currentColor" />
  </SvgBase>
);

const PizzaSliceIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className }) => (
  <SvgBase className={className}>
    <path d="M6 7.5c6.7-2.2 13.3-2.2 20 0L16 28 6 7.5Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M7.2 9.8c5.9-1.8 11.7-1.8 17.6 0" stroke={filled ? 'white' : 'currentColor'} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="13" cy="14" r="1.7" fill={filled ? 'white' : 'currentColor'} opacity={0.9} />
    <circle cx="19" cy="17" r="1.7" fill={filled ? 'white' : 'currentColor'} opacity={0.9} />
  </SvgBase>
);

export const RatingChoiceIcon: React.FC<RatingChoiceIconProps> = ({ type = 'coxinha', filled = false, className = 'w-8 h-8' }) => {
  if (type === 'star') {
    return <Star className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.9} />;
  }
  if (type === 'brigadeiro') return <BrigadeiroIcon filled={filled} className={className} />;
  if (type === 'cake') return <CakeSliceIcon filled={filled} className={className} />;
  if (type === 'pizza') return <PizzaSliceIcon filled={filled} className={className} />;
  return <CoxinhaIcon filled={filled} className={className} />;
};

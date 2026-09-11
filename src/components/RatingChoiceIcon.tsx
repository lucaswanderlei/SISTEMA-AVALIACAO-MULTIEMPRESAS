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


// Novos ícones de alimentação: traço grosso e simples, no mesmo padrão visual dos exemplos enviados.
const FoodLineIcon: React.FC<{ kind: Exclude<RatingIconType, 'star' | 'coxinha' | 'brigadeiro' | 'cake' | 'pizza' | 'icecream'>; filled?: boolean; className?: string }> = ({ kind, filled, className }) => {
  const stroke = filled ? 'white' : 'currentColor';
  const fill = filled ? 'currentColor' : 'none';
  const common = { stroke, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  if (kind === 'coffee') return (
    <SvgBase className={className}>
      <path d="M7 15.2h20v6.3c0 5.7-4.3 9.5-10 9.5S7 27.2 7 21.5v-6.3Z" fill={fill} {...common}/>
      <path d="M27 17h2.5c2.8 0 4.5 1.7 4.5 4s-1.7 4-4.5 4H27" fill="none" {...common}/>
      <path d="M4.5 32h27" fill="none" {...common}/>
      <path d="M13.5 12c-1.8-2.2 1.7-3.3.3-5.6M20.5 12c-1.8-2.2 1.7-3.3.3-5.6" fill="none" {...common}/>
      <path d="M9.5 18c5-2.2 10-2.2 15 0" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'hamburger') return (
    <SvgBase className={className}>
      <path d="M6 15.5C6 9.6 10.9 5 18 5s12 4.6 12 10.5H6Z" fill={fill} {...common}/>
      <path d="M6 18h24" fill="none" {...common}/>
      <path d="M6.2 20.5c2.1 2 4.2 2 6.3 0 2.1 2 4.2 2 6.3 0 2.1 2 4.2 2 6.3 0 1.6 1.5 3.2 1.8 4.8.8" fill="none" {...common}/>
      <path d="M8 25h20c1.7 0 3 1.3 3 3s-1.3 3-3 3H8c-1.7 0-3-1.3-3-3s1.3-3 3-3Z" fill={fill} {...common}/>
      <path d="M11 10h.1M15 8.5h.1M19 10h.1M23 8.8h.1M26 11h.1" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'fries') return (
    <SvgBase className={className}>
      <path d="M10 15 9 4h5l1 10M16 14V2h5v12M22 14l1-10h5l-1 11M5 14c4.5-2 8.7.8 13 2.7C22.5 18.7 26.7 16 31 14l-3 18H8L5 14Z" fill={fill} {...common}/>
    </SvgBase>
  );
  if (kind === 'hotdog') return (
    <SvgBase className={className}>
      <path d="M7 23c-2.2-2.2-2.2-5.8 0-8l7-7c2.2-2.2 5.8-2.2 8 0l7 7c2.2 2.2 2.2 5.8 0 8l-7 7c-2.2 2.2-5.8 2.2-8 0l-7-7Z" fill={fill} {...common}/>
      <path d="M10.5 24.5 25.5 9.5M12.5 17.5c2 1.2 3.5 1.2 5.5 0s3.5-1.2 5.5 0" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'croissant') return (
    <SvgBase className={className}>
      <path d="M6 25c-2-3-1.3-7.5 1.5-10l5.8-5.1c1.5-1.3 3.8-.8 4.6.9l.1.2.1-.2c.8-1.7 3.1-2.2 4.6-.9l5.8 5.1c2.8 2.5 3.5 7 1.5 10-2 3-5.8 4.2-9.1 2.7L18 26.4l-2.9 1.3C11.8 29.2 8 28 6 25Z" fill={fill} {...common}/>
      <path d="M11.5 13.2c1.7 3.5 3.8 6 6.5 7.6 2.7-1.6 4.8-4.1 6.5-7.6" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'drink') return (
    <SvgBase className={className}>
      <path d="M9 10h18l-2 22H11L9 10Z" fill={fill} {...common}/>
      <path d="M7 10h22M21 10l4-7M17 17c3 1.7 5 1.7 8 0" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'chicken') return (
    <SvgBase className={className}>
      <path d="M10.5 25.5c-3.8-3.8-2.8-10.8 1.5-15.1s11.3-5.3 15.1-1.5 2.8 10.8-1.5 15.1-11.3 5.3-15.1 1.5Z" fill={fill} {...common}/>
      <path d="m9.5 26-3 3M6.5 29l-2.5-1.5M6.5 29 5 31.5" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'beef') return (
    <SvgBase className={className}>
      <path d="M6 22c0-8 6.2-14 14-14 6.3 0 10 3.2 10 8.3 0 7.5-7 12.7-15.3 12.7C9.7 29 6 26.6 6 22Z" fill={fill} {...common}/>
      <path d="M16 19c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4Z" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'fish') return (
    <SvgBase className={className}>
      <path d="M6 18c4-6 9-9 15-9 3.8 0 6.8 1.1 9 3.4L34 8v20l-4-4.4C27.8 25.9 24.8 27 21 27c-6 0-11-3-15-9Z" fill={fill} {...common}/>
      <path d="M12 18h.1M26 12.5c-1 3.5-1 7.5 0 11" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'sandwich') return (
    <SvgBase className={className}>
      <path d="M5 14 18 6l13 8-13 8L5 14Z" fill={fill} {...common}/>
      <path d="m5 19 13 8 13-8M5 24l13 8 13-8" fill="none" {...common}/>
    </SvgBase>
  );
  if (kind === 'cookie') return (
    <SvgBase className={className}>
      <path d="M30 18c0 7.2-5.8 13-13 13S4 25.2 4 18 9.8 5 17 5c.3 4.2 3.8 7.5 8 7.5.7 0 1.4-.1 2-.3.8 1.8 3 3.1 3 5.8Z" fill={fill} {...common}/>
      <path d="M11 15h.1M16 23h.1M22 18h.1M12 25h.1" fill="none" {...common}/>
    </SvgBase>
  );
  return (
    <SvgBase className={className}>
      <path d="M10 4v12M6 4v8c0 2 1.8 4 4 4s4-2 4-4V4M10 16v16M25 4v28M21 4v10c0 3 1.7 5 4 5" fill="none" {...common}/>
    </SvgBase>
  );
};

export const RatingChoiceIcon: React.FC<RatingChoiceIconProps> = ({ type = 'coxinha', filled = false, className = 'w-8 h-8' }) => {
  if (type === 'star') return <Star className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.9} />;
  if (type === 'brigadeiro') return <BrigadeiroIcon filled={filled} className={className} />;
  if (type === 'cake') return <CakeSliceIcon filled={filled} className={className} />;
  if (type === 'pizza') return <PizzaSliceIcon filled={filled} className={className} />;
  if (type === 'icecream') return <IceCreamIcon filled={filled} className={className} />;
  if (type === 'coffee') return <FoodLineIcon kind="coffee" filled={filled} className={className} />;
  if (type === 'hamburger') return <FoodLineIcon kind="hamburger" filled={filled} className={className} />;
  if (type === 'fries') return <FoodLineIcon kind="fries" filled={filled} className={className} />;
  if (type === 'hotdog') return <FoodLineIcon kind="hotdog" filled={filled} className={className} />;
  if (type === 'croissant') return <FoodLineIcon kind="croissant" filled={filled} className={className} />;
  if (type === 'drink') return <FoodLineIcon kind="drink" filled={filled} className={className} />;
  if (type === 'chicken') return <FoodLineIcon kind="chicken" filled={filled} className={className} />;
  if (type === 'beef') return <FoodLineIcon kind="beef" filled={filled} className={className} />;
  if (type === 'fish') return <FoodLineIcon kind="fish" filled={filled} className={className} />;
  if (type === 'sandwich') return <FoodLineIcon kind="sandwich" filled={filled} className={className} />;
  if (type === 'cookie') return <FoodLineIcon kind="cookie" filled={filled} className={className} />;
  if (type === 'utensils') return <FoodLineIcon kind="utensils" filled={filled} className={className} />;
  return <CoxinhaIcon filled={filled} className={className} />;
};

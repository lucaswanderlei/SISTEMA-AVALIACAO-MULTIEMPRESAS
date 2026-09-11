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


// Novos ícones de alimentação: pictogramas de contorno grosso, simples e arredondado,
// seguindo o estilo visual das referências enviadas pelo usuário.
const FoodLineIcon: React.FC<{ kind: Exclude<RatingIconType, 'star' | 'coxinha' | 'brigadeiro' | 'cake' | 'pizza' | 'icecream'>; filled?: boolean; className?: string }> = ({ kind, filled, className }) => {
  const outline = filled ? 'white' : 'currentColor';
  const body = filled ? 'currentColor' : 'none';
  const common = {
    stroke: outline,
    strokeWidth: 2.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  // Xícara: bojo largo, café visível, alça grande, pires e vapor em duas curvas.
  if (kind === 'coffee') return (
    <SvgBase className={className}>
      <path d="M7 15.2h20.4v5.1c0 6.2-4.3 10.2-10.2 10.2S7 26.5 7 20.3v-5.1Z" fill={body} {...common}/>
      <path d="M27.3 17h2.2c3.3 0 4.8 2 4.8 4.5s-1.7 4.6-5 4.6h-2.8" fill="none" {...common}/>
      <path d="M8.8 17.2c2.9 1.9 13.8 1.9 16.8 0" fill="none" {...common}/>
      <path d="M5.3 31.3c4.2 2.1 8.2 2.9 12.1 2.9 4.1 0 8.1-.8 12.3-2.9" fill="none" {...common}/>
      <path d="M13.6 12.2c-1.8-2.2 1.9-3.6.2-6.3M20.5 12.2c-1.8-2.2 2.2-4.1.7-7.2" fill="none" {...common}/>
    </SvgBase>
  );

  // Hambúrguer: pão superior arredondado com gergelim, alface ondulada, queijo, carne e pão inferior.
  if (kind === 'hamburger') return (
    <SvgBase className={className}>
      <path d="M5.8 15.7C6 9.3 10.7 5.2 18 5.2s12 4.1 12.2 10.5H5.8Z" fill={body} {...common}/>
      <path d="M6 18.4c2.2 0 2.4-1.2 4.2-1.2 1.7 0 2 1.5 3.8 1.5s2.1-1.5 3.9-1.5 2.2 1.5 4 1.5 2.1-1.5 3.9-1.5c1.7 0 2.1 1.2 4.2 1.2" fill="none" {...common}/>
      <path d="M7.2 21.2h21.6" fill="none" {...common}/>
      <path d="m11.5 21.3 6.5 4.5 6.5-4.5" fill={filled ? 'white' : 'none'} {...common}/>
      <path d="M7.8 26.4h20.4c1.8 0 3 1.3 3 2.8 0 1.6-1.2 2.9-3 2.9H7.8c-1.8 0-3-1.3-3-2.9 0-1.5 1.2-2.8 3-2.8Z" fill={body} {...common}/>
      <g fill={outline} stroke="none">
        <circle cx="11.5" cy="10.4" r="1"/><circle cx="15.4" cy="8.8" r="1"/>
        <circle cx="19.5" cy="9.8" r="1"/><circle cx="23.3" cy="8.9" r="1"/>
        <circle cx="26.6" cy="11.1" r="1"/><circle cx="15.8" cy="12.5" r="1"/>
        <circle cx="22.2" cy="12.7" r="1"/>
      </g>
    </SvgBase>
  );

  // Batata: palitos altos e caixa larga com boca em arco.
  if (kind === 'fries') return (
    <SvgBase className={className}>
      <path d="M10.4 14.8 9.7 5h5l.7 9.2M16 13.9V2.8h5.1v11.1M21.8 14.1l.8-9.7h5l-.7 10.3" fill="none" {...common}/>
      <path d="M5.4 14.2c4.3-1.6 8.2 1 12.6 2.8 4.4-1.8 8.4-4.4 12.6-2.8l-2.9 18.5H8.3L5.4 14.2Z" fill={body} {...common}/>
      <path d="M9.1 18.2c2.8 1.6 5.9 2.4 8.9 2.4s6.1-.8 8.9-2.4" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'hotdog') return (
    <SvgBase className={className}>
      <path d="M7.4 23.6c-2.8-2.8-2.8-7.3 0-10.1l5-5c2.8-2.8 7.3-2.8 10.1 0l6.1 6.1c2.8 2.8 2.8 7.3 0 10.1l-5 5c-2.8 2.8-7.3 2.8-10.1 0l-6.1-6.1Z" fill={body} {...common}/>
      <path d="M10.4 25.4 25.6 10.2" fill="none" {...common}/>
      <path d="M11.8 18.4c2 1.5 3.8 1.5 5.8 0 2-1.5 3.8-1.5 5.8 0" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'croissant') return (
    <SvgBase className={className}>
      <path d="M5.6 24.2c-1.6-3.7-.1-8.5 3.3-10.5l4.3-2.6c1.2-.7 2.8-.3 3.5.9L18 14l1.3-2c.7-1.2 2.3-1.6 3.5-.9l4.3 2.6c3.4 2 4.9 6.8 3.3 10.5-1.6 3.8-5.9 5.7-9.7 4.2L18 27.3l-2.7 1.1c-3.8 1.5-8.1-.4-9.7-4.2Z" fill={body} {...common}/>
      <path d="M11.3 12.9c1.7 4.8 3.9 8.1 6.7 10 2.8-1.9 5-5.2 6.7-10" fill="none" {...common}/>
      <path d="M8.5 17c2.2 3 4.1 4.7 6 5.7M27.5 17c-2.2 3-4.1 4.7-6 5.7" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'drink') return (
    <SvgBase className={className}>
      <path d="M9.1 11h17.8l-2 21.4H11.1L9.1 11Z" fill={body} {...common}/>
      <path d="M7.3 11h21.4M20.8 11 25 3.6" fill="none" {...common}/>
      <path d="M12.2 18c3.6 1.4 7.8 1.4 11.6 0" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'chicken') return (
    <SvgBase className={className}>
      <path d="M10.7 25.7c-3.9-3.9-2.7-11 1.8-15.5 4.6-4.6 11.6-5.7 15.5-1.8 3.9 3.9 2.7 11-1.8 15.5-4.6 4.6-11.6 5.7-15.5 1.8Z" fill={body} {...common}/>
      <path d="m10 26.4-3 3M7 29.4l-2.6-1.5M7 29.4 5.4 32" fill="none" {...common}/>
      <path d="M17.2 10.5c2.8-.7 5.3-.2 7.2 1.7" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'beef') return (
    <SvgBase className={className}>
      <path d="M5.5 21.7c0-8.3 6.5-14.6 14.7-14.6 6.6 0 10.3 3.6 10.3 8.9 0 7.8-7.2 13.2-15.8 13.2-5.2 0-9.2-2.8-9.2-7.5Z" fill={body} {...common}/>
      <path d="M15.7 18.8c0-2.4 1.9-4.3 4.3-4.3s4.3 1.9 4.3 4.3-1.9 4.3-4.3 4.3-4.3-1.9-4.3-4.3Z" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'fish') return (
    <SvgBase className={className}>
      <path d="M5.3 18c4.5-6.3 9.6-9.3 15.8-9.3 3.8 0 6.9 1.1 9.1 3.3L34 8.2v19.6L30.2 24c-2.2 2.2-5.3 3.3-9.1 3.3-6.2 0-11.3-3-15.8-9.3Z" fill={body} {...common}/>
      <circle cx="13" cy="16" r="1.3" fill={outline} stroke="none"/>
      <path d="M25.8 11.7c-1.1 4.2-1.1 8.4 0 12.6" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'sandwich') return (
    <SvgBase className={className}>
      <path d="M5.1 13.7 18 6.2l12.9 7.5L18 21.2 5.1 13.7Z" fill={body} {...common}/>
      <path d="M6.3 19.2 18 26l11.7-6.8M6.3 24.3 18 31l11.7-6.7" fill="none" {...common}/>
    </SvgBase>
  );

  if (kind === 'cookie') return (
    <SvgBase className={className}>
      <path d="M30.5 18.2c0 7.3-5.9 13.2-13.2 13.2S4.1 25.5 4.1 18.2 10 5 17.3 5c.1 4.6 3.8 8.3 8.4 8.3 1.3 0 2.5-.3 3.6-.8.8 1.7 1.2 3.6 1.2 5.7Z" fill={body} {...common}/>
      <g fill={outline} stroke="none"><circle cx="11.3" cy="15" r="1.25"/><circle cx="15.4" cy="24.2" r="1.25"/><circle cx="22.2" cy="19.5" r="1.25"/><circle cx="11.2" cy="25.4" r="1.25"/></g>
    </SvgBase>
  );

  return (
    <SvgBase className={className}>
      <path d="M9.6 3.5v12.3M5.7 3.5v8.2c0 2.4 1.7 4.1 3.9 4.1s3.9-1.7 3.9-4.1V3.5M9.6 15.8v16.7M25.2 3.5v29M20.8 3.5v10.4c0 3.1 1.8 5.1 4.4 5.1" fill="none" {...common}/>
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

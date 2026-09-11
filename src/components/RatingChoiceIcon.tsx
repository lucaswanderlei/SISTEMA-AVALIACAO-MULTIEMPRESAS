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

const FoodIcon: React.FC<{ type: RatingIconType; filled?: boolean; className?: string }> = ({ type, filled = false, className }) => {
  const fill = filled ? 'currentColor' : 'none';
  const detail = filled ? 'white' : 'currentColor';
  const common = { stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const dcommon = { stroke: detail, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (type) {
    case 'brigadeiro':
      return <SvgBase className={className}>
        <path d="M6.2 18.2C6.2 10.8 11.4 5.4 18 5.4s11.8 5.4 11.8 12.8" fill={fill} {...common}/>
        <g {...dcommon}><path d="m11 11.5 1.8 1.2"/><path d="m15.8 9.3 1.8-.2"/><path d="m21.2 9.5.5 1.9"/><path d="m24.8 12.3 1.6-1.2"/><path d="m9.4 15.5 1.5-1.4"/><path d="m14.2 15.4 2-.2"/><path d="m19.3 13.8 1 2"/><path d="m24.3 15.8 1.1-1.8"/></g>
        <path d="M5.2 18.2c2.1-.9 4.2-.8 6.2.5 2.2-1.4 4.4-1.4 6.6 0 2.2-1.4 4.4-1.4 6.6 0 2-1.3 4.1-1.4 6.2-.5L26.6 31H9.4L5.2 18.2Z" fill={fill} {...common}/>
        <path d="m10.2 20.7 3.2 10.1M18 20.5V31M25.8 20.7l-3.2 10.1" {...dcommon}/>
      </SvgBase>;

    case 'coffee':
      return <SvgBase className={className}>
        <path d="M8 14h18v6.5A8.5 8.5 0 0 1 17.5 29h-1A8.5 8.5 0 0 1 8 20.5V14Z" fill={fill} {...common}/>
        <path d="M26 16h2.3a4.2 4.2 0 0 1 0 8.4H25" fill={fill} {...common}/>
        <path d="M11 31h18M11 10c-2-2 .5-3.8 0-6M17 10c-2-2 .5-3.8 0-6M23 10c-2-2 .5-3.8 0-6" {...dcommon}/>
      </SvgBase>;

    case 'hamburger':
      return <SvgBase className={className}>
        <path d="M6 14.5C7 8.5 11.8 5 18 5s11 3.5 12 9.5H6Z" fill={fill} {...common}/>
        <path d="M6 18c2-1.5 4-1.5 6 0 2-1.5 4-1.5 6 0 2-1.5 4-1.5 6 0 2-1.5 4-1.5 6 0v4H6v-4Z" fill={fill} {...common}/>
        <path d="M7 22h22l-2 5H9l-2-5ZM9 27h18v3H9v-3Z" fill={fill} {...common}/>
        <g fill={detail}><circle cx="12" cy="10" r="1"/><circle cx="17" cy="8.5" r="1"/><circle cx="22" cy="10.5" r="1"/><circle cx="26" cy="12" r="1"/></g>
      </SvgBase>;

    case 'fries':
      return <SvgBase className={className}>
        <path d="M10 5v10M15 3v12M20 5v10M25 4v11M29 7v8" {...dcommon}/>
        <path d="M7 14h22l-3 17H10L7 14Z" fill={fill} {...common}/>
        <path d="M11 19h2M11 23h2" {...dcommon}/>
      </SvgBase>;

    case 'pizza':
      return <SvgBase className={className}>
        <path d="M7 8c7-2.7 15-2.7 22 0L18 31 7 8Z" fill={fill} {...common}/>
        <path d="M8 11c6.7-2.1 13.3-2.1 20 0" {...dcommon}/>
        <circle cx="14" cy="16" r="1.8" fill={detail}/><circle cx="21.5" cy="19" r="1.8" fill={detail}/>
      </SvgBase>;

    case 'cake':
      return <SvgBase className={className}>
        <path d="M5 16.8 26.8 8.5 31 16.8H5Z" fill={fill} {...common}/>
        <path d="M5 16.8h26v14H5v-14Z" fill={fill} {...common}/>
        <path d="M5.4 21c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 7.2.2M5.5 27h25" {...dcommon}/>
        <circle cx="26.2" cy="8" r="2.7" fill={filled ? 'white' : 'none'} {...common}/>
      </SvgBase>;

    case 'donut':
      return <SvgBase className={className}>
        <circle cx="18" cy="18" r="13" fill={fill} {...common}/><circle cx="18" cy="18" r="4.2" fill={filled ? 'white' : 'none'} {...common}/>
        <path d="m10 11 2 1m6-3 1 2m6 1-2 1m4 5-2 1M9 21l2-1m4 7 1-2m7 1-1-2" {...dcommon}/>
      </SvgBase>;

    case 'icecream':
      return <SvgBase className={className}>
        <path d="M10 16c-2.5-.6-4-2.8-4-5 0-3 2.4-5.5 5.5-5.5.8 0 1.5.2 2.2.5C14.8 3.6 17 2 19.7 2c3.6 0 6.5 2.7 6.8 6.2 2.2.5 3.7 2.5 3.7 4.8 0 2.8-2.2 5-5 5H11c-2.8 0-5-2.2-5-5" fill={fill} {...common}/>
        <path d="m11.5 18 6.5 15 6.5-15h-13Z" fill={fill} {...common}/><path d="m14.5 22 7 5m-1-5-5 4" {...dcommon}/>
      </SvgBase>;

    case 'chicken':
      return <SvgBase className={className}>
        <path d="M8 24c0-6 5-11 11-11 4.8 0 8.5 3.3 8.5 7.8S23.8 29 19 29c-6 0-11-2-11-5Z" fill={fill} {...common}/>
        <path d="m25 15 4-4m-1-3 2-2m-1 5 3 1M11 21h.1M14 25h.1" {...dcommon}/>
      </SvgBase>;

    case 'beef':
      return <SvgBase className={className}>
        <path d="M5 20c0-8 7-13 16-13 7 0 11 4 11 9 0 8-7 13-16 13C9 29 5 25 5 20Z" fill={fill} {...common}/>
        <ellipse cx="23.5" cy="16.5" rx="4" ry="3" fill={filled ? 'white' : 'none'} {...common}/><path d="M9 18c4 0 8 1 11 3" {...dcommon}/>
      </SvgBase>;

    case 'sandwich':
      return <SvgBase className={className}>
        <path d="m6 13 12-7 12 7H6Z" fill={fill} {...common}/><path d="M6 13h24v6H6v-6Z" fill={fill} {...common}/>
        <path d="M6 19c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0v4H6v-4Z" fill={fill} {...common}/><path d="M6 23h24v6H6v-6Z" fill={fill} {...common}/>
      </SvgBase>;

    case 'hotdog':
      return <SvgBase className={className}>
        <path d="M5 23c0-5 4-9 9-9h8c5 0 9 4 9 9s-4 9-9 9h-8c-5 0-9-4-9-9Z" fill={fill} {...common}/>
        <path d="M9 24c3-6 6-6 9 0s6 6 9 0" {...dcommon}/>
      </SvgBase>;

    case 'croissant':
      return <SvgBase className={className}>
        <path d="M5 24C7 13 12 8 18 8s11 5 13 16c-4-4-7-5-10-2-2 2-4 2-6 0-3-3-6-2-10 2Z" fill={fill} {...common}/>
        <path d="m11 13 3 8m11-8-3 8M18 9v11" {...dcommon}/>
      </SvgBase>;

    case 'cupcake':
      return <SvgBase className={className}>
        <path d="M8 16c0-3 2-5 5-5 0-4 3-7 7-7 3 0 5 2 5 5 3 0 5 2 5 5 0 2-1 4-3 5H11c-2-1-3-2-3-3Z" fill={fill} {...common}/>
        <path d="M10 19h17l-2 12H12l-2-12Z" fill={fill} {...common}/><path d="m14 21 1 8m5-8v8m5-8-1 8" {...dcommon}/>
      </SvgBase>;

    case 'cookie':
      return <SvgBase className={className}>
        <path d="M30 17c-4 0-7-3-7-7-7-1-14 4-15 11-1 7 4 12 11 12 8 0 14-7 11-16Z" fill={fill} {...common}/>
        <g fill={detail}><circle cx="14" cy="17" r="1.5"/><circle cx="18" cy="26" r="1.5"/><circle cx="24" cy="22" r="1.5"/><circle cx="13" cy="25" r="1.2"/></g>
      </SvgBase>;

    case 'shrimp':
      return <SvgBase className={className}>
        <path d="M29 8c-10-2-19 2-21 9-2 7 5 13 12 12 7-1 11-7 9-13-2-5-8-7-13-4" fill={fill} {...common}/>
        <path d="M12 15c2 1 4 2 6 4m-8 1c2 1 4 2 6 4m9-11 4-4M8 27l-3 3m4-4 2 5" {...dcommon}/><circle cx="21" cy="11" r="1.2" fill={detail}/>
      </SvgBase>;

    case 'fish':
      return <SvgBase className={className}>
        <path d="M5 18c5-7 11-10 17-7l5 3 4-4v16l-4-4-5 3c-6 3-12 0-17-7Z" fill={fill} {...common}/><circle cx="13" cy="16" r="1.2" fill={detail}/><path d="m18 14 4 4-4 4" {...dcommon}/>
      </SvgBase>;

    case 'pasta':
      return <SvgBase className={className}>
        <path d="M7 22h22c0 6-5 10-11 10S7 28 7 22Z" fill={fill} {...common}/><path d="M10 20c2-5 5-5 7 0 2-5 5-5 7 0 2-5 5-5 7 0M13 9c5 1 10 1 15-1" {...dcommon}/><path d="M25 7 31 3" {...dcommon}/>
      </SvgBase>;

    case 'drink':
      return <SvgBase className={className}>
        <path d="M9 9h18l-2 22H11L9 9Z" fill={fill} {...common}/><path d="M7 9h22M21 9l3-6h5" {...dcommon}/>
      </SvgBase>;

    case 'beer':
      return <SvgBase className={className}>
        <path d="M7 12h18v19H7V12Z" fill={fill} {...common}/><path d="M25 16h3a4 4 0 0 1 0 8h-3" fill={fill} {...common}/><path d="M7 12c0-4 3-6 6-5 2-4 7-4 9 0 3-1 6 1 6 5H7ZM12 17v9m5-9v9m5-9v9" {...dcommon}/>
      </SvgBase>;

    case 'meal':
      return <SvgBase className={className}>
        <circle cx="18" cy="18" r="9" fill={fill} {...common}/><circle cx="18" cy="18" r="5.5" fill="none" stroke={detail} strokeWidth="1.6"/><path d="M6 7v22m-2-22v8m4-8v8M30 7v22m-3-18c0-2 1-4 3-4" {...dcommon}/>
      </SvgBase>;

    case 'salad':
      return <SvgBase className={className}>
        <path d="M7 19h22c0 7-5 12-11 12S7 26 7 19Z" fill={fill} {...common}/><path d="M10 18c-1-5 3-7 6-4 0-5 5-7 8-3 4-1 7 2 5 7M14 18l4-6m3 6 3-7" {...dcommon}/>
      </SvgBase>;

    case 'taco':
      return <SvgBase className={className}>
        <path d="M6 25c1-9 6-14 12-14s11 5 12 14H6Z" fill={fill} {...common}/><path d="M9 19c2-1 4-1 6 0 2-2 4-2 6 0 2-1 4-1 6 0" {...dcommon}/>
      </SvgBase>;

    case 'skewer':
      return <SvgBase className={className}>
        <path d="M6 30 30 6" {...common}/><path d="m9 24 4 4 4-4-4-4-4 4Zm7-7 4 4 4-4-4-4-4 4Zm7-7 4 4 3-3-4-4-3 3Z" fill={fill} {...common}/>
      </SvgBase>;

    default:
      return null;
  }
};

export const RatingChoiceIcon: React.FC<RatingChoiceIconProps> = ({ type = 'coxinha', filled = false, className = 'w-8 h-8' }) => {
  if (type === 'star') {
    return <Star className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.9} />;
  }

  if (type === 'coxinha') {
    return <CoxinhaIcon filled={filled} className={className} />;
  }

  return <FoodIcon type={type} filled={filled} className={className} />;
};

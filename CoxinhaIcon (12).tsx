import React from 'react';

interface CoxinhaIconProps {
  className?: string;
  filled?: boolean;
  size?: number;
}

export const CoxinhaIcon: React.FC<CoxinhaIconProps> = ({
  className = 'w-7 h-7',
  filled = false,
  size,
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="coxinhaGoldGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Silhouette da coxinha: ponta superior suave e base arredondada farta */}
      <path
        d="M 12 2.3
           C 11.2 3.7, 8.8 8.0, 6.8 12.4
           C 4.8 16.6, 4.4 19.3, 6.8 21.2
           C 8.7 22.7, 15.3 22.7, 17.2 21.2
           C 19.6 19.3, 19.2 16.6, 17.2 12.4
           C 15.2 8.0, 12.8 3.7, 12 2.3 Z"
        fill={filled ? 'url(#coxinhaGoldGrad)' : 'transparent'}
        stroke={filled ? '#b45309' : 'currentColor'}
        strokeWidth={filled ? '1.2' : '1.8'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Detalhes dourados e crocantes quando selecionada */}
      {filled && (
        <>
          {/* Brilho da casquinha dourada crocante */}
          <path
            d="M 9.5 10.5 C 8.3 13 7.8 15.8 8.8 18"
            stroke="white"
            strokeWidth="1.25"
            strokeLinecap="round"
            opacity="0.6"
          />
          {/* Base sutilmente marcada */}
          <path
            d="M 9.8 20.2 C 11.2 20.8 12.8 20.8 14.2 20.2"
            stroke="#92400e"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.35"
          />
          {/* Ponto de crocância */}
          <circle cx="14.5" cy="14" r="0.8" fill="#b45309" opacity="0.45" />
        </>
      )}
    </svg>
  );
};

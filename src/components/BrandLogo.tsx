import * as React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function BrandLogo({ className = '', size = 'md' }: BrandLogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  };

  return (
    <div className={`relative flex items-center justify-center select-none ${sizeClasses[size]} ${className}`}>
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full drop-shadow-[0_10px_15px_rgba(30,64,185,0.2)] animate-pulse-subtle" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="icon-grad-top" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="icon-grad-right" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="100%" stopColor="#312E81" />
          </linearGradient>
          <linearGradient id="icon-grad-left" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A5B4FC" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 3D Isometric Transparent/Glowing outer hex cage */}
        <polygon 
          points="50,10 85,30 85,70 50,90 15,70 15,30" 
          stroke="url(#icon-grad-top)" 
          strokeWidth="2" 
          strokeDasharray="4,4" 
          opacity="0.6"
        />

        {/* Lower/Base Isometric shadow plate */}
        <polygon 
          points="50,75 75,60 50,45 25,60" 
          fill="#1D4ED8" 
          opacity="0.15"
        />

        {/* Bottom layers of the Stack */}
        <g transform="translate(0, 14)">
          <polygon points="50,45 78,29 50,13 22,29" fill="url(#icon-grad-left)" opacity="0.3" />
          <polygon points="50,45 78,29 78,39 50,55" fill="url(#icon-grad-right)" opacity="0.3" />
          <polygon points="22,29 50,45 50,55 22,39" fill="url(#icon-grad-top)" opacity="0.3" />
        </g>
        
        <g transform="translate(0, 7)">
          <polygon points="50,45 78,29 50,13 22,29" fill="url(#icon-grad-left)" opacity="0.5" />
          <polygon points="50,45 78,29 78,39 50,55" fill="url(#icon-grad-right)" opacity="0.5" />
          <polygon points="22,29 50,45 50,55 22,39" fill="url(#icon-grad-top)" opacity="0.5" />
        </g>

        {/* Top Floating Isometric Icon Block (Main visual) */}
        <g className="animate-float">
          {/* Top Face */}
          <polygon 
            points="50,43 82,25 50,7 18,25" 
            fill="url(#icon-grad-top)" 
          />
          {/* Right Face */}
          <polygon 
            points="50,43 82,25 82,37 50,55" 
            fill="url(#icon-grad-right)" 
          />
          {/* Left Face */}
          <polygon 
            points="18,25 50,43 50,55 18,37" 
            fill="url(#icon-grad-left)" 
          />

          {/* Sparkle detailing inside the floating top box */}
          <path 
            d="M50,18 L52,24 L58,25 L52,26 L50,32 L48,26 L42,25 L48,24 Z" 
            fill="white" 
            filter="url(#glow)"
            className="animate-pulse"
          />
        </g>
      </svg>
    </div>
  );
}

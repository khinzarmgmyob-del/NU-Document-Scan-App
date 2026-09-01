import React from 'react';

interface WaveBackgroundProps {
  isDark?: boolean;
}

export const WaveBackground: React.FC<WaveBackgroundProps> = ({ isDark = false }) => {
  return (
    <div className="fixed top-0 left-0 right-0 h-[34vh] min-h-[220px] max-h-[380px] pointer-events-none z-0 overflow-hidden select-none transition-colors duration-500">
      {/* Base gradient fill for top 1/3 */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${
          isDark
            ? 'bg-gradient-to-b from-[#042823] via-[#081f1c] to-transparent opacity-90'
            : 'bg-gradient-to-b from-[#DCFCE7] via-[#ECFDF5] to-transparent opacity-80'
        }`}
      />

      {/* Layer 1: Deep Back Wave */}
      <svg
        className="absolute top-0 left-0 w-[200%] sm:w-full h-full object-cover transition-transform duration-1000"
        viewBox="0 0 1440 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M0,0 L1440,0 L1440,160 C1280,240 1120,110 960,180 C800,250 640,130 480,210 C320,290 160,150 0,220 Z"
          fill={isDark ? '#064E3B' : '#A7F3D0'}
          fillOpacity={isDark ? '0.35' : '0.45'}
        />
      </svg>

      {/* Layer 2: Mid S-Curve Flowing Wave */}
      <svg
        className="absolute top-0 left-0 w-[200%] sm:w-full h-full object-cover"
        viewBox="0 0 1440 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M0,0 L1440,0 L1440,210 C1300,140 1180,270 1020,210 C860,150 720,280 540,200 C380,120 200,260 0,180 Z"
          fill={isDark ? '#047857' : '#6EE7B7'}
          fillOpacity={isDark ? '0.25' : '0.35'}
        />
      </svg>

      {/* Layer 3: Foreground Dynamic Crest Wave */}
      <svg
        className="absolute top-0 left-0 w-full h-full object-cover"
        viewBox="0 0 1440 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M0,0 L1440,0 L1440,240 C1320,290 1190,190 1060,250 C920,310 790,210 630,270 C470,330 310,210 160,280 C80,315 0,270 0,270 Z"
          fill={isDark ? '#065F46' : '#BBF7D0'}
          fillOpacity={isDark ? '0.3' : '0.55'}
        />
        {/* Crest highlight line */}
        <path
          d="M0,270 C80,315 160,280 310,210 C470,330 630,270 790,210 C920,310 1060,250 1190,190 C1320,290 1440,240 1440,240"
          stroke={isDark ? '#34D399' : '#34D399'}
          strokeWidth="2.5"
          strokeOpacity={isDark ? '0.6' : '0.7'}
          strokeLinecap="round"
        />
      </svg>

      {/* Layer 4: Soft Ripple accent curve */}
      <svg
        className="absolute top-0 left-0 w-full h-full object-cover"
        viewBox="0 0 1440 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M0,190 C220,130 440,220 660,170 C880,120 1100,210 1320,160 C1380,145 1440,150 1440,150"
          stroke={isDark ? '#6EE7B7' : '#10B981'}
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeOpacity={isDark ? '0.4' : '0.45'}
        />
      </svg>

      {/* Ambient glowing radial light in dark mode / soft sunlight in light mode */}
      <div
        className={`absolute top-0 left-1/4 w-96 h-48 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isDark ? 'bg-emerald-500/10' : 'bg-emerald-300/25'
        }`}
      />
    </div>
  );
};

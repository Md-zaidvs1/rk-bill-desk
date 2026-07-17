import React from "react";

interface RKDentalLogoProps {
  className?: string;
  showText?: boolean;
}

export default function RKDentalLogo({ className = "w-12 h-12", showText = false }: RKDentalLogoProps) {
  return (
    <svg 
      viewBox={showText ? "0 0 400 420" : "0 0 400 362"} 
      className={`${className} shrink-0`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="gold-metallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" />
          <stop offset="25%" stopColor="#FFFDD0" />
          <stop offset="50%" stopColor="#AA771C" />
          <stop offset="75%" stopColor="#FDF6C7" />
          <stop offset="100%" stopColor="#8B6508" />
        </linearGradient>
      </defs>
      
      {/* 5-Spike Crown with mini-balls on top */}
      <g>
        {/* Crown base band */}
        <path 
          d="M 135,112 C 135,108 265,108 265,112 L 265,120 C 265,122 135,122 135,120 Z" 
          fill="url(#gold-metallic)" 
        />
        {/* Middle decorative bar on band */}
        <rect x="150" y="115" width="100" height="2" fill="#1e1b4b" opacity="0.3" />
        
        {/* Five Spikes */}
        <path 
          d="M 137,112 
             L 150,75 
             L 175,98 
             L 200,62 
             L 225,98 
             L 250,75 
             L 263,112 Z" 
          fill="url(#gold-metallic)" 
          stroke="url(#gold-metallic)" 
          strokeWidth="2" 
          strokeLinejoin="round"
        />
        
        {/* Spherical crown tips (pearls) */}
        <circle cx="137" cy="112" r="5" fill="url(#gold-metallic)" />
        <circle cx="150" cy="75" r="6" fill="url(#gold-metallic)" />
        <circle cx="175" cy="98" r="5" fill="url(#gold-metallic)" />
        <circle cx="200" cy="62" r="7.5" fill="url(#gold-metallic)" />
        <circle cx="225" cy="98" r="5" fill="url(#gold-metallic)" />
        <circle cx="250" cy="75" r="6" fill="url(#gold-metallic)" />
        <circle cx="263" cy="112" r="5" fill="url(#gold-metallic)" />
      </g>
      
      {/* Sleek tooth outline (Gold Metallic) */}
      <path 
        d="M 155,135 
           C 110,135 105,195 105,215 
           C 105,255 138,305 162,352 
           C 166,360 174,360 178,342 
           C 188,302 198,282 200,265 
           C 202,282 212,302 222,342 
           C 226,360 234,360 238,352 
           C 262,305 295,255 295,215 
           C 295,195 290,135 245,135
           C 222,135 208,150 200,150
           C 192,150 178,135 155,135 Z" 
        fill="none" 
        stroke="url(#gold-metallic)" 
        strokeWidth="15" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />

      {/* Golden "D" (Dentistry) on the upper right crown of the tooth */}
      <path 
        d="M 232,168 L 248,168 C 257,168 262,174 262,182 C 262,190 257,196 248,196 L 232,196 Z M 240,174 L 240,190 L 247,190 C 252,190 255,187 255,182 C 255,177 252,174 247,174 Z" 
        fill="url(#gold-metallic)" 
      />

      {/* Circular Badge on Bottom Right with cross (+) and "R", "K" letters */}
      <g>
        {/* Outer gold ring */}
        <circle 
          cx="262" 
          cy="262" 
          r="34" 
          fill="#0b091a" 
          stroke="url(#gold-metallic)" 
          strokeWidth="6" 
        />
        {/* Inner thin gold circle */}
        <circle 
          cx="262" 
          cy="262" 
          r="28" 
          fill="none" 
          stroke="url(#gold-metallic)" 
          strokeWidth="1.5" 
        />
        
        {/* Red/Orange Center Cross */}
        <path 
          d="M 262,250 L 262,274 M 250,262 L 274,262" 
          stroke="#EA580C" 
          strokeWidth="7.5" 
          strokeLinecap="round"
        />
        
        {/* R (Top-Left inside badge) */}
        <text 
          x="241" 
          y="249" 
          fill="url(#gold-metallic)" 
          fontSize="11" 
          fontWeight="bold" 
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >R</text>
        
        {/* K (Bottom-Right inside badge) */}
        <text 
          x="272" 
          y="281" 
          fill="url(#gold-metallic)" 
          fontSize="11" 
          fontWeight="bold" 
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >K</text>
      </g>

      {/* Dynamic branding text under the logo */}
      {showText && (
        <g>
          <text 
            x="200" 
            y="388" 
            textAnchor="middle" 
            fill="url(#gold-metallic)" 
            fontSize="22" 
            fontWeight="bold" 
            letterSpacing="3"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            RK DENTAL
          </text>
          <text 
            x="200" 
            y="406" 
            textAnchor="middle" 
            fill="#a1a1aa" 
            fontSize="8.5" 
            fontWeight="600" 
            letterSpacing="2.5"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          >
            GENERAL AND COSMETIC DENTISTRY
          </text>
        </g>
      )}
    </svg>
  );
}

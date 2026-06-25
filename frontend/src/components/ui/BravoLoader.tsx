// Bravo Music branded loader — dancing headphone figure with pulsing sound waves.
// Ported 1:1 from the original index.html .bravo-loader markup.

export default function BravoLoader({ label = 'Tuning in', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div className={`bravo-loader ${fullScreen ? 'bravo-loader--full' : ''}`} role="status" aria-label="Loading Bravo Music">
      <svg viewBox="0 0 240 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="bl-shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7d75ff" />
            <stop offset="100%" stopColor="#5d4fd9" />
          </linearGradient>
          <linearGradient id="bl-wave-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#9b59b6" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="bl-hp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a3a52" />
            <stop offset="100%" stopColor="#1f1f33" />
          </linearGradient>
          <linearGradient id="bl-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2c8a2" />
            <stop offset="100%" stopColor="#e6b58c" />
          </linearGradient>
          <linearGradient id="bl-pants" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3854" />
            <stop offset="100%" stopColor="#1c2840" />
          </linearGradient>
        </defs>

        {/* Sound waves (left) */}
        <g stroke="url(#bl-wave-grad)" strokeWidth="3" fill="none">
          <path className="bl-wave bl-wave-1" d="M 60 115 Q 38 130 60 165" />
          <path className="bl-wave bl-wave-2" d="M 48 105 Q 18 130 48 175" />
          <path className="bl-wave bl-wave-3" d="M 36 95  Q -2 130 36 185" />
        </g>
        {/* Sound waves (right) */}
        <g stroke="url(#bl-wave-grad)" strokeWidth="3" fill="none">
          <path className="bl-wave bl-wave-1" d="M 180 115 Q 202 130 180 165" />
          <path className="bl-wave bl-wave-2" d="M 192 105 Q 222 130 192 175" />
          <path className="bl-wave bl-wave-3" d="M 204 95  Q 242 130 204 185" />
        </g>

        <g className="bl-figure">
          {/* Legs */}
          <g className="bl-legs">
            <path d="M 102 198 C 100 220, 96 245, 95 270 L 110 270 C 111 245, 112 220, 114 198 Z" fill="url(#bl-pants)" />
            <path d="M 126 198 C 128 220, 132 245, 134 270 L 149 270 C 148 245, 144 220, 142 198 Z" fill="url(#bl-pants)" />
            <ellipse cx="103" cy="270" rx="13" ry="5" fill="#0d0d18" />
            <ellipse cx="141" cy="270" rx="13" ry="5" fill="#0d0d18" />
          </g>

          {/* Torso / shirt */}
          <path d="M 82 150 C 80 145, 90 138, 100 138 L 140 138 C 150 138, 160 145, 158 150 L 156 200 C 156 205, 150 208, 145 208 L 95 208 C 90 208, 84 205, 84 200 Z" fill="url(#bl-shirt)" />
          <path d="M 108 138 Q 120 144 132 138" fill="none" stroke="#4a3fa8" strokeWidth="1.5" strokeLinecap="round" />

          {/* Left arm */}
          <g className="bl-arm-relaxed">
            <path d="M 84 150 C 76 165, 72 185, 76 200 C 78 205, 84 205, 86 200 C 88 185, 90 165, 95 152 Z" fill="url(#bl-shirt)" />
            <circle cx="81" cy="203" r="7" fill="url(#bl-skin)" />
          </g>
          {/* Right arm (raised) */}
          <g className="bl-arm-raised">
            <path d="M 156 150 C 168 145, 174 132, 168 122 C 165 118, 158 119, 156 124 C 152 134, 148 145, 145 152 Z" fill="url(#bl-shirt)" />
            <circle cx="167" cy="120" r="7" fill="url(#bl-skin)" />
          </g>

          {/* Neck */}
          <path d="M 110 138 L 110 132 Q 120 134 130 132 L 130 138 Z" fill="url(#bl-skin)" />

          {/* Head */}
          <g className="bl-head">
            <ellipse cx="120" cy="100" rx="36" ry="38" fill="url(#bl-skin)" />
            <path d="M 88 88 C 90 70, 110 60, 120 62 C 132 60, 148 68, 152 88 C 144 80, 136 78, 128 80 C 120 80, 112 78, 104 82 C 98 84, 92 86, 88 88 Z" fill="#2a2438" />
            <path d="M 102 102 Q 108 98 114 102" fill="none" stroke="#1a1a2e" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 126 102 Q 132 98 138 102" fill="none" stroke="#1a1a2e" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="102" y1="101" x2="100" y2="99" stroke="#1a1a2e" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="138" y1="101" x2="140" y2="99" stroke="#1a1a2e" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 110 116 Q 120 124 130 116" fill="none" stroke="#1a1a2e" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="98" cy="112" rx="4" ry="2.5" fill="#e88a8a" opacity="0.4" />
            <ellipse cx="142" cy="112" rx="4" ry="2.5" fill="#e88a8a" opacity="0.4" />
            {/* Headphones */}
            <path d="M 84 96 C 86 65, 154 65, 156 96" fill="none" stroke="url(#bl-hp)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 88 92 C 92 72, 148 72, 152 92" fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            <ellipse cx="83" cy="105" rx="11" ry="13" fill="url(#bl-hp)" />
            <ellipse cx="83" cy="105" rx="7" ry="9" fill="#1a1a2e" />
            <circle cx="83" cy="105" r="2.5" fill="#6c63ff" />
            <ellipse cx="157" cy="105" rx="11" ry="13" fill="url(#bl-hp)" />
            <ellipse cx="157" cy="105" rx="7" ry="9" fill="#1a1a2e" />
            <circle cx="157" cy="105" r="2.5" fill="#6c63ff" />
          </g>
        </g>
      </svg>

      <p className="bl-text">{label}<span className="bl-text-dot">...</span></p>
    </div>
  )
}

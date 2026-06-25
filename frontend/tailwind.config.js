/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6c63ff',
        'primary-dark': '#5a52d6',
        secondary: '#ff6584',
        success: '#00c853',
        warning: '#ffc107',
        danger: '#ff4757',
        'bg-dark': '#0a0a0a',
        'bg-darker': '#050505',
        'bg-card': '#1a1a1a',
        'text-secondary': '#b3b3b3',
        border: '#2a2a2a',
        hover: '#2a2a2a',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      boxShadow: {
        soft: '0 4px 6px rgba(0,0,0,0.3)',
        lg2: '0 10px 20px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'fade-in-down': 'fadeInDown 0.2s ease',
        'slide-in-right': 'slideInRight 0.3s ease',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeInDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

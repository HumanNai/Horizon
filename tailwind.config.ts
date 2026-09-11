import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8ecf5',
          100: '#c5ceea',
          200: '#9aaedd',
          300: '#6f8dd0',
          400: '#4f75c7',
          500: '#2e5eff',
          DEFAULT: '#0B1229',
          light: '#111d3c',
          mid:   '#162040',
          dark:  '#080e1e'
        },
        brand: {
          blue:       '#2E5EFF',
          blueLight:  '#5B82FF',
          orange:     '#F5A623',
          orangeDark: '#d4891a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #2E5EFF 0%, #5B82FF 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #111d3c 0%, #0B1229 100%)'
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.35)',
        glow: '0 0 20px rgba(46,94,255,0.25)'
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
} satisfies Config


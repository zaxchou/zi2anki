import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        kai: ['"Noto Serif SC"', '"楷体"', 'KaiTi', 'serif'],
        sans: ['"Noto Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      colors: {
        ink: {
          light: '#666',
          DEFAULT: '#333',
          dark: '#1a1a1a',
        },
        mint: {
          light: '#e8faf8',
          DEFAULT: '#d0f4f0',
          dark: '#b8eeea',
        },
      },
      animation: {
        'flip': 'flip 0.4s ease',
        'flip-back': 'flipBack 0.4s ease',
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        flipBack: {
          '0%': { transform: 'rotateY(180deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
      },
    },
  },
  corePlugins: {
    preflight: false, // MUI 与 Tailwind 重置冲突，由 MUI CssBaseline 处理
  },
  plugins: [],
} satisfies Config;

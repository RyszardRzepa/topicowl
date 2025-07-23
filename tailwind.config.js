/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Notion-inspired color system
        stone: {
          700: '#373530', // default text
          500: '#787774', // gray text
          100: '#f1f1ef', // gray background
          200: '#e5e5e2', // gray border
        },
        blue: {
          500: '#2f80ed', // accent blue
          50: '#f0f7ff',  // accent blue background
        },
        // Semantic colors
        notion: {
          brown: {
            text: '#9f6b53',
            bg: '#f4f1ee',
          },
          orange: {
            text: '#d9730d',
            bg: '#faebdd',
          },
          yellow: {
            text: '#dfab01',
            bg: '#fbf3db',
          },
          green: {
            text: '#4d6461',
            bg: '#ddedea',
          },
          blue: {
            text: '#2f80ed',
            bg: '#d3e5ef',
          },
          purple: {
            text: '#9065b0',
            bg: '#e8deee',
          },
          pink: {
            text: '#c14cbc',
            bg: '#f5d9f3',
          },
          red: {
            text: '#e03e3e',
            bg: '#fbe4e4',
          },
        },
      },
      fontSize: {
        '15': '0.9375rem', // 15px - Notion's body text size
      },
      spacing: {
        '680': '680px', // content width default
        '1180': '1180px', // content width full
      },
      borderRadius: {
        'notion': '4px', // max 4px border radius
      },
      transitionDuration: {
        '150': '150ms', // consistent transition timing
      },
      transitionTimingFunction: {
        'notion': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

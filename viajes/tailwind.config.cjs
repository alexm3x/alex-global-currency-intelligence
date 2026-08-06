module.exports = {
  content: ['./viajes/index.html', './viajes/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminal: {
          950: '#050b10', 900: '#071119', 850: '#0a1720',
          800: '#10212c', 700: '#183240'
        },
        emeraldx: '#34d399',
        goldx: '#e8c66a',
        cyanx: '#67e8f9',
        dangerx: '#fb7185'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace']
      },
      boxShadow: { terminal: '0 24px 70px rgba(0,0,0,.34)' }
    }
  },
  plugins: []
};

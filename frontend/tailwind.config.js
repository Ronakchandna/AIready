/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'xs': '475px',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    /* UI ENHANCEMENT — added missing brand-300 & brand-400 used in sidebar, login blobs, and dark mode text */
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                }
            },
            boxShadow: {
                'soft': '0 8px 30px rgba(0, 0, 0, 0.04)',
                'soft-lg': '0 20px 40px rgba(0, 0, 0, 0.08)',
                'glow': '0 0 20px rgba(79, 70, 229, 0.15)',
                /* UI ENHANCEMENT — stronger glow for hover states on primary CTAs */
                'glow-lg': '0 0 32px rgba(79, 70, 229, 0.25)',
            },
            /* UI ENHANCEMENT — animation keyframes for blob, fade-in, and shimmer effects */
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            animation: {
                'blob': 'blob 7s infinite ease-in-out',
                'fade-in': 'fadeIn 0.4s ease-out forwards',
                'shimmer': 'shimmer 1.5s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}

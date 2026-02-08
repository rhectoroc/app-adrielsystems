/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--bg-deep) / <alpha-value>)',
                foreground: 'hsl(var(--text-main) / <alpha-value>)',
                primary: {
                    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
                    glow: 'hsl(var(--primary-glow))',
                },
                secondary: 'hsl(var(--secondary) / <alpha-value>)',
                accent: 'hsl(var(--accent) / <alpha-value>)',
            },
            fontFamily: {
                sans: ['Roboto', 'sans-serif'],
                heading: ['"Bruno Ace SC"', 'sans-serif'],
            },
        },
    },
    plugins: [],
}

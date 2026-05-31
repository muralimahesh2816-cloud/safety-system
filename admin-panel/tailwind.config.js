/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "sans-serif"],
        display: ["Sora", "sans-serif"]
      },
      colors: {
        slate: {
          950: "#020617"
        }
      },
      boxShadow: {
        glow: "0 0 50px rgba(45, 212, 191, 0.22)"
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        }
      },
      animation: {
        floaty: "floaty 5s ease-in-out infinite"
      }
    },
  },
  plugins: [],
};

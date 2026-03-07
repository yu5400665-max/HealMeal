import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#dceeff",
          500: "#4a9dff",
          700: "#237be0"
        }
      },
      boxShadow: {
        card: "0 10px 25px rgba(28, 82, 136, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

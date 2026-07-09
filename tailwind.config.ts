import type { Config } from "tailwindcss"

// Identidade visual definida no prompt master (§10):
// primária azul escuro, secundária verde, destaque amarelo/dourado,
// fundo cinza claro, texto grafite.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0B2545", // azul escuro
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#1E7A46", // verde
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#D4A017", // amarelo/dourado
          foreground: "#1A1A1A",
        },
        background: "#F5F6F8", // cinza claro
        foreground: "#2B2B2B", // grafite
        status: {
          ativa: "#1E7A46",
          em_atencao: "#D4A017",
          inativa: "#C0392B",
          estrategica: "#0B2545",
          nova: "#8A8F98",
          em_andamento: "#E08E0B",
          resolvida: "#1E7A46",
          atrasada: "#C0392B",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
}

export default config

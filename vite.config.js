import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración de Vite para KALLPA.
// `base: './'` permite abrir el build desde cualquier carpeta o subruta
// (la app usa HashRouter, por lo que no requiere configuración del servidor).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

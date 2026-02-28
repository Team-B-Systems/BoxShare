import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

const certPath = path.resolve(__dirname, 'certs/cert.pem');
const keyPath = path.resolve(__dirname, 'certs/key.pem');

const httpsOptions = fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
  : false;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on all interfaces for LAN access
    host: true,
    port: 5173,
    open: true,
    ...(httpsOptions && { https: httpsOptions }),
  },
});

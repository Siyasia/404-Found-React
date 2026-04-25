import react from '@vitejs/plugin-react'

import { defineConfig, loadEnv } from 'vite';


export default ({ mode }) => {
  process.env = {...process.env, ...loadEnv(mode, process.cwd())};
  const allowedHosts = process.env.VITE_URL?.split(',').map(h => h.trim());
  if (!allowedHosts || allowedHosts.length === 0) {
    throw new Error('VITE_URL environment variable is required and must contain at least one host');
  }
  const port = parseInt(process.env.VITE_PORT, 10) || 5173;
  // import.meta.env.VITE_NAME available here with: process.env.VITE_NAME
  // import.meta.env.VITE_PORT available here with: process.env.VITE_PORT

  return defineConfig({
    plugins: [react()],

    server: {
      host: true,
      port: port,
      allowedHosts: allowedHosts,
      hmr: {
        // host: 'capstone.midnight.wtf',
        host: allowedHosts[0], // Use the first allowed host for HMR
        protocol: 'wss',   // MUST be wss because browser is HTTPS
        clientPort: 443    // 👈 key for Cloudflare
      }
    }
  });
}

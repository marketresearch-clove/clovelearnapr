import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      middlewareMode: false,
    },
    plugins: [react()],
    assetsInclude: ['**/*.pptx', '**/*.pdf', '**/*.mp4'],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            let extType = info[info.length - 1];
            if (/png|jpe?g|gif|tiff|bmp|ico/i.test(extType)) {
              extType = 'images';
            } else if (/woff|woff2|ttf|otf|eot/i.test(extType)) {
              extType = 'fonts';
            } else if (/mp4|webm|ogv/i.test(extType)) {
              extType = 'videos';
            } else if (/pdf|pptx/i.test(extType)) {
              extType = 'docs';
            }
            return `assets/${extType}/[name]-[hash][extname]`;
          }
        }
      }
    }
  };
});
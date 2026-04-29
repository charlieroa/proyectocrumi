import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load .env files so we can map VITE_* to process.env.REACT_APP_*
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // The 'process' npm polyfill overrides individual process.env.X defines,
      // so we must define the entire process.env object at once.
      'process.env': JSON.stringify({
        NODE_ENV: mode,
        REACT_APP_DEFAULTAUTH: env.VITE_DEFAULTAUTH || 'jwt',
        REACT_APP_API_URL: env.VITE_API_URL || '',
        REACT_APP_OPENAI_API_KEY: env.VITE_OPENAI_API_KEY || '',
        PUBLIC_URL: '',
      }),
    },
    resolve: {
      alias: {
        // Match tsconfig baseUrl: "./src"
        Components: path.resolve(__dirname, 'src/Components'),
        Layouts: path.resolve(__dirname, 'src/Layouts'),
        Routes: path.resolve(__dirname, 'src/Routes'),
        assets: path.resolve(__dirname, 'src/assets'),
        helpers: path.resolve(__dirname, 'src/helpers'),
        hooks: path.resolve(__dirname, 'src/hooks'),
        pages: path.resolve(__dirname, 'src/pages'),
        services: path.resolve(__dirname, 'src/services'),
        slices: path.resolve(__dirname, 'src/slices'),
        config: path.resolve(__dirname, 'src/config'),
      },
    },
    server: {
      port: 3003,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
        },
      },
    },
    build: {
      outDir: 'build',
    },
  };
});

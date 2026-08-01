import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.QG_BACKEND_URL || 'http://127.0.0.1:8080';

  return {
    base: '/vue/',
    plugins: [vue()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/monaco-editor')) return 'monaco-editor';
            if (id.includes('node_modules/klinecharts')) return 'klinecharts';
            if (id.includes('node_modules/ant-design-vue')) return 'ant-design-vue';
            return undefined;
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': backendUrl,
      },
    },
  };
});

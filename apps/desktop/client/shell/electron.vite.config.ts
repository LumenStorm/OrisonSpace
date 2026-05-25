import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const desktopUiSrc = path.resolve(__dirname, '../ui/src');
const bundledWorkspaceDeps = ['@orison/shared-contracts', '@orison/model-protocols', '@orison/story-sync', '@orison/desktop-agent'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundledWorkspaceDeps })],
    build: {
      outDir: 'dist/main',
      lib: {
        entry: path.resolve(__dirname, 'main/index.ts'),
        formats: ['cjs']
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundledWorkspaceDeps })],
    build: {
      outDir: 'dist/preload',
      lib: {
        entry: path.resolve(__dirname, 'preload/index.ts'),
        formats: ['cjs']
      },
      rollupOptions: {
        output: {
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: path.resolve(__dirname, 'renderer'),
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, 'dist/renderer'),
      rollupOptions: {
        input: path.resolve(__dirname, 'renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@desktop-ui': desktopUiSrc
      }
    }
  }
});

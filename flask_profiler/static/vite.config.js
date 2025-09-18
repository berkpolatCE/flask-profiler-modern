import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/flask-profiler/static/dist/',  // Must match Flask blueprint's static_url_path
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/index.html',  // Use HTML as entry point
      output: {
        entryFileNames: 'js/flask-profiler.js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    minify: true,
    sourcemap: false  // No sourcemaps for production
  }
});
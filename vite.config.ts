/// <reference types="vitest" />
// feature: exam-variants
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the built page works from https://<user>.github.io/testmessj/
  // as happily as it does from a file opened locally.
  base: './',
  // The sample tests are imported with ?url, so Vite emits them itself; there
  // is no public/ directory to copy.
  publicDir: false,
  assetsInclude: ['**/*.docx'],
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  test: {
    // jsdom for DOMParser / XMLSerializer; the compression streams come from
    // Node itself, the same API the browser provides.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // jsdom parses and serialises XML far more slowly than a browser does,
    // and a test here writes whole documents; 5 s is not enough for that.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

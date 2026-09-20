/// <reference types="vitest" />
// feature: exam-variants
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the built page works from https://<user>.github.io/testmessj/
  // as happily as it does from a file opened locally.
  base: './',
  // samples/ is the static directory, so both sample tests are copied to the
  // root of the build under their own names.  They are deliberately not
  // fingerprinted assets: a teacher is meant to be able to download one, open
  // it in Word and copy its layout, and a link worth sending someone should
  // not change its name on every build.
  publicDir: 'samples',
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

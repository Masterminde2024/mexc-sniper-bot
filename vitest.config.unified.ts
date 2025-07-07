import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load test environment variables
config({ path: '.env.test', override: true })

// Verify critical environment variables are loaded
if (!process.env.DATABASE_URL) {
  // Set fallback for DATABASE_URL if not loaded from .env.test
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
}

/**
 * Simplified Vitest Configuration for MEXC Sniper Bot
 * Optimized for speed and reduced strictness
 */
export default defineConfig({
  test: {
    // Environment setup - Use jsdom for React component tests
    environment: 'jsdom',
    globals: true,
    
    // Test discovery and inclusion - ONLY test files, no spec files
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/utils/**/*.test.{js,ts,tsx}',
      'tests/components/**/*.test.{js,ts,tsx}',
    ],
    
    // Comprehensive exclusions
    exclude: [
      'node_modules', 
      'dist', 
      '.next', 
      'coverage',
      'build',
      'out',
      'tests/e2e/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      'all-tests/**/*',
    ],
    
    // Fast timeout configuration
    testTimeout: 30000, // Reduced to 30 seconds
    hookTimeout: 60000, // Increased for cleanup
    teardownTimeout: 30000, // Increased for cleanup
    
    // No retries for speed
    retry: 0,
    
    // Conditional coverage reporting
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage/vitest'
    },
    
    // Simplified environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      FORCE_MOCK_DB: 'false',
      USE_REAL_DATABASE: 'true',
      OPENAI_API_KEY: 'test-openai-key-vitest',
      MEXC_API_KEY: 'test-mexc-key-vitest',
      MEXC_SECRET_KEY: 'test-mexc-secret-vitest',
      MEXC_BASE_URL: 'https://api.mexc.com',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      DATABASE_URL: process.env.DATABASE_URL,
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
    },
    
    // Minimal setup files
    setupFiles: [
      './tests/setup/vitest-setup.ts'
    ],
    
    // Minimal reporting for speed
    reporters: [['default', { summary: false }]],
      
    // Output configuration
    outputFile: {
      json: './test-results/vitest-results.json',
    },
    
    // No watch mode in tests
    watch: false,
    
    // Performance-optimized settings - disable most checks
    logHeapUsage: false,
    isolate: true,
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    
    // Single thread for simplicity
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
        isolate: true,
      },
    },
    maxConcurrency: 1,
    fileParallelism: false
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './'),
    },
  },
  
  // Build configuration for testing - relaxed
  esbuild: {
    target: 'node18',
    sourcemap: false, // Disable for speed
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  
  // Define global constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    global: 'globalThis',
  }
})
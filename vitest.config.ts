import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        testTimeout: 30000,
        hookTimeout: 10000,
        setupFiles: ['src/__tests__/setup.ts'],
    },
});

import { defineConfig } from 'vitest/config';
import path from 'path';

// Config mínima: solo pruebas unitarias de lógica pura (finanzas, geometría),
// sin necesidad de un entorno DOM — mismo alias "@/*" que usa Next.js.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'node',
        include: ['**/*.test.ts'],
        exclude: ['node_modules', '.next'],
    },
});

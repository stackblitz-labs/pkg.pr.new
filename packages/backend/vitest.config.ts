import path from 'path';
import { defineConfig } from 'vitest/config'


const simulacrumFoundationSimulator = path.resolve(__dirname, "node_modules/@simulacrum/foundation-simulator/dist/cjs/index.js")
console.log(simulacrumFoundationSimulator)

export default defineConfig({
    resolve: {
        alias: {
            "@simulacrum/foundation-simulator": simulacrumFoundationSimulator 
        },
        preserveSymlinks: true
    },
    test: {
    }
});

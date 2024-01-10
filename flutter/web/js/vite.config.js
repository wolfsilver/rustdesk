import { defineConfig, splitVendorChunkPlugin } from 'vite';

export default defineConfig({
    plugins: [splitVendorChunkPlugin()],
    build: {
        manifest: false,
        rollupOptions: {
            output: {
                entryFileNames: `[name].[hash].js`,
                chunkFileNames: `[name].[hash].js`,
                assetFileNames: `[name].[ext]`,
            }
        }
    },
})

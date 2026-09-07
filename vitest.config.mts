import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// .mts-ändelsen gör att Vite laddar konfigen via ESM-ingången i stället för
// den deprekerade CJS-ingången (varningen "The CJS build of Vite's Node API
// is deprecated"). I ESM finns inte __dirname — vi härleder roten från
// import.meta.url i stället.
const rot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': rot },
  },
})

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'src/index.html',
        admin: 'src/admin.html',
        rbac: 'src/rbac.html'
      }
    }
  }
})
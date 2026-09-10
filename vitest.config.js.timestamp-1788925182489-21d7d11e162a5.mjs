// vitest.config.js
import { defineConfig } from "file:///C:/Dev/PROJECTS/NeuroBridge/node_modules/vitest/dist/config.js";
import react from "file:///C:/Dev/PROJECTS/NeuroBridge/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Dev/PROJECTS/NeuroBridge/vitest.config.js";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var vitest_config_default = defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: [
      "src/**/*.{test,spec}.{js,jsx}",
      "backend/**/*.{test,spec}.{js,jsx}",
      "mobile/src/**/*.{test,spec}.{ts,tsx}"
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@backend": path.resolve(__dirname, "./backend")
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXERldlxcXFxQUk9KRUNUU1xcXFxOZXVyb0JyaWRnZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcRGV2XFxcXFBST0pFQ1RTXFxcXE5ldXJvQnJpZGdlXFxcXHZpdGVzdC5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L0Rldi9QUk9KRUNUUy9OZXVyb0JyaWRnZS92aXRlc3QuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJ1cmxcIjtcclxuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgICB0ZXN0OiB7XHJcbiAgICAgICAgZW52aXJvbm1lbnQ6IFwianNkb21cIixcclxuICAgICAgICBnbG9iYWxzOiB0cnVlLFxyXG4gICAgICAgIHNldHVwRmlsZXM6IFtcIi4vc3JjL3Rlc3Qvc2V0dXAuanNcIl0sXHJcbiAgICAgICAgaW5jbHVkZTogW1xyXG4gICAgICAgICAgICBcInNyYy8qKi8qLnt0ZXN0LHNwZWN9Lntqcyxqc3h9XCIsXHJcbiAgICAgICAgICAgIFwiYmFja2VuZC8qKi8qLnt0ZXN0LHNwZWN9Lntqcyxqc3h9XCIsXHJcbiAgICAgICAgICAgIFwibW9iaWxlL3NyYy8qKi8qLnt0ZXN0LHNwZWN9Lnt0cyx0c3h9XCIsXHJcbiAgICAgICAgXSxcclxuICAgIH0sXHJcbiAgICByZXNvbHZlOiB7XHJcbiAgICAgICAgYWxpYXM6IHtcclxuICAgICAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICAgICAgICAgIFwiQGJhY2tlbmRcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL2JhY2tlbmRcIiksXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQStRLFNBQVMsb0JBQW9CO0FBQzVTLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyxxQkFBcUI7QUFIeUksSUFBTSwyQ0FBMkM7QUFJeE4sSUFBTSxZQUFZLEtBQUssUUFBUSxjQUFjLHdDQUFlLENBQUM7QUFDN0QsSUFBTyx3QkFBUSxhQUFhO0FBQUEsRUFDeEIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE1BQU07QUFBQSxJQUNGLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxJQUNULFlBQVksQ0FBQyxxQkFBcUI7QUFBQSxJQUNsQyxTQUFTO0FBQUEsTUFDTDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLFdBQVcsT0FBTztBQUFBLE1BQ3BDLFlBQVksS0FBSyxRQUFRLFdBQVcsV0FBVztBQUFBLElBQ25EO0FBQUEsRUFDSjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

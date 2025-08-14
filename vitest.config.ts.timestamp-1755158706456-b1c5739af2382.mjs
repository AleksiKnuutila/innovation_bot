// vitest.config.ts
import { defineConfig } from "file:///Users/aleksi/Projects/innovation/node_modules/vitest/dist/config.js";
import { svelte } from "file:///Users/aleksi/Projects/innovation/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "/Users/aleksi/Projects/innovation";
var vitest_config_default = defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "vb-implementation/",
        "**/*.d.ts",
        "**/*.config.*"
      ]
    }
  },
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src"),
      "@/engine": resolve(__vite_injected_original_dirname, "./src/engine"),
      "@/types": resolve(__vite_injected_original_dirname, "./src/types"),
      "@/cards": resolve(__vite_injected_original_dirname, "./src/cards"),
      "@/ui": resolve(__vite_injected_original_dirname, "./src/ui"),
      "@/bot": resolve(__vite_injected_original_dirname, "./src/bot")
    }
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9hbGVrc2kvUHJvamVjdHMvaW5ub3ZhdGlvblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2FsZWtzaS9Qcm9qZWN0cy9pbm5vdmF0aW9uL3ZpdGVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2FsZWtzaS9Qcm9qZWN0cy9pbm5vdmF0aW9uL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcbmltcG9ydCB7IHN2ZWx0ZSB9IGZyb20gJ0BzdmVsdGVqcy92aXRlLXBsdWdpbi1zdmVsdGUnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbc3ZlbHRlKCldLFxuICB0ZXN0OiB7XG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBjb3ZlcmFnZToge1xuICAgICAgcHJvdmlkZXI6ICd2OCcsXG4gICAgICByZXBvcnRlcjogWyd0ZXh0JywgJ2pzb24nLCAnaHRtbCddLFxuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAnbm9kZV9tb2R1bGVzLycsXG4gICAgICAgICdkaXN0LycsXG4gICAgICAgICd2Yi1pbXBsZW1lbnRhdGlvbi8nLFxuICAgICAgICAnKiovKi5kLnRzJyxcbiAgICAgICAgJyoqLyouY29uZmlnLionLFxuICAgICAgXSxcbiAgICB9LFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgJ0AvZW5naW5lJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9lbmdpbmUnKSxcbiAgICAgICdAL3R5cGVzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy90eXBlcycpLFxuICAgICAgJ0AvY2FyZHMnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2NhcmRzJyksXG4gICAgICAnQC91aSc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdWknKSxcbiAgICAgICdAL2JvdCc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvYm90JyksXG4gICAgfSxcbiAgfSxcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVIsU0FBUyxvQkFBb0I7QUFDdFQsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsZUFBZTtBQUZ4QixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsT0FBTyxDQUFDO0FBQUEsRUFDbEIsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsVUFBVTtBQUFBLE1BQ1IsVUFBVTtBQUFBLE1BQ1YsVUFBVSxDQUFDLFFBQVEsUUFBUSxNQUFNO0FBQUEsTUFDakMsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQy9CLFlBQVksUUFBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDN0MsV0FBVyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUMzQyxXQUFXLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQzNDLFFBQVEsUUFBUSxrQ0FBVyxVQUFVO0FBQUEsTUFDckMsU0FBUyxRQUFRLGtDQUFXLFdBQVc7QUFBQSxJQUN6QztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=

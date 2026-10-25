import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * react-photo-editor bundles Tailwind's global preflight reset (`*, button, h1-h6`)
 * inside its dist/index.css, which corrupts global app button and border styles.
 * This plugin strips the preflight and preserves all .rpe-* classes.
 */
function stripPhotoEditorPreflight() {
  return {
    name: "strip-photo-editor-preflight",
    transform(code: string, id: string) {
      if (id.includes("react-photo-editor") && id.endsWith(".css")) {
        const rpeStart = code.indexOf(".rpe-fixed");
        if (rpeStart !== -1) {
          return { code: code.slice(rpeStart), map: null };
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [stripPhotoEditorPreflight(), react()],
  server: {
    proxy: {
      // Same-origin door to the backend, so its httpOnly admin cookies work in dev.
      "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:8000", changeOrigin: true },
    },
  },
  resolve: {
    alias: { "@": "/src" },
    // One copy of each, so BlockNote's React context is shared by the editor and its blocks.
    dedupe: ["react", "react-dom", "@blocknote/core", "@blocknote/react", "@blocknote/mantine", "@mantine/core"],
  },
  // The studio route is lazy: without this Vite discovers BlockNote after startup, re-optimizes it and a
  // page loaded before that holds a second copy of the package ("useBlockNoteEditor was called outside of a
  // BlockNoteContext provider"). Pre-bundling it up front keeps a single instance.
  optimizeDeps: {
    include: ["@blocknote/core", "@blocknote/core/locales", "@blocknote/react", "@blocknote/mantine", "@floating-ui/react"],
  },
});

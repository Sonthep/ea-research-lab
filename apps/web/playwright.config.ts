import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", timeout: 30000, use: { baseURL: "http://localhost:3000", headless: true, viewport: { width: 1440, height: 1000 } }, reporter: "list", workers: 1 });

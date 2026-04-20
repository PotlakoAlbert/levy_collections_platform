#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Remove package-lock.json and yarn.lock
const files = ["package-lock.json", "yarn.lock"];
const root = path.dirname(__dirname);

files.forEach((file) => {
  const filePath = path.join(root, file);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Removed ${file}`);
    }
  } catch (err) {
    console.error(`Failed to remove ${file}:`, err.message);
  }
});

// Check for pnpm
const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Please use pnpm instead of npm or yarn");
  process.exit(1);
}

console.log("Preinstall checks passed");

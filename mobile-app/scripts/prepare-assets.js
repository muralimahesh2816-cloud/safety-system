const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(projectRoot, "..");
const assetsDir = path.join(projectRoot, "assets");
const webLogo = path.join(repoRoot, "admin-panel", "src", "assets", "logo.png");

const fallbackPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWElEQVR4nO3QMQEAAAwCoNm/9F4HGlA0QHfS2QEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwG4ABAAFxCkS7AAAAAElFTkSuQmCC",
  "base64"
);

fs.mkdirSync(assetsDir, { recursive: true });

const source = fs.existsSync(webLogo) ? fs.readFileSync(webLogo) : fallbackPng;

["logo.png", "icon.png", "adaptive-icon.png", "splash.png"].forEach((name) => {
  fs.writeFileSync(path.join(assetsDir, name), source);
});

console.log("Mobile app assets prepared.");

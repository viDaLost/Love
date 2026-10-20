import { spawnSync } from "node:child_process";
for (const path of ["assets/model.js", "assets/portrait.js", "assets/animation.js", "scripts/serve.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", path], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("JavaScript syntax is valid.");

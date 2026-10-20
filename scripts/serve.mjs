// Optional local preview. No installation or build step is needed.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep, extname } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 8080);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml" };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(root, "." + pathname + (pathname.endsWith("/") ? "index.html" : ""));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403); response.end(); return;
    }
    const data = await readFile(file);
    response.writeHead(200, { "Content-Type":mime[extname(file)] || "application/octet-stream", "Cache-Control":"no-cache" });
    response.end(data);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(port, "0.0.0.0", () => console.log("Preview: http://localhost:" + port));

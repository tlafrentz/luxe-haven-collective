// Next.js 16 + Turbopack correctly skips writing .next/server/middleware.js.nft.json
// (it only renames proxy.js.nft.json -> middleware.js.nft.json for webpack builds; see
// the `bundler !== Bundler.Turbopack` guard in next/dist/build/index.js). But Vercel's
// own build step still unconditionally reads that file when packaging the Edge Function
// for middleware, causing every Turbopack deploy to fail with ENOENT. The middleware
// bundle is self-contained (edge runtime, no external files to trace), so an empty
// trace list is the semantically correct content, not a stub. Only creates the file if
// Next didn't already produce one, so this becomes a no-op the moment upstream fixes it.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const serverDir = join(process.cwd(), ".next/server");
const manifestPath = join(serverDir, "middleware-manifest.json");
const nftPath = join(serverDir, "middleware.js.nft.json");

if (existsSync(manifestPath) && !existsSync(nftPath)) {
  writeFileSync(nftPath, JSON.stringify({ version: 1, files: [] }));
  console.log(`[ensure-middleware-nft] created missing ${nftPath}`);
}

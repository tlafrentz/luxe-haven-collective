#!/usr/bin/env node
// Walks src/app for page.tsx files and prints a route inventory.
// The route tree changes as the app grows, so this discovers routes fresh
// on every run instead of the skill carrying a hardcoded, staling list.
//
// Usage:
//   node discover-routes.mjs                 # full inventory, table output
//   node discover-routes.mjs --area=admin     # only routes under one area
//   node discover-routes.mjs --grep=reports   # only routes matching a substring
//   node discover-routes.mjs --changed        # only routes touched vs origin/main
//   node discover-routes.mjs --json           # machine-readable output

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execSync } from "node:child_process";

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const appDir = join(repoRoot, "src", "app");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  }),
);

function findPageFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "api") continue; // API routes aren't screens
      findPageFiles(full, out);
    } else if (entry === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

function toRoute(file) {
  const rel = relative(appDir, file).replace(/\/page\.tsx$/, "");
  const segments = rel.split(sep).filter((seg) => !/^\(.*\)$/.test(seg)); // drop route groups
  return "/" + segments.join("/");
}

function toArea(file) {
  const rel = relative(appDir, file);
  const firstSegment = rel.split(sep)[0];
  const groupMatch = firstSegment.match(/^\((.+)\)$/);
  return groupMatch ? groupMatch[1] : firstSegment;
}

function dynamicParams(route) {
  return [...route.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
}

function loadProtectedPrefixes() {
  const rolesFile = join(repoRoot, "src", "lib", "auth", "roles.ts");
  const src = readFileSync(rolesFile, "utf8");
  const extract = (name) => {
    const match = src.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]+)\\]`));
    if (!match) return [];
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };
  return {
    protectedRoutes: extract("protectedRoutes"),
    adminRoutes: extract("adminRoutes"),
  };
}

function changedRoutes() {
  try {
    const diff = execSync("git diff --name-only origin/main...HEAD -- src/app", {
      cwd: repoRoot,
    })
      .toString()
      .trim();
    if (!diff) return null;
    return new Set(diff.split("\n").filter((f) => f.endsWith("page.tsx")));
  } catch {
    return null;
  }
}

const { protectedRoutes, adminRoutes } = loadProtectedPrefixes();
const isProtected = (route) =>
  protectedRoutes.some((p) => route === p || route.startsWith(`${p}/`));
const isAdmin = (route) => adminRoutes.some((p) => route === p || route.startsWith(`${p}/`));

let files = findPageFiles(appDir);

if (args.changed) {
  const changed = changedRoutes();
  if (changed) {
    files = files.filter((f) => changed.has(relative(repoRoot, f)));
  } else {
    console.error("--changed: no diff against origin/main (or not resolvable); showing full inventory instead.");
  }
}

let routes = files.map((file) => {
  const route = toRoute(file);
  return {
    route,
    file: relative(repoRoot, file),
    area: toArea(file),
    dynamic: dynamicParams(route),
    protected: isProtected(route),
    admin: isAdmin(route),
  };
});

if (args.area) {
  routes = routes.filter((r) => r.area === args.area);
}
if (args.grep) {
  const needle = String(args.grep).toLowerCase();
  routes = routes.filter((r) => r.route.toLowerCase().includes(needle));
}

routes.sort((a, b) => a.route.localeCompare(b.route));

if (args.json) {
  console.log(JSON.stringify(routes, null, 2));
} else {
  const areas = [...new Set(routes.map((r) => r.area))];
  for (const area of areas) {
    const inArea = routes.filter((r) => r.area === area);
    console.log(`\n## ${area} (${inArea.length})`);
    for (const r of inArea) {
      const flags = [
        r.dynamic.length ? `dynamic:${r.dynamic.join(",")}` : null,
        r.admin ? "admin-only" : r.protected ? "auth-required" : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${r.route}${flags ? "  [" + flags + "]" : ""}`);
    }
  }
  console.log(`\nTotal: ${routes.length} routes`);
}

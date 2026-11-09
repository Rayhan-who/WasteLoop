/**
 * Node module resolve hooks for the test runner.
 *
 * Tests run on Node's built-in runner with native TypeScript type stripping
 * (no bundler, no native binaries). These hooks add what the Next.js bundler
 * normally provides:
 *   - the `@/` path alias → ./src
 *   - extensionless imports of .ts / .tsx files
 *   - JSON imports without an explicit import attribute
 *   - a no-op stand-in for `server-only`
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../../src/", import.meta.url);
const SERVER_ONLY_STUB = new URL("./server-only-stub.mjs", import.meta.url);
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function isFile(url) {
  const p = fileURLToPath(url);
  return existsSync(p) && statSync(p).isFile();
}

function withExtension(url) {
  if (isFile(url)) return url;
  for (const ext of EXTENSIONS) {
    const candidate = new URL(url.href + ext);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function finish(url, context) {
  if (url.pathname.endsWith(".json")) {
    return { url: url.href, format: "json", importAttributes: { ...context.importAttributes, type: "json" }, shortCircuit: true };
  }
  if (url.pathname.endsWith(".ts") || url.pathname.endsWith(".tsx")) {
    return { url: url.href, format: "module-typescript", shortCircuit: true };
  }
  return { url: url.href, shortCircuit: true };
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: SERVER_ONLY_STUB.href, format: "module", shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const resolved = withExtension(new URL(specifier.slice(2), SRC));
    if (resolved) return finish(resolved, context);
  }

  const fromTs = context.parentURL && /\.tsx?$/.test(new URL(context.parentURL).pathname);
  if (fromTs && (specifier.startsWith("./") || specifier.startsWith("../"))) {
    const resolved = withExtension(new URL(specifier, context.parentURL));
    if (resolved) return finish(resolved, context);
  }

  return nextResolve(specifier, context);
}


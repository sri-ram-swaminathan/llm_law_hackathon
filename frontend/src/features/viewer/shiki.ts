import type { HighlighterCore, ThemedToken } from "shiki/core";

/** Lazy, fine-grained Shiki: JS regex engine (no wasm), only the languages the bundles use, loaded on demand. */
let core: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();

const LANGS: Record<string, () => Promise<{ default: unknown }>> = {
  python: () => import("shiki/langs/python.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
};

const EXT: Record<string, string> = {
  py: "python", jsx: "jsx", tsx: "tsx", ts: "typescript", js: "javascript", mjs: "javascript", json: "json",
  yml: "yaml", yaml: "yaml", toml: "toml", sh: "bash", css: "css", html: "html", md: "markdown",
};
export const langOf = (path: string) => EXT[path.split(".").pop()?.toLowerCase() ?? ""] ?? null;

const getCore = () =>
  (core ??= Promise.all([import("shiki/core"), import("shiki/engine/javascript"), import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark-default.mjs")]).then(
    ([c, e, light, dark]) => c.createHighlighterCore({ themes: [light.default, dark.default], langs: [], engine: e.createJavaScriptRegexEngine() }),
  ));

export type TokenLine = ThemedToken[];

/** Tokens per line with both light/dark colours as CSS vars (--shiki-light / --shiki-dark). Resolves null for unknown languages. */
export async function tokenize(code: string, path: string): Promise<TokenLine[] | null> {
  const lang = langOf(path);
  if (!lang || !LANGS[lang]) return null;
  const hl = await getCore();
  if (!loaded.has(lang)) {
    await hl.loadLanguage((await LANGS[lang]()).default as never);
    loaded.add(lang);
  }
  return hl.codeToTokens(code, { lang, themes: { light: "github-light", dark: "github-dark-default" }, defaultColor: false }).tokens;
}

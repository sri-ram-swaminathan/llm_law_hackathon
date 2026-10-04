/**
 * SemVer ordering for the release timeline (DESIGN §1: the timeline sorts by semver, not created_at).
 * `1.0.0-rc.12 < 1.0.0`; numeric prerelease ids compare numerically. A leading "v" is ignored.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.replace(/^v/, "").split("+")[0].split(/-(.*)/s);
    return { core: core.split(".").map((n) => parseInt(n, 10) || 0), pre: pre ? pre.split(".") : [] };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.core[i] ?? 0) !== (y.core[i] ?? 0)) return (x.core[i] ?? 0) - (y.core[i] ?? 0);
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length; // release > prerelease
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn && +p !== +q) return +p - +q;
    if (pn !== qn) return pn ? -1 : 1;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

/** Newest first. */
export const bySemverDesc = <T extends { release: { version: string } }>(l: T[]) =>
  [...l].sort((a, b) => compareVersions(b.release.version, a.release.version));

import type { QueryClient } from "@tanstack/react-query";
import { API_URL, ApiError, FIXTURES, getToken, http, type ReleaseOut } from "@/api/client";
import type { components } from "@/api/types";
import { readZipEntry } from "./zip";

type CiResult = components["schemas"]["CiResult"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Matches the version shapes the spec uses: 0.9.0, 1.0.0-rc.2, 1.0.0. */
export const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const fixtureId = (version: string) => `rel-${version}`;

/** Fixtures mode keeps new releases in the query cache only; a real backend is the source of truth otherwise. */
export function addToCache(qc: QueryClient, out: ReleaseOut) {
  if (!FIXTURES) {
    void qc.invalidateQueries({ queryKey: ["releases"] });
    return;
  }
  qc.setQueryData<ReleaseOut[]>(["releases"], (list = []) => [...list.filter((r) => r.release.id !== out.release.id), out]);
}

/** POST /api/releases (multipart: `bundle` file(s) + `version`) with upload progress. */
export function uploadRelease(
  files: File[], version: string, previous: ReleaseOut | undefined, onProgress: (pct: number) => void,
): Promise<ReleaseOut> {
  if (FIXTURES) {
    return (async () => {
      for (let p = 0; p <= 100; p += 10) { onProgress(p); await sleep(70); }
      return {
        release: {
          id: fixtureId(version), product_id: "wealthpilot", version, source: "ui", git_sha: null, branch: null,
          pr_number: null, ci_run_url: null, previous_release_id: previous?.release.id ?? null, created_at: new Date().toISOString(),
        },
        artifacts: [], latest_assessment: null,
      };
    })();
  }
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("version", version);
    files.forEach((f) => fd.append("bundle", f, f.name));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/releases`);
    const token = getToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("X-Deploy-Token", token);
    }
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new Error("Network error: the upload did not reach the server."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        try { resolve(JSON.parse(xhr.responseText) as ReleaseOut); } catch { reject(new Error("Unexpected response from the server.")); }
        return;
      }
      let detail = `${xhr.status} ${xhr.statusText}`;
      try {
        const d = JSON.parse(xhr.responseText)?.detail;
        if (typeof d === "string") detail = d;
        else if (Array.isArray(d) && d[0]?.msg) detail = d[0].msg;
      } catch { /* keep status text */ }
      reject(new ApiError(xhr.status, detail));
    };
    xhr.send(fd);
  });
}

/** Reads a CI `result.json` (or the artifact ZIP that contains it) from a user-chosen file. */
export async function readCiResult(file: File): Promise<CiResult> {
  let text: string;
  if (/\.zip$/i.test(file.name) || file.type === "application/zip") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entry = await readZipEntry(bytes, (n) => /(^|\/)result\.json$/i.test(n));
    if (!entry) throw new Error("This ZIP has no result.json. Use the artifact produced by the CCOmmit CI job.");
    text = new TextDecoder().decode(entry);
  } else {
    text = await file.text();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("The file is not valid JSON."); }
  const r = parsed as Partial<CiResult>;
  if (!r || typeof r !== "object" || !r.release || !r.readiness || !r.assessment) {
    throw new Error("This does not look like a CCOmmit result.json (missing release, assessment or readiness).");
  }
  return r as CiResult;
}

/** POST /api/releases/import. */
export async function importCiRun(result: CiResult): Promise<ReleaseOut> {
  if (FIXTURES) {
    await sleep(400);
    return { release: { ...result.release, source: "ci" }, artifacts: [], latest_assessment: result.assessment };
  }
  return http<ReleaseOut>("/api/releases/import", { method: "POST", body: JSON.stringify({ result }) });
}

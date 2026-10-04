import { register as finding } from "@/features/finding";
import { register as viewer } from "@/features/viewer";
import { register as legal } from "@/features/legal";
import { register as evidence } from "@/features/evidence";
import { register as activity } from "@/features/activity";
import { register as review } from "@/features/review";
import { register as persona } from "@/features/persona";
import { register as fixplan } from "@/features/fixplan";
import { register as releases } from "@/features/releases";
import { register as profile } from "@/features/profile";
import { register as overview } from "@/features/overview";
import { register as findings } from "@/features/findings";

/** Every feature folder registers its slot contributions here, once at startup. */
export function registerFeatures() {
  [overview, findings, finding, viewer, legal, evidence, activity, review, persona, fixplan, releases, profile].forEach((r) => r());
}

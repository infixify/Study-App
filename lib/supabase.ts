// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type ClassLevel = "10" | "11" | "12" | "11_12" | "Dropper";
export type TargetExam = "JEE" | "NEET" | "Boards";
export type StudyMode = "Online" | "Offline" | "Self";

export interface OnboardingData {
  classLevel: ClassLevel | null;
  targetExam: TargetExam | null;
  wantsBoards: boolean;
  studyMode: StudyMode | null;
  batchOrBranch: string | null;
}

// Mocked auth call — replace with supabase.auth.signInWithOAuth({ provider: "google" })
export async function mockGoogleSignIn(): Promise<{ name: string; email: string }> {
  await new Promise((r) => setTimeout(r, 600));
  return { name: "Aarav Sharma", email: "aarav.sharma@gmail.com" };
}

// Mocked profile write — replace with supabase.from("users").upsert(...)
// NOTE: class_level / target_exam / wants_boards should only ever be written
// here, at signup time. After onboarding_completed = true, the DB trigger
// (see schema.sql -> trg_users_lock_after_onboarding) rejects changes to
// these three columns, so the profile screen must never send them again.
export async function mockSaveOnboarding(data: OnboardingData) {
  await new Promise((r) => setTimeout(r, 400));
  console.log("Saving onboarding profile:", data);
  return { success: true };
}

// Mocked profile update for the EDITABLE fields only (study_mode, batch).
// Real version: supabase.from("users").update({ study_mode, batch_or_branch_id }).eq("uid", uid)
export async function mockUpdateEditableProfile(fields: {
  studyMode: StudyMode;
  batchOrBranch: string | null;
}) {
  await new Promise((r) => setTimeout(r, 300));
  console.log("Updating editable profile fields:", fields);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Batches — Online is grouped by institute with real, named batch series.
// Offline is institute-name only (no batch-level detail), per product call.
// In production this seeds/reads from the `batches` table (see schema.sql).
// ---------------------------------------------------------------------------
export interface OnlineBatchOption {
  institute: string;
  name: string;
  meta: string; // short descriptor shown under the batch name
}

export const ONLINE_BATCHES: OnlineBatchOption[] = [
  { institute: "Physics Wallah (PW)", name: "Arjuna", meta: "Class 11 · JEE/NEET foundation" },
  { institute: "Physics Wallah (PW)", name: "Lakshya", meta: "Class 12 · Boards + entrance" },
  { institute: "Physics Wallah (PW)", name: "Yakeen", meta: "Dropper · intensive revision" },
  { institute: "Physics Wallah (PW)", name: "Uday", meta: "Class 11 · NEET/JEE + Boards" },
  { institute: "Physics Wallah (PW)", name: "Udaan", meta: "Class 10 · foundation" },
  { institute: "Aakash", name: "iACST / ANTHE track", meta: "Foundation + entrance" },
  { institute: "Aakash", name: "Aakash iTutor", meta: "Online live + recorded" },
  { institute: "Vedantu", name: "Vedantu JEE/NEET Pro", meta: "Live batches" },
  { institute: "Vedantu", name: "Master Course", meta: "Long-term track" },
  { institute: "Unacademy", name: "NEET/JEE batch", meta: "Subscription based" },
];

// Offline: institute name only — student's actual batch inside the institute
// isn't asked at signup for offline mode.
export const OFFLINE_INSTITUTES: string[] = [
  "Allen Career Institute",
  "Aakash Institute",
  "FIITJEE",
  "Resonance",
  "Motion Education",
  "Narayana",
  "Sri Chaitanya",
  "Physics Wallah Vidyapeeth",
  "Local / Independent Coaching",
];

export const BATCH_OTHER = "Other / not listed";

// Class options shown at signup. "11_12" is the combined track — content
// queries should treat it as the union of Class 11 + Class 12 content.
export const CLASS_OPTIONS: { value: ClassLevel; label: string; sub: string; isNew?: boolean }[] = [
  { value: "10", label: "Class 10", sub: "Boards focus" },
  { value: "11", label: "Class 11", sub: "Foundation year" },
  { value: "12", label: "Class 12", sub: "Boards + entrance" },
  { value: "11_12", label: "11 + 12", sub: "Combined 2-year track", isNew: true },
  { value: "Dropper", label: "Dropper", sub: "One more shot, fully focused" },
];

// Helper used by content queries (library/dashboard) so a user on the
// combined track sees both classes' chapters instead of just one.
export function classLevelsForContent(classLevel: ClassLevel | null): string[] {
  if (classLevel === "11_12") return ["11", "12"];
  if (!classLevel) return [];
  return [classLevel];
}

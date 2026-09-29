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

// Mocked auth call — kept only in case anything still imports it.
// Real sign-in now happens via supabase.auth.signInWithOAuth in StepLogin.tsx.
export async function mockGoogleSignIn(): Promise<{ name: string; email: string }> {
  await new Promise((r) => setTimeout(r, 600));
  return { name: "Aarav Sharma", email: "aarav.sharma@gmail.com" };
}

// Shared helper: resolves a batch/institute display string to its row id.
// Uses case-insensitive + trimmed matching so small formatting differences
// (extra space, different case) don't silently null out batch_or_branch_id.
// Returns null for "Self" mode or the "Other / not listed" option.
async function resolveBatchId(batchOrBranch: string | null): Promise<string | null> {
  if (!batchOrBranch || batchOrBranch === BATCH_OTHER) return null;

  const { data: batchRow, error } = await supabase
    .from("batches")
    .select("id, name")
    .ilike("name", batchOrBranch.trim())
    .maybeSingle();

  if (error) {
    console.error("Batch lookup failed:", error.message);
    return null;
  }
  if (!batchRow) {
    console.warn(
      `No batch match found for "${batchOrBranch}" — batch_or_branch_id will be null.`
    );
    return null;
  }
  return batchRow.id;
}

// Real profile write — creates/updates the signed-in user's row.
// NOTE: class_level / target_exam / wants_boards should only ever be written
// here, at signup time. After onboarding_completed = true, the DB trigger
// (see schema.sql -> trg_users_lock_after_onboarding) rejects changes to
// these three columns, so the profile screen must never send them again.
export async function saveOnboarding(data: OnboardingData) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { success: false, error: "Not signed in" };
  }

  const batchId = await resolveBatchId(data.batchOrBranch);

  const { error } = await supabase.from("users").upsert({
    uid: authData.user.id,
    name:
      authData.user.user_metadata?.full_name ||
      authData.user.user_metadata?.name ||
      "Student",
    email: authData.user.email!,
    class_level: data.classLevel,
    target_exam: data.targetExam,
    wants_boards: data.wantsBoards,
    study_mode: data.studyMode,
    batch_or_branch_id: batchId,
    onboarding_completed: true,
  });

  if (error) {
    console.error("Failed to save onboarding profile:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// Backward-compat alias — app/onboarding/page.tsx uses the new name directly;
// this keeps any other still-mock-named import from breaking the build.
export const mockSaveOnboarding = saveOnboarding;

// Real profile update for the EDITABLE fields only (study_mode, batch).
export async function updateEditableProfile(fields: {
  studyMode: StudyMode;
  batchOrBranch: string | null;
}) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return { success: false, error: "Not signed in" };
  }

  const batchId = await resolveBatchId(fields.batchOrBranch);

  const { error } = await supabase
    .from("users")
    .update({
      study_mode: fields.studyMode,
      batch_or_branch_id: batchId,
    })
    .eq("uid", authData.user.id);

  if (error) {
    console.error("Failed to update editable profile:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// Backward-compat alias for app/profile/page.tsx (still imports the mock name).
export const mockUpdateEditableProfile = updateEditableProfile;

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

// Helper used by content queries (library/dashboard/resources) so a user on the
// combined track or dropper sees both classes' chapters instead of just one.
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
  if (classLevel === "11_12" || classLevel === "Dropper") {
  // Dropper students and 11+12 combined students get full Class 11 and 12 NCERT & content
    return ["11", "12"];
  }
  if (!classLevel) return [];
  return [classLevel];
}

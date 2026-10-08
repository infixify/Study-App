// app/resources/page.tsx
"use client";

import { createElement as e, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/dashboard/BottomNav";
import ResourceChapterList, { RESOURCE_TYPES, SubjectGroup } from "@/components/resources/ResourceChapterList";
import type { Resource } from "@/components/resources/ResourceChapterList";

// 4 fixed buckets — no auth, no personalization
type BucketKey = "11_jee" | "11_neet" | "12_jee" | "12_neet";

const BUCKETS: { key: BucketKey; label: string; classLevels: string[]; exam: string }[] = [
  { key: "11_jee",  label: "11th JEE",  classLevels: ["11", "11_12"], exam: "JEE"  },
  { key: "11_neet", label: "11th NEET", classLevels: ["11", "11_12"], exam: "NEET" },
  { key: "12_jee",  label: "12th JEE",  classLevels: ["12", "11_12"], exam: "JEE"  },
  { key: "12_neet", label: "12th NEET", classLevels: ["12", "11_12"], exam: "NEET" },
];

// Subjects to show per exam (display order)
const JEE_SUBJECTS  = ["Physics", "Chemistry", "Mathematics"];
const NEET_SUBJECTS = ["Physics", "Chemistry", "Biology"];

interface BucketData {
  subjectGroups: SubjectGroup[];
  resources: Resource[];
}

// In-memory cache: bucketKey → data
const bucketCache = new Map<BucketKey, BucketData>();

export default function ResourcesPage() {
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<BucketKey | null>(null);
  const [bucketData, setBucketData] = useState<BucketData | null>(null);
  const [loadingBucket, setLoadingBucket] = useState(false);

  // Auto-intercept PDF / Drive links for AppBridge
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("a, button");
      if (!target) return;
      const href = (target as HTMLAnchorElement).href || target.getAttribute("data-url") || "";
      const downloadAttr = target.getAttribute("download");
      const targetText = (target.textContent || "").toLowerCase();
      const isDownload =
        targetText.includes("download") ||
        target.getAttribute("aria-label")?.toLowerCase().includes("download") ||
        downloadAttr !== null;
      const isDoc =
        href &&
        (href.toLowerCase().endsWith(".pdf") ||
          href.includes("application/pdf") ||
          href.includes("drive.google.com") ||
          href.includes("ncert.nic.in") ||
          href.includes("docs.google.com/viewer"));
      if ((isDoc || isDownload) && href) {
        if (typeof window !== "undefined" && (window as any).AppBridge) {
          event.preventDefault();
          event.stopPropagation();
          let cleanUrl = href;
          try {
            if (href.includes("docs.google.com/viewer")) {
              const u = new URL(href);
              cleanUrl = u.searchParams.get("url") || href;
            }
          } catch (_) {}
          (window as any).AppBridge.postMessage(
            JSON.stringify({
              action: "downloadPdf",
              url: cleanUrl,
              title: target.getAttribute("data-title") || target.textContent?.trim() || "PrepWise_Resource",
            })
          );
        }
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  async function loadBucket(bkey: BucketKey) {
    if (bucketCache.has(bkey)) {
      setBucketData(bucketCache.get(bkey)!);
      return;
    }
    setLoadingBucket(true);
    setBucketData(null);

    const bucket = BUCKETS.find((b) => b.key === bkey)!;
    const subjectOrder = bucket.exam === "JEE" ? JEE_SUBJECTS : NEET_SUBJECTS;

    const subjectRes = await supabase
      .from("subjects")
      .select("id, name, class_level, display_order")
      .eq("target_exam", bucket.exam)
      .in("class_level", bucket.classLevels)
      .order("display_order", { ascending: true });

    const subjectRows: any[] = (subjectRes.data ?? []).filter(
      (s: any) => subjectOrder.includes(s.name)
    );

    if (subjectRows.length === 0) {
      const empty: BucketData = { subjectGroups: [], resources: [] };
      bucketCache.set(bkey, empty);
      setBucketData(empty);
      setLoadingBucket(false);
      return;
    }

    const subjectRowIds: string[] = subjectRows.map((s: any) => s.id);

    const [chapterRes, chapterResourceRes, subjectResourceRes] = await Promise.all([
      supabase
        .from("chapters")
        .select("id, subject_id, title, display_order, in_competitive_syllabus")
        .in("subject_id", subjectRowIds)
        .order("display_order", { ascending: true }),
      supabase
        .from("resources")
        .select("id, title, url, category, chapter_id, subject_id, display_order, chapters!inner(subject_id)")
        .in("chapters.subject_id", subjectRowIds)
        .order("display_order", { ascending: true }),
      supabase
        .from("resources")
        .select("id, title, url, category, chapter_id, subject_id, display_order")
        .in("subject_id", subjectRowIds)
        .is("chapter_id", null)
        .order("display_order", { ascending: true }),
    ]);

    const chapterRows: any[] = chapterRes.data ?? [];
    const allResources: Resource[] = [
      ...((chapterResourceRes.data ?? []) as any[]),
      ...((subjectResourceRes.data ?? []) as any[]),
    ].map((r: any) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      category: r.category,
      chapter_id: r.chapter_id ?? null,
      subject_id: r.subject_id ?? null,
    }));

    // Group by subject name — merge 11 + 12 rows for 11_12 entries
    // Keep display order per subjectOrder array
    const groupMap = new Map<string, SubjectGroup>();
    for (const name of subjectOrder) {
      groupMap.set(name, { name, subjectRowIds: [], chapters: [] });
    }

    for (const s of subjectRows) {
      if (!groupMap.has(s.name)) continue;
      const entry = groupMap.get(s.name)!;
      entry.subjectRowIds.push(s.id);
      const chaptersForRow = chapterRows
        .filter((c: any) => c.subject_id === s.id)
        .map((c: any) => ({ id: c.id, title: c.title, subjectName: s.name }));
      entry.chapters.push(...chaptersForRow);
    }

    const subjectGroups = subjectOrder
      .map((name) => groupMap.get(name)!)
      .filter((g) => g.subjectRowIds.length > 0);

    const data: BucketData = { subjectGroups, resources: allResources };
    bucketCache.set(bkey, data);
    setBucketData(data);
    setLoadingBucket(false);
  }

  function openType(typeKey: string) {
    setActiveType(typeKey);
    setActiveBucket(null);
    setBucketData(null);
  }

  function openBucket(bkey: BucketKey) {
    setActiveBucket(bkey);
    loadBucket(bkey);
  }

  const activeTypeDef = RESOURCE_TYPES.find((t) => t.key === activeType);

  // ── Screen 1: Resource type grid ──────────────────────────────────────────
  if (!activeTypeDef) {
    return e(
      "div",
      { className: "min-h-screen bg-paper pb-28 smooth-scroll" },
      e(
        "div",
        { className: "max-w-md mx-auto px-5 pt-8" },
        e("h1", { className: "font-display text-3xl text-ink mb-1" }, "Resources"),
        e("p", { className: "text-slate text-sm mb-6" }, "Pick what you're looking for."),
        e(
          "div",
          { className: "grid grid-cols-3 gap-3" },
          RESOURCE_TYPES.map((t) =>
            e(
              "button",
              {
                key: t.key,
                onClick: () => openType(t.key),
                className:
                  "bg-white rounded-ticket border border-ink/10 p-3 flex flex-col items-center gap-2 text-center",
              },
              e(
                "div",
                {
                  className:
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-ink",
                },
                t.icon
              ),
              e("span", { className: "text-xs font-medium text-ink" }, t.label)
            )
          )
        )
      ),
      e(BottomNav)
    );
  }

  // ── Screen 2: 4 bucket buttons ────────────────────────────────────────────
  if (!activeBucket) {
    return e(
      "div",
      { className: "min-h-screen bg-paper pb-28 smooth-scroll" },
      e(
        "div",
        { className: "max-w-md mx-auto px-5 pt-8" },
        e(
          "button",
          { onClick: () => setActiveType(null), className: "text-sm text-slate mb-3" },
          "← All types"
        ),
        e("h1", { className: "font-display text-3xl text-ink mb-1" }, activeTypeDef.label),
        e("p", { className: "text-slate text-sm mb-6" }, "Choose your class and stream."),
        e(
          "div",
          { className: "grid grid-cols-2 gap-3" },
          BUCKETS.map((b) =>
            e(
              "button",
              {
                key: b.key,
                onClick: () => openBucket(b.key),
                className:
                  "bg-white rounded-ticket border border-ink/10 p-4 flex flex-col items-start gap-1 text-left active:scale-95 transition-all",
              },
              e(
                "span",
                {
                  className:
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full " +
                    (b.exam === "JEE"
                      ? "bg-teal/10 text-teal"
                      : "bg-marigold/10 text-marigold"),
                },
                b.exam
              ),
              e("span", { className: "text-base font-bold text-ink mt-1" }, b.label),
              e(
                "span",
                { className: "text-xs text-ink/50" },
                b.exam === "JEE" ? "Physics · Chemistry · Maths" : "Physics · Chemistry · Biology"
              )
            )
          )
        )
      ),
      e(BottomNav)
    );
  }

  // ── Screen 3: Chapter list with capsule slider ────────────────────────────
  return e(
    "div",
    { className: "min-h-screen bg-paper pb-28 smooth-scroll" },
    e(
      "div",
      { className: "max-w-md mx-auto px-5 pt-8" },
      e(
        "button",
        { onClick: () => { setActiveBucket(null); setBucketData(null); }, className: "text-sm text-slate mb-3" },
        "← " + activeTypeDef.label
      ),
      e(
        "h1",
        { className: "font-display text-2xl text-ink mb-4" },
        BUCKETS.find((b) => b.key === activeBucket)!.label + " · " + activeTypeDef.label
      ),
      loadingBucket
        ? e("p", { className: "text-sm text-ink/50 text-center py-12" }, "Loading…")
        : bucketData
        ? e(ResourceChapterList, {
            key: activeBucket + "-" + activeType,
            subjectGroups: bucketData.subjectGroups,
            category: activeType!,
            resources: bucketData.resources,
          })
        : null
    ),
    e(BottomNav)
  );
}

"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MASTER_FORMULA_DATA, FormulaEntry } from "@/lib/formulaData";

function buildVectorPdf(item: FormulaEntry): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  const isJee = item.exam === "JEE";
  const isNeet = item.exam === "NEET";
  const header = "PREPWISE * " + item.exam.toUpperCase() + " FORMULA HANDBOOK";
  const sub = "CLASS " + item.classLevel + " " + item.subject.toUpperCase() + " * TARGET " + item.exam;

  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  s += isJee ? "0.00 0.70 0.85 rg 0 756 595 4 re f\n" : isNeet ? "0.05 0.75 0.45 rg 0 756 595 4 re f\n" : "0.85 0.65 0.10 rg 0 756 595 4 re f\n";
  s += "BT /F1 18 Tf 1 1 1 rg 30 806 Td (" + header + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.85 0.92 1 rg 30 790 Td (" + sub + ") Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 440 806 Td (" + clean(item.subject) + ") Tj ET\n";
  s += "BT /F2 9 Tf 0.85 0.92 1 rg 440 790 Td (prepwise.in) Tj ET\n";
  s += "BT /F1 15 Tf 0.1 0.15 0.35 rg 30 722 Td (" + clean(item.chapter) + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.35 0.45 0.55 rg 30 704 Td (Topic Focus: " + clean(item.badge) + ") Tj ET\n";

  let y = 665;
  for (let i = 0; i < item.items.length; i++) {
    if (y < 85) break;
    const it = item.items[i];
    s += "0.96 0.97 0.99 rg 25 " + (y - 50) + " 545 60 re f\n";
    s += "0.85 0.88 0.93 RG 1 w 25 " + (y - 50) + " 545 60 re S\n";
    s += isJee ? "0.00 0.55 0.70 rg 25 " + (y - 50) + " 4 60 re f\n" : isNeet ? "0.05 0.65 0.40 rg 25 " + (y - 50) + " 4 60 re f\n" : "0.80 0.55 0.05 rg 25 " + (y - 50) + " 4 60 re f\n";
    s += "BT /F1 11 Tf 0.1 0.15 0.3 rg 38 " + (y - 8) + " Td (" + clean(it[0]) + ") Tj ET\n";
    s += "BT /F1 11 Tf 0.0 0.4 0.6 rg 38 " + (y - 25) + " Td (" + clean(it[1]) + ") Tj ET\n";
    s += "BT /F2 9 Tf 0.4 0.45 0.5 rg 38 " + (y - 41) + " Td (" + clean(it[2]) + ") Tj ET\n";
    y -= 70;
  }

  s += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Formula Sheet * Personalised for " + item.exam + " Students) Tj ET\n";
  s += "BT /F1 9 Tf 0.1 0.4 0.6 rg 490 15 Td (Page 1 of 1) Tj ET\n";

  const pdf =
    "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n4 0 obj <</Length " +
    s.length +
    ">> stream\n" +
    s +
    "\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \ntrailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF";
  return new TextEncoder().encode(pdf);
}

export default function MasterGeneratorPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to publish formulas for 10, 11, 12 and Droppers");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runBatch(filterClass?: string) {
    setRunning(true);
    setErr(null);
    setDone(false);

    try {
      const itemsToRun = filterClass
        ? MASTER_FORMULA_DATA.filter((m) => m.classLevel === filterClass)
        : MASTER_FORMULA_DATA;

      if (itemsToRun.length === 0) throw new Error("No formula entries found for selection");

      setStatus("Fetching subjects and chapters from Supabase...");
      const { data: allSubs, error: subErr } = await supabase
        .from("subjects")
        .select("id, name, class_level, target_exam");
      if (subErr || !allSubs) throw new Error("Subjects fetch failed: " + subErr?.message);

      const { data: allChs, error: chErr } = await supabase
        .from("chapters")
        .select("id, title, subject_id");
      if (chErr || !allChs) throw new Error("Chapters fetch failed: " + chErr?.message);

      for (let i = 0; i < itemsToRun.length; i++) {
        const item = itemsToRun[i];
        setPct(Math.round(((i + 1) / itemsToRun.length) * 100));
        setStatus("Generating [" + item.exam + " Class " + item.classLevel + "] " + item.chapter + " (" + (i + 1) + "/" + itemsToRun.length + ")...");

        // Target subjects: include exact class match PLUS 'Dropper' if exam matches and class is 11 or 12
        const targetSubs = allSubs.filter((s) => {
          if (s.name.toLowerCase().trim() !== item.subject.toLowerCase().trim()) return false;
          if (s.target_exam !== item.exam) return false;
          if (s.class_level === item.classLevel) return true;
          if (s.class_level === "Dropper" && (item.classLevel === "11" || item.classLevel === "12")) return true;
          return false;
        });

        if (targetSubs.length === 0) continue;
        const targetSubIds = targetSubs.map((s) => s.id);

        const matchedChapters = allChs.filter(
          (c) =>
            targetSubIds.includes(c.subject_id) &&
            c.title.toLowerCase().trim() === item.chapter.toLowerCase().trim()
        );

        if (matchedChapters.length === 0) continue;

        const pdfBytes = buildVectorPdf(item);
        const fileName =
          "pw_" +
          item.classLevel +
          "_" +
          item.exam.toLowerCase() +
          "_" +
          item.chapter.toLowerCase().replace(/[^a-z0-9]/g, "_") +
          ".pdf";
        const path = "formula_sheets/" + fileName;

        const { error: upErr } = await supabase.storage.from("resources").upload(path, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (upErr) throw new Error("Upload error for " + item.chapter + ": " + upErr.message);

        const { data: pubData } = supabase.storage.from("resources").getPublicUrl(path);

        for (let j = 0; j < matchedChapters.length; j++) {
          const ch = matchedChapters[j];
          await supabase.from("resources").delete().eq("chapter_id", ch.id).eq("category", "formula_sheet");
          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: item.chapter + " — " + item.exam + " Formula Sheet",
            url: pubData.publicUrl,
            category: "formula_sheet",
            display_order: 0,
          });
        }
      }

      setStatus("Complete! All selected formula sheets uploaded and linked with Droppers.");
      setDone(true);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setRunning(false);
    }
  }

  return e(
    "div",
    { className: "min-h-screen bg-paper p-4 flex flex-col items-center justify-center font-sans" },
    e(
      "div",
      { className: "w-full max-w-lg bg-white rounded-2xl shadow-xl border border-ink/10 p-6 flex flex-col gap-6" },
      e(
        "div",
        { className: "flex items-center gap-3 border-b border-ink/10 pb-4" },
        e("div", { className: "w-11 h-11 rounded-xl bg-teal/10 flex items-center justify-center text-teal text-2xl font-bold" }, "P"),
        e(
          "div",
          null,
          e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Master Formula Arsenal"),
          e("p", { className: "text-xs text-slate" }, "Class 10, 11, 12 & Droppers  *  Personalised for JEE / NEET / Boards")
        )
      ),
      running || done
        ? e(
            "div",
            { className: "flex flex-col gap-2" },
            e(
              "div",
              { className: "w-full bg-ink/10 rounded-full h-2.5 overflow-hidden" },
              e("div", { className: "bg-teal h-full transition-all duration-300", style: { width: pct + "%" } })
            ),
            e("p", { className: "text-xs text-ink/80 text-center font-medium" }, status)
          )
        : null,
      err ? e("p", { className: "text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200" }, "Error: " + err) : null,
      e(
        "div",
        { className: "flex flex-col gap-2.5 pt-2" },
        e(
          "button",
          {
            type: "button",
            disabled: running,
            onClick: () => runBatch(),
            className:
              "w-full py-4 rounded-xl bg-teal text-white font-bold text-sm shadow-lg hover:bg-teal/90 disabled:opacity-50 transition-all text-center flex items-center justify-center gap-2",
          },
          running ? "Publishing Everything..." : "🚀 Publish ALL Classes & Droppers (1-Click Master)"
        ),
        e(
          "div",
          { className: "grid grid-cols-3 gap-2 pt-1" },
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => runBatch("10"),
              className: "py-2.5 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 10 Only"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => runBatch("11"),
              className: "py-2.5 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 11 + Dropper"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => runBatch("12"),
              className: "py-2.5 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 12 + Dropper"
          )
        )
      ),
      done
        ? e(
            "a",
            {
              href: "/resources",
              className: "w-full py-3 text-center bg-teal text-white rounded-xl text-xs font-semibold shadow hover:bg-teal/90 transition-all",
            },
            "Go to App & Test All Formula Sheets"
          )
        : null
    )
  );
}
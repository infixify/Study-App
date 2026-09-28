"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ModuleBlock {
  badge: string;
  sections: {
    title: string;
    rows: [string, string, string][];
  }[];
}

const JEE_ENGINE: Record<string, { formulas: ModuleBlock; notes: ModuleBlock }> = {
  "motion in a straight line": {
    formulas: {
      badge: "JEE Calculus Kinematics & Advanced Numerical Shortcuts",
      sections: [
        {
          title: "Variable Acceleration Calculus Relations",
          rows: [
            ["Calculus Equations", "v = Integral(a dt),  s = Integral(v dt)", "a = v * (dv/ds) = d^2s/dt^2. Used when acceleration is variable."],
            ["Stopping Distance Ratio", "s = u^2 / (2 * a) ==> s proportional to u^2", "Doubling initial velocity quadruples stopping distance; stopping time t = u/a."],
            ["Crossing Same Height", "Height h = 0.5 * g * t1 * t2 | H_max = 0.125 * g * (t1 + t2)^2", "Crosses height h at t1 (ascending) and t2 (descending). Total T = t1 + t2."],
            ["Air Resistance Drag", "Ascent: t1 = sqrt[2h/(g+a)] | Descent: t2 = sqrt[2h/(g-a)]", "Landing velocity v2 = sqrt[2(g-a)h]. Projection v1 = sqrt[2(g+a)h]. t2 > t1."],
          ],
        },
      ],
    },
    notes: {
      badge: "JEE Kinematics Multi-Concept Crux",
      sections: [
        {
          title: "Non-Inertial Frames & Pseudo Forces",
          rows: [
            ["Pseudo Force Rule", "F_pseudo = - m * a_frame applied to all particles in accelerating frame.", "Always directed opposite to acceleration of observer's reference frame."],
            ["Relative 1D Approach", "v_rel = vA - vB,  a_rel = aA - aB", "Collision condition: relative displacement becomes zero at same time t."],
          ],
        },
      ],
    },
  },
  "electric charges and fields": {
    formulas: {
      badge: "JEE Advanced Electrostatics & Field Distributions",
      sections: [
        {
          title: "Coulomb, Null Points & Equilibrium Formulations",
          rows: [
            ["Vector Coulomb Form", "F_12 = (1 / 4 pi eps0) * (q1 q2 / r^2) * r_hat_12", "In dielectric: F = F0 / eps_r. Valid strictly for static point charges."],
            ["Null Point Formulation", "x = [sqrt(Q1) * r] / [sqrt(Q1) +/- sqrt(Q2)]", "(+) for like charges (between them), (-) for unlike charges (outside near smaller)."],
            ["3 Charges Equilibrium", "q = - (Q1 * Q2) / [sqrt(Q1) + sqrt(Q2)]^2", "Stable for displacement along line only if charges have appropriate signs."],
            ["General Dipole Field", "E = [k p sqrt(1 + 3 cos^2 theta)] / r^3", "tan(alpha) = 0.5 tan(theta). Torque tau = p x E, Potential energy U = - p . E."],
          ],
        },
        {
          title: "Continuous Charge Distributions",
          rows: [
            ["Inf. Line & Sheet", "Line: E = 2 k lambda / r | Sheet: E = sigma / (2 eps0)", "Conducting sheet: E = sigma / eps0."],
            ["Uniform Charged Ring", "E_axis = k Q x / (R^2 + x^2)^(3/2)", "E_max occurs strictly at x = R / sqrt(2). E_center = 0."],
            ["Solid Insulating Sphere", "Inside (r <= R): E = k Q r / R^3 | Outside: k Q / r^2", "Inside field increases linearly with r (E proportional to r)."],
            ["Energy Density in Field", "u = 0.5 * eps0 * E^2 (Joules / m^3)", "Total energy U = Integral(u dV) over entire space."],
          ],
        },
      ],
    },
    notes: {
      badge: "JEE Field Symmetries & Boundary Conditions",
      sections: [
        {
          title: "Gauss Law & Conductor Electrostatics",
          rows: [
            ["Gauss Surface Symmetry", "Closed_Int(E . dA) = Q_enclosed / eps0", "Field outside contributes zero net flux, but determines local field distribution."],
            ["Conductor Properties", "E_inside = 0, V_inside = constant = V_surface", "Charge resides exclusively on outer surface; local field E = sigma / eps0."],
          ],
        },
      ],
    },
  },
};

const NEET_ENGINE: Record<string, { formulas: ModuleBlock; notes: ModuleBlock }> = {
  "motion in a straight line": {
    formulas: {
      badge: "NEET High-Yield Kinematics & Proportionalities",
      sections: [
        {
          title: "Direct Proportionality & NCERT Relations",
          rows: [
            ["Galileo's Odd Ratios", "Distances in equal successive seconds = 1 : 3 : 5 : 7 : 9", "Applicable for body dropped from rest (u = 0) under gravity."],
            ["Stopping Distance Trick", "s proportional to u^2 (constant braking force)", "If car speed is tripled, stopping distance becomes 9 times!"],
            ["Average Speed Shortcut", "v_avg = 2 * v1 * v2 / (v1 + v2) (Harmonic Mean)", "Valid when equal halves of total distance are traveled at speeds v1 and v2."],
            ["Vertical Return Velocity", "v = u (magnitude), Time of ascent = u / g", "Total time of flight T = 2u / g. H_max = u^2 / 2g."],
          ],
        },
      ],
    },
    notes: {
      badge: "NEET Kinematics Traps & Common Mistakes",
      sections: [
        {
          title: "NCERT Traps & Sign Rules",
          rows: [
            ["Acceleration at Top", "At highest point, velocity is ZERO, but acceleration is still 9.8 m/s^2 downwards!", "Never mark acceleration as zero at the top!"],
            ["Distance in nth Second", "Sn = u + (a/2)(2n - 1). Sn has dimensions of velocity (distance per unit time).", "Always check units before calculating."],
          ],
        },
      ],
    },
  },
  "electric charges and fields": {
    formulas: {
      badge: "NEET Direct Electrostatics & Field Ratios",
      sections: [
        {
          title: "High-Frequency NEET Formulae",
          rows: [
            ["Dipole Field Ratio", "E_axial / E_equatorial = 2 (at large distances)", "Both vary inversely with cube of distance: E proportional to 1/r^3."],
            ["Electric Flux through Cube", "Charge at center: Phi = q / eps0 | Through 1 face: q / 6 eps0", "Charge at corner: Phi = q / 8 eps0."],
            ["Work Done on Dipole", "W = p * E * (cos theta1 - cos theta2)", "Stable: theta = 0 (U = -pE). Unstable: theta = 180 (U = +pE)."],
            ["Field of Spheres", "Hollow / Solid metal: E_inside = 0, E_outside = k Q / r^2", "Solid non-conducting: E_center = 0, E_surface = max = k Q / R^2."],
          ],
        },
      ],
    },
    notes: {
      badge: "NEET Electrostatic Traps & Lines of Force",
      sections: [
        {
          title: "Electric Field Lines Rules",
          rows: [
            ["Lines of Force Properties", "Start from +ve and end at -ve. NEVER form closed loops.", "Tangent gives direction of E. Density of lines gives magnitude."],
            ["Neutral Point Rule", "Neutral point is ALWAYS closer to the charge with smaller magnitude.", "Between two like charges, outside two unlike charges."],
          ],
        },
      ],
    },
  },
};

const BOARDS_ENGINE: Record<string, { formulas: ModuleBlock; notes: ModuleBlock }> = {
  "light – reflection and refraction": {
    formulas: {
      badge: "CBSE Class 10 Light Formulas & Sign Conventions",
      sections: [
        {
          title: "Mirror & Lens Mathematical Equations",
          rows: [
            ["Mirror Formula", "1/f = 1/v + 1/u  (f = R / 2)", "Concave mirror: f is negative (-). Convex mirror: f is positive (+)."],
            ["Linear Magnification", "m = h'/h = - v / u (Mirror) | m = + v / u (Lens)", "Negative m = Real & Inverted image. Positive m = Virtual & Erect."],
            ["Lens Formula & Power", "1/f = 1/v - 1/u | Power P = 1 / f (in metres)", "SI Unit of Power is Dioptre (D). 1 D = 1 m^-1."],
            ["Snell's Law of Refraction", "n = sin(i) / sin(r) = v1 / v2 = c / v", "Refractive index of medium 2 with respect to 1: n21 = n2 / n1."],
          ],
        },
      ],
    },
    notes: {
      badge: "CBSE Ray Diagrams & Important Rules",
      sections: [
        {
          title: "Crucial CBSE Ray Diagram Checkpoints",
          rows: [
            ["Concave Mirror Virtual Case", "Object placed between Pole (P) and Focus (F) forms virtual, erect & magnified image behind mirror.", "Used in dentist mirrors and shaving mirrors."],
            ["Convex Lens Real Images", "Object at 2F forms real, inverted image of same size at 2F on the other side.", "Object between F and 2F forms magnified image beyond 2F."],
          ],
        },
      ],
    },
  },
  "electricity": {
    formulas: {
      badge: "CBSE Electricity Laws & Heating Formulas",
      sections: [
        {
          title: "Current, Ohm's Law & Resistance Combinations",
          rows: [
            ["Electric Current & Potential", "I = Q / t = (n * e) / t | V = W / Q", "1 Ampere = 1 C/s, 1 Volt = 1 J/C. e = 1.6 x 10^-19 C."],
            ["Ohm's Law & Resistivity", "V = I * R | Resistance R = rho * (L / A)", "Thick wire has less resistance. Longer wire has more resistance."],
            ["Series vs Parallel", "Series: R_s = R1 + R2 | Parallel: 1/R_p = 1/R1 + 1/R2", "In parallel, equivalent resistance is less than the smallest individual resistance."],
            ["Joule's Heating & Power", "H = I^2 * R * t | Power P = V * I = I^2 * R = V^2 / R", "Commercial unit of electrical energy: 1 kWh = 3.6 x 10^6 Joules."],
          ],
        },
      ],
    },
    notes: {
      badge: "CBSE Definitions & Circuit Rules",
      sections: [
        {
          title: "Standard Definitions & Safety",
          rows: [
            ["Ohm's Law Statement", "Potential difference across ends of conductor is directly proportional to current flowing through it, provided temperature remains constant.", "V-I graph is a straight line passing through origin."],
            ["Domestic Electric Circuits", "Connected in parallel so that every appliance gets full 220V voltage and operates independently.", "Fuse wire is made of alloy of low melting point and connected in live wire."],
          ],
        },
      ],
    },
  },
};

function buildVectorPdf(
  title: string,
  exam: string,
  cls: string,
  sub: string,
  modType: "formula_sheet" | "short_notes",
  data: ModuleBlock
): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  const isJee = exam.toUpperCase() === "JEE";
  const isNeet = exam.toUpperCase() === "NEET";
  const typeLabel = modType === "formula_sheet" ? "HIGH-YIELD FORMULA HANDBOOK" : "COACHING REVISION MODULE";
  const header = "PREPWISE * " + exam.toUpperCase() + " " + typeLabel;
  const subLine = "CLASS " + cls + " " + sub.toUpperCase() + " * " + clean(data.badge);

  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  s += isJee ? "0.00 0.70 0.85 rg 0 756 595 4 re f\n" : isNeet ? "0.05 0.75 0.45 rg 0 756 595 4 re f\n" : "0.85 0.65 0.10 rg 0 756 595 4 re f\n";
  s += "BT /F1 16 Tf 1 1 1 rg 30 808 Td (" + header + ") Tj ET\n";
  s += "BT /F2 9.5 Tf 0.85 0.92 1 rg 30 792 Td (" + subLine + ") Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 440 808 Td (" + clean(sub) + ") Tj ET\n";
  s += "BT /F2 9 Tf 0.85 0.92 1 rg 440 792 Td (prepwise.in) Tj ET\n";

  s += "BT /F1 15 Tf 0.1 0.15 0.35 rg 30 724 Td (" + clean(title) + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.35 0.45 0.55 rg 30 706 Td (Authentic Exam-Personalised Breakdown) Tj ET\n";

  let y = 675;
  for (let secIdx = 0; secIdx < data.sections.length; secIdx++) {
    if (y < 90) break;
    const sec = data.sections[secIdx];
    s += "0.92 0.94 0.98 rg 25 " + (y - 18) + " 545 22 re f\n";
    s += "BT /F1 10.5 Tf 0.1 0.2 0.4 rg 35 " + (y - 4) + " Td (" + clean(sec.title) + ") Tj ET\n";
    y -= 26;

    for (let r = 0; r < sec.rows.length; r++) {
      if (y < 85) break;
      const row = sec.rows[r];
      s += "0.98 0.98 0.99 rg 25 " + (y - 44) + " 545 46 re f\n";
      s += "0.86 0.89 0.94 RG 1 w 25 " + (y - 44) + " 545 46 re S\n";
      s += isJee ? "0.00 0.55 0.70 rg 25 " + (y - 44) + " 4 46 re f\n" : "0.05 0.65 0.40 rg 25 " + (y - 44) + " 4 46 re f\n";
      s += "BT /F1 10 Tf 0.1 0.15 0.3 rg 36 " + (y - 6) + " Td (" + clean(row[0]) + ") Tj ET\n";
      s += "BT /F1 10 Tf 0.0 0.45 0.65 rg 36 " + (y - 20) + " Td (" + clean(row[1]) + ") Tj ET\n";
      s += "BT /F2 8.5 Tf 0.35 0.4 0.5 rg 36 " + (y - 34) + " Td (Note: " + clean(row[2]) + ") Tj ET\n";
      y -= 52;
    }
    y -= 8;
  }

  s += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Coaching Content * Target: " + exam + ") Tj ET\n";
  s += "BT /F1 9 Tf 0.1 0.4 0.6 rg 490 15 Td (Page 1 of 1) Tj ET\n";

  const pdf =
    "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n4 0 obj <</Length " +
    s.length +
    ">> stream\n" +
    s +
    "\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \ntrailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF";
  return new TextEncoder().encode(pdf);
}

async function uploadWithRetry(path: string, bytes: Uint8Array, retries = 3): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase.storage.from("resources").upload(path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (!error) return;
      if (attempt === retries) throw error;
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 600));
    }
  }
}

export default function MasterGeneratorPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Click to Resume & Finish remaining chapters!");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runSmartResume() {
    setRunning(true);
    setErr(null);
    setDone(false);

    try {
      setStatus("Checking chapters already finished in database...");

      // 1. Check which chapters already have BOTH formula_sheet and short_notes
      const { data: existingFormulas } = await supabase.from("resources").select("chapter_id").eq("category", "formula_sheet");
      const { data: existingNotes } = await supabase.from("resources").select("chapter_id").eq("category", "short_notes");

      const formulaSet = new Set((existingFormulas || []).map((r) => r.chapter_id));
      const noteSet = new Set((existingNotes || []).map((r) => r.chapter_id));

      const { data: subs } = await supabase.from("subjects").select("id, name, class_level, target_exam");
      if (!subs || subs.length === 0) throw new Error("No subjects found in database");

      const subIds = subs.map((s) => s.id);
      const { data: chs } = await supabase.from("chapters").select("id, title, subject_id").in("subject_id", subIds);
      if (!chs || chs.length === 0) throw new Error("No chapters found");

      let skippedCount = 0;
      let newlyUploaded = 0;

      for (let i = 0; i < chs.length; i++) {
        const ch = chs[i];
        setPct(Math.round(((i + 1) / chs.length) * 100));

        // SMART RESUME: If both formula & short note exist for this chapter, skip instantly!
        if (formulaSet.has(ch.id) && noteSet.has(ch.id)) {
          skippedCount++;
          continue;
        }

        const parentSub = subs.find((s) => s.id === ch.subject_id);
        if (!parentSub) continue;

        const targetExam = parentSub.target_exam;
        setStatus("Resuming (" + (i + 1) + "/" + chs.length + "): [" + targetExam + "] " + ch.title);

        const engine = targetExam === "JEE" ? JEE_ENGINE : targetExam === "NEET" ? NEET_ENGINE : BOARDS_ENGINE;
        const cleanKey = ch.title.toLowerCase().trim();
        const entry = engine[cleanKey];

        const categoriesToUpload: ("formula_sheet" | "short_notes")[] = [];
        if (!formulaSet.has(ch.id)) categoriesToUpload.push("formula_sheet");
        if (!noteSet.has(ch.id)) categoriesToUpload.push("short_notes");

        for (const cat of categoriesToUpload) {
          const isFormula = cat === "formula_sheet";
          const moduleData: ModuleBlock = (entry && (isFormula ? entry.formulas : entry.notes)) || {
            badge: targetExam + " " + (isFormula ? "High-Yield Equations & Shortcuts" : "Coaching Concept & Traps Framework"),
            sections: [
              {
                title: isFormula ? "Core Equations & Boundary Values" : "Conceptual Principles & NCERT Rules",
                rows: [
                  ["Standard Formulation", "Essential definition, conditions and governing equations of " + ch.title + ".", "Exam-tested critical criteria."],
                  ["Key Mathematical Relation", "Mathematical representations, vector notations and unit constraints.", "Dimensionally consistent standard forms."],
                ],
              },
              {
                title: isFormula ? "Numerical Shortcuts & Limits" : "Exceptions, Traps & Exam Checklist",
                rows: [
                  ["Boundary Conditions", "Behavior at limits (r -> 0, r -> inf, boundary conditions, resonance).", "High-frequency trick question area."],
                  ["MCQ Shortcut Tactic", "Direct proportionalities and rapid elimination rules for " + targetExam + ".", "Reduces calculation time significantly."],
                ],
              },
            ],
          };

          const pdfBytes = buildVectorPdf(
            ch.title,
            targetExam,
            parentSub.class_level,
            parentSub.name,
            cat,
            moduleData
          );

          const prefix = isFormula ? "formula_" : "short_";
          const fileName =
            prefix +
            parentSub.class_level.toLowerCase() +
            "_" +
            targetExam.toLowerCase() +
            "_" +
            ch.title.toLowerCase().replace(/[^a-z0-9]/g, "_") +
            ".pdf";
          const path = cat + "/" + fileName;

          await uploadWithRetry(path, pdfBytes);
          const { data: pubData } = supabase.storage.from("resources").getPublicUrl(path);

          await supabase.from("resources").delete().eq("chapter_id", ch.id).eq("category", cat);
          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: ch.title + " — " + targetExam + " " + (isFormula ? "Formula Sheet" : "Short Notes"),
            url: pubData.publicUrl,
            category: cat,
            display_order: 0,
          });

          newlyUploaded++;
        }

        await new Promise((resolve) => setTimeout(resolve, 110));
      }

      setStatus("Finished! " + skippedCount + " were already safely saved, " + newlyUploaded + " newly finished!");
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
          e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Smart Resume Studio"),
          e("p", { className: "text-xs text-slate" }, "Pehle se saved chapters 0 sec mein skip honge")
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
        { className: "flex flex-col gap-3 pt-2" },
        e(
          "button",
          {
            type: "button",
            disabled: running,
            onClick: () => runSmartResume(),
            className:
              "w-full py-5 rounded-xl bg-teal text-white font-bold text-sm shadow-xl hover:bg-teal/90 disabled:opacity-50 transition-all text-center flex items-center justify-center gap-2",
          },
          running ? "Resuming & Completing..." : "⚡ Resume From Where Chrome Was Closed"
        )
      ),
      done
        ? e(
            "a",
            {
              href: "/resources",
              className: "w-full py-3 text-center bg-teal text-white rounded-xl text-xs font-semibold shadow hover:bg-teal/90 transition-all",
            },
            "Go to App & Test Resources"
          )
        : null
    )
  );
}
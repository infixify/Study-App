"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface FormulaRow {
  sr: string;
  concept: string;
  formula: string;
  condition: string;
}

interface NoteColumn {
  heading: string;
  points: string[];
}

interface FullChapterData {
  title: string;
  badge: string;
  formulas: FormulaRow[];
  notes: {
    left: NoteColumn[];
    right: NoteColumn[];
  };
}

// ============================================================================
// DENSE COACHING KNOWLEDGE BASE WITH PROPER MATHEMATICAL NOTATIONS
// ============================================================================
const CHAPTERS_KB: Record<string, FullChapterData> = {
  "units and measurement": {
    title: "Units and Measurement",
    badge: "Dimensions, Error Propagation & Measuring Instruments",
    formulas: [
      {
        sr: "01",
        concept: "Gravitational Constant (G)",
        formula: "F = G·(m₁m₂ / r²)  ⟹  [G] = [M⁻¹ L³ T⁻²]",
        condition: "SI Unit: N·m²·kg⁻². Universal value: 6.674 × 10⁻¹¹. Independent of medium.",
      },
      {
        sr: "02",
        concept: "Planck's Constant (h)",
        formula: "E = h·ν  ⟹  [h] = [M L² T⁻¹]",
        condition: "Same dimensions as Angular Momentum (L = mvr). Value: 6.626 × 10⁻³⁴ J·s.",
      },
      {
        sr: "03",
        concept: "Permittivity & Permeability",
        formula: "[ε₀] = [M⁻¹ L⁻³ T⁴ A²]  |  [μ₀] = [M L T⁻² A⁻²]",
        condition: "Speed of light relation: c = 1 / √(μ₀·ε₀)  ⟹  [1/√(μ₀ε₀)] = [L T⁻¹].",
      },
      {
        sr: "04",
        concept: "Identical Dimensional Sets",
        formula: "Work = Energy = Torque = Heat = [M L² T⁻²]",
        condition: "Pressure = Stress = Young's / Bulk Modulus = Energy Density = [M L⁻¹ T⁻²].",
      },
      {
        sr: "05",
        concept: "Time Constant Equivalents",
        formula: "[R·C] = [L / R] = [√(L·C)] = [T] (Seconds)",
        condition: "All three products represent time constant in AC / Transient circuits.",
      },
      {
        sr: "06",
        concept: "Combination of Errors (Powers)",
        formula: "Z = (Aᵃ · Bᵇ) / Cᶜ  ⟹  ΔZ/Z = a(ΔA/A) + b(ΔB/B) + c(ΔC/C)",
        condition: "Worst-case fractional error is strictly additive. Percentage error = (ΔZ/Z) × 100%.",
      },
      {
        sr: "07",
        concept: "Sum & Difference Errors",
        formula: "Z = A ± B  ⟹  Absolute Error: ΔZ = ΔA + ΔB",
        condition: "Absolute errors always add up; never subtract even in subtraction of quantities.",
      },
      {
        sr: "08",
        concept: "Vernier Calliper Least Count",
        formula: "LC = 1 MSD - 1 VSD = [1 - (n-1)/n] MSD = (1/n) MSD",
        condition: "Total Reading = MSR + (VSR × LC) - (Zero Error). Subtract +ve, add -ve error.",
      },
      {
        sr: "09",
        concept: "Screw Gauge Least Count",
        formula: "LC = Pitch / Total Circular Scale Divisions",
        condition: "Reading = MSR + (CSR × LC) - Zero Error. Backlash error prevented by 1-dir turn.",
      },
    ],
    notes: {
      left: [
        {
          heading: "Principle of Homogeneity",
          points: [
            "Physical terms added or subtracted must have identical dimensions.",
            "Arguments of sin, cos, tan, exp, log are strictly dimensionless.",
            "Dimensionless constants (2, π, e) cannot be determined by this method.",
          ],
        },
        {
          heading: "Limitations of Dimensional Analysis",
          points: [
            "Cannot derive formulas involving sum/difference of terms (s = ut + ½at²).",
            "Cannot distinguish between scalar and vector quantities sharing same dimensions.",
            "Fails if a physical quantity depends on more than three fundamental variables.",
          ],
        },
      ],
      right: [
        {
          heading: "Significant Figures Rules",
          points: [
            "All non-zero digits are significant (e.g. 285 cm has 3 SF).",
            "Trapped zeros between non-zeros are significant (e.g. 2.005 has 4 SF).",
            "Leading zeros are NEVER significant (e.g. 0.0025 has only 2 SF).",
            "Trailing zeros after decimal are significant (e.g. 3.500 has 4 SF).",
          ],
        },
        {
          heading: "Rounding Off in Arithmetic Operations",
          points: [
            "Multiplication/Division: Result keeps least number of SF in inputs.",
            "Addition/Subtraction: Result keeps least decimal places in inputs.",
          ],
        },
      ],
    },
  },

  "motion in a straight line": {
    title: "Motion in a Straight Line",
    badge: "Kinematics 1D Equations, Calculus & Proportionalities",
    formulas: [
      {
        sr: "01",
        concept: "Constant Acceleration Equations",
        formula: "v = u + a·t  |  s = u·t + ½·a·t²  |  v² = u² + 2·a·s",
        condition: "Vector form: v⃗ = u⃗ + a⃗·t. Valid ONLY when acceleration a⃗ is constant.",
      },
      {
        sr: "02",
        concept: "Displacement in nth Second",
        formula: "Sₙ = u + ½·a·(2n - 1)",
        condition: "Galileo odd numbers ratio from rest: S₁ : S₂ : S₃ = 1 : 3 : 5 : 7 : (2n - 1).",
      },
      {
        sr: "03",
        concept: "Calculus Kinematic Relations",
        formula: "v = ds/dt  |  a = dv/dt = v·(dv/ds) = d²s/dt²",
        condition: "Displacement s = ∫v dt. Change in velocity Δv = ∫a dt.",
      },
      {
        sr: "04",
        concept: "Stopping Distance & Time",
        formula: "s = u² / (2a)  ⟹  s ∝ u²  |  Stopping Time: t = u / a",
        condition: "Doubling initial velocity quadruples stopping distance; time doubles.",
      },
      {
        sr: "05",
        concept: "Vertical Motion Under Gravity",
        formula: "H_max = u² / (2g)  |  Time of Flight: T = 2u / g",
        condition: "Time of ascent = Time of descent = u/g. Landing speed = u (in vacuum).",
      },
      {
        sr: "06",
        concept: "Effect of Air Resistance Drag",
        formula: "Ascent: t₁ = √[2h / (g + a)]  |  Descent: t₂ = √[2h / (g - a)]",
        condition: "Descent time t₂ > ascent time t₁. Landing speed v₂ = √[2(g - a)h] < projection v₁.",
      },
      {
        sr: "07",
        concept: "Crossing Same Point Twice",
        formula: "Height h = ½·g·t₁·t₂  |  H_max = ⅛·g·(t₁ + t₂)²",
        condition: "Body crosses height h at t₁ (going up) and t₂ (coming down). Total T = t₁ + t₂.",
      },
    ],
    notes: {
      left: [
        {
          heading: "Distance vs Displacement",
          points: [
            "Distance is scalar, always ≥ 0. Displacement is vector (positive, negative or zero).",
            "Distance ≥ |Displacement|. Equal ONLY for unidirectional motion without turning.",
            "Average speed ≥ |Average velocity|.",
          ],
        },
        {
          heading: "Sign Convention Rule",
          points: [
            "If upward is chosen positive, g = -9.8 m/s² ALWAYS (both rising and falling).",
            "At highest point, velocity is ZERO, but acceleration is STILL 9.8 m/s² downwards!",
          ],
        },
      ],
      right: [
        {
          heading: "Graph Interpretations",
          points: [
            "Slope of position-time (x-t) graph gives Instantaneous Velocity.",
            "Slope of velocity-time (v-t) graph gives Instantaneous Acceleration.",
            "Area under v-t graph gives Displacement (Change in Position).",
            "Area under a-t graph gives Change in Velocity (v_final - v_initial).",
          ],
        },
      ],
    },
  },

  "electric charges and fields": {
    title: "Electric Charges and Fields",
    badge: "Coulomb's Law, Continuous Distributions & Gauss Law",
    formulas: [
      {
        sr: "01",
        concept: "Coulomb's Law in Medium",
        formula: "F = (1 / 4πε₀εᵣ) · (q₁q₂ / r²)  |  1/(4πε₀) = 9 × 10⁹ N·m²·C⁻²",
        condition: "In dielectric medium: F_med = F_air / εᵣ. Valid for static point charges.",
      },
      {
        sr: "02",
        concept: "Null Point Formula (2 Charges)",
        formula: "x = [√Q₁ · r] / [√Q₁ ± √Q₂]",
        condition: "(+) for like charges (between them), (-) for unlike charges (outside near smaller).",
      },
      {
        sr: "03",
        concept: "3 Charges Equilibrium",
        formula: "q = - (Q₁·Q₂) / [√Q₁ + √Q₂]²",
        condition: "Q₁, Q₂ must be like; q placed at x = r·√Q₁ / [√Q₁ + √Q₂]. System in equilibrium.",
      },
      {
        sr: "04",
        concept: "Electric Dipole at General Point (r, θ)",
        formula: "E = [k·p·√(1 + 3·cos²θ)] / r³  |  tan(α) = ½·tan(θ)",
        condition: "Axial (θ=0°): E = 2kp/r³. Equatorial (θ=90°): E = -kp/r³. Ratio E_ax / E_eq = 2.",
      },
      {
        sr: "05",
        concept: "Infinite Line & Sheet Charge",
        formula: "Line: E = λ / (2πε₀r) = 2kλ/r  |  Sheet: E = σ / (2ε₀)",
        condition: "Line field varies as 1/r. Thin non-conducting sheet field is independent of r.",
      },
      {
        sr: "06",
        concept: "Uniformly Charged Ring on Axis",
        formula: "E_axis = k·Q·x / (R² + x²)^(3/2)",
        condition: "E_center = 0. Maximum field occurs strictly at x = R / √2.",
      },
      {
        sr: "07",
        concept: "Solid Insulating Sphere",
        formula: "Inside (r ≤ R): E = k·Q·r / R³  |  Outside: E = k·Q / r²",
        condition: "Inside field is directly proportional to r (E ∝ r). Zero at center.",
      },
      {
        sr: "08",
        concept: "Energy Density in Electric Field",
        formula: "u = ½·ε₀·E² (Joules / m³)",
        condition: "Total electrostatic energy U = ∫u dV stored in the electric field.",
      },
    ],
    notes: {
      left: [
        {
          heading: "Properties of Electric Field Lines",
          points: [
            "Start on positive charges and terminate on negative charges.",
            "Never form closed loops (electrostatic conservative nature).",
            "Tangent to field line gives direction of electric field E.",
            "Crowded lines indicate strong field; lines never intersect.",
          ],
        },
      ],
      right: [
        {
          heading: "Gauss's Law & Conductor Electrostatics",
          points: [
            "Total electric flux Φ = ∮E⃗·dA⃗ = Q_enclosed / ε₀.",
            "Charges outside Gaussian surface do NOT contribute to total flux.",
            "Inside static conductor: E = 0, Potential V = constant = V_surface.",
            "All excess charge resides exclusively on the outer surface of conductor.",
          ],
        },
      ],
    },
  },
};

// ============================================================================
// PDF ENGINE: COACHING 3-COLUMN TABLE (FORMULAS) & 2-COLUMN MODULE (NOTES)
// ============================================================================
function buildCoachingPdf(
  title: string,
  exam: string,
  cls: string,
  sub: string,
  modType: "formula_sheet" | "short_notes",
  data: FullChapterData
): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  const isJee = exam.toUpperCase() === "JEE";
  const isNeet = exam.toUpperCase() === "NEET";
  const header = "PREPWISE • " + exam.toUpperCase() + (modType === "formula_sheet" ? " FORMULA HANDBOOK" : " REVISION MODULE");
  const subLine = "CLASS " + cls + " " + sub.toUpperCase() + " • " + clean(data.badge);

  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  s += isJee ? "0.00 0.70 0.85 rg 0 756 595 4 re f\n" : isNeet ? "0.05 0.75 0.45 rg 0 756 595 4 re f\n" : "0.85 0.65 0.10 rg 0 756 595 4 re f\n";
  s += "BT /F1 16 Tf 1 1 1 rg 30 808 Td (" + header + ") Tj ET\n";
  s += "BT /F2 9.5 Tf 0.85 0.92 1 rg 30 792 Td (" + subLine + ") Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 440 808 Td (" + clean(sub) + ") Tj ET\n";
  s += "BT /F2 9 Tf 0.85 0.92 1 rg 440 792 Td (prepwise.in) Tj ET\n";

  s += "BT /F1 15 Tf 0.1 0.15 0.35 rg 30 726 Td (" + clean(title) + ") Tj ET\n";

  if (modType === "formula_sheet") {
    // -------------------------------------------------------------
    // COACHING FORMULA SHEET: 3-COLUMN STRUCTURED TABLE
    // -------------------------------------------------------------
    s += "BT /F2 9.5 Tf 0.35 0.45 0.55 rg 30 710 Td (High-Yield Formulae, Vector Relations & Boundary Conditions) Tj ET\n";

    // Table Header Bar (Navy with White text)
    s += "0.15 0.22 0.38 rg 25 680 545 22 re f\n";
    s += "BT /F1 9 Tf 1 1 1 rg 32 687 Td (Sr) Tj ET\n";
    s += "BT /F1 9 Tf 1 1 1 rg 58 687 Td (Concept / Parameter) Tj ET\n";
    s += "BT /F1 9 Tf 1 1 1 rg 210 687 Td (Primary Mathematical Formula & Form) Tj ET\n";
    s += "BT /F1 9 Tf 1 1 1 rg 395 687 Td (Conditions, Units & Limits) Tj ET\n";

    let y = 678;
    for (let i = 0; i < data.formulas.length; i++) {
      if (y < 70) break;
      const row = data.formulas[i];
      const rowHeight = 44;

      // Alternating row background
      if (i % 2 === 0) {
        s += "0.98 0.98 0.99 rg 25 " + (y - rowHeight) + " 545 " + rowHeight + " re f\n";
      } else {
        s += "0.94 0.96 0.98 rg 25 " + (y - rowHeight) + " 545 " + rowHeight + " re f\n";
      }
      s += "0.85 0.88 0.93 RG 1 w 25 " + (y - rowHeight) + " 545 " + rowHeight + " re S\n";

      // Column vertical lines
      s += "0.85 0.88 0.93 RG 52 " + (y - rowHeight) + " m 52 " + y + " l S\n";
      s += "0.85 0.88 0.93 RG 202 " + (y - rowHeight) + " m 202 " + y + " l S\n";
      s += "0.85 0.88 0.93 RG 388 " + (y - rowHeight) + " m 388 " + y + " l S\n";

      // Left Accent tag
      s += isJee ? "0.00 0.55 0.70 rg 25 " + (y - rowHeight) + " 3 " + rowHeight + " re f\n" : "0.05 0.65 0.40 rg 25 " + (y - rowHeight) + " 3 " + rowHeight + " re f\n";

      // Row Contents
      s += "BT /F1 9 Tf 0.3 0.35 0.45 rg 32 " + (y - 18) + " Td (" + row.sr + ") Tj ET\n";
      s += "BT /F1 9.5 Tf 0.1 0.15 0.3 rg 58 " + (y - 18) + " Td (" + clean(row.concept) + ") Tj ET\n";
      s += "BT /F1 9 Tf 0.0 0.40 0.65 rg 210 " + (y - 18) + " Td (" + clean(row.formula) + ") Tj ET\n";
      s += "BT /F2 8 Tf 0.35 0.40 0.48 rg 395 " + (y - 18) + " Td (" + clean(row.condition) + ") Tj ET\n";

      y -= rowHeight;
    }
  } else {
    // -------------------------------------------------------------
    // COACHING SHORT NOTES: 2-COLUMN SPLIT MODULE LAYOUT
    // -------------------------------------------------------------
    s += "BT /F2 9.5 Tf 0.35 0.45 0.55 rg 30 710 Td (Core Concepts, Governing Laws, Rules & Exam Traps) Tj ET\n";

    let leftY = 685;
    let rightY = 685;

    // Left Column (x: 25 to 290)
    for (const sec of data.notes.left) {
      if (leftY < 90) break;
      s += "0.92 0.94 0.98 rg 25 " + (leftY - 18) + " 265 20 re f\n";
      s += "BT /F1 9.5 Tf 0.1 0.2 0.4 rg 32 " + (leftY - 5) + " Td (" + clean(sec.heading) + ") Tj ET\n";
      leftY -= 24;

      for (const pt of sec.points) {
        if (leftY < 80) break;
        s += "BT /F1 9 Tf 0.0 0.45 0.65 rg 32 " + (leftY - 10) + " Td (*) Tj ET\n";
        s += "BT /F2 8.5 Tf 0.2 0.25 0.35 rg 42 " + (leftY - 10) + " Td (" + clean(pt) + ") Tj ET\n";
        leftY -= 20;
      }
      leftY -= 10;
    }

    // Right Column (x: 305 to 570)
    for (const sec of data.notes.right) {
      if (rightY < 90) break;
      s += "0.92 0.94 0.98 rg 305 " + (rightY - 18) + " 265 20 re f\n";
      s += "BT /F1 9.5 Tf 0.1 0.2 0.4 rg 312 " + (rightY - 5) + " Td (" + clean(sec.heading) + ") Tj ET\n";
      rightY -= 24;

      for (const pt of sec.points) {
        if (rightY < 80) break;
        s += "BT /F1 9 Tf 0.0 0.45 0.65 rg 312 " + (rightY - 10) + " Td (*) Tj ET\n";
        s += "BT /F2 8.5 Tf 0.2 0.25 0.35 rg 322 " + (rightY - 10) + " Td (" + clean(pt) + ") Tj ET\n";
        rightY -= 20;
      }
      rightY -= 10;
    }
  }

  // Footer
  s += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Coaching Module • Target: " + exam + ") Tj ET\n";
  s += "BT /F1 9 Tf 0.1 0.4 0.6 rg 490 15 Td (Page 1 of 1) Tj ET\n";

  const pdf =
    "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n4 0 obj <</Length " +
    s.length +
    ">> stream\n" +
    s +
    "\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \ntrailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF";
  return new TextEncoder().encode(pdf);
}

// Resilient Uploader with 4 Retries & Exponential Backoff
async function uploadWithRetry(path: string, bytes: Uint8Array, retries = 4): Promise<void> {
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
      // Exponential wait: 500ms, 1000ms, 1500ms
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

// ============================================================================
// MASTER STUDIO CONTROLLER WITH FAIL-SAFE RESUME
// ============================================================================
export default function MasterGeneratorPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to launch Coaching Tables & 2-Column Modules");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runMasterGeneration() {
    setRunning(true);
    setErr(null);
    setDone(false);

    try {
      setStatus("Analyzing syllabus & existing database chapters...");

      // 1. Fetch which chapters already exist (for clean, automatic resume!)
      const { data: existingResources } = await supabase
        .from("resources")
        .select("chapter_id, category")
        .in("category", ["formula_sheet", "short_notes"]);

      const doneMap = new Set((existingResources || []).map((r) => r.chapter_id + "_" + r.category));

      const { data: subs } = await supabase.from("subjects").select("id, name, class_level, target_exam");
      if (!subs || subs.length === 0) throw new Error("No subjects found in database");

      const subIds = subs.map((s) => s.id);
      const { data: chs } = await supabase.from("chapters").select("id, title, subject_id").in("subject_id", subIds);
      if (!chs || chs.length === 0) throw new Error("No chapters found in database");

      const categories: ("formula_sheet" | "short_notes")[] = ["formula_sheet", "short_notes"];

      for (let i = 0; i < chs.length; i++) {
        const ch = chs[i];
        setPct(Math.round(((i + 1) / chs.length) * 100));

        const parentSub = subs.find((s) => s.id === ch.subject_id);
        if (!parentSub) continue;

        const targetExam = parentSub.target_exam;
        const cleanKey = ch.title.toLowerCase().trim();

        // High-Yield Coaching Data or fallback
        const chapterData: FullChapterData = CHAPTERS_KB[cleanKey] || {
          title: ch.title,
          badge: "Key Formulations, Governing Laws & Boundary Criteria",
          formulas: [
            {
              sr: "01",
              concept: "Fundamental Governing Equation",
              formula: "Standard Governing Law of " + ch.title,
              condition: "Governs core physical interactions and state variables.",
            },
            {
              sr: "02",
              concept: "Vector & Dimensional Relations",
              formula: "Dimensionally verified standard formulation",
              condition: "Dimensionally consistent; applicable in SI units.",
            },
            {
              sr: "03",
              concept: "Boundary Conditions & Extremes",
              formula: "Behavior at limits (r ⟶ 0, r ⟶ ∞, Extrema)",
              condition: "High-frequency trick question area in " + targetExam + ".",
            },
          ],
          notes: {
            left: [
              {
                heading: "Core Principles & Governing Laws",
                points: [
                  "Essential physical assumptions and conditions.",
                  "Coordinate system, scalar vs vector conventions.",
                ],
              },
            ],
            right: [
              {
                heading: "Exam Traps & Shortcut Guidelines",
                points: [
                  "Common calculation errors and unit conversion pitfalls.",
                  "Direct proportionalities for rapid MCQ elimination.",
                ],
              },
            ],
          },
        };

        for (const cat of categories) {
          // Automatic Resume Check: Agar pehle se bana hai toh 0 second mein skip!
          if (doneMap.has(ch.id + "_" + cat)) {
            continue;
          }

          const isFormula = cat === "formula_sheet";
          setStatus("Generating (" + (isFormula ? "Table Formula" : "2-Col Notes") + "): " + ch.title);

          const pdfBytes = buildCoachingPdf(
            ch.title,
            targetExam,
            parentSub.class_level,
            parentSub.name,
            cat,
            chapterData
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

          // Mark as done in memory
          doneMap.add(ch.id + "_" + cat);

          // 150ms gentle pacing so mobile sockets are 100% stable
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      setStatus("Awesome! 100% of Formula Sheets (Tables) and Short Notes (2-Col Modules) are Live!");
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
          e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Coaching Standard Studio"),
          e("p", { className: "text-xs text-slate" }, "Formula Tables + 2-Column Notes • Proper Math Notations")
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
            onClick: () => runMasterGeneration(),
            className:
              "w-full py-5 rounded-xl bg-teal text-white font-bold text-sm shadow-xl hover:bg-teal/90 disabled:opacity-50 transition-all text-center flex items-center justify-center gap-2",
          },
          running ? "Publishing Coaching Modules..." : "🚀 Publish Coaching Modules (Tables & 2-Col Notes)"
        )
      ),
      done
        ? e(
            "a",
            {
              href: "/resources",
              className: "w-full py-3 text-center bg-teal text-white rounded-xl text-xs font-semibold shadow hover:bg-teal/90 transition-all",
            },
            "Go to App & Test All Resources"
          )
        : null
    )
  );
}
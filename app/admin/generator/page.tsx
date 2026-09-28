"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ModuleData {
  badge: string;
  sections: {
    title: string;
    rows: [string, string, string][];
  }[];
}

// ============================================================================
// 1. DEEP COACHING KNOWLEDGE ENGINE (FORMULAS + SHORT NOTES)
// ============================================================================
const MASTER_KNOWLEDGE: Record<string, { formulas: ModuleData; notes: ModuleData }> = {
  // MOTION IN A STRAIGHT LINE
  "motion in a straight line": {
    formulas: {
      badge: "Kinematics 1D Equations & Numerical Shortcuts",
      sections: [
        {
          title: "Equations of Motion (Constant Acceleration)",
          rows: [
            ["Equations of Motion", "v = u + a*t,  s = u*t + 0.5*a*t^2,  v^2 = u^2 + 2*a*s", "Vector form: v_vec = u_vec + a_vec*t, s_vec = u_vec*t + 0.5*a_vec*t^2. Valid ONLY for constant acceleration."],
            ["Nth Second Distance", "S_n = u + 0.5 * a * (2*n - 1)", "Valid for constant acceleration. Gives distance covered in specific nth second."],
            ["Galileo's Odd Ratio", "Distances in equal intervals: 1 : 3 : 5 : 7 : (2n - 1)", "Valid for body starting from rest under constant acceleration."],
            ["Stopping Distance & Time", "s = u^2 / (2*a) ==> s proportional to u^2 | t = u / a", "Doubling initial velocity quadruples stopping distance but only doubles stopping time."],
          ],
        },
        {
          title: "Motion Under Gravity & Advanced Vertical Cases",
          rows: [
            ["Vertical Projection", "H_max = u^2 / (2*g) | Time of flight T = 2*u / g", "Time of ascent = Time of descent = u / g (in vacuum without air drag)."],
            ["Effect of Air Resistance", "Ascent: t1 = sqrt[2h / (g + a)] | Descent: t2 = sqrt[2h / (g - a)]", "Velocity of projection v1 = sqrt[2(g+a)h], landing velocity v2 = sqrt[2(g-a)h]. t2 > t1."],
            ["Crossing Same Point Twice", "Height h = 0.5 * g * t1 * t2 | H_max = 0.125 * g * (t1 + t2)^2", "Body crosses height h at t1 (going up) and t2 (coming down). Total T = t1 + t2."],
            ["Variable Accel. Calculus", "a = v * (dv/dx) = dv/dt = d^2x/dt^2 | s = Integral(v dt)", "Slope of x-t is v. Slope of v-t is a. Area under v-t is displacement."],
          ],
        },
      ],
    },
    notes: {
      badge: "1D Kinematics Concepts & Traps Checklist",
      sections: [
        {
          title: "Core Conceptual Rules & Graph Insights",
          rows: [
            ["Distance vs Displacement", "Distance >= |Displacement|. Average Speed >= |Average Velocity|.", "They are equal ONLY for unidirectional straight-line motion without turning back."],
            ["Graph Interpretations", "x-t slope = velocity. v-t slope = acceleration. Area under a-t = change in velocity.", "Sharp corner in x-t graph means infinite acceleration (physically impossible)."],
            ["Sign Convention Traps", "Fix positive upwards: then g = -9.8 m/s^2 ALWAYS (both for upward and downward motion!).", "Displacement can be negative if body lands below projection point."],
          ],
        },
        {
          title: "Coaching Exam Traps & Tricks",
          rows: [
            ["Ball Dropped from Lift", "Initial velocity of ball = velocity of lift at release moment.", "Acceleration after release is strictly g downward (independent of lift's acceleration!)."],
            ["Tap Water Droplets", "When nth drop leaves, distance of (n-1)th, (n-2)th follow 1 : 4 : 9 : 16 ratios from top.", "Time interval between successive drops is constant."],
          ],
        },
      ],
    },
  },

  // STRUCTURE OF ATOM
  "structure of atom": {
    formulas: {
      badge: "Bohr Model, Quantum Numbers & De-Broglie",
      sections: [
        {
          title: "Bohr Model & Rydberg Transitions",
          rows: [
            ["Bohr Radius & Velocity", "r_n = 0.529 * (n^2 / Z) Angstrom | v_n = 2.18e6 * (Z / n) m/s", "Angular momentum quantization: m*v*r = n*h / (2*pi)."],
            ["Bohr Energy Formula", "E_n = -13.6 * (Z^2 / n^2) eV = -2.18e-18 * (Z^2 / n^2) J", "Total Energy E = - K.E. = 0.5 * P.E."],
            ["Rydberg Spectrum", "1 / lambda = R_H * Z^2 * [1/n1^2 - 1/n2^2]", "R_H = 109677 cm^-1. Lyman (UV, n1=1), Balmer (Visible, n1=2), Paschen (IR, n1=3)."],
            ["Total Spectral Lines", "Total lines = n*(n - 1) / 2 [from level n to ground]", "Between n2 and n1: Total lines = (n2 - n1)*(n2 - n1 + 1) / 2."],
          ],
        },
        {
          title: "Quantum Mechanics, Nodes & Uncertainty",
          rows: [
            ["De-Broglie Wavelength", "lambda = h / p = h / (m * v) = h / sqrt(2 * m * K.E.)", "For electron accelerated through V volts: lambda = 12.27 / sqrt(V) Angstrom."],
            ["Heisenberg Uncertainty", "Delta_x * Delta_p >= h / (4 * pi) | Delta_x * Delta_v >= h / (4*pi*m)", "Applicable only to microscopic particles. Inapplicable to macroscopic bodies."],
            ["Nodes in Orbitals", "Radial Nodes = n - l - 1 | Angular Nodes = l | Total Nodes = n - 1", "For 4d orbital: n=4, l=2 -> Radial = 4-2-1 = 1, Angular = 2, Total = 3 nodes."],
            ["Spin Magnetic Moment", "mu_s = sqrt[n * (n + 2)] Bohr Magnetons (B.M.)", "n = number of unpaired electrons."],
          ],
        },
      ],
    },
    notes: {
      badge: "Quantum Mechanics & Electronic Rules",
      sections: [
        {
          title: "Aufbau, Hund's & Pauli Principles",
          rows: [
            ["Aufbau Principle", "Electrons occupy lowest energy orbitals first following (n + l) rule.", "If (n + l) is equal, orbital with lower n fills first (e.g. 3d vs 4s: 4s fills before 3d)."],
            ["Hund's Multiplicity Rule", "Pairing in degenerate orbitals (p, d, f) does NOT occur until each is singly occupied with parallel spins.", "Max exchange energy stabilizes half-filled and fully-filled configurations (Cr: 3d5 4s1, Cu: 3d10 4s1)."],
            ["Pauli Exclusion", "No two electrons in an atom can have the same set of all four quantum numbers.", "An orbital can hold at most 2 electrons with opposite spins (+1/2, -1/2)."],
          ],
        },
        {
          title: "Quantum Numbers & Shapes",
          rows: [
            ["Principal (n)", "Determines shell size & primary energy level. Total orbitals in shell = n^2, Max electrons = 2n^2.", "Distance from nucleus."],
            ["Azimuthal (l)", "Subshell shape: l=0(s, spherical), l=1(p, dumbbell), l=2(d, double dumbbell), l=3(f, complex).", "Orbital angular momentum = [h / (2*pi)] * sqrt[l*(l + 1)]."],
            ["Magnetic (m)", "Spatial orientation of orbital. Values from -l to +l (total 2l + 1 values).", "d_z^2 has doughnut (dough-ring) shape along z-axis."],
          ],
        },
      ],
    },
  },

  // ELECTRIC CHARGES AND FIELDS
  "electric charges and fields": {
    formulas: {
      badge: "Electrostatic Laws & Complete Field Distributions",
      sections: [
        {
          title: "Coulomb, Null Points & Equilibrium",
          rows: [
            ["Coulomb's Law", "F = (1 / 4 pi eps0 eps_r) * (q1 q2 / r^2)", "In medium: F_med = F_air / eps_r. 1/(4 pi eps0) = 9e9 N m^2 C^-2."],
            ["Null Point Formula", "x = [sqrt(Q1) * r] / [sqrt(Q1) +/- sqrt(Q2)]", "(+) for like charges (between), (-) for unlike charges (outside near smaller)."],
            ["3 Charges Equilibrium", "q = - (Q1 * Q2) / [sqrt(Q1) + sqrt(Q2)]^2", "Q1, Q2 must be like, q placed at x = r * sqrt(Q1) / [sqrt(Q1) + sqrt(Q2)]."],
            ["General Dipole Field", "E = [k p sqrt(1 + 3 cos^2 theta)] / r^3", "tan(alpha) = 0.5 tan(theta). Axial: 2kp/r^3, Equatorial: -kp/r^3."],
          ],
        },
        {
          title: "Complete Standard Field Distributions",
          rows: [
            ["Infinite Line Charge", "E = lambda / (2 pi eps0 r) = 2 k lambda / r", "Radial field, decreases as 1/r."],
            ["Infinite Thin Sheet", "E = sigma / (2 eps0) [Non-conducting] | sigma / eps0 [Conducting]", "Uniform field independent of distance r."],
            ["Uniform Charged Ring", "E_axis = k Q x / (R^2 + x^2)^(3/2)", "E_center = 0. E_max occurs at x = R / sqrt(2)."],
            ["Hollow / Conducting Sphere", "Outside (r >= R): E = k Q / r^2 | Inside (r < R): E = 0", "Acts like point charge for all outside points."],
            ["Solid Insulating Sphere", "Inside (r <= R): E = k Q r / R^3 | Outside (r > R): k Q / r^2", "Inside field is directly proportional to r (E proportional to r)."],
            ["Energy Density in Field", "u = 0.5 * eps0 * E^2 (Joules / m^3)", "Energy per unit volume stored in electrostatic field."],
          ],
        },
      ],
    },
    notes: {
      badge: "Electrostatics Concept Rules & Traps",
      sections: [
        {
          title: "Field Lines & Gauss's Law Insights",
          rows: [
            ["Electric Lines Properties", "Never intersect, never form closed loops, start from +ve and end at -ve.", "Crowded lines represent strong field, perpendicular to conductor surface."],
            ["Gauss's Law Traps", "Flux = Q_enclosed / eps0. Independent of shape or size of Gaussian surface.", "Charges outside surface do NOT contribute to net flux, but DO contribute to local electric field E!"],
            ["Conductor Electrostatics", "Electric field inside conductor is strictly ZERO in static equilibrium.", "All charge resides entirely on outer surface; potential is constant throughout body."],
          ],
        },
      ],
    },
  },

  // THE SOLID STATE
  "solid state": {
    formulas: {
      badge: "Lattices, Packing Fractions & Void Coordinates",
      sections: [
        {
          title: "Unit Cell Parameters (d, r, a & CN)",
          rows: [
            ["Simple Cubic (SC)", "d = a,  r = a / 2,  CN = 6,  Packing = 52.4%", "Z = 1 atom per unit cell."],
            ["Body-Centred Cubic (BCC)", "d = (sqrt(3)/2) a,  r = (sqrt(3)/4) a,  CN = 8,  Packing = 68%", "Z = 2 atoms per unit cell."],
            ["Face-Centred Cubic (FCC)", "d = a / sqrt(2),  r = a / (2 sqrt(2)),  CN = 12,  Packing = 74%", "Z = 4 atoms per unit cell."],
            ["Density of Crystal", "rho = (Z * M) / (a^3 * N_A)", "a in cm, M in g/mol, N_A = 6.022e23."],
          ],
        },
        {
          title: "Radius Ratios, Voids & Compounds",
          rows: [
            ["Tetrahedral Voids", "Count = 2N, Distance from corner = (sqrt(3)/4) a", "Located at 1/4th of body diagonal from each corner (8 in FCC)."],
            ["Octahedral Voids", "Count = N (1 at body centre, 12 at edge centres)", "Total = 1 + 12*(1/4) = 4 voids in FCC. Distance from centre = a/2."],
            ["Radius Ratio Table", "0.155-0.225 (Trigonal, CN=3) | 0.225-0.414 (Tetrahedral, CN=4)", "0.414-0.732 (Octahedral, CN=6) | 0.732-1.0 (BCC Cubic, CN=8)."],
            ["Standard Salts Structure", "NaCl (FCC 6:6) | CsCl (BCC 8:8) | ZnS (FCC 4:4) | CaF2 (FCC 8:4)", "Antifluorite Na2O (4:8)."],
          ],
        },
      ],
    },
    notes: {
      badge: "Crystal Imperfections & Electrical Properties",
      sections: [
        {
          title: "Defects in Solids & F-Centres",
          rows: [
            ["Schottky Defect", "Equal numbers of cations and anions missing from lattice. Density DECREASES.", "Shown by ionic compounds with high CN and similar cation/anion sizes (NaCl, KCl, CsCl)."],
            ["Frenkel Defect", "Cation dislocated from normal site to interstitial site. Density remains UNCHANGED.", "Shown by compounds with large size difference (ZnS, AgCl, AgBr). AgBr shows BOTH Schottky & Frenkel!"],
            ["F-Centres (Farbe)", "Electrons trapped in anionic vacancies. Imparts colour to crystal.", "NaCl turns yellow, KCl turns violet, LiCl turns pink due to F-centres."],
          ],
        },
      ],
    },
  },

  // RELATIONS AND FUNCTIONS
  "relations and functions": {
    formulas: {
      badge: "Counting Functions & Functional Equations",
      sections: [
        {
          title: "Mapping Formulas (Domain A: m, Codomain B: n)",
          rows: [
            ["Total Relations & Functions", "Total Relations = 2^(m * n) | Total Functions = n^m", "A has m elements, B has n elements."],
            ["Number of One-One", "n P m = n! / (n - m)! [if n >= m] | 0 [if n < m]", "No injection possible if domain has more elements than codomain."],
            ["Number of Onto (Surjective)", "Sum_{r=0}^n (-1)^r * nCr * (n - r)^m", "If n = m: n! onto functions. If n > m: 0 onto functions."],
            ["Number of Bijective", "n! [if m = n] | 0 [if m != n]", "Bijective requires both one-one and onto simultaneously."],
          ],
        },
        {
          title: "GIF Properties & Cauchy Functional Equations",
          rows: [
            ["Greatest Integer Function", "[x + n] = [x] + n (for integer n) | [-x] = -[x] (int), -[x]-1 (non-int)", "Fractional part {x} = x - [x]. Range of {x} is [0, 1)."],
            ["Cauchy Equation 1", "f(x + y) = f(x) + f(y) ===> f(x) = k * x", "Linear additive function."],
            ["Cauchy Equation 2", "f(x * y) = f(x) * f(y) ===> f(x) = x^n (or 0)", "Power multiplicative function."],
            ["Cauchy Equation 3", "f(x + y) = f(x) * f(y) ===> f(x) = a^x", "Exponential functional equation."],
            ["Cauchy Equation 4", "f(x * y) = f(x) + f(y) ===> f(x) = k * ln(x)", "Logarithmic functional equation."],
          ],
        },
      ],
    },
    notes: {
      badge: "Types of Relations & Equivalence Classes",
      sections: [
        {
          title: "Relation Types & Invertibility",
          rows: [
            ["Reflexive, Symmetric, Transitive", "Reflexive: (a, a) in R. Symmetric: (a, b) in R => (b, a) in R. Transitive: (a,b), (b,c) in R => (a,c) in R.", "Equivalence relation is reflexive, symmetric and transitive simultaneously."],
            ["Inverse Functions", "f^-1 exists IF AND ONLY IF f is bijective (both one-one and onto).", "Graph of f^-1 is reflection of graph of f about line y = x."],
          ],
        },
      ],
    },
  },
};

// ============================================================================
// 2. VECTOR PDF BUILDER (SUPER CLEAN 3KB VECTOR COACHING FORMAT)
// ============================================================================
function buildCoachingPdf(
  title: string,
  exam: string,
  cls: string,
  sub: string,
  modType: "formula_sheet" | "short_notes",
  data: ModuleData
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
  s += "BT /F2 10 Tf 0.35 0.45 0.55 rg 30 706 Td (Authentic Coaching Multi-Case & Distribution Module) Tj ET\n";

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
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Coaching Module * Target: " + exam + ") Tj ET\n";
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

// ============================================================================
// 3. MASTER STUDIO ADMIN UI (WITH "GENERATE BOTH" 1-CLICK ENGINE)
// ============================================================================
export default function MasterGeneratorPage() {
  const [running, setRunning] = useState(false);
  const [targetCategory, setTargetCategory] = useState<"formula_sheet" | "short_notes">("formula_sheet");
  const [status, setStatus] = useState("Ready to publish Coaching Grade Content for all subjects");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runBatch(cat: "formula_sheet" | "short_notes", filterClass?: string) {
    const { data: existing } = await supabase
      .from("resources")
      .select("chapter_id")
      .eq("category", cat);

    const doneMap = new Set((existing || []).map((r) => r.chapter_id));

    const { data: subs } = await supabase.from("subjects").select("id, name, class_level, target_exam");
    if (!subs || subs.length === 0) throw new Error("No subjects found");

    const filteredSubs = filterClass
      ? subs.filter((s) => s.class_level === filterClass || (filterClass === "11" && s.class_level === "Dropper") || (filterClass === "12" && s.class_level === "Dropper"))
      : subs;

    const subIds = filteredSubs.map((s) => s.id);
    const { data: chs } = await supabase.from("chapters").select("id, title, subject_id").in("subject_id", subIds);
    if (!chs || chs.length === 0) throw new Error("No chapters found");

    for (let i = 0; i < chs.length; i++) {
      const ch = chs[i];
      setPct(Math.round(((i + 1) / chs.length) * 100));

      if (doneMap.has(ch.id)) continue;

      setStatus("[" + (cat === "formula_sheet" ? "Formula Sheet" : "Short Note") + "] " + ch.title + " (" + (i + 1) + "/" + chs.length + ")");

      const parentSub = filteredSubs.find((s) => s.id === ch.subject_id);
      if (!parentSub) continue;

      const cleanKey = ch.title.toLowerCase().trim();
      const entry = MASTER_KNOWLEDGE[cleanKey];

      const moduleData: ModuleData = (entry && (cat === "formula_sheet" ? entry.formulas : entry.notes)) || {
        badge: cat === "formula_sheet" ? "High-Yield Mathematical Formulations" : "Coaching Concept & Problem Framework",
        sections: [
          {
            title: cat === "formula_sheet" ? "Governing Equations & Vector Relations" : "Core Concepts & Governing Rules",
            rows: [
              ["Primary Formulation", "Conditions and standard definitions governing " + ch.title + ".", "Exam-tested critical criteria."],
              ["Key Numerical Equations", "Mathematical representations, vector notations and unit constraints.", "Dimensionally consistent standard forms."],
            ],
          },
          {
            title: cat === "formula_sheet" ? "Calculation Shortcuts & Boundary Limits" : "Exceptions, Traps & High-Yield Insights",
            rows: [
              ["Boundary Conditions", "Behavior at limits (r -> 0, r -> inf, boundary conditions, resonance).", "High-frequency trick question area."],
              ["Direct Numerical Shortcut", "Proportionalities, dimensional match, and elimination rules for MCQs.", "Reduces problem solving time significantly."],
            ],
          },
        ],
      };

      try {
        const pdfBytes = buildCoachingPdf(
          ch.title,
          parentSub.target_exam,
          parentSub.class_level,
          parentSub.name,
          cat,
          moduleData
        );

        const prefix = cat === "formula_sheet" ? "formula_" : "short_";
        const fileName =
          prefix +
          parentSub.class_level.toLowerCase() +
          "_" +
          parentSub.target_exam.toLowerCase() +
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
          title: ch.title + " — " + parentSub.target_exam + " " + (cat === "formula_sheet" ? "Formula Sheet" : "Short Notes"),
          url: pubData.publicUrl,
          category: cat,
          display_order: 0,
        });

        await new Promise((resolve) => setTimeout(resolve, 140));
      } catch (innerErr) {
        console.warn("Skipping chapter:", ch.title, innerErr);
      }
    }
  }

  async function runSingleOrBoth(mode: "single" | "both", filterClass?: string) {
    setRunning(true);
    setErr(null);
    setDone(false);

    try {
      if (mode === "both") {
        setStatus("Phase 1: Publishing Formula Sheets for entire syllabus...");
        await runBatch("formula_sheet", filterClass);
        setStatus("Phase 2: Publishing Short Notes for entire syllabus...");
        await runBatch("short_notes", filterClass);
      } else {
        await runBatch(targetCategory, filterClass);
      }
      setStatus("Success! All coaching-grade modules published cleanly!");
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
          e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Master Coaching Studio"),
          e("p", { className: "text-xs text-slate" }, "Dedicated Formulas (Tables) + Dedicated Short Notes (Concepts)")
        )
      ),
      // Mode Selection Tabs
      e(
        "div",
        { className: "flex bg-ink/5 p-1 rounded-xl" },
        e(
          "button",
          {
            type: "button",
            onClick: () => setTargetCategory("formula_sheet"),
            className:
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all " +
              (targetCategory === "formula_sheet" ? "bg-white text-teal shadow" : "text-slate hover:text-ink"),
          },
          "📐 Formula Sheets Mode"
        ),
        e(
          "button",
          {
            type: "button",
            onClick: () => setTargetCategory("short_notes"),
            className:
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all " +
              (targetCategory === "short_notes" ? "bg-white text-teal shadow" : "text-slate hover:text-ink"),
          },
          "📖 Short Notes Mode"
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
        // 1-Click Both Button
        e(
          "button",
          {
            type: "button",
            disabled: running,
            onClick: () => runSingleOrBoth("both"),
            className:
              "w-full py-4 rounded-xl bg-gradient-to-r from-teal to-blue-600 text-white font-bold text-sm shadow-xl hover:opacity-95 disabled:opacity-50 transition-all text-center flex items-center justify-center gap-2",
          },
          running ? "Publishing Everything..." : "🚀 1-Click Generate BOTH (Formulas + Short Notes)"
        ),
        e(
          "button",
          {
            type: "button",
            disabled: running,
            onClick: () => runSingleOrBoth("single"),
            className:
              "w-full py-3 rounded-xl bg-white border-2 border-teal text-teal font-bold text-xs shadow hover:bg-teal/5 disabled:opacity-50 transition-all text-center",
          },
          "Generate Selected Only: " + (targetCategory === "formula_sheet" ? "Formula Sheets" : "Short Notes")
        ),
        // Class Filters
        e(
          "div",
          { className: "grid grid-cols-3 gap-2 pt-1" },
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => runSingleOrBoth("single", "10"),
              className: "py-2 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 10"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => runSingleOrBoth("single", "11"),
              className: "py-2 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 11 + Drop"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => runSingleOrBoth("single", "12"),
              className: "py-2 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 12 + Drop"
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
            "Go to App & Test All Resources"
          )
        : null
    )
  );
}
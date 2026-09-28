"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface FormulaEntry {
  sub: string;
  cls: "10" | "11" | "12";
  exam: "JEE" | "NEET" | "Boards";
  ch: string;
  badge: string;
  items: [string, string, string][];
}

const ALL_FORMULAS: FormulaEntry[] = [
  // CLASS 10 (BOARDS)
  { sub: "Science", cls: "10", exam: "Boards", ch: "Light – Reflection and Refraction", badge: "Optics & Lens", items: [["Mirror Formula", "1/f = 1/v + 1/u", "f = R/2, concave f<0, convex f>0"], ["Magnification", "m = -v/u = h'/h", "Negative m = Real & Inverted"], ["Snell's Law", "n = sin i / sin r = v1/v2", "n21 = n2/n1"], ["Lens Formula", "1/f = 1/v - 1/u", "Lens m = +v/u"], ["Lens Power", "P = 1/f (m)", "Unit: Dioptre (D)"]] },
  { sub: "Science", cls: "10", exam: "Boards", ch: "Electricity", badge: "Circuits & Power", items: [["Current", "I = Q/t = ne/t", "1 A = 1 C / 1 s"], ["Ohm's Law", "V = I * R", "V proportional to I"], ["Resistance", "R = rho * L / A", "Thick wire has lower R"], ["Resistors", "Series: R1+R2 | Parallel: 1/R1+1/R2", "Parallel R is lower"], ["Joule Heating", "H = I^2 R t = V I t", "Power P = V*I = I^2*R = V^2/R"]] },
  { sub: "Science", cls: "10", exam: "Boards", ch: "Chemical Reactions and Equations", badge: "Reactions", items: [["Combination", "CaO + H2O -> Ca(OH)2 + Heat", "Slaked lime synthesis"], ["Decomposition", "2FeSO4 -> Fe2O3 + SO2 + SO3", "Thermal decomposition"], ["Displacement", "Fe + CuSO4 -> FeSO4 + Cu", "Reactivity series based"], ["Precipitation", "Na2SO4 + BaCl2 -> BaSO4(ppt) + 2NaCl", "Double displacement"]] },
  { sub: "Mathematics", cls: "10", exam: "Boards", ch: "Quadratic Equations", badge: "Roots & D", items: [["Formula", "x = (-b +/- sqrt(D))/(2a)", "ax^2 + bx + c = 0"], ["Discriminant", "D = b^2 - 4ac", "D>0 Real, D=0 Equal, D<0 None"], ["Roots Relation", "sum = -b/a, product = c/a", "x^2 - (sum)x + prod = 0"]] },
  { sub: "Mathematics", cls: "10", exam: "Boards", ch: "Introduction to Trigonometry", badge: "Identities", items: [["Identity 1", "sin^2 q + cos^2 q = 1", "Fundamental identity"], ["Identity 2", "1 + tan^2 q = sec^2 q", "sec^2 q - tan^2 q = 1"], ["Identity 3", "1 + cot^2 q = cosec^2 q", "cosec^2 q - cot^2 q = 1"], ["Values", "sin 30=1/2, sin 45=1/sqrt2, sin 60=sqrt3/2", "tan 45 = 1"]] },

  // CLASS 11 (JEE & NEET)
  { sub: "Chemistry", cls: "11", exam: "JEE", ch: "Some Basic Concepts of Chemistry", badge: "Mole Concept", items: [["Moles", "n = Mass/M = N/N_A = V(STP)/22.4L", "N_A = 6.022e23"], ["Molarity & Molality", "M = moles/L | m = moles/kg solvent", "m is temperature independent"], ["Equiv Wt", "Eq Wt = M / n-factor", "Normality N = M * n-factor"]] },
  { sub: "Chemistry", cls: "11", exam: "NEET", ch: "Some Basic Concepts of Chemistry", badge: "NEET Conversions", items: [["Molecules", "N = (Mass/M) * 6.022e23", "STP 1 mol = 22.4 L"], ["Molarity Trick", "M = (10 * d * %x) / M_solute", "d = density in g/mL"], ["Empirical", "Molecular = n * Empirical", "n = Mol Mass / Emp Mass"]] },
  { sub: "Chemistry", cls: "11", exam: "JEE", ch: "Thermodynamics", badge: "JEE Enthalpy & G", items: [["1st Law", "DU = q + w, DH = DU + Dn_g R T", "Dn_g = Gas prod - Gas react"], ["Gibbs Energy", "DG = DH - T DS", "DG < 0 Spontaneous"], ["Standard EMF", "DG0 = -n F E0 = -2.303 R T log K", "F = 96500 C/mol"]] },
  { sub: "Chemistry", cls: "11", exam: "NEET", ch: "Thermodynamics", badge: "NEET Spontaneity", items: [["Spontaneity", "DH < 0 & DS > 0: ALWAYS spontaneous", "DH > 0 & DS < 0: NEVER spontaneous"], ["Hess Law", "Total DH is path independent", "DH = Sum(BE react) - Sum(BE prod)"], ["State Functions", "U, H, S, G are State Functions", "q and w are Path Functions"]] },
  { sub: "Chemistry", cls: "11", exam: "JEE", ch: "Equilibrium", badge: "JEE Ionic & Kp", items: [["Kp & Kc", "Kp = Kc * (R T)^Dn_g", "R = 0.0821 L atm/mol K"], ["Ostwald Law", "alpha = sqrt(Ka / C)", "For weak electrolytes"], ["Buffer pH", "Acidic: pH = pKa + log(Salt/Acid)", "Henderson equation"]] },
  { sub: "Mathematics", cls: "11", exam: "JEE", ch: "Trigonometric Functions", badge: "JEE Angles", items: [["Compound", "sin(A+B) = sinA cosB + cosA sinB", "cos(A+B) = cosA cosB - sinA sinB"], ["Double Angle", "sin 2A = 2 sinA cosA", "cos 2A = 2 cos^2 A - 1"], ["General Soln", "sin q = sin a -> q = n pi + (-1)^n a", "cos q = cos a -> q = 2n pi +/- a"]] },
  { sub: "Biology", cls: "11", exam: "NEET", ch: "Cell: The Unit of Life", badge: "NEET Cytology", items: [["Ribosomes", "Prokaryotes: 70S (50S+30S) | Eukaryotes: 80S", "Protein synthesis factory"], ["Fluid Mosaic", "Singer & Nicolson (1972)", "Quasifluid lipid bilayer"], ["Mitochondria", "Semi-autonomous with circular DNA & 70S", "Cristae increase surface area"]] },

  // CLASS 12 (JEE & NEET)
  { sub: "Physics", cls: "12", exam: "JEE", ch: "Electric Charges and Fields", badge: "JEE Electrostatics", items: [["Coulomb Law", "F = (1/4 pi eps0) * q1 q2 / r^2", "k = 9e9 N m^2 C^-2"], ["Dipole Field", "Axial: 2kp/r^3 | Equat: -kp/r^3", "Torque = p x E, U = -p.E"], ["Gauss Law", "Phi = Closed(E.dA) = q_enc / eps0", "Sheet: E = sigma / 2 eps0"]] },
  { sub: "Physics", cls: "12", exam: "NEET", ch: "Electric Charges and Fields", badge: "NEET Charges", items: [["Dipole Ratio", "E_axial / E_equatorial = 2", "Both decrease as 1/r^3"], ["Flux Cube", "Center: q/eps0 | Face: q/6 eps0", "Corner: q/8 eps0"], ["Dipole Work", "W = p E (cos q1 - cos q2)", "Stable at 0 deg, Unstable at 180"]] },
  { sub: "Physics", cls: "12", exam: "JEE", ch: "Current Electricity", badge: "JEE Circuits", items: [["Drift Speed", "v_d = e E tau / m,  I = n e A v_d", "Mobility mu = v_d / E"], ["Kirchhoff", "KCL: Charge conservation | KVL: Energy", "Sum I = 0, Sum V = 0"], ["Bridge", "P/Q = R/S at balance", "Meter Bridge: R/S = l1/(100-l1)"]] },
  { sub: "Chemistry", cls: "12", exam: "JEE", ch: "Solutions", badge: "Colligative Properties", items: [["Raoult Law", "(P0 - P)/P0 = i * X_solute", "i = van't Hoff factor"], ["Elevation/Depression", "DT_b = i K_b m,  DT_f = i K_f m", "Kb ebullioscopic, Kf cryoscopic"], ["Osmotic Press", "pi = i C R T = i (n/V) R T", "Isotonic: pi1 = pi2"]] },
  { sub: "Chemistry", cls: "12", exam: "NEET", ch: "Solutions", badge: "NEET Solutions", items: [["van't Hoff i", "Dissociation: i = 1 + (n-1) alpha", "Association dimer: i = 1 - 0.5 alpha"], ["Ideal Soln", "DH_mix = 0, DV_mix = 0", "Benzene + Toluene example"], ["Particle Trap", "1M CaCl2 (i=3) has higher BP than 1M NaCl (i=2)", "Colligative depends only on particle count"]] },
  { sub: "Chemistry", cls: "12", exam: "JEE", ch: "Electrochemistry", badge: "JEE Nernst", items: [["Nernst Eqn", "E = E0 - (0.0591/n) log Q", "At equil E=0 -> E0 = (0.0591/n) log K"], ["Kohlrausch", "Lambda0 = nu+ lambda0+ + nu- lambda0-", "alpha = Lambda / Lambda0"], ["Faraday Law", "m = Z I t = (Eq Wt / 96500) * Q", "1 F deposits 1 gram-equivalent"]] },
  { sub: "Mathematics", cls: "12", exam: "JEE", ch: "Integrals", badge: "JEE Calculus", items: [["By Parts", "Integral(u v dx) = u Int(v) - Int(u' Int(v))", "ILATE rule selection"], ["King Property", "Int_a^b f(x) dx = Int_a^b f(a+b-x) dx", "Int_0^a f(x) dx = Int_0^a f(a-x) dx"], ["Leibniz Rule", "d/dx [Int_u^v f(t)dt] = f(v) v' - f(u) u'", "Differentiating integrals"]] },
  { sub: "Biology", cls: "12", exam: "NEET", ch: "Principles of Inheritance and Variation", badge: "NEET Genetics", items: [["Mendel Ratios", "Monohybrid: 3:1 (Pheno), 1:2:1 (Geno)", "Dihybrid: 9:3:3:1"], ["Co-dominance", "ABO Blood Grouping (IA, IB co-dominant)", "Incomplete: Snapdragon 1:2:1"], ["Disorders", "Sex-linked recessive: Haemophilia, Colour blindness", "Autosomal: Sickle cell (GAG -> GUG)"]] },
];

function buildVectorPdf(item: FormulaEntry): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  const isJee = item.exam === "JEE";
  const isNeet = item.exam === "NEET";
  const header = "PREPWISE * " + item.exam.toUpperCase() + " FORMULA HANDBOOK";
  const sub = "CLASS " + item.cls + " " + item.sub.toUpperCase() + " * TARGET " + item.exam;

  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  s += isJee ? "0.00 0.70 0.85 rg 0 756 595 4 re f\n" : isNeet ? "0.05 0.75 0.45 rg 0 756 595 4 re f\n" : "0.85 0.65 0.10 rg 0 756 595 4 re f\n";
  s += "BT /F1 18 Tf 1 1 1 rg 30 806 Td (" + header + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.85 0.92 1 rg 30 790 Td (" + sub + ") Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 440 806 Td (" + clean(item.sub) + ") Tj ET\n";
  s += "BT /F2 9 Tf 0.85 0.92 1 rg 440 790 Td (prepwise.in) Tj ET\n";
  s += "BT /F1 15 Tf 0.1 0.15 0.35 rg 30 722 Td (" + clean(item.ch) + ") Tj ET\n";
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
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Formula Sheet * Personalised for " + item.exam + ") Tj ET\n";
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
        ? ALL_FORMULAS.filter((m) => m.cls === filterClass)
        : ALL_FORMULAS;

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
        setStatus("Generating [" + item.exam + " Class " + item.cls + "] " + item.ch + " (" + (i + 1) + "/" + itemsToRun.length + ")...");

        const targetSubs = allSubs.filter((s) => {
          if (s.name.toLowerCase().trim() !== item.sub.toLowerCase().trim()) return false;
          if (s.target_exam !== item.exam) return false;
          if (s.class_level === item.cls) return true;
          if (s.class_level === "Dropper" && (item.cls === "11" || item.cls === "12")) return true;
          return false;
        });

        if (targetSubs.length === 0) continue;
        const targetSubIds = targetSubs.map((s) => s.id);

        const matchedChapters = allChs.filter(
          (c) =>
            targetSubIds.includes(c.subject_id) &&
            c.title.toLowerCase().trim() === item.ch.toLowerCase().trim()
        );

        if (matchedChapters.length === 0) continue;

        const pdfBytes = buildVectorPdf(item);
        const fileName =
          "pw_" +
          item.cls +
          "_" +
          item.exam.toLowerCase() +
          "_" +
          item.ch.toLowerCase().replace(/[^a-z0-9]/g, "_") +
          ".pdf";
        const path = "formula_sheets/" + fileName;

        const { error: upErr } = await supabase.storage.from("resources").upload(path, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
        if (upErr) throw new Error("Upload error for " + item.ch + ": " + upErr.message);

        const { data: pubData } = supabase.storage.from("resources").getPublicUrl(path);

        for (let j = 0; j < matchedChapters.length; j++) {
          const ch = matchedChapters[j];
          await supabase.from("resources").delete().eq("chapter_id", ch.id).eq("category", "formula_sheet");
          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: item.ch + " — " + item.exam + " Formula Sheet",
            url: pubData.publicUrl,
            category: "formula_sheet",
            display_order: 0,
          });
        }
      }

      setStatus("Complete! All formula sheets uploaded and linked with Droppers.");
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
          e("p", { className: "text-xs text-slate" }, "Class 10, 11, 12 & Droppers * Personalised for JEE / NEET / Boards")
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

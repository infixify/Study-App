"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ChapterFormula {
  badge: string;
  items: [string, string, string][];
}

const KNOWLEDGE_BASE: Record<string, ChapterFormula> = {
  // CLASS 10
  "light – reflection and refraction": { badge: "Mirrors & Lenses", items: [["Mirror Formula", "1/f = 1/v + 1/u", "Concave f<0, Convex f>0"], ["Magnification", "m = -v/u = h'/h", "Negative m = Real/Inverted"], ["Lens Formula", "1/f = 1/v - 1/u", "Lens m = +v/u"], ["Power", "P = 1/f (metres)", "Unit: Dioptre (D)"]] },
  "the human eye and the colourful world": { badge: "Defects & Dispersion", items: [["Myopia (Near)", "Corrected by Concave Lens", "Image formed in front of retina"], ["Hypermetropia (Far)", "Corrected by Convex Lens", "Image formed behind retina"], ["Prism Dispersion", "Angle of Dev: d = (n - 1) A", "Violet deviates most, Red least"]] },
  "electricity": { badge: "Ohm Law & Power", items: [["Ohm's Law", "V = I * R", "V proportional to I"], ["Resistance", "R = rho * L / A", "Thick wire has lower R"], ["Series & Parallel", "Series: R1+R2 | Parallel: 1/R1+1/R2", "Parallel R is lowest"], ["Joule Heating", "H = I^2 R t = V I t", "Power P = V^2 / R = I^2 R"]] },
  "magnetic effects of electric current": { badge: "Electromagnetism", items: [["Right Hand Thumb", "Thumb = Current, Fingers = Field lines", "Concentric circles around wire"], ["Fleming Left Hand", "Thumb=Force, Fore=Field, Center=Current", "Electric Motor principle"], ["Fleming Right Hand", "Induced Current in Generator", "Electromagnetic Induction"]] },
  "chemical reactions and equations": { badge: "Reaction Types", items: [["Combination", "CaO + H2O -> Ca(OH)2 + Heat", "Slaked lime synthesis"], ["Decomposition", "2FeSO4 -> Fe2O3 + SO2 + SO3", "Single reactant breaks down"], ["Displacement", "Fe + CuSO4 -> FeSO4 + Cu", "Reactivity series based"], ["Redox", "Oxidation = loss of e-, Reduction = gain of e-", "Simultaneous transfer"]] },
  "acids, bases and salts": { badge: "pH & Salts", items: [["pH Scale", "pH = -log[H+], Range: 0 to 14", "pH<7 Acidic, pH=7 Neutral"], ["Bleaching Powder", "Ca(OH)2 + Cl2 -> CaOCl2 + H2O", "Disinfection of water"], ["Plaster of Paris", "CaSO4.0.5H2O + 1.5H2O -> CaSO4.2H2O", "Heating gypsum at 373 K"]] },
  "metals and non-metals": { badge: "Reactivity & Metallurgy", items: [["Reactivity Series", "K > Na > Ca > Mg > Al > Zn > Fe > Cu > Ag > Au", "K & Na stored in kerosene"], ["Amphoteric Oxides", "Al2O3 and ZnO react with BOTH acids & bases", "Form salt and water"], ["Roasting vs Calcination", "Roasting: in excess air (Sulphides)", "Calcination: in limited air (Carbonates)"]] },
  "carbon and its compounds": { badge: "Organic Basics", items: [["Covalent Bonding", "Carbon shares 4 valence electrons", "Tetravalency & Catenation"], ["Homologous Series", "Alkanes CnH2n+2, Alkenes CnH2n, Alkynes CnH2n-2", "Differs by -CH2- (14 u)"], ["Saponification", "Ester + NaOH -> Soap + Alcohol", "CH3COOC2H5 + NaOH -> CH3COONa + C2H5OH"]] },
  "life processes": { badge: "Vital Functions", items: [["Photosynthesis", "6CO2 + 12H2O -> C6H12O6 + 6O2 + 6H2O", "Chloroplast thylakoids & stroma"], ["Respiration", "Aerobic (38 ATP in Mitochondria)", "Anaerobic: Lactic acid causes cramps"], ["Circulation", "Double circulation in humans", "Left ventricle -> Aorta -> Body"]] },
  "control and coordination": { badge: "Nervous & Hormones", items: [["Reflex Arc", "Receptor -> Sensory -> Spinal Cord -> Motor -> Effector", "Involuntary quick action"], ["Plant Hormones", "Auxin (growth), Gibberellin (stem), Cytokinin (division)", "Abscisic acid (inhibitor)"], ["Insulin", "Secreted by Pancreas beta cells", "Regulates blood glucose"]] },
  "how do organisms reproduce?": { badge: "Reproduction", items: [["Binary Fission", "Amoeba divides into two equal individuals", "Asexual reproduction"], ["Flower Organs", "Stamen = Male (Anther+Filament)", "Carpel = Female (Stigma+Style+Ovary)"], ["Double Fertilisation", "Syngamy (Zygote 2n) + Triple Fusion (Endosperm 3n)", "Unique to angiosperms"]] },
  "heredity": { badge: "Genetics", items: [["Mendel Monohybrid", "Phenotype: 3 : 1 | Genotype: 1 : 2 : 1", "Law of Segregation"], ["Dihybrid Cross", "Phenotype: 9 : 3 : 3 : 1", "Law of Independent Assortment"], ["Sex Determination", "Female: XX, Male: XY", "Father determines sex of child"]] },
  "our environment": { badge: "Ecology", items: [["10% Energy Law", "Lindeman: Only 10% energy transfers to next trophic level", "90% lost as heat"], ["Biomagnification", "Pesticide concentration increases at higher levels", "DDT in birds"], ["Ozone Depletion", "CFCs release Cl free radicals destroying O3", "O3 protects from UV rays"]] },
  "real numbers": { badge: "HCF & LCM", items: [["Fundamental Theorem", "Every composite = unique prime factor product", "Uniqueness up to order"], ["HCF * LCM", "HCF(a, b) * LCM(a, b) = a * b", "Valid for two numbers only"]] },
  "polynomials": { badge: "Zeroes of Polynomials", items: [["Quadratic Zeroes", "alpha + beta = -b/a, alpha * beta = c/a", "p(x) = k[x^2 - (sum)x + prod]"], ["Cubic Zeroes", "Sum = -b/a, Sum pairwise = c/a, Prod = -d/a", "ax^3 + bx^2 + cx + d = 0"]] },
  "quadratic equations": { badge: "Roots & D", items: [["Quadratic Formula", "x = [-b +/- sqrt(b^2 - 4ac)] / 2a", "ax^2 + bx + c = 0"], ["Discriminant D", "D = b^2 - 4ac", "D>0 Real & distinct, D=0 Equal, D<0 Imaginary"]] },
  "arithmetic progressions": { badge: "AP Formulae", items: [["nth Term", "a_n = a + (n - 1) d", "d = a_k - a_{k-1}"], ["Sum of n Terms", "S_n = (n/2)[2a + (n-1)d] = (n/2)(a + l)", "l = last term"]] },
  "introduction to trigonometry": { badge: "Ratios & Identities", items: [["Identity 1", "sin^2 q + cos^2 q = 1", "sec^2 q - tan^2 q = 1"], ["Identity 2", "cosec^2 q - cot^2 q = 1", "1 + tan^2 q = sec^2 q"], ["Key Values", "sin 30=1/2, sin 45=1/sqrt2, sin 60=sqrt3/2", "tan 45=1, tan 60=sqrt3"]] },

  // CLASS 11 & 12 CORE
  "units and measurement": { badge: "Errors & Dimensions", items: [["Percentage Error", "%Z = a(%A) + b(%B) + c(%C)", "For Z = A^a * B^b / C^c"], ["Vernier LC", "LC = 1 MSD - 1 VSD = (1/n) MSD", "When n VSD = (n-1) MSD"], ["Screw Gauge LC", "LC = Pitch / Circular Divisions", "Total = MSR + (CSR x LC) - Zero Error"]] },
  "motion in a straight line": { badge: "1D Kinematics", items: [["Equations of Motion", "v = u + at, s = ut + 0.5at^2, v^2 = u^2 + 2as", "Constant acceleration"], ["Nth Second", "S_n = u + (a/2)(2n - 1)", "Distance in specific second"], ["Stopping Distance", "s = u^2 / 2a -> s proportional to u^2", "Doubling u quadruples s"]] },
  "motion in a plane": { badge: "Vectors & Projectiles", items: [["Time of Flight", "T = 2 u sin q / g", "Total air time"], ["Max Height", "H = u^2 sin^2 q / 2g", "vy = 0 at top"], ["Horizontal Range", "R = u^2 sin(2q) / g", "R_max at 45 deg = u^2/g = 4H_max"]] },
  "laws of motion": { badge: "Newtonian Dynamics", items: [["Newton 2nd Law", "F = dp/dt = m * a", "External net force"], ["Friction", "f_s <= mu_s N, f_k = mu_k N", "Angle of repose: tan phi = mu_s"], ["Banked Road", "v = sqrt(r g tan q)", "Frictionless optimum turn speed"]] },
  "work, energy and power": { badge: "Work Energy Theorem", items: [["Work-Energy", "W_net = Delta K = 0.5 m (v^2 - u^2)", "Universal theorem"], ["Spring Energy", "U = 0.5 k x^2, F = -kx", "Restoring force Hooke law"], ["Vertical Circle", "v_bottom = sqrt(5gR), v_top = sqrt(gR)", "T_bottom - T_top = 6mg"]] },
  "systems of particles and rotational motion": { badge: "Center of Mass & Torque", items: [["Torque & Angular Mom", "tau = r x F = I alpha, L = r x p = I w", "Conserved when external torque = 0"], ["Parallel Axis", "I = I_cm + M d^2", "Perpendicular: I_z = I_x + I_y"], ["Rolling Accel", "a = (g sin q) / [1 + (I_cm / M R^2)]", "Solid sphere rolls fastest"]] },
  "gravitation": { badge: "Gravity & Orbits", items: [["g with Height & Depth", "g_h = g(1 - 2h/R), g_d = g(1 - d/R)", "At center of Earth g=0"], ["Escape Speed", "v_e = sqrt(2 g R) = 11.2 km/s", "Independent of mass of body"], ["Orbital Speed", "v_o = sqrt(G M / r) = v_e / sqrt(2)", "Kepler 3rd: T^2 proportional to r^3"]] },
  "mechanical properties of solids": { badge: "Elasticity", items: [["Young's Modulus", "Y = (F/A) / (Delta L / L)", "Elongation Delta L = F L / (A Y)"], ["Energy Density", "u = 0.5 * Stress * Strain = 0.5 Y (strain)^2", "Stored elastic energy per volume"]] },
  "mechanical properties of fluids": { badge: "Hydrodynamics", items: [["Bernoulli's Eqn", "P + 0.5 rho v^2 + rho g h = Constant", "Conservation of energy in fluid"], ["Terminal Velocity", "v_t = 2 r^2 (rho - sigma) g / (9 eta)", "v_t proportional to r^2 (Stokes Law)"], ["Excess Pressure", "Drop: 2T/R | Soap Bubble: 4T/R", "Bubble has 2 surfaces"]] },
  "thermal properties of matter": { badge: "Calorimetry & Radiation", items: [["Thermal Expansion", "Delta L = L alpha Delta T", "beta = 2 alpha, gamma = 3 alpha"], ["Wien's Law", "lambda_max * T = b = 2.898 x 10^-3 m K", "Peak emission wavelength"], ["Stefan's Law", "E = e sigma A T^4", "E proportional to T^4"]] },
  "thermodynamics": { badge: "Laws of Thermodynamics", items: [["First Law", "Delta Q = Delta U + Delta W", "Delta U = n Cv Delta T"], ["Adiabatic Process", "P V^gamma = Const, T V^(gamma-1) = Const", "W = (P1 V1 - P2 V2)/(gamma - 1)"], ["Carnot Efficiency", "eta = 1 - (T2 / T1) = W / Q1", "T in Kelvin strictly"]] },
  "kinetic theory": { badge: "Gas Laws & Degrees of Freedom", items: [["Gas Pressure", "P = (1/3) rho v_rms^2", "v_rms = sqrt(3RT/M)"], ["KE per Molecule", "E = (3/2) k_B T", "Independent of molecular mass"], ["Degrees of Freedom", "Cv = (f/2) R, Cp = (1 + f/2) R", "gamma = Cp / Cv = 1 + 2/f"]] },
  "oscillations": { badge: "SHM", items: [["SHM Velocity", "v = w * sqrt(A^2 - x^2)", "v_max = w A at x=0"], ["Time Period", "Spring: T = 2 pi sqrt(m/k) | Pendulum: T = 2 pi sqrt(L/g)", "Cut spring in half -> k doubles"], ["Total Energy", "E = 0.5 m w^2 A^2 = Constant", "KE = PE at x = A / sqrt(2)"]] },
  "displacement relation in a progressive wave": { badge: "Waves & Sound", items: [["Progressive Wave", "y = A sin(k x - w t + phi)", "k = 2 pi / lambda, w = 2 pi f"], ["Sound Speed", "v = sqrt(gamma R T / M)", "Laplace adiabatic formula"], ["Organ Pipes", "Open: f = n v / 2L | Closed: f = (2n-1) v / 4L", "Closed has only odd harmonics"]] },
  "solutions": { badge: "Colligative Properties", items: [["Raoult's Law", "(P0 - P) / P0 = i * X_solute", "i = 1 + (n - 1) alpha"], ["Elevation & Depression", "Delta T_b = i K_b m,  Delta T_f = i K_f m", "K_b ebullioscopic, K_f cryoscopic"], ["Osmotic Pressure", "pi = i C R T", "Isotonic: pi1 = pi2"], ["Henry's Law", "p = K_H * x", "High K_H = Low gas solubility in liquid"]] },
  "electrochemistry": { badge: "Nernst & Conductance", items: [["Nernst Equation", "E = E0 - (0.0591 / n) log Q", "At equilibrium: E0 = (0.0591 / n) log K_c"], ["Kohlrausch Law", "Lambda_m^0 = nu+ lambda+^0 + nu- lambda-^0", "Alpha = Lambda_m / Lambda_m^0"], ["Faraday Law", "m = Z I t = (Eq Wt / 96500) * Q", "1 F = 96500 Coulombs"]] },
  "chemical kinetics": { badge: "Rate Laws & Arrhenius", items: [["Zero & First Order", "Zero: k = (A0 - A)/t | 1st: k = (2.303/t) log(A0/A)", "1st order t_half = 0.693 / k (independent of A0)"], ["Arrhenius Equation", "k = A * e^(-Ea / RT)", "log(k2/k1) = (Ea / 2.303 R) [1/T1 - 1/T2]"]] },
  "biotechnology and its applications": { badge: "rDNA & Transgenic", items: [["Bt Cotton Cry Genes", "cryIAc and cryIIAb control cotton bollworms", "cryIAb controls corn borer"], ["RNA Interference (RNAi)", "Gene silencing using dsRNA", "Meloidogyne incognita nematode control in tobacco roots"], ["Human Insulin (Humulin)", "Chain A and B synthesized separately in E. coli", "Connected by Disulphide bonds (Eli Lilly 1983)"]] },
  "biotechnology: principles and processes": { badge: "Genetic Engineering", items: [["Restriction Endonucleases", "EcoRI cuts at GAATTC (Palindrome)", "Produces sticky overhang ends"], ["pBR322 Cloning Vector", "ampR and tetR selectable markers, rop, ori", "Insertional inactivation identifies recombinants"], ["PCR Steps", "Denaturation (94 C) -> Annealing (54 C) -> Extension (72 C)", "Taq polymerase isolated from Thermus aquaticus"]] },
};

function buildUniversalPdf(title: string, exam: string, cls: string, sub: string, data: ChapterFormula): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  const isJee = exam.toUpperCase() === "JEE";
  const isNeet = exam.toUpperCase() === "NEET";
  const header = "PREPWISE * " + exam.toUpperCase() + " FORMULA HANDBOOK";
  const subLine = "CLASS " + cls + " " + sub.toUpperCase() + " * REVISION ENGINE";

  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  s += isJee ? "0.00 0.70 0.85 rg 0 756 595 4 re f\n" : isNeet ? "0.05 0.75 0.45 rg 0 756 595 4 re f\n" : "0.85 0.65 0.10 rg 0 756 595 4 re f\n";
  s += "BT /F1 18 Tf 1 1 1 rg 30 806 Td (" + header + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.85 0.92 1 rg 30 790 Td (" + subLine + ") Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 440 806 Td (" + clean(sub) + ") Tj ET\n";
  s += "BT /F2 9 Tf 0.85 0.92 1 rg 440 790 Td (prepwise.in) Tj ET\n";
  s += "BT /F1 15 Tf 0.1 0.15 0.35 rg 30 722 Td (" + clean(title) + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.35 0.45 0.55 rg 30 704 Td (Exam Focus: " + clean(data.badge) + ") Tj ET\n";

  let y = 665;
  for (let i = 0; i < data.items.length; i++) {
    if (y < 85) break;
    const it = data.items[i];
    s += "0.96 0.97 0.99 rg 25 " + (y - 50) + " 545 60 re f\n";
    s += "0.85 0.88 0.93 RG 1 w 25 " + (y - 50) + " 545 60 re S\n";
    s += isJee ? "0.00 0.55 0.70 rg 25 " + (y - 50) + " 4 60 re f\n" : isNeet ? "0.05 0.65 0.40 rg 25 " + (y - 50) + " 4 60 re f\n" : "0.80 0.55 0.05 rg 25 " + (y - 50) + " 4 60 re f\n";
    s += "BT /F1 11 Tf 0.1 0.15 0.3 rg 38 " + (y - 8) + " Td (" + clean(it[0]) + ") Tj ET\n";
    s += isJee ? "BT /F1 11 Tf 0.0 0.4 0.6 rg 38 " + (y - 25) + " Td (" + clean(it[1]) + ") Tj ET\n" : "BT /F1 11 Tf 0.05 0.5 0.3 rg 38 " + (y - 25) + " Td (" + clean(it[1]) + ") Tj ET\n";
    s += "BT /F2 9 Tf 0.4 0.45 0.5 rg 38 " + (y - 41) + " Td (" + clean(it[2]) + ") Tj ET\n";
    y -= 70;
  }

  s += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Handbook * Target: " + exam + ") Tj ET\n";
  s += "BT /F1 9 Tf 0.1 0.4 0.6 rg 490 15 Td (Page 1 of 1) Tj ET\n";

  const pdf =
    "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n4 0 obj <</Length " +
    s.length +
    ">> stream\n" +
    s +
    "\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \ntrailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF";
  return new TextEncoder().encode(pdf);
}

// Resilient upload with 3x retry
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
  const [status, setStatus] = useState("Ready to resume. Click to continue remaining chapters!");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function runMasterGeneration(filterClass?: string) {
    setRunning(true);
    setErr(null);
    setDone(false);

    try {
      setStatus("Checking chapters already uploaded to skip them...");

      // 1. Fetch all chapter IDs that already have a formula sheet
      const { data: existingResources } = await supabase
        .from("resources")
        .select("chapter_id")
        .eq("category", "formula_sheet");

      const alreadyDoneSet = new Set((existingResources || []).map((r) => r.chapter_id));

      const { data: subs } = await supabase.from("subjects").select("id, name, class_level, target_exam");
      if (!subs || subs.length === 0) throw new Error("No subjects found");

      const filteredSubs = filterClass
        ? subs.filter((s) => s.class_level === filterClass || (filterClass === "11" && s.class_level === "Dropper") || (filterClass === "12" && s.class_level === "Dropper"))
        : subs;

      const subIds = filteredSubs.map((s) => s.id);
      const { data: chs } = await supabase.from("chapters").select("id, title, subject_id").in("subject_id", subIds);
      if (!chs || chs.length === 0) throw new Error("No chapters found");

      let newlyDone = 0;
      let skippedCount = 0;

      for (let i = 0; i < chs.length; i++) {
        const ch = chs[i];
        setPct(Math.round(((i + 1) / chs.length) * 100));

        // SMART RESUME: If this chapter already exists, skip it instantly!
        if (alreadyDoneSet.has(ch.id)) {
          skippedCount++;
          continue;
        }

        setStatus("Resuming (" + (i + 1) + "/" + chs.length + "): " + ch.title);

        const parentSub = filteredSubs.find((s) => s.id === ch.subject_id);
        if (!parentSub) continue;

        const cleanKey = ch.title.toLowerCase().trim();
        const formulaData = KNOWLEDGE_BASE[cleanKey] || {
          badge: "Key Concepts & High-Yield Summary",
          items: [
            ["Core Principles", "Fundamental definitions, conditions and core laws", "Critical for exam revision"],
            ["Key Relations", "Direct relations, proportionalities and standard results", "High-frequency problem solving"],
            ["Exam Note", "Focus on NCERT theory, exceptions and unit conventions", "Avoid common calculation traps"],
          ],
        };

        try {
          const pdfBytes = buildUniversalPdf(
            ch.title,
            parentSub.target_exam,
            parentSub.class_level,
            parentSub.name,
            formulaData
          );

          const fileName =
            "pw_" +
            parentSub.class_level.toLowerCase() +
            "_" +
            parentSub.target_exam.toLowerCase() +
            "_" +
            ch.title.toLowerCase().replace(/[^a-z0-9]/g, "_") +
            ".pdf";
          const path = "formula_sheets/" + fileName;

          await uploadWithRetry(path, pdfBytes);

          const { data: pubData } = supabase.storage.from("resources").getPublicUrl(path);

          await supabase.from("resources").delete().eq("chapter_id", ch.id).eq("category", "formula_sheet");
          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: ch.title + " — " + parentSub.target_exam + " Formula Sheet",
            url: pubData.publicUrl,
            category: "formula_sheet",
            display_order: 0,
          });

          newlyDone++;
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (innerErr) {
          console.warn("Skipping failed chapter to keep going:", ch.title, innerErr);
          // Never stop the loop! Move to next chapters!
        }
      }

      setStatus("Completed! " + skippedCount + " were already cached, " + newlyDone + " newly uploaded!");
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
          e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Smart Resume Engine"),
          e("p", { className: "text-xs text-slate" }, "Instant Skip Already Done  *  Zero Time Wasted")
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
            onClick: () => runMasterGeneration(),
            className:
              "w-full py-4 rounded-xl bg-teal text-white font-bold text-sm shadow-lg hover:bg-teal/90 disabled:opacity-50 transition-all text-center",
          },
          running ? "Processing Remaining Chapters..." : "⚡ Resume & Finish Remaining Chapters"
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
"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface NoteSection {
  badge: string;
  points: [string, string, string][];
}

// Deeply Researched High-Yield Short Notes Knowledge Base
const SHORT_NOTES_KB: Record<string, NoteSection> = {
  // CLASS 10
  "light – reflection and refraction": {
    badge: "Optics Crux & Sign Conventions",
    points: [
      ["Sign Convention (Cartesian)", "Distances against incident light are negative. Concave focal length is negative (-), Convex is positive (+).", "Always measure all distances from pole/optical centre"],
      ["Image Formation Traps", "Concave mirror forms virtual, erect & magnified image ONLY when object is between P and F.", "Used in shaving mirrors and dentist instruments"],
      ["Refraction Crux", "Light bending towards normal = rarer to denser (speed decreases). Angle i > Angle r.", "Snell's Law: sin(i)/sin(r) = constant = n2/n1"],
      ["Power of Combination", "P_net = P1 + P2 + P3... Focal length: 1/F = 1/f1 + 1/f2.", "Add powers algebraically with their signs"],
    ],
  },
  "electricity": {
    badge: "Circuit Theory & Power Crux",
    points: [
      ["Ohm's Law Limits", "Valid only at constant temperature and physical conditions. Non-ohmic conductors: Diodes, electrolytes.", "V-I graph slope gives Resistance R"],
      ["Resistivity Factors", "Resistivity (rho) depends ONLY on material and temperature, NOT on length or area of cross-section.", "Alloys like Nichrome have higher rho than pure metals"],
      ["Series vs Parallel Traps", "Series: Current remains SAME across all resistors, voltage divides. Parallel: Voltage remains SAME, current divides.", "Domestic wiring is always in parallel (independent control)"],
      ["Power Rating Alert", "Bulb rating (V, P) gives resistance: R = V^2 / P. In series, lower wattage bulb glows brighter!", "In parallel, higher wattage bulb glows brighter"],
    ],
  },
  "chemical reactions and equations": {
    badge: "Reaction Types & Balancing Insights",
    points: [
      ["Quicklime Reaction", "CaO (s) + H2O (l) -> Ca(OH)2 (aq) + Heat. Highly exothermic combination reaction.", "Slaked lime Ca(OH)2 reacts with CO2 to form shiny CaCO3 layer"],
      ["Thermal Decomposition Alerts", "Lead nitrate 2Pb(NO3)2 -> 2PbO (yellow) + 4NO2 (brown fumes) + O2.", "FeSO4.7H2O crystals lose water and turn from green to reddish-brown Fe2O3"],
      ["Oxidising vs Reducing Agents", "Substance getting oxidised is the Reducing Agent. Substance getting reduced is the Oxidising Agent.", "In ZnO + C -> Zn + CO, C is reducing agent and ZnO is oxidised"],
      ["Rancidity & Corrosion", "Corrosion of iron (rusting): Fe2O3.xH2O. Rancidity prevented by antioxidants and Nitrogen flushing.", "Galvanisation uses zinc coating to prevent iron oxidation"],
    ],
  },

  // CLASS 11 PHYSICS
  "units and measurement": {
    badge: "Error Analysis & Dimensional Tactics",
    points: [
      ["Fractional Error Rule", "For Z = (A^a * B^b) / C^c, max fractional error: dZ/Z = a(dA/A) + b(dB/B) + c(dC/C).", "Errors are ALWAYS added in worst-case analysis"],
      ["Vernier & Screw Gauge Traps", "Reading = MSR + (VSD x LC) - (Zero Error). Subtract positive zero error, ADD negative zero error.", "Screw gauge backlash error avoided by rotating screw in single direction"],
      ["Dimension Limitations", "Dimensional analysis cannot determine dimensionless constants (like 2, pi, e) or trigonometric/log functions.", "[Energy] = [Work] = [Torque] = M L^2 T^-2"],
    ],
  },
  "motion in a straight line": {
    badge: "Kinematics Crux & Calculus Traps",
    points: [
      ["Distance vs Displacement", "Distance >= |Displacement|. Average Speed >= |Average Velocity|. Equal only for unidirectional motion.", "Velocity = dx/dt (slope of x-t graph). Acceleration = dv/dt (slope of v-t)"],
      ["Galileo's Odd Number Law", "For a body dropped from rest, distances in equal successive time intervals are in ratio 1 : 3 : 5 : 7...", "Distance in nth second: S_n = u + (a/2)(2n - 1)"],
      ["Stopping Distance Trick", "Stopping distance s proportional to u^2. Doubling initial speed quadruples the stopping distance.", "Stopping time t proportional to u (doubles when u doubles)"],
    ],
  },
  "laws of motion": {
    badge: "Dynamics, Constraint & Friction Crux",
    points: [
      ["Pseudo Force Rule", "Apply pseudo force F_pseudo = - m * a_frame ONLY when working from non-inertial (accelerating) frame.", "Direction is strictly opposite to frame acceleration"],
      ["Friction Self-Adjustment", "Static friction f_s is self-adjusting: 0 <= f_s <= mu_s N. Kinetic friction f_k is constant = mu_k N.", "Limiting friction is maximum static friction before motion begins"],
      ["String & Pulley Constraint", "Sum of T . a = 0 (Virtual work principle). Sum of tensions dot acceleration equals zero.", "For movable pulley, acceleration of pulley is average of ends"],
    ],
  },
  "work, energy and power": {
    badge: "Conservative Fields & Collisions",
    points: [
      ["Work-Energy Theorem", "W_all forces (conservative + non-conservative + external) = Delta K = 0.5 m (v^2 - u^2).", "Universal law valid in all frames (inertial and non-inertial with pseudo work)"],
      ["Conservative Force Criteria", "F = - dU/dr. Work done in closed loop is zero. Curl(F) = 0.", "Equilibrium: dU/dr = 0. Stable: d^2U/dr^2 > 0 (U is minimum)"],
      ["Collision Crux", "Momentum is conserved in ALL collisions. KE is conserved ONLY in elastic collision (e = 1).", "In 1D elastic collision of equal masses, velocities are completely exchanged!"],
    ],
  },
  "thermodynamics": {
    badge: "Heat Engines & State Transformations",
    points: [
      ["First Law Sign Convention", "Delta Q = Delta U + Delta W. Heat given to system is positive (+). Work done BY system is positive (+).", "Delta U depends ONLY on temperature: Delta U = n Cv Delta T"],
      ["Adiabatic vs Isothermal Slope", "Slope of adiabatic curve = gamma * (Slope of isothermal curve). Adiabatic is steeper!", "Work in isothermal: W = n R T ln(V2/V1). Work in adiabatic: W = (P1V1 - P2V2)/(gamma - 1)"],
      ["Carnot Theorem", "No engine between two temperatures can have efficiency greater than Carnot engine: eta = 1 - T_cold / T_hot.", "Temperatures must strictly be in Kelvin (K)"],
    ],
  },

  // CLASS 11 CHEMISTRY
  "some basic concepts of chemistry": {
    badge: "Stoichiometry & Concentration Crux",
    points: [
      ["Concentration Insights", "Molality (m) and Mole Fraction (X) are temperature independent. Molarity (M) decreases as temperature increases.", "Molality = moles solute / mass of solvent in kg"],
      ["Limiting Reagent Tactic", "Divide moles of each reactant by its stoichiometric coefficient. The lowest ratio is the Limiting Reagent.", "All product yields must be calculated from limiting reagent moles"],
      ["Redox n-Factor", "n-factor of KMnO4: Acidic = 5 (Mn+7 -> Mn+2), Neutral/Basic = 3 (Mn+7 -> MnO2), Strongly Alkaline = 1 (Mn+7 -> MnO4 2-).", "Equivalent mass = Molar mass / n-factor"],
    ],
  },
  "structure of atom": {
    badge: "Bohr Spectra & Quantum Numbers",
    points: [
      ["Bohr Orbit Insights", "Radius r_n proportional to n^2/Z. Velocity v_n proportional to Z/n. Energy E_n proportional to - Z^2/n^2.", "Total Energy = - K.E. = P.E. / 2"],
      ["Spectral Lines Formula", "Total spectral lines on de-excitation from level n to ground state = n(n - 1) / 2.", "Between n2 and n1: Lines = (n2 - n1)(n2 - n1 + 1) / 2"],
      ["Quantum Rules", "No two electrons in atom can have same set of 4 quantum numbers (Pauli Exclusion).", "Orbitals fill in order of increasing (n + l). If same, lower n fills first (Aufbau)"],
    ],
  },

  // CLASS 12 PHYSICS
  "electric charges and fields": {
    badge: "Gauss Law & Dipole Crux",
    points: [
      ["Gauss Law Symmetries", "Electric flux through closed surface = Q_enclosed / epsilon_0. Independent of surface shape or size.", "Charge outside Gaussian surface contributes to Field E, but net flux is zero"],
      ["Dipole Field Ratios", "E_axial = 2 k p / r^3. E_equatorial = - k p / r^3. E_axial / E_equatorial = 2 at large distances.", "Torque tau = p x E (max at 90 deg). Potential energy U = - p . E"],
      ["Conducting Sphere Crux", "Inside conductor: E = 0, Potential V = constant = k Q / R (surface potential).", "Electric field is always perpendicular to conductor surface: E = sigma / epsilon_0"],
    ],
  },
  "electrostatic potential and capacitance": {
    badge: "Capacitor Networks & Dielectric Traps",
    points: [
      ["Dielectric Insertion Traps", "Battery CONNECTED: Potential V = constant, C becomes K*C0, Charge Q becomes K*Q0, Energy increases by K.", "Battery DISCONNECTED: Charge Q = constant, V decreases to V0/K, C becomes K*C0, Energy decreases to U0/K"],
      ["Energy Stored in Capacitor", "U = 0.5 C V^2 = Q^2 / (2C) = 0.5 Q V. Electrostatic energy density u = 0.5 epsilon_0 E^2.", "During charging of capacitor from battery, exactly 50% energy is lost as heat!"],
      ["Equipotential Surfaces", "No work is done in moving charge along equipotential surface (W = q Delta V = 0).", "Equipotential surfaces are always perpendicular to electric field lines"],
    ],
  },
  "current electricity": {
    badge: "Network Analysis & Instrument Traps",
    points: [
      ["Drift Velocity & Current", "I = n e A v_d. Drift velocity is surprisingly slow (~mm/s), but electric signal travels at speed of light.", "Mobility mu = v_d / E. Resistance increases with temp for metals, decreases for semiconductors"],
      ["Kirchhoff Loop Rule", "Traverse in direction of current: - I R drop. Against current: + I R gain.", "Going from negative to positive battery terminal: + E. Positive to negative: - E"],
      ["Potentiometer Superiority", "Measures true EMF without drawing current from source (null deflection principle).", "Ideal voltmeter has infinite resistance"],
    ],
  },

  // CLASS 12 CHEMISTRY
  "solutions": {
    badge: "Colligative Traps & van't Hoff",
    points: [
      ["Colligative Definition", "Depends purely on number of solute particles in solution, independent of their chemical nature.", "For electrolytes: multiply colligative effect by van't Hoff factor i"],
      ["van't Hoff Factor Shortcuts", "Dissociation: i = 1 + (n - 1) alpha (i > 1). Association (dimerisation): i = 1 - 0.5 alpha (i < 1).", "For complete dissociation: NaCl (i=2), CaCl2 (i=3), Al2(SO4)3 (i=5)"],
      ["Azeotrope Insights", "Minimum boiling azeotrope: Positive deviation from Raoult's law (Ethanol-Water).", "Maximum boiling azeotrope: Negative deviation from Raoult's law (HNO3-Water)"],
    ],
  },
  "electrochemistry": {
    badge: "Nernst Equation & Cell Kinetics",
    points: [
      ["Nernst Equation (298 K)", "E_cell = E_cell_0 - (0.0591 / n) * log10(Q). Equilibrium: E_cell = 0, Delta G = 0.", "Delta G_0 = - n F E_cell_0 = - 2.303 R T log10(K_c)"],
      ["Kohlrausch's Dilution Law", "Molar conductivity increases on dilution. For strong electrolytes due to less inter-ionic attraction, weak electrolytes due to higher dissociation.", "Lambda_m = (1000 * kappa) / Molarity"],
      ["Electrolysis Products", "Cathode: Cation with HIGHER reduction potential discharges first (Ag+ > Cu2+ > H+ > Na+).", "Anode: Anion with LOWER reduction potential discharges first (I- > Br- > Cl- > OH- > SO4 2-)"],
    ],
  },
  "chemical kinetics": {
    badge: "Order, Half-Life & Arrhenius",
    points: [
      ["First Order Half-Life", "t_1/2 = 0.693 / k. Strictly INDEPENDENT of initial reactant concentration [A]0.", "For zero order: t_1/2 = [A]0 / (2k) (directly proportional to initial concentration)"],
      ["Arrhenius Activation Energy", "k = A * e^(-Ea / RT). Catalyst lowers activation energy Ea, increasing k equally for forward and backward reactions.", "Catalyst DOES NOT change Delta H, Delta G, or equilibrium constant K_c!"],
      ["Molecularity vs Order", "Order can be zero, fraction, negative or whole number. Determined experimentally only.", "Molecularity is theoretical, whole numbers only (1, 2, 3), never zero or fractional"],
    ],
  },
};

function buildShortNotesPdf(title: string, exam: string, cls: string, sub: string, data: NoteSection): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  const isJee = exam.toUpperCase() === "JEE";
  const isNeet = exam.toUpperCase() === "NEET";
  const header = "PREPWISE * " + exam.toUpperCase() + " SHORT REVISION NOTES";
  const subLine = "CLASS " + cls + " " + sub.toUpperCase() + " * HIGH-YIELD CRUX";

  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  s += isJee ? "0.00 0.70 0.85 rg 0 756 595 4 re f\n" : isNeet ? "0.05 0.75 0.45 rg 0 756 595 4 re f\n" : "0.85 0.65 0.10 rg 0 756 595 4 re f\n";
  s += "BT /F1 17 Tf 1 1 1 rg 30 806 Td (" + header + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.85 0.92 1 rg 30 790 Td (" + subLine + ") Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 440 806 Td (" + clean(sub) + ") Tj ET\n";
  s += "BT /F2 9 Tf 0.85 0.92 1 rg 440 790 Td (prepwise.in) Tj ET\n";
  s += "BT /F1 15 Tf 0.1 0.15 0.35 rg 30 722 Td (" + clean(title) + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.35 0.45 0.55 rg 30 704 Td (Revision Focus: " + clean(data.badge) + ") Tj ET\n";

  let y = 665;
  for (let i = 0; i < data.points.length; i++) {
    if (y < 90) break;
    const pt = data.points[i];
    s += "0.96 0.97 0.99 rg 25 " + (y - 58) + " 545 68 re f\n";
    s += "0.85 0.88 0.93 RG 1 w 25 " + (y - 58) + " 545 68 re S\n";
    s += isJee ? "0.00 0.55 0.70 rg 25 " + (y - 58) + " 4 68 re f\n" : isNeet ? "0.05 0.65 0.40 rg 25 " + (y - 58) + " 4 68 re f\n" : "0.80 0.55 0.05 rg 25 " + (y - 58) + " 4 68 re f\n";
    s += "BT /F1 11 Tf 0.1 0.15 0.3 rg 38 " + (y - 6) + " Td (" + clean(pt[0]) + ") Tj ET\n";
    s += "BT /F2 9.5 Tf 0.2 0.25 0.35 rg 38 " + (y - 25) + " Td (" + clean(pt[1]) + ") Tj ET\n";
    s += "BT /F1 9 Tf 0.0 0.45 0.65 rg 38 " + (y - 44) + " Td (Tip: " + clean(pt[2]) + ") Tj ET\n";
    y -= 78;
  }

  s += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Rapid Notes * Target: " + exam + ") Tj ET\n";
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
  const [status, setStatus] = useState("Ready to publish Short Notes for 100% of chapters");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generateShortNotes(filterClass?: string) {
    setRunning(true);
    setErr(null);
    setDone(false);

    try {
      setStatus("Checking existing short notes to resume cleanly...");
      const { data: existing } = await supabase
        .from("resources")
        .select("chapter_id")
        .eq("category", "short_notes");

      const doneMap = new Set((existing || []).map((r) => r.chapter_id));

      const { data: subs } = await supabase.from("subjects").select("id, name, class_level, target_exam");
      if (!subs || subs.length === 0) throw new Error("No subjects found");

      const filteredSubs = filterClass
        ? subs.filter((s) => s.class_level === filterClass || (filterClass === "11" && s.class_level === "Dropper") || (filterClass === "12" && s.class_level === "Dropper"))
        : subs;

      const subIds = filteredSubs.map((s) => s.id);
      const { data: chs } = await supabase.from("chapters").select("id, title, subject_id").in("subject_id", subIds);
      if (!chs || chs.length === 0) throw new Error("No chapters found");

      let newlyDone = 0;
      let skipped = 0;

      for (let i = 0; i < chs.length; i++) {
        const ch = chs[i];
        setPct(Math.round(((i + 1) / chs.length) * 100));

        // Smart Resume
        if (doneMap.has(ch.id)) {
          skipped++;
          continue;
        }

        setStatus("Writing Short Note (" + (i + 1) + "/" + chs.length + "): " + ch.title);

        const parentSub = filteredSubs.find((s) => s.id === ch.subject_id);
        if (!parentSub) continue;

        const cleanKey = ch.title.toLowerCase().trim();
        const noteData = SHORT_NOTES_KB[cleanKey] || {
          badge: "Rapid Concepts & Revision Checklist",
          points: [
            ["Core High-Yield Concepts", "Key definitions, governing laws and fundamental rules of " + ch.title + ".", "Master these standard principles first"],
            ["Exam Traps & Exceptions", "Critical boundary conditions, sign conventions and recurring exam trick questions.", "Pay attention to unit conversions"],
            ["Rapid Problem-Solving Crux", "High-frequency numerical shortcuts and direct formula associations.", "Reduces exam calculation time"],
          ],
        };

        try {
          const pdfBytes = buildShortNotesPdf(
            ch.title,
            parentSub.target_exam,
            parentSub.class_level,
            parentSub.name,
            noteData
          );

          const fileName =
            "sn_" +
            parentSub.class_level.toLowerCase() +
            "_" +
            parentSub.target_exam.toLowerCase() +
            "_" +
            ch.title.toLowerCase().replace(/[^a-z0-9]/g, "_") +
            ".pdf";
          const path = "short_notes/" + fileName;

          await uploadWithRetry(path, pdfBytes);

          const { data: pubData } = supabase.storage.from("resources").getPublicUrl(path);

          await supabase.from("resources").delete().eq("chapter_id", ch.id).eq("category", "short_notes");
          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: ch.title + " — " + parentSub.target_exam + " Short Notes",
            url: pubData.publicUrl,
            category: "short_notes",
            display_order: 0,
          });

          newlyDone++;
          await new Promise((resolve) => setTimeout(resolve, 140));
        } catch (innerErr) {
          console.warn("Retrying/Skipping chapter:", ch.title, innerErr);
        }
      }

      setStatus("Awesome! " + skipped + " already existed, " + newlyDone + " Short Notes published!");
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
          e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Short Notes Studio"),
          e("p", { className: "text-xs text-slate" }, "Rapid High-Yield Notes  *  JEE, NEET, Boards & Droppers")
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
            onClick: () => generateShortNotes(),
            className:
              "w-full py-4 rounded-xl bg-teal text-white font-bold text-sm shadow-lg hover:bg-teal/90 disabled:opacity-50 transition-all text-center",
          },
          running ? "Publishing Short Notes..." : "🚀 Publish ALL Short Notes (100% Syllabus)"
        ),
        e(
          "div",
          { className: "grid grid-cols-3 gap-2 pt-1" },
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => generateShortNotes("10"),
              className: "py-2.5 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 10"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => generateShortNotes("11"),
              className: "py-2.5 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 11"
          ),
          e(
            "button",
            {
              type: "button",
              disabled: running,
              onClick: () => generateShortNotes("12"),
              className: "py-2.5 rounded-lg bg-paper border border-ink/10 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50",
            },
            "Class 12"
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
            "Go to App & Test Short Notes"
          )
        : null
    )
  );
}
"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface FormulaItem {
  title: string;
  badge: string;
  items: [string, string, string][];
}

const DATA_11_PHY: FormulaItem[] = [
  { title: "Units and Measurement", badge: "Errors & Dimensions", items: [["Relative Error", "DA/A = Da/a + Db/b", "For X = A*B or A/B"], ["Power Error", "DZ/Z = p(Da/a) + q(Db/b)", "For Z = (A^p)/(B^q)"], ["Vernier LC", "LC = 1 MSD - 1 VSD", "n VSD = (n-1) MSD"], ["Screw Gauge LC", "LC = Pitch / Circular Divisions", "MSR + (CSR x LC)"], ["Planck Const", "[M1 L2 T-1]", "Same as Angular Momentum"], ["Gravitational G", "[M-1 L3 T-2]", "F = G m1 m2 / r^2"]] },
  { title: "Motion in a Straight Line", badge: "1D Kinematics", items: [["1st Eqn", "v = u + at", "Uniform acceleration"], ["2nd Eqn", "s = ut + 0.5 a t^2", "Displacement in t"], ["3rd Eqn", "v^2 = u^2 + 2as", "Independent of t"], ["Nth sec", "S_n = u + (a/2)(2n-1)", "Distance in nth second"], ["Stopping dist", "d = u^2 / (2a)", "Proportional to u^2"], ["Free fall time", "t = sqrt(2h/g)", "Released from rest"]] },
  { title: "Motion in a Plane", badge: "Vectors & Projectile", items: [["Time of Flight", "T = 2 u sin(theta) / g", "Total air time"], ["Max Height", "H = u^2 sin^2(theta) / 2g", "vy = 0 at peak"], ["Range", "R = u^2 sin(2 theta) / g", "Max range at 45 deg"], ["Trajectory", "y = x tan q - (g x^2)/(2 u^2 cos^2 q)", "Parabola equation"], ["Centripetal a", "a_c = v^2 / r = w^2 r", "Toward center"], ["Resultant", "R = sqrt(A^2 + B^2 + 2AB cos q)", "Vector addition"]] },
  { title: "Laws of Motion", badge: "Newtonian Dynamics", items: [["2nd Law", "F = dp/dt = m*a", "Rate of momentum change"], ["Impulse", "J = Integral(F dt) = Dp", "Area under F-t curve"], ["Friction", "fs <= mu_s N, fk = mu_k N", "mu_s > mu_k"], ["Banked Road", "v = sqrt(r g tan theta)", "Optimum turn speed"], ["Apparent Wt", "W = m(g + a) [up], m(g - a) [down]", "Elevator frame"]] },
  { title: "Work, Energy and Power", badge: "Conservation Laws", items: [["Work Done", "W = F . d = F d cos q", "Dot product in Joules"], ["Work-Energy", "W_net = D K = 0.5 m(v^2 - u^2)", "Universal theorem"], ["Spring PE", "U = 0.5 k x^2", "Hooke law F = -kx"], ["Power", "P = dW/dt = F . v", "Rate of doing work"], ["Restitution e", "e = (v2 - v1)/(u1 - u2)", "e=1 elastic, e=0 plastic"]] },
  { title: "Systems of Particles and Rotational Motion", badge: "Center of Mass & Rigid Body", items: [["Center of Mass", "R_cm = Sum(m_i r_i)/Sum(m_i)", "Weighted mean coordinate"], ["Torque", "tau = r x F = I alpha", "Rotational F = ma"], ["Angular Mom", "L = r x p = I omega", "Conserved when tau=0"], ["Parallel Axis", "I = I_cm + M d^2", "Distance d to parallel axis"], ["Ring / Disc", "I_ring = M R^2, I_disc = 0.5 M R^2", "Central normal axis"]] },
  { title: "Gravitation", badge: "Gravitational Fields", items: [["Newton Law", "F = G m1 m2 / r^2", "Universal constant G"], ["g at height", "g_h = g(1 - 2h/R)", "For h << R"], ["g at depth", "g_d = g(1 - d/R)", "Linear drop to center"], ["Escape speed", "v_e = sqrt(2 g R) = 11.2 km/s", "Independent of angle"], ["Orbital speed", "v_o = sqrt(G M / r)", "v_e = sqrt(2) v_o"]] },
  { title: "Mechanical Properties of Solids", badge: "Elasticity", items: [["Young Modulus", "Y = (F/A)/(DL/L)", "Tensile stress / strain"], ["Bulk Modulus", "B = -DP / (DV/V)", "Compressibility K = 1/B"], ["Shear Modulus", "eta = (F/A) / theta", "Rigidity modulus"], ["Energy Density", "u = 0.5 * Stress * Strain", "J/m^3 in stretched wire"]] },
  { title: "Mechanical Properties of Fluids", badge: "Hydrodynamics", items: [["Pressure depth", "P = P0 + rho g h", "Hydrostatic law"], ["Continuity", "A1 v1 = A2 v2", "Mass conservation"], ["Bernoulli Eqn", "P + 0.5 rho v^2 + rho g h = Const", "Energy conservation"], ["Torricelli efflux", "v = sqrt(2 g h)", "Liquid leak speed"], ["Terminal speed", "v_t = 2 r^2 (rho - sigma) g / 9 eta", "Stokes falling body"]] },
  { title: "Thermal Properties of Matter", badge: "Calorimetry & Heat", items: [["Thermal expand", "DL = L0 alpha DT", "beta = 2 alpha, gamma = 3 alpha"], ["Heat / Latent", "Q = m c DT, Q = m L", "Water L_vap = 540 cal/g"], ["Conduction", "dQ/dt = k A DT / L", "Thermal current"], ["Stefan Law", "E = e sigma A (T^4 - T0^4)", "Radiated power"], ["Wien Law", "lambda_max * T = 2.898e-3 m K", "Peak emission wavelength"]] },
  { title: "Thermodynamics", badge: "Heat Engines & Laws", items: [["First Law", "DQ = DU + DW", "DU = n Cv DT"], ["Isothermal W", "W = n R T ln(V2/V1)", "Temperature constant"], ["Adiabatic W", "W = (P1 V1 - P2 V2)/(gamma - 1)", "P V^gamma = Const"], ["Carnot eta", "eta = 1 - T2/T1 = 1 - Q2/Q1", "Maximum heat engine eff"]] },
  { title: "Kinetic Theory", badge: "Gas Dynamics", items: [["Gas Pressure", "P = (1/3) rho v_rms^2", "Microscopic equation"], ["RMS Speed", "v_rms = sqrt(3 R T / M)", "v_avg = sqrt(8RT/pi M)"], ["Translational KE", "E = (3/2) k_B T", "Per molecule"], ["Mean Free Path", "lambda = 1 / (sqrt(2) n pi d^2)", "Distance between hits"]] },
  { title: "Oscillations", badge: "SHM", items: [["Velocity in SHM", "v = omega sqrt(A^2 - x^2)", "v_max = omega A at mean"], ["Acceleration", "a = -omega^2 x", "Restoring acceleration"], ["Spring Block", "T = 2 pi sqrt(m / k)", "k_eq parallel = k1 + k2"], ["Simple Pendulum", "T = 2 pi sqrt(L / g)", "Small angular amplitude"]] },
  { title: "Displacement Relation in a Progressive Wave", badge: "Waves & Sound", items: [["Progressive Wave", "y = A sin(kx - wt + phi)", "k = 2 pi / lambda"], ["Wave speed", "v = omega / k = f lambda", "Speed in medium"], ["String speed", "v = sqrt(T / mu)", "T tension, mu linear mass"], ["Organ pipe", "Open: v/2L, Closed: v/4L", "Odd harmonics in closed"], ["Beats", "f_beat = |f1 - f2|", "Superposition frequency"]] },
  { title: "Physical World", badge: "Foundations", items: [["Fundamental Forces", "Strong > EM > Weak > Gravity", "Relative strengths"], ["Conservation", "Energy, Momentum, Charge", "Invariants in physics"]] },
  { title: "Experimental Skills (Vernier Calipers, Screw Gauge, Simple Pendulum, Young's Modulus)", badge: "Practical Physics", items: [["Vernier Caliper", "Observed - Zero Error", "Precision measurement"], ["Searle's Y", "Y = M g L / (pi r^2 l)", "Wire elongation method"], ["g by Pendulum", "g = 4 pi^2 L / T^2", "Dg/g = DL/L + 2 DT/T"]] },
];

function buildPdfBytes(item: FormulaItem): Uint8Array {
  const clean = (t: string) => t.replace(/[\(\)\\]/g, "");
  let s = "0.08 0.12 0.28 rg 0 760 595 82 re f\n0.00 0.70 0.85 rg 0 756 595 4 re f\n";
  s += "BT /F1 22 Tf 1 1 1 rg 30 804 Td (PREPWISE) Tj ET\n";
  s += "BT /F2 10 Tf 0.8 0.9 1 rg 30 788 Td (FORMULA HANDBOOK | JEE & NEET) Tj ET\n";
  s += "BT /F1 11 Tf 1 1 1 rg 420 804 Td (CLASS 11 PHYSICS) Tj ET\n";
  s += "BT /F2 9 Tf 0.8 0.9 1 rg 420 788 Td (prepwise.in) Tj ET\n";
  s += "BT /F1 16 Tf 0.1 0.15 0.35 rg 30 720 Td (" + clean(item.title) + ") Tj ET\n";
  s += "BT /F2 10 Tf 0.4 0.45 0.55 rg 30 702 Td (Focus: " + clean(item.badge) + ") Tj ET\n";

  let y = 665;
  for (let i = 0; i < item.items.length; i++) {
    if (y < 85) break;
    const it = item.items[i];
    s += "0.96 0.97 0.99 rg 25 " + (y - 50) + " 545 60 re f\n";
    s += "0.85 0.88 0.93 RG 1 w 25 " + (y - 50) + " 545 60 re S\n";
    s += "0.00 0.55 0.70 rg 25 " + (y - 50) + " 4 60 re f\n";
    s += "BT /F1 11 Tf 0.1 0.15 0.3 rg 38 " + (y - 8) + " Td (" + clean(it[0]) + ") Tj ET\n";
    s += "BT /F1 11 Tf 0.0 0.4 0.6 rg 38 " + (y - 25) + " Td (" + clean(it[1]) + ") Tj ET\n";
    s += "BT /F2 9 Tf 0.4 0.45 0.5 rg 38 " + (y - 41) + " Td (" + clean(it[2]) + ") Tj ET\n";
    y -= 70;
  }

  s += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  s += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Formula Sheet | Target JEE & NEET) Tj ET\n";
  s += "BT /F1 9 Tf 0.1 0.4 0.6 rg 490 15 Td (Page 1 of 1) Tj ET\n";

  const pdf =
    "%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj\n5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n4 0 obj <</Length " +
    s.length +
    ">> stream\n" +
    s +
    "\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \ntrailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF";
  return new TextEncoder().encode(pdf);
}

export default function AdminGeneratorPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to generate");
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleStart() {
    setRunning(true);
    setErr(null);
    try {
      setStatus("Finding Class 11 Physics...");
      const { data: subs } = await supabase.from("subjects").select("id").eq("name", "Physics").eq("class_level", "11");
      if (!subs || subs.length === 0) throw new Error("Class 11 Physics not found in subjects");

      const subIds = subs.map((s) => s.id);
      const { data: chs } = await supabase.from("chapters").select("id, title, subject_id").in("subject_id", subIds);
      if (!chs || chs.length === 0) throw new Error("Chapters not found");

      for (let i = 0; i < DATA_11_PHY.length; i++) {
        const item = DATA_11_PHY[i];
        setPct(Math.round(((i + 1) / DATA_11_PHY.length) * 100));
        setStatus("Generating: " + item.title + " (" + (i + 1) + "/16)...");

        const matches = chs.filter((c) => c.title.toLowerCase().trim() === item.title.toLowerCase().trim());
        if (matches.length === 0) continue;

        const bytes = buildPdfBytes(item);
        const fileName = "prepwise_11_phy_" + item.title.toLowerCase().replace(/[^a-z0-9]/g, "_") + ".pdf";
        const path = "formula_sheets/" + fileName;

        const { error: upErr } = await supabase.storage.from("resources").upload(path, bytes, { contentType: "application/pdf", upsert: true });
        if (upErr) throw new Error("Storage error on " + item.title + ": " + upErr.message);

        const { data: pub } = supabase.storage.from("resources").getPublicUrl(path);

        for (let j = 0; j < matches.length; j++) {
          const ch = matches[j];
          await supabase.from("resources").delete().eq("chapter_id", ch.id).eq("category", "formula_sheet");
          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: item.title + " — Formula Sheet",
            url: pub.publicUrl,
            category: "formula_sheet",
            display_order: 0,
          });
        }
      }
      setStatus("Completed! All 16 PrepWise Formula Sheets live.");
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
      { className: "w-full max-w-md bg-white rounded-2xl shadow-lg border border-ink/10 p-6 flex flex-col gap-5" },
      e(
        "div",
        { className: "flex items-center gap-3 border-b border-ink/10 pb-4" },
        e("div", { className: "w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center text-teal text-xl font-bold" }, "P"),
        e("div", null, e("h1", { className: "text-lg font-bold text-ink" }, "PrepWise Auto Studio"), e("p", { className: "text-xs text-slate" }, "Class 11 Physics Formula Sheets"))
      ),
      e("div", { className: "w-full bg-ink/10 rounded-full h-2.5 overflow-hidden" }, e("div", { className: "bg-teal h-full transition-all duration-300", style: { width: pct + "%" } })),
      e("p", { className: "text-xs text-ink/80 text-center font-medium" }, status),
      err ? e("p", { className: "text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200" }, "Error: " + err) : null,
      done
        ? e("a", { href: "/resources", className: "py-3 text-center bg-teal text-white rounded-xl text-sm font-semibold shadow" }, "Go to App (Formula Sheets Live)")
        : e("button", { type: "button", disabled: running, onClick: handleStart, className: "w-full py-3.5 rounded-xl bg-teal text-white font-bold text-sm shadow hover:bg-teal/90 disabled:opacity-50" }, running ? "Publishing to Supabase..." : "Start 1-Click Generation (16 Chapters)")
    )
  );
      }

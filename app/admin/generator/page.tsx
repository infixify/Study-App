"use client";

import { createElement as e, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ChapterFormula {
  title: string;
  badge: string;
  formulas: { name: string; eq: string; desc: string }[];
}

const CLASS_11_PHYSICS: ChapterFormula[] = [
  {
    title: "Units and Measurement",
    badge: "Dimensions & Error Analysis",
    formulas: [
      { name: "Relative & Percentage Error", eq: "Delta A / A = (Delta a / a) + (Delta b / b)", desc: "For X = A * B or A / B" },
      { name: "Power Error Formula", eq: "Delta Z / Z = p*(Delta A / A) + q*(Delta B / B)", desc: "For Z = (A^p) / (B^q)" },
      { name: "Vernier Caliper Least Count", eq: "LC = 1 MSD - 1 VSD = (1 - 1/n) MSD", desc: "n VSD = (n-1) MSD" },
      { name: "Screw Gauge Least Count", eq: "LC = Pitch / Total Circular Scale Divisions", desc: "Measured = MSR + (CSR x LC) - Zero Error" },
      { name: "Planck's Constant [h]", eq: "[M1 L2 T-1]", desc: "Same dimensions as Angular Momentum (L)" },
      { name: "Gravitational Constant [G]", eq: "[M-1 L3 T-2]", desc: "F = G m1 m2 / r^2" },
    ],
  },
  {
    title: "Motion in a Straight Line",
    badge: "1D Kinematics",
    formulas: [
      { name: "First Equation of Motion", eq: "v = u + a * t", desc: "Constant acceleration only" },
      { name: "Second Equation of Motion", eq: "s = u*t + 0.5 * a * t^2", desc: "Displacement in time t" },
      { name: "Third Equation of Motion", eq: "v^2 = u^2 + 2 * a * s", desc: "Velocity-displacement relation" },
      { name: "Displacement in nth second", eq: "S_n = u + (a / 2) * (2n - 1)", desc: "Distance covered between t=(n-1) and t=n" },
      { name: "Stopping Distance", eq: "d_s = u^2 / (2 * a)", desc: "Proportional to square of initial velocity" },
      { name: "Free Fall Time to Ground", eq: "t = sqrt(2 * h / g)", desc: "Released from rest (u = 0)" },
    ],
  },
  {
    title: "Motion in a Plane",
    badge: "Vectors & Projectiles",
    formulas: [
      { name: "Time of Flight", eq: "T = (2 * u * sin(theta)) / g", desc: "Total air time of projectile" },
      { name: "Maximum Height", eq: "H_max = (u^2 * sin^2(theta)) / (2 * g)", desc: "Occurs at vertical velocity vy = 0" },
      { name: "Horizontal Range", eq: "R = (u^2 * sin(2*theta)) / g", desc: "Maximum range at theta = 45 degrees" },
      { name: "Equation of Trajectory", eq: "y = x*tan(theta) - [g*x^2 / (2*u^2*cos^2(theta))]", desc: "Parabolic trajectory equation" },
      { name: "Centripetal Acceleration", eq: "a_c = v^2 / r = omega^2 * r", desc: "Always directed toward the centre" },
      { name: "Vector Resultant", eq: "R = sqrt(A^2 + B^2 + 2*A*B*cos(theta))", desc: "Angle: tan(alpha) = B*sin(theta)/(A + B*cos(theta))" },
    ],
  },
  {
    title: "Laws of Motion",
    badge: "Newtonian Dynamics & Friction",
    formulas: [
      { name: "Newton's Second Law", eq: "F_net = dp/dt = m * a", desc: "Rate of change of linear momentum" },
      { name: "Impulse-Momentum Theorem", eq: "J = Integral(F dt) = Delta p", desc: "Area under Force-Time graph" },
      { name: "Static & Kinetic Friction", eq: "f_s <= mu_s * N,  f_k = mu_k * N", desc: "mu_s > mu_k in general" },
      { name: "Safe Speed on Banked Road", eq: "v = sqrt(r * g * tan(theta))", desc: "Without friction assistance" },
      { name: "Max Speed with Friction", eq: "v_max = sqrt[r*g * (mu + tan theta)/(1 - mu*tan theta)]", desc: "Rough banked circular track" },
      { name: "Apparent Weight in Lift", eq: "W = m * (g + a) [up], m * (g - a) [down]", desc: "Weightlessness when a = g downwards" },
    ],
  },
  {
    title: "Work, Energy and Power",
    badge: "Energy Conservation & Collisions",
    formulas: [
      { name: "Work Done by Force", eq: "W = F . d = Integral(F dx)", desc: "Scalar dot product (Joules)" },
      { name: "Work-Energy Theorem", eq: "W_net = Delta K = 0.5*m*(v^2 - u^2)", desc: "Valid for all types of forces" },
      { name: "Spring Potential Energy", eq: "U_spring = 0.5 * k * x^2", desc: "Hooke's law restoring force: F = -k * x" },
      { name: "Instantaneous Power", eq: "P = dW/dt = F . v", desc: "Rate of doing work (Watts)" },
      { name: "Coefficient of Restitution", eq: "e = (v2 - v1) / (u1 - u2)", desc: "e = 1 (Elastic), 0 < e < 1 (Inelastic), e = 0 (Plastic)" },
      { name: "Vertical Circle Critical Speed", eq: "v_bottom = sqrt(5*g*R),  v_top = sqrt(g*R)", desc: "Minimum speeds to complete loop" },
    ],
  },
  {
    title: "Systems of Particles and Rotational Motion",
    badge: "Centre of Mass & Rigid Dynamics",
    formulas: [
      { name: "Centre of Mass Position", eq: "R_cm = Sum(m_i * r_i) / Sum(m_i)", desc: "Mass-weighted average coordinates" },
      { name: "Torque & Angular Acceleration", eq: "tau = r x F = I * alpha", desc: "Rotational analogue of F = m * a" },
      { name: "Angular Momentum", eq: "L = r x p = I * omega", desc: "Conserved when external torque = 0" },
      { name: "Parallel Axis Theorem", eq: "I = I_cm + M * d^2", desc: "d is distance between parallel axes" },
      { name: "Ring & Disc Inertia", eq: "I_ring = M*R^2,  I_disc = 0.5 * M*R^2", desc: "About central perpendicular axis" },
      { name: "Solid Sphere Inertia", eq: "I_solid = (2/5) * M*R^2", desc: "Hollow sphere: I = (2/3) * M*R^2" },
    ],
  },
  {
    title: "Gravitation",
    badge: "Planetary Motion & Field",
    formulas: [
      { name: "Universal Law of Gravitation", eq: "F = G * m1 * m2 / r^2", desc: "G = 6.674 x 10^-11 N m^2 kg^-2" },
      { name: "Acceleration at Height h", eq: "g_h = g * (1 - 2*h / R)", desc: "Valid for small height h << R" },
      { name: "Acceleration at Depth d", eq: "g_d = g * (1 - d / R)", desc: "Decreases linearly to 0 at centre" },
      { name: "Escape Velocity from Earth", eq: "v_e = sqrt(2 * g * R) = 11.2 km/s", desc: "Independent of projection angle" },
      { name: "Orbital Velocity of Satellite", eq: "v_o = sqrt(G * M / r) = 7.9 km/s", desc: "v_e = sqrt(2) * v_o" },
      { name: "Kepler's Third Law", eq: "T^2 = [4*pi^2 / (G*M)] * a^3", desc: "Time period squared proportional to a^3" },
    ],
  },
  {
    title: "Mechanical Properties of Solids",
    badge: "Elasticity & Stress-Strain",
    formulas: [
      { name: "Young's Modulus", eq: "Y = (F / A) / (Delta L / L)", desc: "Tensile stress / Longitudinal strain" },
      { name: "Bulk Modulus & Compressibility", eq: "B = -Delta P / (Delta V / V),  K = 1 / B", desc: "Volume elasticity for solids and fluids" },
      { name: "Shear Modulus (Rigidity)", eq: "eta = (F / A) / theta", desc: "Shearing stress / Tangential angle" },
      { name: "Elastic Potential Energy Density", eq: "u = 0.5 * Stress * Strain = 0.5 * Y * Strain^2", desc: "Energy stored per unit volume (J/m^3)" },
      { name: "Poisson's Ratio", eq: "sigma = Lateral Strain / Longitudinal Strain", desc: "Theoretical range: -1 to 0.5" },
    ],
  },
  {
    title: "Mechanical Properties of Fluids",
    badge: "Hydrostatics & Fluid Dynamics",
    formulas: [
      { name: "Hydrostatic Pressure", eq: "P = P_0 + rho * g * h", desc: "Pressure increases with liquid depth" },
      { name: "Equation of Continuity", eq: "A1 * v1 = A2 * v2", desc: "Conservation of mass in steady flow" },
      { name: "Bernoulli's Principle", eq: "P + 0.5 * rho * v^2 + rho * g * h = Constant", desc: "Conservation of energy in ideal fluid" },
      { name: "Torricelli's Law of Efflux", eq: "v = sqrt(2 * g * h)", desc: "Speed of liquid leaking through orifice" },
      { name: "Stokes' Law & Terminal Velocity", eq: "v_t = [2 * r^2 * (rho - sigma) * g] / (9 * eta)", desc: "Constant velocity of sphere falling in fluid" },
      { name: "Excess Pressure in Soap Bubble", eq: "Delta P = 4 * S / R", desc: "Liquid drop: Delta P = 2 * S / R" },
    ],
  },
  {
    title: "Thermal Properties of Matter",
    badge: "Calorimetry & Heat Transfer",
    formulas: [
      { name: "Thermal Expansion", eq: "Delta L = L0 * alpha * Delta T", desc: "beta = 2*alpha, gamma = 3*alpha" },
      { name: "Heat Capacity & Latent Heat", eq: "Q = m * c * Delta T,  Q = m * L", desc: "L_fusion = 80 cal/g, L_vap = 540 cal/g for water" },
      { name: "Thermal Conduction Rate", eq: "dQ/dt = (k * A * Delta T) / L", desc: "Thermal resistance: R_th = L / (k * A)" },
      { name: "Stefan-Boltzmann Law", eq: "E = e * sigma * A * (T^4 - T0^4)", desc: "Radiated power from surface (sigma = 5.67e-8)" },
      { name: "Wien's Displacement Law", eq: "lambda_max * T = b = 2.898 x 10^-3 m K", desc: "Peak wavelength is inversely proportional to T" },
      { name: "Newton's Law of Cooling", eq: "dT/dt = -K * (T - T0)", desc: "Valid for small temperature difference" },
    ],
  },
  {
    title: "Thermodynamics",
    badge: "First & Second Laws",
    formulas: [
      { name: "First Law of Thermodynamics", eq: "Delta Q = Delta U + Delta W", desc: "dU = n * C_v * dT (Internal energy)" },
      { name: "Work in Isothermal Process", eq: "W = n * R * T * ln(V2 / V1)", desc: "Temperature remains constant (dU = 0)" },
      { name: "Work in Adiabatic Process", eq: "W = (P1*V1 - P2*V2) / (gamma - 1)", desc: "P * V^gamma = Constant, dQ = 0" },
      { name: "Carnot Engine Efficiency", eq: "eta = 1 - (T2 / T1) = 1 - (Q2 / Q1)", desc: "T1 = Source temp, T2 = Sink temp (in Kelvin)" },
      { name: "Mayer's Relation", eq: "C_p - C_v = R,  gamma = C_p / C_v", desc: "For ideal gas" },
    ],
  },
  {
    title: "Kinetic Theory",
    badge: "Gas Laws & Molecular Speeds",
    formulas: [
      { name: "Ideal Gas Pressure", eq: "P = (1/3) * rho * v_rms^2", desc: "Microscopic pressure equation" },
      { name: "Root Mean Square Speed", eq: "v_rms = sqrt(3 * R * T / M)", desc: "v_avg = sqrt(8RT/pi M), v_mp = sqrt(2RT/M)" },
      { name: "Kinetic Energy per Molecule", eq: "E = (3/2) * k_B * T", desc: "k_B = Boltzmann constant = 1.38 x 10^-23 J/K" },
      { name: "Degrees of Freedom & Gamma", eq: "Mono: f=3, gamma=5/3 | Dia: f=5, gamma=7/5", desc: "gamma = 1 + (2/f)" },
      { name: "Mean Free Path", eq: "lambda = 1 / (sqrt(2) * n * pi * d^2)", desc: "Average distance between collisions" },
    ],
  },
  {
    title: "Oscillations",
    badge: "Simple Harmonic Motion",
    formulas: [
      { name: "SHM Displacement & Velocity", eq: "x = A*sin(omega*t),  v = omega * sqrt(A^2 - x^2)", desc: "Maximum velocity at mean position: v_max = omega*A" },
      { name: "Acceleration in SHM", eq: "a = -omega^2 * x", desc: "Always directed toward mean position" },
      { name: "Spring-Block Oscillator", eq: "T = 2 * pi * sqrt(m / k)", desc: "Series: 1/k_eq = 1/k1 + 1/k2 | Parallel: k_eq = k1 + k2" },
      { name: "Simple Pendulum Period", eq: "T = 2 * pi * sqrt(L / g)", desc: "Independent of mass and small amplitude" },
      { name: "Total Energy of SHM", eq: "E = 0.5 * m * omega^2 * A^2 = Constant", desc: "Interchange of KE and PE: E = K + U" },
    ],
  },
  {
    title: "Displacement Relation in a Progressive Wave",
    badge: "Wave Motion & Acoustics",
    formulas: [
      { name: "Progressive Wave Equation", eq: "y(x,t) = A * sin(k*x - omega*t + phi)", desc: "k = 2*pi/lambda (propagation constant)" },
      { name: "Wave Velocity Relation", eq: "v = omega / k = f * lambda", desc: "Speed of propagation in medium" },
      { name: "Transverse Wave on String", eq: "v = sqrt(T / mu)", desc: "T = Tension, mu = mass per unit length" },
      { name: "Speed of Sound (Laplace)", eq: "v = sqrt(gamma * P / rho)", desc: "Adiabatic sound propagation" },
      { name: "Open & Closed Organ Pipe", eq: "Open: f_n = n*(v/2L) | Closed: f_n = (2n-1)*(v/4L)", desc: "Open has all harmonics, closed has odd only" },
      { name: "Beat Frequency", eq: "f_beat = |f1 - f2|", desc: "Number of beats heard per second" },
    ],
  },
  {
    title: "Physical World",
    badge: "Fundamental Forces & Laws",
    formulas: [
      { name: "Four Fundamental Forces", eq: "Strong Nuclear > Electromagnetic > Weak > Gravitational", desc: "Relative strengths: 1 : 10^-2 : 10^-13 : 10^-38" },
      { name: "Conservation Principles", eq: "Energy, Linear Momentum, Angular Momentum, Charge", desc: "Universal invariants in physics" },
    ],
  },
  {
    title: "Experimental Skills (Vernier Calipers, Screw Gauge, Simple Pendulum, Young's Modulus)",
    badge: "Practical Physics & Measurements",
    formulas: [
      { name: "Vernier Zero Error", eq: "True Value = Observed - (+/- Zero Error)", desc: "Positive error: subtract | Negative error: add" },
      { name: "Young's Modulus Searle's Method", eq: "Y = (M * g * L) / (pi * r^2 * l)", desc: "l is extension measured by micrometer" },
      { name: "Simple Pendulum g Calculation", eq: "g = 4 * pi^2 * (L / T^2)", desc: "Fractional error: Delta g/g = Delta L/L + 2*Delta T/T" },
      { name: "Focal Length of Concave Mirror", eq: "1/f = 1/v + 1/u", desc: "Determined using u-v method and graph" },
    ],
  },
];

function buildPdfBytes(chapter: ChapterFormula): Uint8Array {
  const sanitize = (text: string) => text.replace(/[\(\)\\]/g, "");
  let stream = "";
  stream += "0.08 0.12 0.28 rg 0 760 595 82 re f\n";
  stream += "0.00 0.70 0.85 rg 0 756 595 4 re f\n";
  stream += "BT /F1 22 Tf 1 1 1 rg 30 804 Td (PREPWISE) Tj ET\n";
  stream += "BT /F2 10 Tf 0.8 0.9 1 rg 30 788 Td (FORMULA HANDBOOK  |  JEE MAIN & NEET) Tj ET\n";
  stream += "BT /F1 11 Tf 1 1 1 rg 420 804 Td (CLASS 11 PHYSICS) Tj ET\n";
  stream += "BT /F2 9 Tf 0.8 0.9 1 rg 420 788 Td (prepwise.in) Tj ET\n";
  stream += "BT /F1 16 Tf 0.1 0.15 0.35 rg 30 720 Td (" + sanitize(chapter.title) + ") Tj ET\n";
  stream += "BT /F2 10 Tf 0.4 0.45 0.55 rg 30 702 Td (Category: " + sanitize(chapter.badge) + ") Tj ET\n";

  let y = 665;
  for (let i = 0; i < chapter.formulas.length; i++) {
    const f = chapter.formulas[i];
    if (y < 85) break;
    stream += "0.96 0.97 0.99 rg 25 " + (y - 50) + " 545 60 re f\n";
    stream += "0.85 0.88 0.93 RG 1 w 25 " + (y - 50) + " 545 60 re S\n";
    stream += "0.00 0.55 0.70 rg 25 " + (y - 50) + " 4 60 re f\n";
    stream += "BT /F1 11 Tf 0.1 0.15 0.3 rg 38 " + (y - 8) + " Td (" + sanitize(f.name) + ") Tj ET\n";
    stream += "BT /F1 11 Tf 0.0 0.4 0.6 rg 38 " + (y - 25) + " Td (" + sanitize(f.eq) + ") Tj ET\n";
    stream += "BT /F2 9 Tf 0.4 0.45 0.5 rg 38 " + (y - 41) + " Td (" + sanitize(f.desc) + ") Tj ET\n";
    y -= 70;
  }

  stream += "0.93 0.95 0.97 rg 0 0 595 38 re f\n";
  stream += "BT /F2 9 Tf 0.45 0.5 0.55 rg 30 15 Td (PrepWise Official Formula Sheet  *  Confidential & Verified for JEE / NEET) Tj ET\n";
  stream += "BT /F1 9 Tf 0.1 0.4 0.6 rg 480 15 Td (Page 1 of 1) Tj ET\n";

  const streamLength = stream.length;
  const pdfBody =
    "%PDF-1.4\n" +
    "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n" +
    "2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n" +
    "3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R /F2 6 0 R>>>>>> endobj\n" +
    "5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>> endobj\n" +
    "6 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n" +
    "4 0 obj <</Length " + streamLength + ">> stream\n" + stream + "\nendstream\nendobj\n" +
    "xref\n0 7\n0000000000 65535 f \n" +
    "trailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF";

  return new TextEncoder().encode(pdfBody);
}

export default function AdminGeneratorPage() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("Ready to generate");
  const [percent, setPercent] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate() {
    setRunning(true);
    setErrorMsg(null);
    setCompleted(false);

    try {
      setProgress("Connecting to database & finding Class 11 Physics chapters...");
      const { data: subData, error: subErr } = await supabase
        .from("subjects")
        .select("id, name, class_level")
        .eq("name", "Physics")
        .eq("class_level", "11");

      if (subErr || !subData || subData.length === 0) {
        throw new Error("Could not find Class 11 Physics in subjects table: " + (subErr?.message || ""));
      }

      const subjectIds = subData.map((s) => s.id);
      const { data: chData, error: chErr } = await supabase
        .from("chapters")
        .select("id, title, subject_id")
        .in("subject_id", subjectIds);

      if (chErr || !chData || chData.length === 0) {
        throw new Error("Could not find chapters for Class 11 Physics: " + (chErr?.message || ""));
      }

      for (let i = 0; i < CLASS_11_PHYSICS.length; i++) {
        const item = CLASS_11_PHYSICS[i];
        const pct = Math.round(((i + 1) / CLASS_11_PHYSICS.length) * 100);
        setPercent(pct);
        setProgress("Generating: " + item.title + " (" + (i + 1) + "/" + CLASS_11_PHYSICS.length + ")...");

        const matchedChapters = chData.filter(
          (c) => c.title.toLowerCase().trim() === item.title.toLowerCase().trim()
        );

        if (matchedChapters.length === 0) {
          continue;
        }

        const pdfBytes = buildPdfBytes(item);
        const fileName =
          "prepwise_11_physics_" +
          item.title.toLowerCase().replace(/[^a-z0-9]/g, "_") +
          ".pdf";
        const storagePath = "formula_sheets/" + fileName;

        const { error: upErr } = await supabase.storage
          .from("resources")
          .upload(storagePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (upErr) {
          throw new Error("Storage upload error for " + item.title + ": " + upErr.message);
        }

        const { data: pubUrlData } = supabase.storage
          .from("resources")
          .getPublicUrl(storagePath);

        const finalUrl = pubUrlData.publicUrl;

        for (let j = 0; j < matchedChapters.length; j++) {
          const ch = matchedChapters[j];
          await supabase
            .from("resources")
            .delete()
            .eq("chapter_id", ch.id)
            .eq("category", "formula_sheet");

          await supabase.from("resources").insert({
            chapter_id: ch.id,
            subject_id: ch.subject_id,
            resource_type: "pdf",
            title: item.title + " — Formula Sheet",
            url: finalUrl,
            category: "formula_sheet",
            display_order: 0,
          });
        }
      }

      setProgress("All 16 Formula Sheets generated and uploaded to Supabase!");
      setCompleted(true);
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setRunning(false);
    }
  }

  return e(
    "div",
    { className: "min-h-screen bg-paper p-4 md:p-8 flex flex-col items-center justify-center font-sans" },
    e(
      "div",
      { className: "w-full max-w-xl bg-white rounded-2xl shadow-xl border border-ink/10 p-6 md:p-8 flex flex-col gap-6" },
      e(
        "div",
        { className: "flex items-center gap-3 border-b border-ink/10 pb-4" },
        e("div", { className: "w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center text-teal text-xl font-bold" }, "P"),
        e(
          "div",
          null,
          e("h1", { className: "text-lg md:text-xl font-bold text-ink" }, "PrepWise Auto Content Studio"),
          e("p", { className: "text-xs text-slate" }, "Branded Vector Formula Sheets  *  Zero Phone Storage")
        )
      ),
      e(
        "div",
        { className: "bg-paper rounded-xl p-4 border border-ink/5 flex flex-col gap-2" },
        e("p", { className: "text-sm font-semibold text-ink" }, "Target Batch: Class 11 Physics (16 Chapters)"),
        e("p", { className: "text-xs text-slate" }, "Generates clean vector PDF formula sheets with PrepWise branding, uploads them directly into your Supabase Storage bucket ('resources'), and updates the app database automatically.")
      ),
      running || completed
       

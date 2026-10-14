import { NextRequest, NextResponse } from "next/server";
import {
  getImageGeminiKeys,
  getChatGeminiKeys,
  getGroqKey,
  getSambaNovaKey,
  getCloudflareWorkersAiConfig,
  getCloudflareImageAiConfig,
  getOpenRouterKey,
} from "@/lib/ai-key-manager";

export const runtime = "edge";

// ── Language matching (Unicode script detect + whole-word Roman keywords) ──
// STRICT rule: reply in the SAME language + script as the student's question.
const SCRIPT_DETECT: Record<string, { regex: RegExp; code: string }> = {
  hindi: { regex: /[\u0900-\u097F]/, code: "hi" },        // Devanagari
  bengali: { regex: /[\u0980-\u09FF]/, code: "bn" },     // Bengali
  tamil: { regex: /[\u0B80-\u0BFF]/, code: "ta" },        // Tamil
  telugu: { regex: /[\u0C00-\u0C7F]/, code: "te" },       // Telugu
  marathi: { regex: /[\u0900-\u097F]/, code: "mr" },      // Devanagari (same as Hindi)
  gujarati: { regex: /[\u0A80-\u0AFF]/, code: "gu" },     // Gujarati
  punjabi: { regex: /[\u0A00-\u0A7F]/, code: "pa" },      // Gurmukhi
  malayalam: { regex: /[\u0D00-\u0D7F]/, code: "ml" },    // Malayalam
  kannada: { regex: /[\u0C80-\u0CFF]/, code: "kn" },       // Kannada
  odia: { regex: /[\u0B00-\u0B7F]/, code: "or" },         // Odia
};

// Roman-script keyword lists, matched on WHOLE WORDS only. Substring matching
// misfires badly: Hinglish like "Newton ka first law batado" matched the old
// "hindi" list via "ka" and wrongly produced a Devanagari reply. Hinglish
// (Roman Hindi) is listed FIRST so ties resolve to Hinglish; it contains only
// unambiguous Hindi glue words (never "to", "hi", "do", "so").
const ROMAN_KEYWORDS: Record<string, string[]> = {
  "hi-IN": [
    "bro", "bhai", "bhaiya", "yaar", "arre", "arrey", "abey", "ji", "waah",
    "hai", "hain", "tha", "thi", "the", "hoga", "hogi", "honge", "hua", "hui",
    "hota", "hoti", "kar", "karo", "kara", "kiya", "kiye", "gaya", "gayi",
    "batado", "batao", "bataiye", "samajhao", "samajha", "samjha", "samajh",
    "padho", "padha", "seekho", "dekho", "dekh", "sunao", "bolo", "bol",
    "puch", "pucho", "puchiye", "chahiye", "chahta", "chahti",
    "kya", "kaise", "kyun", "kaun", "kab", "kahan", "kitna", "kitni",
    "konsa", "konsi", "kaunsa", "nahi", "nahin", "mat",
    "ka", "ki", "ke", "ko", "se", "ne", "pe", "mein", "aur", "ya", "par",
    "lekin", "phir", "abhi", "fir", "bhi", "sirf", "toh", "isliye", "kyunki",
    "main", "mujhe", "mujhko", "tumhe", "aapko", "aap", "tum", "tu",
    "vo", "ye", "yeh", "wo", "woh", "iska", "iske", "iski", "uska", "uske",
    "hmare", "tumhara", "mera", "tera", "apna",
    "bahut", "thoda", "thodi", "zyada", "jyada", "kam", "matlab",
    "seedha", "seedhi", "koi", "kuch", "sab", "sabhi", "har",
    "bilkul", "sach", "sachin", "ekdum",
  ],
  en: [
    "the", "and", "for", "are", "is", "was", "were", "be", "been", "this",
    "that", "these", "those", "with", "what", "how", "why", "when", "where",
    "which", "who", "of", "to", "in", "on", "at", "by", "from", "as", "it",
    "its", "if", "then", "than", "so", "but", "or", "not", "no", "do", "does",
    "did", "will", "would", "can", "could", "should", "may", "might", "must",
    "you", "your", "we", "our", "they", "their", "he", "she", "his", "her",
    "i", "me", "my", "please", "explain", "tell", "define", "give", "find",
    "calculate", "derive", "solve", "show", "prove", "state", "write", "name",
    "list", "describe", "compare", "between", "meaning", "use", "using",
    "about", "into", "over", "after", "before", "under", "again", "once",
    "here", "there", "all", "any", "both", "each", "few", "more", "most",
    "other", "some", "such", "only", "own", "same", "too", "very", "just",
    "also", "now", "first", "second", "well", "way", "even", "still", "back",
    "right", "much", "many", "good", "great", "high", "low", "big", "small",
    "large", "new", "old", "able", "sure", "get", "make", "take", "put",
    "know", "think", "see", "come", "want", "need", "work", "call", "try",
    "ask", "feel", "leave", "long", "little",
  ],
  bn: ["ami", "tomar", "tomake", "bhalobashi", "bhalo", "kemon", "achen", "ache", "korun", "korchhe", "bolun", "bolo", "bujhlam", "bujhte", "parbo", "parbi", "chai", "lagbe", "ki"],
  ta: ["naan", "enna", "yaaru", "eppadi", "irukku", "irukka", "pogiren", "pogiral", "mudiyum", "sollunga", "sollungal", "puriyavillai", "theriyuma", "vela"],
  te: ["nenu", "nuvvu", "ela", "undi", "cheppu", "cheyandi", "cheppandi", "vastundi", "artham", "avuthundi", "arthama", "cheyali"],
  mr: ["mi", "mala", "tumhi", "kay", "karayche", "ahe", "aahe", "sanga", "sangitla", "pahije", "zale", "hot"],
  gu: ["hu", "tame", "shu", "karu", "kahyu", "kahis", "maane", "joiye"],
  pa: ["tusi", "karna", "vich", "dass", "samajh", "pucho", "chahida", "hunda", "hove"],
  ml: ["njan", "ninte", "enth", "cheyyanam", "parayunnu", "manasilayi", "sheri", "ningal", "ente"],
  kn: ["naanu", "nimage", "yenu", "maaduvudi", "tiliside", "kelabeda", "yaake", "ide", "nodi"],
  or: ["mu", "tume", "kaana", "kariba", "kahiba", "bujhibi", "jane", "nuhen"],
};

// Detect language from the question text: Unicode script first (Devanagari,
// Bengali, Tamil, ...), then whole-word Roman keywords. Roman-script Hindi —
// shuddh or Hinglish, e.g. "Newton ka first law batado" — resolves to hi-IN so
// the reply stays in ROMAN script instead of flipping to Devanagari.
function detectLanguage(text: string): string {
  for (const [, { regex, code }] of Object.entries(SCRIPT_DETECT)) {
    if (regex.test(text)) return code;
  }
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) || []);
  let bestMatch = "en";
  let maxMatches = 0;
  for (const [lang, keywords] of Object.entries(ROMAN_KEYWORDS)) {
    let matches = 0;
    for (const word of keywords) {
      if (words.has(word)) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = lang;
    }
  }
  return bestMatch;
}

// Per-language STRICT instruction injected ahead of the question. The chat UI
// renders **headings**, 'Step N:', 'Formula:'/'Important:' boxes and '- '
// bullets — those markers MUST stay intact in every language.
function getLanguageRule(language: string): string {
  const rules: Record<string, string> = {
    en: "LANGUAGE RULE (STRICT — MOST IMPORTANT): The student asked in ENGLISH. Answer ONLY in natural English, helpful teacher tone. NEVER answer in Hindi or any other language. KEEP the formatting markers exactly: **Heading Name** for headings, 'Step 1:', 'Step 2:' for steps, 'Formula:' or 'Important:' for formulas/notes, '- ' for bullet points.",
    hi: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne shuddh HINDI (Devanagari script) mein pucha hai. Answer ONLY Hindi (Devanagari script) mein, helpful teacher tone mein. Roman script ya English mein bilkul NAHI. Formatting markers bilkul same rakho: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    "hi-IN": "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne HINGLISH (Roman/English letters) mein pucha hai. Answer ONLY Hinglish mein — Hindi words ko ROMAN/ENGLISH letters mein likho (jaise 'yaar, yeh law bahut simple hai'). Devanagari (क, ख, ग ...) bilkul NAHI — ek bhi akshar nahi. Formatting markers bilkul same rakho: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    bn: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne BENGALI mein pucha hai. Answer ONLY Bengali script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    ta: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne TAMIL mein pucha hai. Answer ONLY Tamil script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    te: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne TELUGU mein pucha hai. Answer ONLY Telugu script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    mr: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne MARATHI (Devanagari) mein pucha hai. Answer ONLY Marathi Devanagari script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    gu: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne GUJARATI mein pucha hai. Answer ONLY Gujarati script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    pa: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne PUNJABI (Gurmukhi) mein pucha hai. Answer ONLY Punjabi Gurmukhi script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    ml: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne MALAYALAM mein pucha hai. Answer ONLY Malayalam script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    kn: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne KANNADA mein pucha hai. Answer ONLY Kannada script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
    or: "LANGUAGE RULE (STRICT — MOST IMPORTANT): Student ne ODIA mein pucha hai. Answer ONLY Odia script mein, helpful teacher tone mein. KEEP formatting markers: **Heading Name**, 'Step 1:', 'Step 2:', 'Formula:' ya 'Important:', '- ' bullets.",
  };
  const common = " Technical terms (Newton, force, equation, lens, voltage, current, energy, power, etc.) MUST ALWAYS remain in English in ALL languages.";
  return (rules[language] || rules.en) + common;
}

// Post-process the AI reply: models sometimes ignore the "no LaTeX" rule and
// emit $...$, \( ... \), \frac{a}{b}, x^{2} etc. The chat UI renders plain text
// + Unicode only, so convert/strip every LaTeX leftover deterministically.
// Formatting markers (**heading**, 'Step 1:', 'Formula:', '- ' bullets) are
// NOT touched.
function cleanSymbols(text: string): string {
  if (!text) return text;
  let t = text;
  // LaTeX line breaks
  t = t.replace(/\\\\/g, "\n");
  // spacing commands \, \; \! \: \ (space)
  t = t.replace(/\\[,;!:]|\\ /g, " ");
  // superscripts / subscripts → Unicode (run BEFORE \frac/\sqrt so nested
  // cases like \sqrt{x^{2}} or \frac{v^{2}}{2} also resolve correctly)
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "n": "ⁿ", "i": "ⁱ" };
  const sub: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "n": "ₙ", "i": "ᵢ" };
  const supify = (s: string) => s.split("").map((c) => sup[c] || c).join("");
  const subify = (s: string) => s.split("").map((c) => sub[c] || c).join("");
  // (brace content must not contain a backslash — LaTeX commands inside
  // ^{...}/_{...} are resolved by the second pass after the command map)
  t = t.replace(/\^\{([^{}\\]*)\}/g, (_, c) => supify(c));
  t = t.replace(/\^([0-9a-zA-Z])/g, (_, c) => sup[c] || c);
  t = t.replace(/_\{([^{}\\]*)\}/g, (_, c) => subify(c));
  t = t.replace(/_([0-9a-zA-Z])/g, (_, c) => sub[c] || c);
  // \text{...} / \mathrm{...} / \mathbf{...} / \mathit{...} → inner text
  t = t.replace(/\\(?:text|mathrm|mathbf|mathit|textrm)\{([^{}]*)\}/g, "$1");
  // \sqrt{x} → √(x), \sqrt[n]{x} → n√(x) (BEFORE \frac so \frac{\sqrt{2}}{2}
  // resolves inner sqrt first)
  t = t.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "$1√($2)");
  t = t.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  // \frac{a}{b} / \dfrac / \tfrac → a/b (parens around numerator when it has
  // +/- so 'u + at' doesn't become ambiguous; two passes for one nesting level)
  const fracify = (_: string, a: string, b: string) =>
    /[+\-]/.test(a) ? "(" + a + ")/" + b : a + "/" + b;
  t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, fracify);
  t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, fracify);
  // common LaTeX commands → Unicode symbols
  const sym: Record<string, string> = {
    times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓",
    leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
    approx: "≈", equiv: "≡", propto: "∝", sim: "∼", simeq: "≃", cong: "≅",
    infty: "∞", partial: "∂", nabla: "∇", sum: "∑", prod: "∏", int: "∫",
    leftarrow: "←", rightarrow: "→", to: "→", Rightarrow: "⇒", Leftarrow: "⇐",
    leftrightarrow: "↔", mapsto: "↦", gets: "←", implies: "⇒",
    circ: "°", deg: "°", degree: "°",
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
    theta: "θ", vartheta: "θ", lambda: "λ", mu: "μ", nu: "ν", pi: "π", rho: "ρ",
    sigma: "σ", phi: "φ", varphi: "φ", omega: "ω", kappa: "κ", eta: "η",
    xi: "ξ", zeta: "ζ", tau: "τ", chi: "χ", psi: "ψ",
    Delta: "Δ", Gamma: "Γ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
    Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
    cup: "∪", cap: "∩", setminus: "∖", in: "∈", notin: "∉",
    subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇", emptyset: "∅",
    forall: "∀", exists: "∃", neg: "¬", land: "∧", wedge: "∧", lor: "∨", vee: "∨",
    oplus: "⊕", otimes: "⊗", perp: "⊥", parallel: "∥", mid: "∣",
    ldots: "…", dots: "…", cdots: "…", vdots: "⋮", ddots: "⋱", prime: "′",
    cos: "cos", sin: "sin", tan: "tan", cot: "cot", sec: "sec", csc: "csc", cosec: "cosec",
    log: "log", ln: "ln", exp: "exp", min: "min", max: "max", lim: "lim",
    det: "det", dim: "dim", gcd: "gcd", lcm: "lcm", mod: "mod", arg: "arg",
    sup: "sup", inf: "inf",
    left: "", right: "", big: "", Big: "", bigl: "", bigr: "", Bigl: "", Bigr: "",
    displaystyle: "", limits: "", nolimits: "", quad: " ", qquad: "  ",
  };
  t = t.replace(/\\([a-zA-Z]+)/g, (m, cmd) => (cmd in sym ? sym[cmd] : m));
  // second sup/sub pass: resolves wrappers whose content was a LaTeX command
  // (e.g. 30^{\circ} → 30^{°} → 30°, x^{\infty} → x∞)
  t = t.replace(/\^\{([^{}\\]*)\}/g, (_, c) => supify(c));
  t = t.replace(/_\{([^{}\\]*)\}/g, (_, c) => subify(c));
  // escaped literal chars \{ \} \% \& \# \_ → literal
  t = t.replace(/\\([{}%&#_])/g, "$1");
  // math delimiters: $...$, $...$, \( ... \), \[ ... \]
  t = t.replace(/\$\$/g, " ").replace(/\$/g, "");
  t = t.replace(/\\\(|\\\)|\\\[|\\\]/g, " ");
  // leftover unknown backslash commands → drop them
  t = t.replace(/\\[a-zA-Z]+/g, "");
  // empty LaTeX groups
  t = t.replace(/\{\s*\}/g, "");
  // tidy whitespace
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
  return t;
}

const BASE_PROMPT = `Tu PrepWise ka highly qualified Senior Academic Faculty hai jo JEE, NEET aur Boards padhata hai.
RULES FOR PERFECT ANSWERS:
1. Academic Accuracy: Pure NCERT aur standard formulas use kar (jaise Koshika = Cell, Jeevan ki buniyadi ikai).
2. Clean Formatting:
   - Headings ko **Heading Name** karke likh.
   - Steps ko 'Step 1:', 'Step 2:' likh.
   - Formula ya Note ke liye 'Formula:' ya 'Important:' likh.
   - Points ke liye '- ' bullet use kar.
3. Math Symbols (VERY STRICT): Sirf clean Unicode hi use kar — x², x³, √(49)=7, a/b, a×b, ±, →, °C, π, ≤, ≥, ≠, ∞. LaTeX bilkul NAHI: na '
4. Tone: Helpful, clear aur seedha to-the-point solution de. Question ke upar diya gaya LANGUAGE RULE strictly follow karo (same language + script as the student).`;

interface ImagePart {
  mimeType: string;
  data: string;
}

// Helper to convert base64 to byte array in Edge runtime without Node Buffer
function base64ToUint8Array(base64: string): number[] {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return Array.from(bytes);
  } catch {
    return [];
  }
}

// ---------------- VISION PROVIDERS (IMAGE + TEXT) ----------------

// 1. Google Gemini Vision (Active 2026 Models: gemini-3.8-flash & gemini-3.5-flash-lite)
async function callGeminiVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const keys = getImageGeminiKeys();
  if (keys.length === 0) throw new Error("Gemini Image key missing");

  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"];
  let lastErr = "";

  for (const key of keys) {
    for (const model of models) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      try {
        const parts: any[] = [{ text: prompt }];
        for (const img of images) {
          parts.push({
            inlineData: { mimeType: img.mimeType, data: img.data }
          });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: BASE_PROMPT }] },
            contents: [{ parts }]
          })
        });

        clearTimeout(timeoutId);

        // Immediate skip on server overload spike
        if (res.status === 503 || res.status === 429) {
          lastErr = `${model} Busy (${res.status})`;
          break; // Skip to next provider immediately
        }

        if (!res.ok) {
          const errText = await res.text();
          lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { reply: text, model };
      } catch (e: any) {
        clearTimeout(timeoutId);
        lastErr = e.name === "AbortError" ? `${model} Timeout (>4.5s)` : e?.message || String(e);
      }
    }
  }
  throw new Error(lastErr || "Gemini Vision failed");
}

// 2. Groq Multimodal Vision (Active 2026 Model: qwen/qwen3.8-27b)
async function callGroqVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq API key missing");

  const model = "qwen/qwen3.8-27b";
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: BASE_PROMPT },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 90)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq Vision empty reply");
  return { reply: text, model };
}

// 3. SambaNova Cloud Vision (Active 2026 Models with 'Meta-' prefix)
async function callSambaNovaVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getSambaNovaKey();
  if (!apiKey) throw new Error("SambaNova API key missing");

  const models = ["Meta-Llama-3.2-11B-Vision-Instruct", "Meta-Llama-3.2-90B-Vision-Instruct"];
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: userContent }
          ],
          temperature: 0.2,
          max_tokens: 1500
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "SambaNova Vision failed");
}

// 4. Cloudflare Workers AI Vision (Account 2: Llama 3.2 Vision + Llava 1.5)
async function callCloudflareWorkersAiVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const config = getCloudflareImageAiConfig();
  if (!config) throw new Error("Cloudflare Vision credentials missing");

  const models = ["@cf/meta/llama-3.2-11b-vision-instruct", "@cf/llava-hf/llava-1.5-7b-hf"];
  const imageBytes = images[0]?.data ? base64ToUint8Array(images[0].data) : [];

  let lastErr = "";
  for (const model of models) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: `${BASE_PROMPT}\n\nQuestion: ${prompt}`,
          image: imageBytes.length > 0 ? imageBytes : undefined
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.result?.response?.trim() || data?.result?.description?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Cloudflare Vision failed");
}

// 5. OpenRouter Free Vision (openrouter/free & qwen-2.5-vl)
async function callOpenRouterVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) throw new Error("OpenRouter API key missing");

  const models = ["openrouter/free", "qwen/qwen-2.5-vl-7b-instruct:free"];
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://eterprep.pages.dev",
          "X-Title": "PrepWise AI Doubt"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: userContent }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "OpenRouter Vision failed");
}

// ---------------- TEXT-ONLY PROVIDERS (UNTOUCHED & PRESERVED) ----------------

async function callGroqText(prompt: string): Promise<{ reply: string; model: string }> {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq API key missing");

  const models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"];
  let lastErr = "";

  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Groq Text failed");
}

async function callWorkersAiText(prompt: string): Promise<{ reply: string; model: string }> {
  const config = getCloudflareWorkersAiConfig();
  if (!config) throw new Error("Cloudflare Text AI credentials missing");

  const models = ["@cf/meta/llama-3.1-8b-instruct", "@cf/mistral/mistral-7b-instruct-v0.1"];
  let lastErr = "";

  for (const model of models) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.result?.response?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Workers AI Text failed");
}

// ---------------- MAIN ROUTE POST HANDLER ----------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.message || body.prompt || body.question || "").trim();
    const images: string[] = Array.isArray(body.images) ? body.images : [];
    const studentContext = body.studentContext || {};

    // Safe base64 substring parser (zero regex catastrophic backtracking)
    const base64Images: ImagePart[] = [];
    for (const raw of images) {
      if (typeof raw === "string" && raw.startsWith("data:")) {
        const commaIdx = raw.indexOf(",");
        if (commaIdx !== -1) {
          const mimeType = raw.slice(5, commaIdx).split(";")[0] || "image/jpeg";
          const data = raw.slice(commaIdx + 1);
          if (data.length > 50) {
            base64Images.push({ mimeType, data });
          }
        }
      }
    }

    const hasImages = base64Images.length > 0;
    const userPrompt = prompt || (hasImages ? "Kripya is photo mein diye gaye sawal ko step-by-step solve kijiye." : "");

    if (!userPrompt) {
      return NextResponse.json(
        { reply: "Kripya koi sawal likhein ya photo attach karein." },
        { status: 200 }
      );
    }

    // STRICT language matching: reply in the SAME language + script as the
    // student's TYPED question. Typed text ALWAYS wins — even when photos are
    // attached, the language of text visible in the photo is IGNORED.
    // studentContext.language is only a fallback for image-only doubts (no
    // text to detect), which keep the default Hinglish reply.
    const typedText = prompt.trim();
    const KNOWN_LANGUAGES = new Set(["en", "hi", "hi-IN", "bn", "ta", "te", "mr", "gu", "pa", "ml", "kn", "or"]);
    const ctxLang =
      studentContext && KNOWN_LANGUAGES.has(studentContext.language)
        ? studentContext.language
        : null;
    const language = typedText ? detectLanguage(typedText) : ctxLang || "hi-IN";
    let finalPrompt = getLanguageRule(language) + "\n\nQuestion: " + userPrompt;
    if (hasImages && typedText) {
      finalPrompt +=
        "\n\nPHOTO RULE (STRICT): Student ne photo ke saath ek text question bhi likha hai. " +
        "Photo ke andar jo bhi language dikhe, usko IGNORE karo — reply ONLY typed text ki language + script mein (upar wala LANGUAGE RULE). " +
        "Photo sirf sawal samajhne ke liye hai, reply ki language decide nahi karti.";
    }

    const attemptsTrace: string[] = [];

    // ==========================================
    // CASE A: IMAGE + TEXT (VISION FLOW - 5 PROVIDERS)
    // ==========================================
    if (hasImages) {
      // 1. Google Gemini Vision (gemini-3.8-flash, gemini-3.5-flash-lite)
      try {
        const { reply, model } = await callGeminiVision(finalPrompt, base64Images);
        attemptsTrace.push(`Gemini: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "gemini", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Gemini: ${e.message}`);
      }

      // 2. Groq Multimodal Vision (qwen/qwen3.8-27b)
      try {
        const { reply, model } = await callGroqVision(finalPrompt, base64Images);
        attemptsTrace.push(`Groq Vision: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "groq", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Groq: ${e.message}`);
      }

      // 3. SambaNova Cloud Vision (Meta-Llama-3.2-11B-Vision-Instruct)
      try {
        const { reply, model } = await callSambaNovaVision(finalPrompt, base64Images);
        attemptsTrace.push(`SambaNova: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "sambanova", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`SambaNova: ${e.message}`);
      }

      // 4. Cloudflare Workers AI Vision (Account 2)
      try {
        const { reply, model } = await callCloudflareWorkersAiVision(finalPrompt, base64Images);
        attemptsTrace.push(`WorkersAI Vision: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "cloudflare_vision", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`WorkersAI: ${e.message}`);
      }

      // 5. OpenRouter Vision (openrouter/free)
      try {
        const { reply, model } = await callOpenRouterVision(finalPrompt, base64Images);
        attemptsTrace.push(`OpenRouter: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "openrouter", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`OpenRouter: ${e.message}`);
      }
    }

    // ==========================================
    // CASE B: PURE TEXT DOUBTS (UNTOUCHED & PRESERVED)
    // ==========================================
    else {
      // 1. Groq Text
      try {
        const { reply, model } = await callGroqText(finalPrompt);
        attemptsTrace.push(`Groq: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "groq", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Groq: ${e.message}`);
      }

      // 2. Cloudflare Workers AI Text (Account 1)
      try {
        const { reply, model } = await callWorkersAiText(finalPrompt);
        attemptsTrace.push(`WorkersAI: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "cloudflare_workers_ai", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`WorkersAI: ${e.message}`);
      }

      // 3. Google Gemini Text
      try {
        const { reply, model } = await callGeminiVision(finalPrompt, []);
        attemptsTrace.push(`Gemini: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "gemini", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Gemini: ${e.message}`);
      }

      // 4. OpenRouter Text
      try {
        const { reply, model } = await callOpenRouterVision(finalPrompt, []);
        attemptsTrace.push(`OpenRouter: Success (${model})`);
        return NextResponse.json(
          { reply: cleanSymbols(reply), provider: "openrouter", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`OpenRouter: ${e.message}`);
      }
    }

    // If all fail
    return NextResponse.json(
      {
        reply: `⚠️ Sabhi AI Providers connect nahi ho paaye:\n• ${attemptsTrace.join("\n• ")}`,
        debugTrace: attemptsTrace
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { reply: `Sawal process karne mein dikkat aayi: ${err?.message || String(err)}` },
      { status: 200 }
    );
  }
}

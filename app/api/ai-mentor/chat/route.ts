// app/api/ai-mentor/chat/route.ts - Conversational AI Mentor endpoint
import { NextRequest, NextResponse } from "next/server";
import { getGroqKey, getChatGeminiKeys } from "@/lib/ai-key-manager";

export const runtime = "edge";

// Language detection: Unicode ranges for Indian scripts
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

// Language detection keywords for Roman script languages
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  hindi: ["hai", "main", "mujhe", "kya", "hain", "thi", "ka", "ki", "mein", "aap", "hum"],
  hinglish: ["bro", "bhai", "yaar", "ar", "hai", "main", "mujhe", "kya", "bhaiya", "didi", "behen"],
  english: ["the", "and", "for", "are", "this", "that", "with", "what", "how", "why"],
  bengali: ["ami", "tomar", "kotha", "ki", "hoyeche", "bolte", "parbe"],
  tamil: ["naan", "un", "enna", "yaaru", "eppadi", "varum", "seyyum"],
  telugu: ["nenu", "nuvv", "emi", "eppudi", "cheyyali", "varu"],
  marathi: ["mi", "tumhi", "kay", "ka", "karayche", "ahe"],
  gujarati: ["hu", "tame", "shu", "kay", "karu", "che"],
  punjabi: ["main", "tusi", "ki", "kya", "karna", "hai"],
  malayalam: ["njan", "ninte", "enth", "kaaryam", "cheyyanam"],
  kannada: ["naanu", "nimage", "eni", "hege", "maaduvudi"],
  odia: ["mu", "tume", "ki
", "kaana", "kariba"],
};

// Detect language from text
function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Check for script-based languages (Devanagari, Bengali, Tamil, etc.)
  for (const [lang, { regex, code }] of Object.entries(SCRIPT_DETECT)) {
    if (regex.test(text)) {
      return code;
    }
  }
  
  // Check for Roman script languages using keywords
  let bestMatch = "en";
  let maxMatches = 0;
  
  for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    const matches = keywords.filter(word => lowerText.includes(word));
    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      bestMatch = lang === "hinglish" ? "hi-IN" : (lang === "hindi" ? "hi" : lang);
    }
  }
  
  // Default to English
  return bestMatch;
}

// Get language code mapping
const LANGUAGE_CODES: Record<string, string> = {
  en: "en",     // English
  hi: "hi",     // Hindi (Devanagari)
  "hi-IN": "hi-IN", // Hinglish (Roman Hindi)
  bn: "bn",     // Bengali
  ta: "ta",     // Tamil
  te: "te",     // Telugu
  mr: "mr",     // Marathi
  gu: "gu",     // Gujarati
  pa: "pa",     // Punjabi
  ml: "ml",     // Malayalam
  kn: "kn",     // Kannada
  or: "or",     // Odia
};

// Get GenZ tone based on gender
function getGenZTone(gender?: string): string {
  if (gender === "female") return "behen";
  return "bro";
}

// Get tone phrase for each language
function getTonePhrase(tone: string, language: string): string {
  const tones: Record<string, Record<string, string>> = {
    bro: {
      en: "Bro",
      hi: "Bhai",
      "hi-IN": "Yaar",
      bn: "Bhai",
      ta: "Machan",
      te: "Anna",
      mr: "Bhai",
      gu: "Bhai",
      pa: "Bhai",
      ml: "Kuttan",
      kn: "Anna",
      or: "Bhai",
    },
    behen: {
      en: "Sis",
      hi: "Behen",
      "hi-IN": "Didi",
      bn: "Apu",
      ta: "Akka",
      te: "Akka",
      mr: "Bahin",
      gu: "Ben",
      pa: "Bhen",
      ml: "Chechi",
      kn:
 "Akka",
      or: "Bhauji",
    },
  };
  return tones[tone]?.[language] || tones.bro[language] || "Bro";
}

// Build conversational prompt
function buildChatPrompt(
  message: string,
  userId: string,
  context: {
    targetExam?: string;
    classLevel?: string;
    gender?: string;
    name?: string;
    language?: string;
    previousMessages?: Array<{ role: string; content: string }>;
  }
): string {
  const language = context.language || detectLanguage(message);
  const tone = getGenZTone(context.gender);
  const tonePhrase = getTonePhrase(tone, language);
  const targetExam = context.targetExam || "JEE";
  const studentName = context.name || "Student";

  // Build conversation history
  const history = context.previousMessages || [];
  const historyText = history
    .slice(-10) // Last 10 messages for context
    .map((msg) => `${msg.role === "user" ? "Student" : tonePhrase}: ${msg.content}`)
    .join("\n");

  // Language-specific instructions - IMPORTANT: input = output = TTS language
  const languageInstructions: Record<string, string> = {
    en: `Answer ONLY in natural English. Use "bro", "dude", "mate" style language. NEVER translate to any other language.`,
    hi: `ONLY Hindi (Devanagari script) mein jawab do. Natural, supportive tone ka use karein. NEVER use Roman script or English.`,
    "hi-IN": `ONLY Hinglish (Roman Hindi script) mein natural jawab do. "yaar", "bro", "bhai" style language ka use karein. NEVER use Devanagari.`,
    bn: `ONLY Bengali script mein jawab do. Natural Bengali tone. NEVER translate or change script.`,
    ta: `ONLY Tamil script mein jawab do. Natural Tamil tone. NEVER translate or change script.`,
    te: `ONLY Telugu script mein jawab do. Natural Telugu tone. NEVER translate or change script.`,
    mr: `ONLY Marathi (Devanagari script) mein jawab do. Natural Marathi tone. NEVER translate or change script.`,
    gu: `ONLY Gujarati script mein jawab do. Natural Gujarati tone. NEVER translate or change script.`,
    pa:
 `ONLY Punjabi (Gurmukhi script) mein jawab do. Natural Punjabi tone. NEVER translate or change script.`,
    ml: `ONLY Malayalam script mein jawab do. Natural Malayalam tone. NEVER translate or change script.`,
    kn: `ONLY Kannada script mein jawab do. Natural Kannada tone. NEVER translate or change script.`,
    or: `ONLY Odia script mein jawab do. Natural Odia tone. NEVER translate or change script.`,
  };

  const langInstruction = languageInstructions[language] || languageInstructions.en;

  return `
You are a GenZ AI Mentor for PrepWise, helping students with ${targetExam} preparation.

STRICT LANGUAGE RULE: input language = output text language = TTS language (ALL THREE MUST MATCH EXACTLY)
${langInstruction}

IMPORTANT: Technical terms (Newton, force, equation, lens, voltage, current, energy, power, etc.) MUST ALWAYS remain in English in ALL languages.

Student Info:
- Name: ${studentName}
- Target Exam: ${targetExam}
- Tone: Use "${tonePhrase}" style addressing

Conversation Context:
${historyText}

Student Message: "${message}"

Respond naturally, conversationally, and supportively. Keep answers concise but helpful.
Return ONLY a JSON object with: {"reply": "your response", "tts_text": "EXACT same as reply", "language": "${language}"}
  `.trim();
}

// Call Groq with chat completion
async function callGroqChat(
  messages: Array<{ role: string; content: string }>,
  language: string,
  tone: string
) {
  const groqKey = getGroqKey();
  if (!groqKey) {
    throw new Error("No Groq API key configured");
  }

  // Add tone context to first message
  const messagesWithTone = messages.map((msg, index) => {
    if (index === 0 && msg.role === "system") {
      return {
        ...msg,
        content: `You are a GenZ AI Mentor. Use ${tone} tone. Respond in ${language} language. STRICT: input=output=TTS language. ${msg.content}`,
      };
    }
    return msg;
  });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST
",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: messagesWithTone,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq chat HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq chat empty response");
  return text;
}

// Call Gemini with chat completion
async function callGeminiChat(
  messages: Array<{ role: string; content: string }>,
  key: string
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini chat HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini chat empty response");
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, message, studentContext, sessionId } = await req.json();

    if (!userId || !message) {
      return NextResponse.json(
        { error: "Missing userId or message" },
        { status: 400 }
      );
    }

    // Detect or use provided language
    const language = studentContext?.language || detectLangu
age(message);
    const tone = getGenZTone(studentContext?.gender);

    // Build conversation history (for now, just current message)
    // In production, you'd store and retrieve previous messages by sessionId
    const previousMessages: Array<{ role: string; content: string }> = [];

    // Build the prompt
    const prompt = buildChatPrompt(message, userId, {
      ...studentContext,
      language,
      previousMessages,
    });

    // Try Groq first (faster, JSON mode)
    let rawJson = "";
    try {
      const groqKey = getGroqKey();
      if (groqKey) {
        const messages = [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ];
        rawJson = await callGroqChat(messages, language, tone);
      } else {
        throw new Error("No Groq key");
      }
    } catch (groqErr: any) {
      // Fallback to Gemini
      console.warn("Groq chat failed, trying Gemini:", groqErr?.message);
      const geminiKeys = getChatGeminiKeys();
      if (geminiKeys.length === 0) {
        throw new Error("No AI keys available");
      }
      
      const messages = [
        { role: "system", content: prompt },
        { role: "user", content: message },
      ];
      
      let lastError: any = null;
      for (const key of geminiKeys) {
        try {
          rawJson = await callGeminiChat(messages, key);
          break;
        } catch (err: any) {
          lastError = err;
        }
      }
      if (!rawJson) throw lastError || new Error("All AI providers failed");
    }

    // Parse response
    let parsed: { reply: string; tts_text?: string; language?: string };
    try {
      const cleaned = rawJson.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr: any) {
      // If JSON parsing fails, create a simple response
      console.warn("Failed to parse AI response as JSON:", parseErr);
      parsed = {
        reply: rawJson,
        tts_text: rawJson,
        la
nguage,
      };
    }

    // Ensure tts_text is EXACT same as reply (no conversion)
    if (!parsed.tts_text) {
      parsed.tts_text = parsed.reply;
    }
    if (!parsed.language) {
      parsed.language = language;
    }

    return NextResponse.json({
      reply: parsed.reply,
      tts_text: parsed.tts_text,
      language: parsed.language,
      tone,
      sessionId: sessionId || `chat_${Date.now()}`,
    });
  } catch (error: any) {
    console.error("AI Mentor Chat Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to get chat response",
        reply: "Sorry, I'm having trouble responding. Please try again.",
        tts_text: "Sorry, I'm having trouble responding. Please try again.",
        language: "en",
      },
      { status: error?.status || 500 }
    );
  }
}

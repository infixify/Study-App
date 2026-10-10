// app/api/ai-mentor/chat/route.ts - Conversational AI Mentor endpoint
import { NextRequest, NextResponse } from "next/server";
import { getGroqKey, getChatGeminiKeys } from "@/lib/ai-key-manager";

export const runtime = "edge";

// Language detection keywords
const LANGUAGE_DETECT = {
  hindi: ["hai", "main", "mujhe", "kya", "hain", "thi", "the", "ka", "ki", "mein"],
  hinglish: ["bro", "bhai", "yaar", "ar", "hai", "main", "mujhe", "kya"],
  english: ["the", "and", "for", "are", "this", "that", "with"],
};

// Detect language from text
function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Check for Hindi/Devanagari script
  if (/[\u0900-\u097F]/.test(text)) {
    return "hi"; // Hindi
  }
  
  // Check for Hinglish keywords
  const hinglishMatches = LANGUAGE_DETECT.hinglish.filter(word => lowerText.includes(word));
  const englishMatches = LANGUAGE_DETECT.english.filter(word => lowerText.includes(word));
  
  if (hinglishMatches.length >= 2 && hinglishMatches.length > englishMatches.length) {
    return "hi-IN"; // Hinglish
  }
  
  return "en"; // Default to English
}

// Get GenZ tone based on gender
function getGenZTone(gender?: string): string {
  if (gender === "female") return "behen";
  return "bro";
}

// Get tone phrase
function getTonePhrase(tone: string, language: string): string {
  const tones: Record<string, Record<string, string>> = {
    bro: {
      en: "Bro",
      hi: "Bhai",
      "hi-IN": "Yaar",
    },
    behen: {
      en: "Sis",
      hi: "Behen",
      "hi-IN": "Didi",
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

  // Language-specific instructions
  const languageInstructions: Record<string, string> = {
    en: `Answer in natural English with a friendly, supportive tone. Use "bro", "dude", "mate" style language.`,
    hi: `Hindi mein jawab do. Natural, supportive tone ka use karein.`,
    "hi-IN": `Hinglish (Roman Hindi) mein natural jawab do. "yaar", "bro", "bhai" style language ka use karein.`,
  };

  const langInstruction = languageInstructions[language] || languageInstructions.en;

  return `
You are a GenZ AI Mentor for PrepWise, helping students with ${targetExam} preparation.
${langInstruction}

Student Info:
- Name: ${studentName}
- Target Exam: ${targetExam}
- Tone: Use "${tonePhrase}" style addressing

Conversation Context:
${historyText}

Student Message: "${message}"

Respond naturally, conversationally, and supportively. Keep answers concise but helpful.
Return ONLY a JSON object with: {"reply": "your response", "tts_text": "text for TTS", "language": "${language}"}
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
        content: `You are a GenZ AI Mentor. Use ${tone} tone. Respond in ${language} language. ${msg.content}`,
      };
    }
    return msg;
  });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
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

// Generate TTS text (convert to native script for TTS)
function generateTTSText(text: string, language: string): string {
  // For Hindi/Devanagari, we'd need a transliteration library
  // For now, return the same text (TTS engines usually handle this)
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
    const language = studentContext?.language || detectLanguage(message);
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
    let rawJson: string;
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
        language,
      };
    }

    // Generate TTS text if not provided
    if (!parsed.tts_text) {
      parsed.tts_text = generateTTSText(parsed.reply, language);
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

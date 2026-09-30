// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AppHeader from "@/components/dashboard/AppHeader";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

interface ExamScheduleItem {
  id: string;
  exam_key: string;
  label: string;
  target_exam: string;
  year: number;
  exam_date: string;
  is_confirmed: boolean;
}

interface ExamShift {
  id: string;
  exam_schedule_id: string;
  shift_date: string;
  shift_time: string;
}

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  task_type?: string;
  due_date?: string;
}

interface TestLog {
  id: string;
  test_name: string;
  total_marks: number;
  max_marks: number;
  accuracy: number;
  test_date: string;
}

interface SubjectItem {
  id: string;
  name: string;
  class_level: string;
}

interface ChapterItem {
  id: string;
  name: string;
  subject_id: string;
}

// ─── SVG STICKERS ────────────────────────────────────────────────────────────
// Each returns a small SVG face/icon as a React element
const STICKERS: Record<string, JSX.Element> = {
  nobita: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Nobita - round face, glasses, sleepy eyes */}
      <circle cx="20" cy="21" r="14" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1.2"/>
      {/* Hair */}
      <ellipse cx="20" cy="9" rx="10" ry="5" fill="#222"/>
      <rect x="10" y="9" width="20" height="4" fill="#222"/>
      {/* Glasses */}
      <circle cx="15" cy="21" r="4.5" fill="none" stroke="#333" strokeWidth="1.5"/>
      <circle cx="25" cy="21" r="4.5" fill="none" stroke="#333" strokeWidth="1.5"/>
      <line x1="19.5" y1="21" x2="20.5" y2="21" stroke="#333" strokeWidth="1.5"/>
      <line x1="10.5" y1="21" x2="9" y2="20" stroke="#333" strokeWidth="1.5"/>
      <line x1="29.5" y1="21" x2="31" y2="20" stroke="#333" strokeWidth="1.5"/>
      {/* Sleepy eyes */}
      <line x1="13" y1="21" x2="17" y2="21" stroke="#555" strokeWidth="1.5"/>
      <line x1="23" y1="21" x2="27" y2="21" stroke="#555" strokeWidth="1.5"/>
      {/* Mouth - droopy */}
      <path d="M16 27 Q20 25 24 27" stroke="#C0706A" strokeWidth="1.2" fill="none"/>
      {/* Blush */}
      <ellipse cx="12" cy="26" rx="3" ry="1.5" fill="#FFB3B3" opacity="0.6"/>
      <ellipse cx="28" cy="26" rx="3" ry="1.5" fill="#FFB3B3" opacity="0.6"/>
      {/* ZZZ */}
      <text x="30" y="12" fontSize="6" fill="#888" fontWeight="bold">z</text>
      <text x="33" y="8" fontSize="5" fill="#888" fontWeight="bold">z</text>
    </svg>
  ),
  daya: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* CID Daya - moustache cop face */}
      <circle cx="20" cy="21" r="14" fill="#D4956A" stroke="#A0673A" strokeWidth="1.2"/>
      {/* Hair - black side parted */}
      <ellipse cx="20" cy="9" rx="11" ry="5" fill="#111"/>
      <rect x="9" y="9" width="22" height="5" fill="#111"/>
      {/* Eyebrows - angry thick */}
      <rect x="12" y="16" width="6" height="2" rx="1" fill="#111" transform="rotate(-10 15 17)"/>
      <rect x="22" y="16" width="6" height="2" rx="1" fill="#111" transform="rotate(10 25 17)"/>
      {/* Eyes - determined */}
      <ellipse cx="15" cy="20" rx="2.5" ry="2" fill="#111"/>
      <ellipse cx="25" cy="20" rx="2.5" ry="2" fill="#111"/>
      <circle cx="15.5" cy="19.5" r="0.8" fill="white"/>
      <circle cx="25.5" cy="19.5" r="0.8" fill="white"/>
      {/* Big Moustache */}
      <path d="M13 25 Q17 22 20 24 Q23 22 27 25 Q23 28 20 26 Q17 28 13 25Z" fill="#111"/>
      {/* CID badge hint */}
      <rect x="16" y="31" width="8" height="4" rx="1" fill="#FFD700" opacity="0.8"/>
      <text x="17.5" y="34.5" fontSize="3.5" fill="#333" fontWeight="bold">CID</text>
    </svg>
  ),
  naruto: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Naruto - spiky yellow hair, whiskers */}
      <circle cx="20" cy="22" r="13" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1"/>
      {/* Spiky hair */}
      {[14,17,20,23,26].map((x,i) => (
        <polygon key={i} points={`${x},12 ${x+2},4 ${x+4},12`} fill="#F5C518"/>
      ))}
      <ellipse cx="20" cy="12" rx="11" ry="5" fill="#F5C518"/>
      {/* Headband */}
      <rect x="9" y="13" width="22" height="4" rx="1" fill="#4A7FC1"/>
      <rect x="16" y="13" width="8" height="4" fill="#8BA8D4"/>
      {/* Eyes - determined squint */}
      <ellipse cx="15" cy="22" rx="2.5" ry="2.5" fill="#4A90D9"/>
      <ellipse cx="25" cy="22" rx="2.5" ry="2.5" fill="#4A90D9"/>
      <circle cx="15" cy="22" r="1.2" fill="#111"/>
      <circle cx="25" cy="22" r="1.2" fill="#111"/>
      {/* Whisker marks */}
      <line x1="9" y1="22" x2="13" y2="23" stroke="#C8956A" strokeWidth="1"/>
      <line x1="9" y1="25" x2="13" y2="25" stroke="#C8956A" strokeWidth="1"/>
      <line x1="27" y1="23" x2="31" y2="22" stroke="#C8956A" strokeWidth="1"/>
      <line x1="27" y1="25" x2="31" y2="25" stroke="#C8956A" strokeWidth="1"/>
      {/* Smile */}
      <path d="M15 28 Q20 32 25 28" stroke="#C0706A" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  saitama: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Saitama - bald, dead inside face */}
      <circle cx="20" cy="21" r="14" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1"/>
      {/* Completely bald - no hair */}
      {/* Flat dead eyes */}
      <ellipse cx="15" cy="19" rx="3" ry="2" fill="white" stroke="#555" strokeWidth="0.8"/>
      <ellipse cx="25" cy="19" rx="3" ry="2" fill="white" stroke="#555" strokeWidth="0.8"/>
      <circle cx="15" cy="19.5" r="1.2" fill="#333"/>
      <circle cx="25" cy="19.5" r="1.2" fill="#333"/>
      {/* Flat mouth - utter boredom */}
      <line x1="16" y1="27" x2="24" y2="27" stroke="#999" strokeWidth="1.5"/>
      {/* Cape collar hint */}
      <path d="M10 33 Q20 36 30 33" fill="#FFFF00" stroke="#CCC" strokeWidth="0.8"/>
      {/* "OK" text */}
      <text x="31" y="14" fontSize="5.5" fill="#888" fontWeight="bold">ok.</text>
    </svg>
  ),
  rocklee: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Rock Lee - bowl cut, thick eyebrows, determined */}
      <circle cx="20" cy="22" r="13" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1"/>
      {/* Bowl cut black hair */}
      <ellipse cx="20" cy="13" rx="13" ry="7" fill="#111"/>
      <rect x="7" y="13" width="26" height="5" fill="#111"/>
      {/* THICK eyebrows */}
      <rect x="11" y="18" width="7" height="2.5" rx="1.2" fill="#111"/>
      <rect x="22" y="18" width="7" height="2.5" rx="1.2" fill="#111"/>
      {/* Round determined eyes */}
      <circle cx="15" cy="23" r="3" fill="#4A4A00"/>
      <circle cx="25" cy="23" r="3" fill="#4A4A00"/>
      <circle cx="14.5" cy="22.5" r="1" fill="white"/>
      <circle cx="24.5" cy="22.5" r="1" fill="white"/>
      {/* Fire smile */}
      <path d="M14 29 Q20 34 26 29" stroke="#C0706A" strokeWidth="1.8" fill="none"/>
      {/* Sweat drop - training hard */}
      <ellipse cx="32" cy="18" rx="1.5" ry="2.5" fill="#88CCFF" opacity="0.8"/>
    </svg>
  ),
  shinchan: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Shinchan - round head, tiny eyes, big mouth */}
      <circle cx="20" cy="22" r="14" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1.2"/>
      {/* Black hair top */}
      <ellipse cx="20" cy="10" rx="12" ry="6" fill="#111"/>
      <rect x="8" y="10" width="24" height="5" fill="#111"/>
      {/* TINY dot eyes */}
      <circle cx="15" cy="21" r="2" fill="#111"/>
      <circle cx="25" cy="21" r="2" fill="#111"/>
      <circle cx="14.5" cy="20.5" r="0.6" fill="white"/>
      <circle cx="24.5" cy="20.5" r="0.6" fill="white"/>
      {/* Big cheeky grin */}
      <path d="M12 27 Q20 33 28 27" fill="#E8A0A0" stroke="#C0706A" strokeWidth="1"/>
      <path d="M14 27 Q20 31 26 27" fill="#FF8888"/>
      {/* Blush circles */}
      <circle cx="11" cy="26" r="3" fill="#FFB3B3" opacity="0.5"/>
      <circle cx="29" cy="26" r="3" fill="#FFB3B3" opacity="0.5"/>
      {/* Naughty eyebrow */}
      <path d="M12 18 Q15 16 18 18" stroke="#111" strokeWidth="1.5" fill="none"/>
      <path d="M22 18 Q25 16 28 18" stroke="#111" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  doraemon: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Doraemon - blue round face, white face patch, red nose */}
      <circle cx="20" cy="21" r="14" fill="#00AADD"/>
      {/* White face patch */}
      <ellipse cx="20" cy="24" rx="10" ry="9" fill="white"/>
      {/* Eyes */}
      <circle cx="15" cy="16" r="4" fill="white"/>
      <circle cx="25" cy="16" r="4" fill="white"/>
      <circle cx="15.5" cy="16.5" r="2.5" fill="#111"/>
      <circle cx="25.5" cy="16.5" r="2.5" fill="#111"/>
      <circle cx="15" cy="15.5" r="0.8" fill="white"/>
      <circle cx="25" cy="15.5" r="0.8" fill="white"/>
      {/* Red nose */}
      <circle cx="20" cy="22" r="2.5" fill="#FF3333"/>
      {/* Whiskers */}
      <line x1="5" y1="22" x2="15" y2="24" stroke="#555" strokeWidth="0.8"/>
      <line x1="5" y1="26" x2="15" y2="26" stroke="#555" strokeWidth="0.8"/>
      <line x1="25" y1="24" x2="35" y2="22" stroke="#555" strokeWidth="0.8"/>
      <line x1="25" y1="26" x2="35" y2="26" stroke="#555" strokeWidth="0.8"/>
      {/* Big smile */}
      <path d="M12 28 Q20 34 28 28" fill="#FF3333" stroke="#CC0000" strokeWidth="0.8"/>
      {/* Bell */}
      <circle cx="20" cy="35" r="2.5" fill="#FFD700" stroke="#CCA000" strokeWidth="0.8"/>
    </svg>
  ),
  luffy: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Luffy - straw hat, scar under eye, big grin */}
      <circle cx="20" cy="23" r="13" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1"/>
      {/* Straw hat */}
      <ellipse cx="20" cy="12" rx="16" ry="4" fill="#D4A840" stroke="#A07820" strokeWidth="1"/>
      <path d="M10 12 Q20 18 30 12" fill="#C89030" stroke="#A07820" strokeWidth="0.8"/>
      {/* Red hat band */}
      <path d="M8 13 Q20 19 32 13" stroke="#CC2222" strokeWidth="2" fill="none"/>
      {/* Eyes - wide excited */}
      <circle cx="15" cy="23" r="3" fill="#1A1A1A"/>
      <circle cx="25" cy="23" r="3" fill="#1A1A1A"/>
      <circle cx="14.2" cy="22.2" r="1" fill="white"/>
      <circle cx="24.2" cy="22.2" r="1" fill="white"/>
      {/* Scar under left eye */}
      <line x1="13" y1="27" x2="17" y2="29" stroke="#CC4444" strokeWidth="1.5"/>
      {/* HUGE grin */}
      <path d="M11 29 Q20 36 29 29" fill="#FF8888" stroke="#CC4444" strokeWidth="1"/>
      <path d="M13 29 Q20 34 27 29" fill="#FF6666"/>
    </svg>
  ),
  vegeta: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Vegeta - pointy widow's peak, scowl, Prince attitude */}
      <circle cx="20" cy="22" r="13" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1"/>
      {/* Widow's peak spiky hair */}
      <polygon points="20,6 14,14 26,14" fill="#111"/>
      <polygon points="12,10 8,16 16,16" fill="#111"/>
      <polygon points="28,10 24,16 32,16" fill="#111"/>
      <rect x="8" y="14" width="24" height="5" fill="#111"/>
      {/* Angry scowl eyebrows */}
      <line x1="11" y1="18" x2="18" y2="20" stroke="#111" strokeWidth="2.5"/>
      <line x1="29" y1="18" x2="22" y2="20" stroke="#111" strokeWidth="2.5"/>
      {/* Sharp eyes */}
      <ellipse cx="15" cy="23" rx="2.5" ry="2" fill="#111"/>
      <ellipse cx="25" cy="23" rx="2.5" ry="2" fill="#111"/>
      <circle cx="14.5" cy="22.5" r="0.7" fill="white"/>
      <circle cx="24.5" cy="22.5" r="0.7" fill="white"/>
      {/* Scowl */}
      <path d="M15 29 Q20 27 25 29" stroke="#A06050" strokeWidth="1.5" fill="none"/>
      {/* "9000!" */}
      <text x="28" y="10" fontSize="4.5" fill="#FF4400" fontWeight="bold">9000!</text>
    </svg>
  ),
  light: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Light Yagami - Death Note, genius smirk */}
      <circle cx="20" cy="22" r="13" fill="#F5DEB3" stroke="#DEB887" strokeWidth="1"/>
      {/* Brown hair */}
      <ellipse cx="20" cy="11" rx="11" ry="5" fill="#8B4513"/>
      <rect x="9" y="11" width="22" height="5" fill="#8B4513"/>
      {/* Side swept hair */}
      <path d="M9 13 Q13 10 18 12" fill="#8B4513"/>
      {/* Sharp calculating eyes */}
      <ellipse cx="15" cy="22" rx="2.8" ry="2.2" fill="#8B4513"/>
      <ellipse cx="25" cy="22" rx="2.8" ry="2.2" fill="#8B4513"/>
      <circle cx="14.5" cy="21.8" r="0.8" fill="white"/>
      <circle cx="24.5" cy="21.8" r="0.8" fill="white"/>
      {/* Smug genius smirk */}
      <path d="M16 28 Q20 31 24 28" stroke="#C08060" strokeWidth="1.2" fill="none"/>
      {/* Death note corner */}
      <rect x="26" y="28" width="8" height="10" rx="1" fill="#111"/>
      <text x="27" y="35" fontSize="3.5" fill="white">NOTE</text>
    </svg>
  ),
  itachi: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Itachi - long face, Sharingan, calm */}
      <ellipse cx="20" cy="22" rx="12" ry="14" fill="#FDDBA0" stroke="#E8A84C" strokeWidth="1"/>
      {/* Long black hair */}
      <ellipse cx="20" cy="10" rx="12" ry="6" fill="#111"/>
      <rect x="8" y="10" width="4" height="20" fill="#111"/>
      <rect x="28" y="10" width="4" height="20" fill="#111"/>
      {/* Headband */}
      <rect x="8" y="14" width="24" height="3" fill="#444"/>
      {/* Sharingan eyes */}
      <circle cx="15" cy="23" r="3" fill="#CC1111"/>
      <circle cx="25" cy="23" r="3" fill="#CC1111"/>
      <circle cx="15" cy="23" r="1.5" fill="#111"/>
      <circle cx="25" cy="23" r="1.5" fill="#111"/>
      {/* Calm mouth */}
      <line x1="16" y1="30" x2="24" y2="30" stroke="#C0706A" strokeWidth="1"/>
      {/* Clan marks */}
      <line x1="10" y1="26" x2="13" y2="28" stroke="#8B0000" strokeWidth="1"/>
      <line x1="27" y1="28" x2="30" y2="26" stroke="#8B0000" strokeWidth="1"/>
    </svg>
  ),
  gru: (
    <svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      {/* Gru - long nose, bald, striped scarf, meme face */}
      <ellipse cx="20" cy="20" rx="11" ry="13" fill="#B8B8C8" stroke="#8888AA" strokeWidth="1"/>
      {/* Bald head shine */}
      <ellipse cx="16" cy="12" rx="3" ry="2" fill="white" opacity="0.3"/>
      {/* Tiny eyes */}
      <circle cx="16" cy="19" r="2" fill="#222"/>
      <circle cx="24" cy="19" r="2" fill="#222"/>
      <circle cx="15.5" cy="18.5" r="0.6" fill="white"/>
      <circle cx="23.5" cy="18.5" r="0.6" fill="white"/>
      {/* LONG nose */}
      <ellipse cx="20" cy="25" rx="3" ry="6" fill="#A8A8B8" stroke="#8888AA" strokeWidth="0.8"/>
      {/* Scarf stripes */}
      <rect x="9" y="31" width="22" height="3" rx="1" fill="#888"/>
      <rect x="9" y="34" width="22" height="2" rx="1" fill="#555"/>
      {/* Meme plan arms */}
      <line x1="9" y1="25" x2="3" y2="20" stroke="#B8B8C8" strokeWidth="3"/>
      <line x1="31" y1="25" x2="37" y2="20" stroke="#B8B8C8" strokeWidth="3"/>
    </svg>
  ),
};

// ─── ANIME/MEME QUOTES DATA ───────────────────────────────────────────────────
const ANIME_QUOTES = [
  {
    quote: "Iske paas Doraemon hai, lekin aapko to khud hi padhna padega 😂 Isko dekho aur timer on karo! Dusro pe mat hasna — khud padho!",
    character: "Nobita Nobi",
    show: "Doraemon (Meme Edition)",
    sticker: "nobita",
    color: "from-blue-400 to-cyan-300",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    badge: "bg-blue-400",
  },
  {
    quote: "PAKAD PAKAD PAKAD... Isne aaj tak padhai nahi ki! Daya, isko pakad lo! 😂 CID ne tujhe dhundh liya — ab padh le bhai!",
    character: "ACP Pradyuman",
    show: "CID (Meme Edition)",
    sticker: "daya",
    color: "from-gray-600 to-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-300",
    text: "text-gray-900",
    badge: "bg-gray-600",
  },
  {
    quote: "Bhai main bhi nahi jaanta tha ki meraa kya hoga. Lekin ek cheez thi — main kabhi nahi ruka. Chal timer on kar!",
    character: "Naruto Uzumaki",
    show: "Naruto",
    sticker: "naruto",
    color: "from-orange-500 to-yellow-400",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-900",
    badge: "bg-orange-500",
  },
  {
    quote: "Training? Homework? Test? Sab ek jaise lagta hai... OK. (Par tune bhi abhi tak start nahi kiya 🤨)",
    character: "Saitama",
    show: "One Punch Man",
    sticker: "saitama",
    color: "from-yellow-400 to-amber-300",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    badge: "bg-yellow-500",
  },
  {
    quote: "Youth is the time to go all out! Ek baar bhi try kiye bina mat kehna ki nahi ho sakta. Ab leg press karne ki jagah books uthao!",
    character: "Rock Lee",
    show: "Naruto",
    sticker: "rocklee",
    color: "from-green-500 to-emerald-400",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    badge: "bg-emerald-500",
  },
  {
    quote: "Ae sun, exam aane wala hai aur tu abhi bhi phone pe hai?! Shinchan bhi isse zyada serious rehta hai! 😤 Chal bhaag library!",
    character: "Shinchan Nohara",
    show: "Crayon Shin-chan (Meme)",
    sticker: "shinchan",
    color: "from-red-400 to-pink-300",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    badge: "bg-red-400",
  },
  {
    quote: "Mere paas ek magical pocket hai jisme se koi bhi cheez nikalti hai — lekin tere rank improve karne ka jugaad sirf padhai hai! 😅",
    character: "Doraemon",
    show: "Doraemon",
    sticker: "doraemon",
    color: "from-sky-500 to-blue-400",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-900",
    badge: "bg-sky-500",
  },
  {
    quote: "Tujhe koi roke toh mat ruk. Sapne dekhna band mat kar. Aur haan — seat belt lagale kyunki ye padhai wali ride fast hai! 🏴‍☠️",
    character: "Monkey D. Luffy",
    show: "One Piece",
    sticker: "luffy",
    color: "from-red-500 to-orange-400",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    badge: "bg-red-500",
  },
  {
    quote: "NANI?! Tu OVER 9000 questions solve karna chahta hai?! Toh baith jaa aur shuru kar — yaha khade rehne se kuch nahi hoga, baka!",
    character: "Vegeta",
    show: "Dragon Ball Z",
    sticker: "vegeta",
    color: "from-indigo-600 to-blue-500",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-900",
    badge: "bg-indigo-600",
  },
  {
    quote: "Humane logo ke dimaag ko main ek hi raat mein padh leta hun. Tera next chapter? Teri problem. Ab padh. 😏",
    character: "Light Yagami",
    show: "Death Note",
    sticker: "light",
    color: "from-slate-700 to-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-900",
    badge: "bg-slate-700",
  },
  {
    quote: "People's lives don't end when they die — they end when they lose faith. Aur tera focus session? Tab khatam hota hai jab TU band karta hai.",
    character: "Itachi Uchiha",
    show: "Naruto",
    sticker: "itachi",
    color: "from-purple-700 to-red-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-900",
    badge: "bg-purple-700",
  },
  {
    quote: "Step 1: Padhai karo. Step 2: ??? Step 3: AIR 1 aao. Step 2 is still classified. 😂 Mera plan solid hai!",
    character: "Gru",
    show: "Despicable Me (Meme)",
    sticker: "gru",
    color: "from-amber-600 to-yellow-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    badge: "bg-amber-600",
  },
];

function getGreeting(name: string, hour: number): string {
  if (hour >= 5 && hour < 9) return `Rise & grind, ${name}! 🌅`;
  if (hour >= 9 && hour < 12) return `Good morning, ${name}! ☀️`;
  if (hour >= 12 && hour < 14) return `Lunch break, ${name}? 🍱 Back to books!`;
  if (hour >= 14 && hour < 17) return `Afternoon session, ${name}! 💪`;
  if (hour >= 17 && hour < 20) return `Evening grind, ${name}! 🌆`;
  if (hour >= 20 && hour < 23) return `Late night mode, ${name}! 🌙`;
  return `Night owl alert, ${name}! 🦉 Sleep matters too!`;
}

// ─── HERO WIDGET COMPONENT ───────────────────────────────────────────────────
function HeroWidget({
  name,
  streak,
  todayFocusMins,
}: {
  name: string;
  streak: number;
  todayFocusMins: number;
}) {
  const [hour, setHour] = useState(new Date().getHours());
  const [quoteIdx, setQuoteIdx] = useState(() => {
    // Rotate daily based on date so it changes each day but stays same in session
    return new Date().getDate() % ANIME_QUOTES.length;
  });

  useEffect(() => {
    // Update hour every minute
    const interval = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Tap to cycle quote
  const cycleQuote = () => setQuoteIdx((i) => (i + 1) % ANIME_QUOTES.length);

  const q = ANIME_QUOTES[quoteIdx];
  const greeting = getGreeting(name, hour);
  const todayHours = (todayFocusMins / 60).toFixed(1);

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-200/80 bg-white">
      {/* Top bar — gradient accent */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${q.color}`} />

      <div className="p-4 pb-3">
        {/* Greeting row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
              PrepWise Dashboard
            </p>
            <h2 className="text-base font-black text-slate-900 leading-tight truncate">
              {greeting}
            </h2>
          </div>

          {/* Streak badge */}
          <div
            className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 ${
              streak > 0 ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-200"
            }`}
          >
            <span className="text-xl leading-none">{streak > 0 ? "🔥" : "💤"}</span>
            <span
              className={`text-sm font-black leading-tight ${
                streak > 0 ? "text-orange-600" : "text-slate-400"
              }`}
            >
              {streak}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
              {streak === 1 ? "Day" : "Days"}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-base">⏱️</span>
            <div>
              <p className="text-[10px] font-bold text-teal-600 leading-none">Today</p>
              <p className="text-sm font-black text-teal-900 leading-tight">{todayHours}h studied</p>
            </div>
          </div>
          <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-base">🎯</span>
            <div>
              <p className="text-[10px] font-bold text-indigo-600 leading-none">Goal</p>
              <p className="text-sm font-black text-indigo-900 leading-tight">8h / day</p>
            </div>
          </div>
        </div>

        {/* Anime Quote Card — tap to change */}
        <button
          type="button"
          onClick={cycleQuote}
          className={`w-full text-left rounded-xl border ${q.border} ${q.bg} p-3 active:scale-[0.98] transition-all`}
        >
          <div className="flex items-start gap-2.5">
            {/* SVG Character Sticker */}
            <div
              className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center ${q.badge} shadow-sm overflow-hidden p-0.5`}
            >
              {STICKERS[q.sticker] ?? <span className="text-xl">⭐</span>}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-bold leading-snug ${q.text} line-clamp-3`}>
                "{q.quote}"
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[10px] font-black text-slate-500">
                  — {q.character}
                  <span className="font-medium text-slate-400"> · {q.show}</span>
                </p>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  Tap ↻
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Streak message */}
        {streak > 0 && (
          <p className="text-[10px] font-bold text-orange-600 text-center mt-2.5">
            {streak >= 7
              ? `🔥 ${streak}-day streak — you're unstoppable! Keep it going!`
              : streak >= 3
              ? `🔥 ${streak}-day streak! Building momentum!`
              : `🔥 ${streak}-day streak started! Don't break the chain!`}
          </p>
        )}
        {streak === 0 && (
          <p className="text-[10px] font-bold text-slate-400 text-center mt-2.5">
            Start a focus session today to build your streak! 💪
          </p>
        )}
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Mentor & Doubt state
  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  // Telemetry metrics
  const [todayFocusMins, setTodayFocusMins] = useState(0);
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);
  const [streak, setStreak] = useState(0);

  // Backlogs List & Modal States
  const [backlogsList, setBacklogsList] = useState<TaskItem[]>([]);
  const [showAddBacklogModal, setShowAddBacklogModal] = useState(false);
  const [backlogMode, setBacklogMode] = useState<"chapter" | "other">("chapter");

  // Form Fields
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [backlogTitle, setBacklogTitle] = useState("");
  const [backlogPriority, setBacklogPriority] = useState<"high" | "medium" | "low">("high");
  const [backlogDueDate, setBacklogDueDate] = useState<string>("");

  // Dynamic Subjects & Chapters
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectItem[]>([]);
  const [chaptersList, setChaptersList] = useState<ChapterItem[]>([]);
  const [submittingBacklog, setSubmittingBacklog] = useState(false);

  // Study Distribution
  const [splitRatio, setSplitRatio] = useState({
    theory: 0,
    practice: 0,
    revision: 0,
  });

  // Action tasks & mock logs
  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([]);
  const [recentTests, setRecentTests] = useState<TestLog[]>([]);
  const [heatGrid, setHeatGrid] = useState<number[]>([]);

  // Admin Connected Exam Schedules & Shifts
  const [examSchedules, setExamSchedules] = useState<ExamScheduleItem[]>([]);
  const [shiftsMap, setShiftsMap] = useState<Record<string, ExamShift[]>>({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);

      // 1. Fetch User Profile
      const { data: uProf } = await supabase
        .from("users")
        .select("*")
        .eq("uid", session.user.id)
        .maybeSingle();

      if (uProf) {
        setProfile(uProf);
        setSelectedShiftId(uProf.selected_shift_id || null);

        // CACHE-FIRST MENTOR REPORT: Zero API calls on restart!
        const cached = localStorage.getItem(`mentor_report_${session.user.id}`);
        if (cached) {
          try {
            setMentorReport(JSON.parse(cached));
          } catch {
            fetchMentorReport(session.user.id, false);
          }
        } else {
          fetchMentorReport(session.user.id, false);
        }

        const allowedClasses = classLevelsForContent(uProf.class_level);
        setSelectedClass(allowedClasses[0] || "11");

        const { data: subs } = await supabase
          .from("subjects")
          .select("id, name, class_level")
          .in("class_level", allowedClasses.length ? allowedClasses : ["11", "12"]);

        if (subs) {
          setAllSubjects(subs);
          const initialFiltered = subs.filter((s) => s.class_level === (allowedClasses[0] || "11"));
          setFilteredSubjects(initialFiltered);
          if (initialFiltered[0]) {
            setSelectedSubjectId(initialFiltered[0].id);
            fetchChaptersForSubject(initialFiltered[0].id);
          }
        }
      }

      const targetExam = uProf?.target_exam || "JEE";
      const targetYear = Number(uProf?.target_year) || 2027;
      const isDropper = uProf?.class_level === "Dropper";
      const wantsBoards = !isDropper && Boolean(uProf?.wants_boards);

      // 2. FETCH REAL ADMIN EXAM SCHEDULES
      const { data: schedules } = await supabase
        .from("exam_schedule")
        .select("*")
        .eq("year", targetYear)
        .order("display_order", { ascending: true });

      let studentSchedules: ExamScheduleItem[] = [];

      if (schedules && schedules.length > 0) {
        studentSchedules = schedules.filter((s) => {
          if (s.target_exam === "Boards") {
            return wantsBoards;
          }
          return s.target_exam === targetExam || s.target_exam === "ALL";
        });

        const scheduleIds = studentSchedules.map((s) => s.id);
        const { data: shifts } = await supabase
          .from("exam_shifts")
          .select("*")
          .in("exam_schedule_id", scheduleIds)
          .order("display_order", { ascending: true });

        if (shifts) {
          const sMap: Record<string, ExamShift[]> = {};
          shifts.forEach((sh) => {
            if (!sMap[sh.exam_schedule_id]) sMap[sh.exam_schedule_id] = [];
            sMap[sh.exam_schedule_id].push(sh);
          });
          setShiftsMap(sMap);
        }
      }

      // Fallback if Admin hasn't seeded rows yet
      if (studentSchedules.length === 0) {
        if (targetExam === "JEE") {
          studentSchedules.push({
            id: "mains-fallback",
            exam_key: "jee_mains",
            label: "JEE Main",
            target_exam: "JEE",
            year: targetYear,
            exam_date: `${targetYear}-01-22T09:00:00`,
            is_confirmed: false,
          });
          studentSchedules.push({
            id: "adv-fallback",
            exam_key: "jee_advanced",
            label: "JEE Advanced",
            target_exam: "JEE",
            year: targetYear,
            exam_date: `${targetYear}-05-24T09:00:00`,
            is_confirmed: false,
          });
        } else if (targetExam === "NEET") {
          studentSchedules.push({
            id: "neet-fallback",
            exam_key: "neet_ug",
            label: "NEET UG",
            target_exam: "NEET",
            year: targetYear,
            exam_date: `${targetYear}-05-03T14:00:00`,
            is_confirmed: false,
          });
        }
        if (wantsBoards) {
          studentSchedules.push({
            id: "boards-fallback",
            exam_key: "board_exam",
            label: `${uProf?.class_level || "12th"} Board`,
            target_exam: "Boards",
            year: targetYear,
            exam_date: `${targetYear}-02-15T10:30:00`,
            is_confirmed: false,
          });
        }
      }

      setExamSchedules(studentSchedules);

      const todayStr = new Date().toISOString().split("T")[0];

      // 3. Daily Logs & Study Split
      const { data: pastLogs } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, streak_count, log_date")
        .eq("user_id", session.user.id)
        .order("log_date", { ascending: false })
        .limit(84);

      const todayLog = pastLogs?.find((l) => l.log_date === todayStr);
      setTodayFocusMins(todayLog?.study_time_minutes || 0);
      setStreak(todayLog?.streak_count || pastLogs?.[0]?.streak_count || 0);

      setSplitRatio({
        theory: todayLog?.theory_minutes || 0,
        practice: todayLog?.practice_minutes || 0,
        revision: todayLog?.revision_minutes || 0,
      });

      // 4. Questions Solved
      const { data: qLogs } = await supabase
        .from("question_logs")
        .select("question_count, log_date")
        .eq("user_id", session.user.id);

      const todayQ =
        qLogs
          ?.filter((q) => q.log_date === todayStr)
          .reduce((acc, q) => acc + (q.question_count || 0), 0) || 0;
      setTodayQuestions(todayQ);

      const totalQ = (qLogs || []).reduce((acc, q) => acc + (q.question_count || 0), 0);
      setTotalQuestionsAllTime(totalQ);

      // Build 84-day heatmap grid
      const grid = new Array(84).fill(0);
      if (pastLogs) {
        pastLogs.forEach((l) => {
          const d = new Date(l.log_date);
          const daysAgo = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          if (daysAgo >= 0 && daysAgo < 84) {
            const hrs = (l.study_time_minutes || 0) / 60;
            let level = 0;
            if (hrs >= 6) level = 4;
            else if (hrs >= 4) level = 3;
            else if (hrs >= 2) level = 2;
            else if (hrs > 0) level = 1;
            grid[83 - daysAgo] = level;
          }
        });
      }
      setHeatGrid(grid);

      // 5. Backlogs & Action Tasks
      const { data: userTasks } = await supabase
        .from("tasks")
        .select("id, title, priority, status, task_type, due_date")
        .eq("user_id", session.user.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (userTasks) {
        const bl = userTasks.filter((t) => t.task_type === "backlog");
        const regularTasks = userTasks.filter((t) => t.task_type !== "backlog");
        setBacklogsList(bl);
        setTodayTasks(regularTasks.slice(0, 4));
      }

      // 6. Recent Mock Tests
      const { data: testData } = await supabase
        .from("test_logs")
        .select("id, test_name, total_marks, max_marks, accuracy, test_date")
        .eq("user_id", session.user.id)
        .order("test_date", { ascending: false })
        .limit(3);

      if (testData) setRecentTests(testData);

      setLoading(false);
    }

    loadData();
  }, [router]);

  const fetchChaptersForSubject = async (subjId: string) => {
    if (!subjId) return;
    const { data } = await supabase
      .from("chapters")
      .select("id, name, subject_id")
      .eq("subject_id", subjId)
      .order("display_order", { ascending: true });

    if (data && data.length > 0) {
      setChaptersList(data);
      setSelectedChapterId(data[0].id);
    } else {
      setChaptersList([]);
      setSelectedChapterId("");
    }
  };

  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    const filtered = allSubjects.filter((s) => s.class_level === newClass);
    setFilteredSubjects(filtered);
    if (filtered[0]) {
      setSelectedSubjectId(filtered[0].id);
      fetchChaptersForSubject(filtered[0].id);
    } else {
      setSelectedSubjectId("");
      setChaptersList([]);
      setSelectedChapterId("");
    }
  };

  const handleSubjectChange = (subjId: string) => {
    setSelectedSubjectId(subjId);
    fetchChaptersForSubject(subjId);
  };

  const fetchMentorReport = async (uid: string, force = false) => {
    setMentorLoading(true);
    try {
      const res = await fetch("/api/ai-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, forceRefresh: force }),
      });
      if (res.ok) {
        const json = await res.json();
        setMentorReport(json.report);
        if (json.report) {
          localStorage.setItem(`mentor_report_${uid}`, JSON.stringify(json.report));
        }
      }
    } catch (e) {
      console.error("Mentor fetch error:", e);
    } finally {
      setMentorLoading(false);
    }
  };

  const handleShiftSelect = async (shiftId: string) => {
    setSelectedShiftId(shiftId);
    if (user?.id) {
      await supabase.from("users").update({ selected_shift_id: shiftId }).eq("uid", user.id);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  };

  const handleCompleteBacklog = async (id: string) => {
    setBacklogsList((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
  };

  const handleSaveBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submittingBacklog) return;

    let finalTitle = "";
    if (backlogMode === "chapter") {
      const foundChap = chaptersList.find((c) => c.id === selectedChapterId);
      const foundSub = filteredSubjects.find((s) => s.id === selectedSubjectId);
      const prefix = foundChap ? foundChap.name : foundSub ? foundSub.name : "Syllabus Topic";
      finalTitle = backlogTitle.trim() ? `${prefix}: ${backlogTitle.trim()}` : prefix;

      if (selectedChapterId) {
        await supabase.from("chapter_progress").upsert({
          user_id: user.id,
          chapter_id: selectedChapterId,
          is_backlog: true,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      if (!backlogTitle.trim()) return;
      finalTitle = backlogTitle.trim();
    }

    setSubmittingBacklog(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: finalTitle,
          task_type: "backlog",
          priority: backlogPriority,
          status: "pending",
          due_date: backlogDueDate || null,
        })
        .select()
        .single();

      if (!error && data) {
        setBacklogsList((prev) => [data, ...prev]);
        setBacklogTitle("");
        setBacklogDueDate("");
        setShowAddBacklogModal(false);
      }
    } catch (err) {
      console.error("Backlog submit error:", err);
    } finally {
      setSubmittingBacklog(false);
    }
  };

  const calculateDaysLeft = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center text-xs font-bold text-slate-700">
        <span className="animate-spin mr-2">⏳</span> Loading PrepWise Dashboard…
      </div>
    );
  }

  const targetExam = profile?.target_exam || "JEE";
  const allowedClasses = classLevelsForContent(profile?.class_level);
  const todayHours = (todayFocusMins / 60).toFixed(1);

  const sumSplit = splitRatio.theory + splitRatio.practice + splitRatio.revision;
  const totalSplitMins = sumSplit > 0 ? sumSplit : 1;
  const theoryPct = Math.round((splitRatio.theory / totalSplitMins) * 100);
  const practicePct = Math.round((splitRatio.practice / totalSplitMins) * 100);
  const revisionPct = Math.round((splitRatio.revision / totalSplitMins) * 100);

  const studentName =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Champion";
  // Use first name only
  const firstName = studentName.split(" ")[0];

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28 text-[#0F172A] font-sans antialiased">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3">

        {/* 0. HERO WIDGET — Greeting + Anime Quote + Streak */}
        <HeroWidget
          name={firstName}
          streak={streak}
          todayFocusMins={todayFocusMins}
        />

        {/* 1. COMPACT DUAL/SINGLE COUNTDOWN CAROUSEL */}
        <div
          className={`grid gap-2 ${
            examSchedules.length > 1 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {examSchedules.map((exam) => {
            const days = calculateDaysLeft(exam.exam_date);
            const shifts = shiftsMap[exam.id] || [];

            return (
              <div
                key={exam.id}
                className="rounded-2xl p-3 bg-[#0B132B] text-white shadow-md border border-slate-800 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30 truncate">
                    {exam.label}
                  </span>
                  <span className="text-[8.5px] font-semibold text-slate-400 flex-shrink-0">
                    {exam.is_confirmed ? "Official" : "Proj."}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-1 mb-1">
                  <div className="text-2xl font-black tracking-tight text-amber-400 leading-none">
                    {days}
                    <span className="text-[9.5px] font-bold text-slate-300 uppercase ml-1">
                      Days
                    </span>
                  </div>
                  <div className="text-[10px] font-medium text-slate-300">
                    {new Date(exam.exam_date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>

                {shifts.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/10">
                    <select
                      value={selectedShiftId || ""}
                      onChange={(e) => handleShiftSelect(e.target.value)}
                      className="w-full bg-slate-800/90 text-white rounded-lg px-2 py-1 border border-slate-700 text-[9.5px] font-medium focus:outline-none focus:border-amber-400 truncate"
                    >
                      <option value="">Select Shift</option>
                      {shifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.shift_date} ({sh.shift_time})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. AI MENTOR WIDGET */}
        <AiMentorCard
          userId={user?.id}
          targetExam={targetExam}
          report={mentorReport}
          loading={mentorLoading}
          onRefresh={() => fetchMentorReport(user?.id, true)}
          onOpenDoubtSolver={() => setDoubtOpen(true)}
        />

        {/* 3. THREE COCKPIT METRICS */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push("/focus")}
            className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-left active:scale-[0.98] transition-all hover:border-teal-500"
          >
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Today Focus</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">
              {todayHours}
              <span className="text-xs font-semibold text-slate-500 ml-0.5">h</span>
            </div>
            <span className="text-[10px] font-bold text-teal-700 block mt-0.5">Timer →</span>
          </button>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Questions</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{todayQuestions}</div>
            <span className="text-[10px] font-bold text-indigo-700 block mt-0.5">
              All: {totalQuestionsAllTime}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Backlogs</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{backlogsList.length}</div>
            <span
              className={`text-[10px] font-bold block mt-0.5 ${
                backlogsList.length > 0 ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {backlogsList.length > 0 ? "Pending" : "Clean ✓"}
            </span>
          </div>
        </div>

        {/* 4. BACKLOG RADAR WIDGET */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <div className="flex items-center gap-2 text-slate-900">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
              <span className="text-sm font-black">Backlog Radar</span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                {backlogsList.length} Pending
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddBacklogModal(true)}
              className="text-[11px] font-black text-teal-800 bg-teal-100/80 hover:bg-teal-200 border border-teal-300 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs"
            >
              + Add Backlog
            </button>
          </div>

          {backlogsList.length === 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-900 font-bold">
              🎉 Zero backlogs! All homework, DPPs & syllabus chapters are on schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {backlogsList.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        b.priority === "high" ? "bg-rose-600" : b.priority === "medium" ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                    />
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{b.title}</span>
                      {b.due_date && <span className="text-[10px] font-semibold text-slate-500 block">Target: {b.due_date}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCompleteBacklog(b.id)}
                    className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 active:scale-95 flex-shrink-0"
                  >
                    Done ✓
                  </button>
                </div>
              ))}
              {backlogsList.length > 5 && (
                <button
                  type="button"
                  onClick={() => router.push("/library")}
                  className="w-full text-center text-[11px] font-bold text-slate-600 hover:text-slate-900 pt-1.5 block"
                >
                  View all {backlogsList.length} backlogs in Syllabus Tracker →
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. STUDY DISTRIBUTION RATIO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>⚖️</span> Today's Study Split
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              Target: 60% Practice
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex mb-2.5 shadow-inner">
            <div
              style={{ width: `${sumSplit > 0 ? theoryPct : 33}%` }}
              className="bg-amber-500 transition-all"
            />
            <div
              style={{ width: `${sumSplit > 0 ? practicePct : 50}%` }}
              className="bg-teal-600 transition-all"
            />
            <div
              style={{ width: `${sumSplit > 0 ? revisionPct : 17}%` }}
              className="bg-indigo-600 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
            <span className="flex items-center gap-1.5 text-amber-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Theory ({splitRatio.theory}m)
            </span>
            <span className="flex items-center gap-1.5 text-teal-800">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Practice ({splitRatio.practice}m)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-800">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Revision ({splitRatio.revision}m)
            </span>
          </div>
        </div>

        {/* 6. 12-WEEK CONSISTENCY MATRIX */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-3">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>🟩</span> 12-Week Consistency Matrix
            </span>
            <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
              🔥 {streak} Day Streak
            </span>
          </div>

          <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
            {Array.from({ length: 12 }).map((_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cellIdx = weekIdx * 7 + dayIdx;
                  const level = heatGrid[cellIdx] ?? 0;
                  const colors = [
                    "bg-slate-100",
                    "bg-teal-200",
                    "bg-teal-400",
                    "bg-teal-600",
                    "bg-teal-800",
                  ];
                  return (
                    <div
                      key={dayIdx}
                      className={`w-full aspect-square rounded-[2px] ${colors[level]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 justify-end">
            <span className="text-[10px] font-semibold text-slate-400">Less</span>
            {["bg-slate-100", "bg-teal-200", "bg-teal-400", "bg-teal-600", "bg-teal-800"].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] font-semibold text-slate-400">More</span>
          </div>
        </div>

        {/* 7. PRIORITY ACTION ITEMS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>🎯</span> Today's Priority Goals
            </span>
            <button
              type="button"
              onClick={() => router.push("/todo")}
              className="text-[11px] font-bold text-teal-800 hover:underline"
            >
              Open To-Do List →
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-900 font-bold">
              🎉 No pending tasks! Plan goals in your To-Do tab.
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === "high" ? "bg-rose-600" : task.priority === "medium" ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                    />
                    <span className="font-bold text-slate-900 truncate">{task.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 active:scale-95 flex-shrink-0"
                  >
                    Done ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 8. QUICK ROUTE CARDS */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">📚</div>
            <div className="text-xs font-black text-slate-900">Syllabus Tracker</div>
            <div className="text-[10px] font-semibold text-slate-500">Chapters & Backlogs</div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">📊</div>
            <div className="text-xs font-black text-slate-900">Test Hub</div>
            <div className="text-[10px] font-semibold text-slate-500">Log & analyze marks</div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/error-book")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">📕</div>
            <div className="text-xs font-black text-slate-900">Error Book</div>
            <div className="text-[10px] font-semibold text-slate-500">Mistakes & Voice Notes</div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/groups")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">👥</div>
            <div className="text-xs font-black text-slate-900">Study Groups</div>
            <div className="text-[10px] font-semibold text-slate-500">PrepWise World Feed</div>
          </button>
        </div>

        {/* 9. RECENT MOCK TESTS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>📈</span> Recent Mock Performance
            </span>
            <button
              type="button"
              onClick={() => router.push("/tests")}
              className="text-[11px] font-bold text-indigo-700 hover:underline"
            >
              View Hub →
            </button>
          </div>

          {recentTests.length === 0 ? (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-indigo-950">No Tests Logged</div>
                <div className="text-[10px] font-semibold text-slate-600">Log mock test marks to track accuracy</div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/tests")}
                className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                + Log Score
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTests.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-black text-slate-900 text-xs">{t.test_name}</div>
                    <div className="text-[10px] font-semibold text-slate-500">{t.test_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-sm">
                      {t.total_marks} / {t.max_marks}
                    </div>
                    <div className="text-[10px] font-bold text-teal-700">
                      Acc: {t.accuracy || Math.round((t.total_marks / t.max_marks) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 10. BACKLOG MODAL */}
      {showAddBacklogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center text-sm shadow-xs font-bold">
                  🎯
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Add Academic Backlog</h3>
                  <p className="text-[10px] font-semibold text-slate-500">Track and eliminate pending syllabus</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBacklogModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-100">
              <div className="grid grid-cols-2 p-1 bg-slate-200 rounded-xl text-xs font-black">
                <button
                  type="button"
                  onClick={() => setBacklogMode("chapter")}
                  className={`py-2 rounded-lg transition-all ${
                    backlogMode === "chapter"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📚 Chapter Backlog
                </button>
                <button
                  type="button"
                  onClick={() => setBacklogMode("other")}
                  className={`py-2 rounded-lg transition-all ${
                    backlogMode === "other"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🎯 Other (DPP/Test)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveBacklog} className="p-4 space-y-3.5 overflow-y-auto text-xs">
              {backlogMode === "chapter" ? (
                <>
                  {allowedClasses.length > 1 && (
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Select Class
                      </label>
                      <div className="flex gap-2">
                        {allowedClasses.map((cl) => (
                          <button
                            key={cl}
                            type="button"
                            onClick={() => handleClassChange(cl)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-black transition-all ${
                              selectedClass === cl
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            Class {cl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Subject
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600"
                    >
                      {filteredSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} (Class {sub.class_level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Syllabus Chapter
                    </label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600"
                    >
                      {chaptersList.map((chap) => (
                        <option key={chap.id} value={chap.id}>
                          {chap.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Specific Sub-topic / Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={backlogTitle}
                      onChange={(e) => setBacklogTitle(e.target.value)}
                      placeholder="e.g. Only Moment of Inertia & Rolling Motion pending"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Backlog Description / Task Name
                  </label>
                  <input
                    type="text"
                    value={backlogTitle}
                    onChange={(e) => setBacklogTitle(e.target.value)}
                    placeholder="e.g. Allen Mock Test #3 Negative Marking Analysis"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Priority Urgency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBacklogPriority("high")}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                      backlogPriority === "high"
                        ? "bg-rose-100 border-rose-400 text-rose-800 shadow-xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <span>🔴</span> High
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacklogPriority("medium")}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                      backlogPriority === "medium"
                        ? "bg-amber-100 border-amber-400 text-amber-800 shadow-xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <span>🟡</span> Medium
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacklogPriority("low")}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                      backlogPriority === "low"
                        ? "bg-emerald-100 border-emerald-400 text-emerald-800 shadow-xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <span>🟢</span> Low
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Target Elimination Date
                </label>
                <input
                  type="date"
                  value={backlogDueDate}
                  onChange={(e) => setBacklogDueDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBacklogModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-black text-xs hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBacklog || (backlogMode === "other" && !backlogTitle.trim())}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 disabled:opacity-40 transition-all shadow-md"
                >
                  {submittingBacklog ? "Saving…" : "Save Backlog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Doubt Solver Sheet */}
      <AiChatSheet open={doubtOpen} onClose={() => setDoubtOpen(false)} />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

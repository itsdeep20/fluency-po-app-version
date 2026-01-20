import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence, signInWithCredential
} from 'firebase/auth';
import {
  initializeFirestore, collection, query, getDoc, setDoc, addDoc, onSnapshot,
  doc, serverTimestamp, orderBy, getDocs, limit, where, deleteDoc, increment, updateDoc
} from 'firebase/firestore';

import {
  Send, Zap, Swords, Sword, MessageSquare, Trophy, Briefcase, Coffee, Stethoscope,
  Train, Plane, Loader2, LogOut, MessageCircle, Target, Home,
  Users, Hash, Clock, Award, User, X, Info, Play, Menu, Settings, HelpCircle, Sparkles,
  ChevronUp, ChevronDown, AlertTriangle, Mic, MicOff, Volume2, VolumeX, Lightbulb, Globe,
  FileText, Download, TrendingUp, TrendingDown, BarChart3, BookOpen, History, Square, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import WinnerReveal from './WinnerReveal';
import ScoringGuide from './ScoringGuide';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// ===== PROFESSIONAL SOUND UTILITIES =====
const createAudioContext = () => {
  return new (window.AudioContext || window.webkitAudioContext)();
};

// Celebration sound - triumphant, joyful chord progression
const playCelebrationSound = () => {
  try {
    const ctx = createAudioContext();
    const now = ctx.currentTime;

    // Create a triumphant chord (C major with octave)
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + 1.5);
    });
  } catch (e) { console.log('Sound error:', e); }
};

// Message send sound - quick, subtle pop
const playSendSound = () => {
  try {
    const ctx = createAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { console.log('Sound error:', e); }
};

// Message receive sound - gentle, warm notification
const playReceiveSound = () => {
  try {
    const ctx = createAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) { console.log('Sound error:', e); }
};

// Invitation received sound - attention-grabbing but pleasant
const playInviteReceivedSound = () => {
  try {
    const ctx = createAudioContext();
    const now = ctx.currentTime;

    // Two-tone chime (like a doorbell)
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.12, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.5);
    });
  } catch (e) { console.log('Sound error:', e); }
};

// Invitation declined sound - soft, understanding tone
const playDeclinedSound = () => {
  try {
    const ctx = createAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { console.log('Sound error:', e); }
};

// Fire confetti with celebration
const fireCelebrationConfetti = (withSound = true) => {
  if (withSound) playCelebrationSound();

  // First burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
  });

  // Side bursts
  setTimeout(() => {
    confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#FF6B6B', '#4ECDC4'] });
    confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#45B7D1', '#96CEB4', '#FFEAA7'] });
  }, 200);
};
// ===== END SOUND UTILITIES =====

// Helper to call backend - uses native fetch now that server CORS is configured
const callBackend = async (endpoint, method, body, token) => {
  const response = await fetch(endpoint, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }
  return response.json();
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let auth, db, analytics;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Use initializeFirestore with long polling for Android WebView compatibility
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
  analytics = getAnalytics(app);
} catch (e) { console.error("Firebase init error", e); }

// Avatar tiers - some are locked until accuracy milestones
const AVATAR_TIERS = {
  free: ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🦄', '🐲', '🌸', '🔥', '🦅'], // Always unlocked (eagle added!)
  tier50: ['🐬', '🦋', '🐺', '🌟', '🍀'], // Unlock at 50% accuracy
  tier70: ['💎', '🎸', '👨‍💼', '👩‍💼', '🧑‍🎓', '👨‍🎨'], // Unlock at 70% accuracy
  tier85: ['👩‍🔬', '🧙‍♂️', '🦸‍♂️', '🦸‍♀️'], // Unlock at 85% accuracy
  tier95: ['🧑‍🚀', '👸', '🤴', '🥷'], // Unlock at 95% accuracy (Master)
};

// Helper to check if avatar is unlocked based on accuracy
const isAvatarUnlocked = (avatar, avgScore) => {
  if (AVATAR_TIERS.free.includes(avatar)) return true;
  if (AVATAR_TIERS.tier50.includes(avatar)) return avgScore >= 50;
  if (AVATAR_TIERS.tier70.includes(avatar)) return avgScore >= 70;
  if (AVATAR_TIERS.tier85.includes(avatar)) return avgScore >= 85;
  if (AVATAR_TIERS.tier95.includes(avatar)) return avgScore >= 95;
  return true;
};

// All avatars in display order
const AVATARS = [
  ...AVATAR_TIERS.free,
  ...AVATAR_TIERS.tier50,
  ...AVATAR_TIERS.tier70,
  ...AVATAR_TIERS.tier85,
  ...AVATAR_TIERS.tier95,
];

const SIMULATIONS = [
  {
    id: 'sim_interview', cat: 'Career', title: 'Job Interview', icon: Briefcase, color: 'bg-blue-500',
    desc: 'Nail your next interview.',
    stages: [
      { name: 'Reception', icon: '🏢', npc: 'Receptionist Priya' },
      { name: 'HR Round', icon: '👔', npc: 'HR Manager Sharma' },
      { name: 'Technical Round', icon: '💼', npc: 'Tech Lead Rahul' },
      { name: 'Salary Discussion', icon: '💰', npc: 'HR Manager Sharma' },
      { name: 'Offer Discussion', icon: '🤝', npc: 'Director Verma' }
    ],
    greeting: "Welcome! 🏢 I'm Priya from reception. Here for the interview? May I have your name?"
  },
  {
    id: 'sim_cafe', cat: 'Social', title: 'Coffee Shop', icon: Coffee, color: 'bg-amber-500',
    desc: 'Order drinks & snacks.',
    stages: [
      { name: 'Counter', icon: '☕', npc: 'Barista Ankit' },
      { name: 'Customization', icon: '🥛', npc: 'Barista Ankit' },
      { name: 'Add Snacks', icon: '🍰', npc: 'Barista Ankit' },
      { name: 'Payment', icon: '💳', npc: 'Barista Ankit' },
      { name: 'Pickup', icon: '✅', npc: 'Barista Ankit' }
    ],
    greeting: "Hey! ☕ Welcome to Chai & Coffee House! I'm Ankit. What would you like today?"
  },
  {
    id: 'sim_doctor', cat: 'Health', title: 'Doctor Visit', icon: Stethoscope, color: 'bg-red-500',
    desc: 'Describe symptoms clearly.',
    stages: [
      { name: 'Reception', icon: '📋', npc: 'Receptionist Neha' },
      { name: 'Registration', icon: '📝', npc: 'Receptionist Neha' },
      { name: 'Waiting Room', icon: '🪑', npc: 'Nurse Kavya' },
      { name: 'Consultation', icon: '🩺', npc: 'Dr. Mehta' },
      { name: 'Diagnosis', icon: '🔬', npc: 'Dr. Mehta' },
      { name: 'Prescription', icon: '📋', npc: 'Dr. Mehta' },
      { name: 'Pharmacy', icon: '💊', npc: 'Pharmacist Rohit' }
    ],
    greeting: "Good morning! 🏥 I'm Neha at reception. Do you have an appointment or walk-in?"
  },
  {
    id: 'sim_station', cat: 'Travel', title: 'Train Station', icon: Train, color: 'bg-green-500',
    desc: 'Book tickets confidently.',
    stages: [
      { name: 'Enquiry', icon: '🧑‍💼', npc: 'Help Desk Ravi' },
      { name: 'Ticket Booking', icon: '🎫', npc: 'Counter Staff Sunita' },
      { name: 'Payment', icon: '💳', npc: 'Counter Staff Sunita' },
      { name: 'Platform', icon: '🚉', npc: 'Platform Attendant' },
      { name: 'On Board', icon: '🚂', npc: 'TTE Officer Singh' }
    ],
    greeting: "Welcome to the Railway Station! 🚉 I'm Ravi. Where would you like to travel by train today?"
  },
  {
    id: 'sim_travel', cat: 'Travel', title: 'Airport Check-in', icon: Plane, color: 'bg-indigo-500',
    desc: 'Navigate airport confidently.',
    stages: [
      { name: 'Check-in Counter', icon: '🛂', npc: 'Agent Simran' },
      { name: 'Baggage Check', icon: '🧳', npc: 'Agent Simran' },
      { name: 'Security Check', icon: '🔍', npc: 'CISF Officer Kapoor' },
      { name: 'Immigration', icon: '🛃', npc: 'Immigration Officer' },
      { name: 'Boarding Gate', icon: '🚪', npc: 'Gate Agent Diya' },
      { name: 'On Board', icon: '✈️', npc: 'Flight Attendant Meera' }
    ],
    greeting: "Good morning! ✈️ I'm Simran at check-in. May I see your ID and booking please?"
  },
  {
    id: 'sim_friend', cat: 'Wellness', title: 'Supportive Chat', icon: Users, color: 'bg-purple-500',
    desc: 'Talk to a caring friend.',
    stages: [
      { name: 'Opening Up', icon: '💭', npc: 'Your Friend Aisha' },
      { name: 'Feeling Better', icon: '✨', npc: 'Your Friend Aisha' }
    ],
    greeting: "Hey! 💜 I'm always here for you. How are you really feeling today?"
  },
];

const STAT_INFO = {
  streak: { title: '🔥 Practice Streak', desc: 'Your consecutive practice days! Next milestone: Keep practicing daily to build a strong habit. Every day counts! 💪' },
  points: { title: '⭐ Total Points', desc: 'Points earned from all your sessions. Keep practicing to earn more and climb the leaderboard!' },
  level: { title: '🏆 Your Level', desc: 'Your English proficiency level based on practice performance. Keep improving to unlock the next badge! Practice more to level up! 🚀' },
  avgScore: { title: '📊 Accuracy Score', desc: 'This score reflects deep analysis of your grammar, vocabulary, and fluency from sessions & battles. Practice regularly to boost your accuracy! ✨' },
};

// Helper function to compute level from accuracy (Hybrid naming for clarity)
const getLevelFromAccuracy = (avgScore) => {
  if (avgScore >= 95) return { name: 'Master', icon: '★★★★', gradient: 'from-yellow-500 to-amber-500' };
  if (avgScore >= 85) return { name: 'Pro', icon: '★★★', gradient: 'from-purple-500 to-indigo-500' };
  if (avgScore >= 70) return { name: 'Improver', icon: '★★', gradient: 'from-blue-500 to-cyan-500' };
  if (avgScore >= 50) return { name: 'Learner', icon: '★', gradient: 'from-emerald-500 to-teal-500' };
  return { name: 'Starter', icon: '☆', gradient: 'from-slate-400 to-slate-500' };
};

const App = () => {
  const KNOWN_BOTS = {
    'Aman': 'bot_aman', 'Rahul': 'bot_rahul', 'Neha': 'bot_neha', 'Pooja': 'bot_pooja',
    'Rohit': 'bot_rohit', 'Simran': 'bot_simran', 'Ankit': 'bot_ankit',
    'Priya': 'bot_priya', 'Kavya': 'bot_kavya', 'Diya': 'bot_diya', 'Riya': 'bot_riya'
  };

  // Bot avatars for fallback when not stored in chat record
  const BOT_AVATARS = {
    'Aman': '🧑🏽', 'Rahul': '👨🏽', 'Neha': '👩🏽', 'Pooja': '👩🏽‍💼',
    'Rohit': '👨🏽‍💻', 'Simran': '👧🏽', 'Ankit': '🧔🏽',
    'Priya': '👩🏽‍🎓', 'Kavya': '👩🏽‍💻', 'Diya': '👩🏽', 'Riya': '👩🏽‍🍳'
  };

  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [view, setView] = useState('landing');

  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stats, setStats] = useState({ streak: 0, points: 0, level: 'Starter', sessions: 0, avgScore: 0, lastPracticeDate: null, battleWins: 0, battleLosses: 0 });
  const [userAvatar, setUserAvatar] = useState('🦁');
  const [sessionPoints, setSessionPoints] = useState(0);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [lastCorrection, setLastCorrection] = useState(null);
  const [showPointsAnimation, setShowPointsAnimation] = useState(null);
  const [minimizedCorrections, setMinimizedCorrections] = useState({});
  const [messageAccuracies, setMessageAccuracies] = useState([]); // V7: Track per-message accuracy scores
  const [battleAccuracies, setBattleAccuracies] = useState([]); // V8: Track per-message accuracy in Battle Mode

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimeOver, setShowTimeOver] = useState(false); // Bug 3: Time's Up notification
  const timerRef = useRef(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatusText, setSearchStatusText] = useState("Finding a partner...");
  const searchTimeoutRef = useRef(null);
  const matchListener = useRef(null);
  const chatListener = useRef(null);
  const lastOpponentMsgTimeRef = useRef(Date.now()); // Track last opponent message for inactivity
  const lastMyMsgTimeRef = useRef(0); // Track when I sent my last message
  const inactivityTimerRef = useRef(null); // Timer to check opponent inactivity
  // Stale Closure Fix Refs (Bug 6)
  const messagesRef = useRef([]);
  const battleAccuraciesRef = useRef([]);
  const battleCorrectionsRef = useRef([]); // Ref for battle corrections (stale closure fix)

  // Sync refs with state immediately
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { battleAccuraciesRef.current = battleAccuracies; }, [battleAccuracies]);
  const randomSearchListener = useRef(null);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStatInfo, setShowStatInfo] = useState(null);
  // Progress Report Feature
  const [showProgressReport, setShowProgressReport] = useState(false);
  const [progressReportData, setProgressReportData] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const [dualAnalysis, setDualAnalysis] = useState(null);
  const [battleOpponentData, setBattleOpponentData] = useState(null); // Captured opponent for WinnerReveal
  const [showWinnerReveal, setShowWinnerReveal] = useState(false);
  const [sessionEndTransition, setSessionEndTransition] = useState(null); // 'opponent_left' | 'time_over' | null
  const [showMenu, setShowMenu] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null); // 'practice' | 'compete' | 'friend' | 'google' | 'guest'
  const [recentChats, setRecentChats] = useState([]);

  const [pendingInvites, setPendingInvites] = useState([]);
  const [preparingSim, setPreparingSim] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [motherTongue, setMotherTongue] = useState('Hindi');
  // Enhanced Settings
  const [sessionDuration, setSessionDuration] = useState(7); // 3, 5, 7 minutes or 0 for Never
  const [soundEnabled, setSoundEnabled] = useState(true); // Sound effects toggle
  const [difficultyLevel, setDifficultyLevel] = useState('Medium'); // Easy, Medium, Hard
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState(null);
  const [helpFeedbackText, setHelpFeedbackText] = useState('');
  const [helpFeedbackRating, setHelpFeedbackRating] = useState(0);
  const [helpFeedbackSubmitted, setHelpFeedbackSubmitted] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(''); // AI-generated personalized feedback
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [showMistakesPopup, setShowMistakesPopup] = useState(false); // Full-screen mistakes list popup
  const [showAchievements, setShowAchievements] = useState(false);
  const [showScoringGuide, setShowScoringGuide] = useState(false); // Scoring tips guide
  const [lockedAvatarModal, setLockedAvatarModal] = useState(null); // Bug 5: Beautiful locked avatar popup
  const [showDetailedExplanation, setShowDetailedExplanation] = useState(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [showLevelProgress, setShowLevelProgress] = useState(false); // Badge progression popup
  const [showStreakMilestone, setShowStreakMilestone] = useState(null); // Streak milestone celebration (3, 7, 15, 30)
  const [showStreakProgress, setShowStreakProgress] = useState(false); // Streak milestones view popup
  const [showAccuracyInfo, setShowAccuracyInfo] = useState(false); // Accuracy explanation popup
  const [showPointsInfo, setShowPointsInfo] = useState(false); // Points explanation popup
  const [showStudyGuideModal, setShowStudyGuideModal] = useState(false); // Study Guide PDF modal
  const [studyGuideFilter, setStudyGuideFilter] = useState('3days'); // '3days', '7days', '30days', 'all'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfGenerationStep, setPdfGenerationStep] = useState(''); // Current animation step
  const [pdfProgress, setPdfProgress] = useState(0); // Progress percentage 0-100
  const [isGeneratingWorkbook, setIsGeneratingWorkbook] = useState(false); // State for practice workbook
  const [workbookStep, setWorkbookStep] = useState('');
  const [workbookProgress, setWorkbookProgress] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null); // Track session start for duration
  const [lastPdfDownload, setLastPdfDownload] = useState(null);
  const [progressGraphMode, setProgressGraphMode] = useState('accuracy'); // 'accuracy' or 'time'
  const prevLevelRef = useRef(null); // Track previous level for badge unlock detection
  const prevStreakRef = useRef(0); // Track previous streak for milestone detection
  const isEndingRef = useRef(false);
  const isJoiningRef = useRef(false);
  const isAlertingRef = useRef(false);

  // Typing & Visibility Logic for Battle/Bot Mode
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [visibleMessageIds, setVisibleMessageIds] = useState(new Set());
  const processedMessageIds = useRef(new Set());

  // Voice-to-Text & Text-to-Speech
  const [isListening, setIsListening] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false); // TTS disabled by default for reading focus
  const isSpeakerOnRef = useRef(false); // Ref to track current value for closures
  const recognitionRef = useRef(null);
  const typingQueue = useRef([]);
  const isSyncingQueue = useRef(false);
  const isSyncingInitialRef = useRef(true);
  const [isEnding, setIsEnding] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState(null); // 'timeout' | 'opponent_left' | 'time_up' | null
  const messagesEndRef = useRef(null);

  // AI Assist & Translation Feature States
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [isAiAssistOn, setIsAiAssistOn] = useState(true); // ON by default
  const [isTranslationOn, setIsTranslationOn] = useState(true); // ON by default
  const [isBattleTipsOn, setIsBattleTipsOn] = useState(true); // ON by default - Battle Tips
  const isBattleTipsOnRef = useRef(isBattleTipsOn); // Ref for stale closure prevention
  useEffect(() => { isBattleTipsOnRef.current = isBattleTipsOn; }, [isBattleTipsOn]);

  const [battleCorrections, setBattleCorrections] = useState([]); // Track battle corrections for PDF
  // Sync battleCorrections to ref for stale closure prevention
  useEffect(() => { battleCorrectionsRef.current = battleCorrections; }, [battleCorrections]);
  const [showAiAssistPopup, setShowAiAssistPopup] = useState(null); // { messageId, message, context }
  const [showTranslationPopup, setShowTranslationPopup] = useState(null); // { messageId, translation }
  const [isLoadingAssist, setIsLoadingAssist] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [nativeFeedbackPopup, setNativeFeedbackPopup] = useState(null); // { text: translatedText, source: 'simulation'|'battle'|'progress' }
  const longPressTimer = useRef(null);
  const [shouldShakeButtons, setShouldShakeButtons] = useState(false);
  const shakeTimer = useRef(null);

  const adjustedTimestamps = useRef({}); // New ref to track visual display time


  // Live Users & Presence System
  const [activeUsersTab, setActiveUsersTab] = useState('live'); // 'live' or 'recent'
  const [liveUsers, setLiveUsers] = useState([]);
  const [incomingInvitation, setIncomingInvitation] = useState(null);
  const [invitationCountdown, setInvitationCountdown] = useState(16);
  const [senderCountdown, setSenderCountdown] = useState(16); // Timer for sender while waiting
  const [toastNotification, setToastNotification] = useState(null); // {type: 'success'|'error'|'info', message: string, avatar?: string}
  const [pendingInviteTarget, setPendingInviteTarget] = useState(null); // For confirmation popup
  const [sentInviteTarget, setSentInviteTarget] = useState(null); // Track who we sent to
  const [offlineUserTarget, setOfflineUserTarget] = useState(null); // For offline user popup
  const invitationTimerRef = useRef(null);
  const senderTimerRef = useRef(null); // Timer ref for sender countdown
  const sentInviteTargetRef = useRef(null); // Ref for cleaning up on unmount
  const presenceRef = useRef(null);
  const presenceListenerRef = useRef(null);
  const invitationListenerRef = useRef(null);
  const heartbeatRef = useRef(null);

  // Auto-dismiss toast notifications after 4 seconds
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Sync isSpeakerOnRef with state for closure access
  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
    console.log('[SPEAKER] State changed:', isSpeakerOn);
  }, [isSpeakerOn]);

  // PDF History - Centralized State Management
  const [pdfHistory, setPdfHistory] = useState([]);
  const [showPdfHistory, setShowPdfHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  // Centralized function to refresh PDF history from server
  const refreshPdfHistory = useCallback(async () => {
    if (!user) {
      console.log('[PDF History] No user, skipping refresh');
      return;
    }

    console.log('[PDF History] Refreshing from server...');
    setLoadingHistory(true);

    try {
      const token = await user.getIdToken();
      // Use callBackend helper
      const data = await callBackend(BACKEND_URL, 'POST', {
        type: 'get_pdf_history',
        userId: user.uid
      }, token);
      /*const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'get_pdf_history',
          userId: user.uid
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();*/

      if (data.history && Array.isArray(data.history)) {
        setPdfHistory(data.history);
        console.log(`[PDF History] ✓ Loaded ${data.history.length} items`);
      } else if (data.error) {
        console.error('[PDF History] Server error:', data.error);
      }
    } catch (e) {
      console.error('[PDF History] Refresh failed:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  // Load history when modal opens
  useEffect(() => {
    if ((showStudyGuideModal || showProgressReport) && user) {
      refreshPdfHistory();
    }
  }, [showStudyGuideModal, showProgressReport, user, refreshPdfHistory]);

  const resetChatStates = () => {
    isSyncingQueue.current = false;
    typingQueue.current = [];
    processedMessageIds.current.clear();
    adjustedTimestamps.current = {}; // Reset timestamps
    isSyncingInitialRef.current = true;
    setVisibleMessageIds(new Set());
    setIsOpponentTyping(false);
    setMessages([]); // CRITICAL: Purge old messages
  };

  const typingListener = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleTyping = async (isTyping) => {
    if (!activeSession || !activeSession.id || activeSession.type !== 'human') return;

    // update my typing status in the match doc
    // Debounce to prevent spam
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'queue', activeSession.id);
        console.log('[TYPING] Updating typing status:', isTyping, 'for user:', user.uid);
        await setDoc(docRef, {
          typing: { [user.uid]: isTyping }
        }, { merge: true });
      } catch (e) { console.error("Typing update error", e); }
    }, 50); // Very short delay for instant feel
  };

  const processTypingQueue = async () => {
    if (isSyncingQueue.current || typingQueue.current.length === 0) return;
    isSyncingQueue.current = true;
    console.log('TYPING_QUEUE: Start processing', typingQueue.current.length);

    try {
      while (typingQueue.current.length > 0) {
        const m = typingQueue.current.shift();
        console.log('TYPING_QUEUE: Typing', m.id);

        // Ensure message is in the list AND sorted
        setMessages(prev => {
          if (prev.find(ex => ex.id === m.id)) return prev;
          const updated = [...prev, m];
          return updated.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        });

        setIsOpponentTyping(true);
        const delay = Math.min(Math.max(m.text.length * 45, 2000), 5000);
        await new Promise(r => setTimeout(r, delay));

        // VISUAL APPEND: Update timestamp to NOW so it jumps to bottom
        const now = Date.now();
        adjustedTimestamps.current[m.id] = now;

        console.log('TYPING_QUEUE: Reveal', m.id, 'at', now);
        setVisibleMessageIds(prev => new Set([...prev, m.id]));
        playReceiveSound(); // Play receive sound

        // Text-to-Speech for opponent message (uses WaveNet audio if available)
        speakText(m.text, m.audioBase64);

        // Re-sort messages with new timestamp
        setMessages(prev => {
          const updated = [...prev];
          return updated.sort((a, b) => {
            const tA = adjustedTimestamps.current[a.id] || a.createdAt || 0;
            const tB = adjustedTimestamps.current[b.id] || b.createdAt || 0;
            return tA - tB;
          });
        });

        // Hide dots immediately if nothing else is in the queue
        if (typingQueue.current.length === 0) {
          setIsOpponentTyping(false);
        }

        // Tiny gap between consecutive messages
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (e) {
      console.error("Typing queue error:", e);
    } finally {
      setIsOpponentTyping(false);
      isSyncingQueue.current = false;
      console.log('TYPING_QUEUE: Cycle complete');
      // TAIL CHECK: If something arrived during our loop, restart it
      if (typingQueue.current.length > 0) {
        console.log('TYPING_QUEUE: Tail check triggered');
        processTypingQueue();
      }
    }
  };

  // Analytics tracking helper - increment counters in Firestore
  const trackAnalytics = async (field) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        analytics: { [field]: increment(1) }
      }, { merge: true });
      console.log('[ANALYTICS] Tracked:', field);
    } catch (e) {
      console.error('[ANALYTICS] Error tracking:', field, e);
    }
  };



  // Effects

  // Dark Mode Effect - Apply class to document
  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#111827';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
    }
  }, [isDarkTheme]);

  useEffect(() => {
    if (auth) {
      setPersistence(auth, browserLocalPersistence).catch(console.error);
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u); setIsAuthChecking(false);
        if (u) setView(v => v === 'landing' ? 'dashboard' : v); else { setUser(null); setView('landing'); }
      });
      return () => unsub();
    } else setIsAuthChecking(false);
  }, []);

  // Trigger confetti when session summary shows with 70%+ accuracy
  useEffect(() => {
    if (showSessionSummary && showSessionSummary.accuracy >= 70) {
      setTimeout(() => fireCelebrationConfetti(true), 300);
    }
  }, [showSessionSummary]);

  // Save settings to Firestore when any setting changes
  const isLoadingSettingsRef = useRef(false); // Prevent save during load
  useEffect(() => {
    if (!user) return;
    // Skip if currently loading from Firestore (prevents infinite loop)
    if (isLoadingSettingsRef.current) return;
    // Skip initial load
    if (!window._settingsInitialized) {
      window._settingsInitialized = true;
      return;
    }
    const settings = {
      isDarkTheme,
      motherTongue,
      sessionDuration,
      soundEnabled,
      difficultyLevel,
      isSpeakerOn
    };
    console.log('[SETTINGS] Saving to Firestore:', settings);
    setDoc(doc(db, 'users', user.uid), { settings }, { merge: true })
      .catch(e => console.error('[SETTINGS] Save error:', e));
  }, [user, isDarkTheme, motherTongue, sessionDuration, soundEnabled, difficultyLevel, isSpeakerOn]);

  useEffect(() => {
    if (!user) {
      setStats({ streak: 0, points: 0, level: 'Starter', sessions: 0, avgScore: 0, lastPracticeDate: null });
      setRecentChats([]);
      return;
    }

    const docRef = doc(db, 'users', user.uid);

    // 1. User Stats Listener
    const unsubStats = onSnapshot(docRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStats(prev => ({ ...prev, ...data.stats }));
        if (data.userAvatar) setUserAvatar(data.userAvatar);

        // Load saved settings from Firestore
        if (data.settings) {
          // Set flag to prevent save useEffect from triggering during load
          isLoadingSettingsRef.current = true;
          if (data.settings.isDarkTheme !== undefined) setIsDarkTheme(data.settings.isDarkTheme);
          if (data.settings.motherTongue) setMotherTongue(data.settings.motherTongue);
          if (data.settings.sessionDuration !== undefined) setSessionDuration(data.settings.sessionDuration);
          if (data.settings.soundEnabled !== undefined) setSoundEnabled(data.settings.soundEnabled);
          if (data.settings.difficultyLevel) setDifficultyLevel(data.settings.difficultyLevel);
          if (data.settings.isSpeakerOn !== undefined) setIsSpeakerOn(data.settings.isSpeakerOn);
          if (data.settings.isBattleTipsOn !== undefined) setIsBattleTipsOn(data.settings.isBattleTipsOn);
          console.log('[SETTINGS] Loaded from Firestore:', data.settings);
          // Reset flag after React batches the updates (use setTimeout to ensure it's after the render)
          setTimeout(() => { isLoadingSettingsRef.current = false; }, 100);
        }

        // MIGRATION: Add email for existing users who don't have it (runs once per user)
        // Use auth.currentUser to get fresh user data (avoid stale closure issues)
        const currentAuthUser = auth.currentUser;
        const needsEmailMigration = (!data.email || data.email === '' || data.email === null) && currentAuthUser?.email;
        console.log('[MIGRATION_DEBUG] Check:', {
          dataEmail: data.email,
          authEmail: currentAuthUser?.email,
          needsMigration: needsEmailMigration
        });
        if (needsEmailMigration) {
          console.log('[MIGRATION] Adding email for existing user:', currentAuthUser.email);
          await setDoc(docRef, {
            email: currentAuthUser.email,
            displayName: currentAuthUser.displayName || data.displayName || 'Player',
            uid: currentAuthUser.uid
          }, { merge: true });
          console.log('[MIGRATION] Successfully added email!');
        }

        // Update last active timestamp (throttled to once per session)
        if (!window._lastActiveUpdated) {
          window._lastActiveUpdated = true;
          await setDoc(docRef, { lastActiveAt: serverTimestamp() }, { merge: true });
        }
      } else {
        // Initial setup if doc doesn't exist - include user details and analytics
        const deviceType = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Player',
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
          deviceType: deviceType,
          stats: { streak: 0, points: 0, level: 'Starter', sessions: 0, avgScore: 0, lastPracticeDate: null },
          userAvatar,
          lastBots: [],
          // Analytics structure
          analytics: {
            aiAssistClicks: 0,
            translationClicks: 0,
            pdfGenerations: 0,
            explainClicks: 0,
            battleBotsJoined: 0,
            battleHumansRandom: 0,
            battleHumansInvite: 0,
            battleHumansRoom: 0,
            invitesSent: 0,
            invitesAccepted: 0,
            invitesDeclined: 0,
            totalTimeSpentSeconds: 0
          },
          // Settings state
          settings: {
            isAiAssistOn: true,
            isTranslationOn: true,
            isBattleTipsOn: false,
            isSpeakerOn: false,
            motherTongue: 'Hindi'
          }
        });
      }
    }, (err) => console.error("Stats listener error:", err));

    // 2. Recent Sessions Listener
    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const sessionsQuery = query(sessionsRef, orderBy('timestamp', 'desc'), limit(15));

    const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
      const recentSessions = snap.docs.map(docSnap => {
        const data = docSnap.data();
        const sim = SIMULATIONS.find(s => s.id === data.simId);
        return {
          id: docSnap.id,
          type: (data.type === '1v1' || data.type === 'battle-bot') ? 'battle' : 'simulation',
          battleType: data.type, // 'battle-bot', '1v1', or undefined for simulations
          title: data.simName || data.opponentName || 'Session',
          simId: data.simId,
          opponentId: data.opponentId, // For 1v1 human replay
          opponentName: data.opponentName || data.simName,
          lastMessage: data.lastMessage || `Score: ${data.score || data.accuracy || 0}%`,
          timestamp: data.timestamp?.toDate() || new Date(),
          accuracy: data.accuracy || data.score || 0,
          points: data.points,
          opponentAvatar: data.opponentAvatar || sim?.icon || '🤖',
          won: data.won
        };
      });
      setRecentChats(recentSessions);
    }, (err) => console.error("Sessions listener error:", err));

    return () => {
      unsubStats();
      unsubSessions();
    };
  }, [user]);

  // Aggressive Warmup on Dashboard Mount
  useEffect(() => {
    if (view === 'dashboard' && user) {
      user.getIdToken().then(token => {
        // Use callBackend helper
        callBackend(BACKEND_URL, 'POST', { type: 'warmup' }, token)
          .catch(() => { });
        /*fetch(`${BACKEND_URL}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'warmup' })
        }).catch(() => { });*/
      });
    }
  }, [view, user]);

  // ===== HYBRID PRESENCE SYSTEM =====
  // Primary: Event-based (instant status updates)
  // Secondary: 60s heartbeat backup (catches crashes)
  const PRESENCE_CONFIG = {
    HEARTBEAT_INTERVAL: 60000,    // 60 seconds (6x reduction from 10s)
    STALE_THRESHOLD: 150000,      // 2.5 minutes
    STATUS: { LIVE: 'live', BUSY: 'busy', OFFLINE: 'offline' }
  };

  // Helper to update presence status
  const updatePresenceStatus = useCallback(async (status, activity = null) => {
    if (!user || !db) return;

    const presenceDocRef = doc(db, 'presence', user.uid);
    const presenceData = {
      name: user.displayName || 'Player',
      avatar: userAvatar,
      level: getLevelFromAccuracy(stats.avgScore || 0).name,
      status: status,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (activity) presenceData.activity = activity;

    console.log('[PRESENCE] SET:', status, activity || '', user.uid);

    try {
      await setDoc(presenceDocRef, presenceData, { merge: true });
    } catch (e) {
      console.error('[PRESENCE] Update error:', e);
    }
  }, [user, db, userAvatar, stats.avgScore]);

  // Presence Tracking with Hybrid Approach
  useEffect(() => {
    if (!user || !db) return;

    const presenceDocRef = doc(db, 'presence', user.uid);
    const { HEARTBEAT_INTERVAL, STALE_THRESHOLD, STATUS } = PRESENCE_CONFIG;

    // Determine status based on current view
    const getStatusForView = (currentView) => {
      if (currentView === 'dashboard') return STATUS.LIVE;
      // All these views mean user is busy (in battle, chat, simulation, etc.)
      if (['session', 'friendSession', 'randomSession', 'simSession', 'chat', 'simulations', 'analyzing', 'ending'].includes(currentView)) return STATUS.BUSY;
      return STATUS.OFFLINE;
    };

    const currentStatus = getStatusForView(view);
    const currentActivity = view === 'dashboard' ? 'dashboard' :
      view.includes('Session') ? 'battle' : view;

    // Function to update presence based on visibility
    const updatePresence = (isVisible) => {
      if (!isVisible) {
        console.log('[PRESENCE] Tab hidden - marking offline');
        setDoc(presenceDocRef, {
          status: STATUS.OFFLINE,
          lastSeen: serverTimestamp()
        }, { merge: true }).catch(e => console.error('[PRESENCE] Visibility error:', e));
      } else if (view === 'dashboard') {
        console.log('[PRESENCE] Tab visible on dashboard - marking live');
        updatePresenceStatus(STATUS.LIVE, 'dashboard');
      } else {
        console.log('[PRESENCE] Tab visible in session - marking busy');
        updatePresenceStatus(STATUS.BUSY, currentActivity);
      }
    };

    // Initial presence set based on view
    console.log('[PRESENCE] View changed to:', view, '| Status:', currentStatus);
    updatePresenceStatus(currentStatus, currentActivity);

    // Listen for visibility changes (tab switching, minimize, etc.)
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      updatePresence(isVisible);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Window focus/blur for more accuracy
    const handleFocus = () => {
      console.log('[PRESENCE] Window focused');
      if (document.visibilityState === 'visible') {
        updatePresenceStatus(currentStatus, currentActivity);
      }
    };
    const handleBlur = () => {
      console.log('[PRESENCE] Window blurred');
      // Don't immediately go offline on blur - wait for visibility change
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // ANDROID: Listen for app state changes (screen on/off, app to background)
    let appStateListener = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', (state) => {
        console.log('[PRESENCE] App state changed:', state.isActive ? 'ACTIVE' : 'BACKGROUND');
        if (state.isActive) {
          // App came to foreground - restore current status
          updatePresenceStatus(currentStatus, currentActivity);
        } else {
          // App went to background (screen off, home button, etc.) - mark offline
          setDoc(presenceDocRef, {
            status: STATUS.OFFLINE,
            lastSeen: serverTimestamp()
          }, { merge: true }).catch(e => console.error('[PRESENCE] App background error:', e));
        }
      }).then(listener => {
        appStateListener = listener;
      });
    }

    // HYBRID: 60-second heartbeat backup (only updates lastSeen)
    heartbeatRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('[PRESENCE] HEARTBEAT:', user.uid);
        setDoc(presenceDocRef, { lastSeen: serverTimestamp() }, { merge: true })
          .catch(e => console.error('[PRESENCE] Heartbeat error:', e));
      }
    }, HEARTBEAT_INTERVAL);

    // Listen for all non-offline users (live or busy)
    const liveQuery = query(
      collection(db, 'presence'),
      where('status', 'in', [STATUS.LIVE, STATUS.BUSY])
    );
    presenceListenerRef.current = onSnapshot(liveQuery, (snap) => {
      const now = Date.now();

      const live = snap.docs
        .filter(d => d.id !== user.uid)
        .map(d => ({ id: d.id, ...d.data() }))
        // Filter out stale users (lastSeen more than 2.5 minutes ago)
        .filter(u => {
          if (!u.lastSeen) return false;
          const lastSeenMs = u.lastSeen.toMillis ? u.lastSeen.toMillis() : u.lastSeen;
          const secondsAgo = Math.round((now - lastSeenMs) / 1000);
          const isRecent = (now - lastSeenMs) < STALE_THRESHOLD;
          if (!isRecent) {
            console.log('[PRESENCE] FILTER_STALE:', u.name, 'last seen', secondsAgo, 'seconds ago');
          }
          return isRecent;
        })
        // Sort: live users first, then busy users
        .sort((a, b) => {
          if (a.status === 'live' && b.status === 'busy') return -1;
          if (a.status === 'busy' && b.status === 'live') return 1;
          return 0;
        })
        // Limit to 50 users max
        .slice(0, 50);

      console.log('[PRESENCE] Live/Busy users:', live.map(u => ({
        name: u.name,
        status: u.status || 'unknown',
        id: u.id.substring(0, 6) + '...'
      })));
      setLiveUsers(live);
    }, e => console.error('[PRESENCE] Listener error:', e));

    // Cleanup
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (presenceListenerRef.current) presenceListenerRef.current();

      // Remove visibility event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);

      // Remove Capacitor app state listener
      if (appStateListener) {
        appStateListener.remove();
      }

      // Cancel pending invitation if we leave dashboard
      if (sentInviteTargetRef.current) {
        const targetId = sentInviteTargetRef.current.id;
        console.log('[PRESENCE] Cancelling invitation to:', targetId);
        const invRef = doc(db, 'invitations', targetId);
        setDoc(invRef, { status: 'cancelled' }, { merge: true }).catch(e => console.error('[PRESENCE] Cancel error:', e));
        setTimeout(() => deleteDoc(invRef).catch(e => console.error('[PRESENCE] Delete error:', e)), 500);
      }

      // Set offline when component unmounts
      console.log('[PRESENCE] Cleanup - marking offline');
      setDoc(presenceDocRef, {
        status: STATUS.OFFLINE,
        lastSeen: serverTimestamp()
      }, { merge: true }).catch(e => console.error('[PRESENCE] Cleanup error:', e));
    };
  }, [view, user, userAvatar, stats.avgScore, updatePresenceStatus]);

  // DEDICATED Invitation Listener (Split from Presence to be more stable)
  useEffect(() => {
    if (!user || !db || view !== 'dashboard') return;

    const invitationDocRef = doc(db, 'invitations', user.uid);

    // SELF-HEALING: Clear any stale invitation doc at my ID when I load dashboard
    deleteDoc(invitationDocRef).catch(e => console.warn('Self-cleanup skip:', e.message));

    const unsub = onSnapshot(invitationDocRef, (snap) => {
      if (snap.exists()) {
        const inv = snap.data();
        if (inv.status === 'pending') {
          setIncomingInvitation({ id: snap.id, ...inv });
        } else if (inv.status === 'cancelled') {
          setIncomingInvitation(null);
          setToastNotification({ type: 'info', message: 'cancelled the request', name: inv.fromName, avatar: inv.fromAvatar });
          setTimeout(() => setToastNotification(null), 3000);
        } else {
          setIncomingInvitation(null);
        }
      } else {
        setIncomingInvitation(null);
      }
    }, e => {
      console.error('[INVITE_LISTEN] ERROR:', e);
    });

    invitationListenerRef.current = unsub;
    return () => {
      if (invitationListenerRef.current) {
        invitationListenerRef.current();
        invitationListenerRef.current = null;
      }
    };
  }, [view, user]);

  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // IMPORTANT: Also clear inactivity timer to prevent conflict
            if (inactivityTimerRef.current) {
              clearInterval(inactivityTimerRef.current);
              inactivityTimerRef.current = null;
            }
            setTimerActive(false);
            // Bug 3 & 7: Show Time's Up transition animation before ending
            setSessionEndTransition('time_over');
            setTimeout(() => {
              setSessionEndTransition(null);
              endSession(true, true); // Second param = timeEnded flag
            }, 4000); // Show animation for 4 seconds
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [timerActive]);

  // Opponent Inactivity Timer - Auto-end if opponent inactive for 60 seconds (human battles only)
  useEffect(() => {
    // FIX: Run inactivity check for ALL human matches, not just when timerActive
    // (timerActive is false when sessionDuration=0/infinity mode)
    if (view === 'chat' && activeSession?.type === 'human') {
      // Reset both refs when entering battle
      lastOpponentMsgTimeRef.current = Date.now();
      lastMyMsgTimeRef.current = 0; // Reset - no message sent yet

      inactivityTimerRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceOpponentMsg = now - lastOpponentMsgTimeRef.current;
        // Only trigger if I sent a message (lastMyMsgTimeRef > 0) AND I sent AFTER opponent's last message
        const iSentLast = lastMyMsgTimeRef.current > 0 && lastMyMsgTimeRef.current > lastOpponentMsgTimeRef.current;

        console.log('[INACTIVITY_CHECK]', {
          timeSinceOpponentMsg: Math.round(timeSinceOpponentMsg / 1000) + 's',
          iSentLast,
          myLast: lastMyMsgTimeRef.current,
          oppLast: lastOpponentMsgTimeRef.current
        });

        if (timeSinceOpponentMsg >= 60000 && iSentLast) { // 60 seconds = 1 minute AND I sent last
          clearInterval(inactivityTimerRef.current);
          console.log('[INACTIVITY] Opponent inactive for 60s (I sent last), auto-ending session');
          // Show 'opponent_left' animation for me (the active player)
          setSessionEndTransition('opponent_left');
          // End session with 'inactivity' reason so opponent knows they were inactive
          setTimeout(() => {
            setSessionEndTransition(null);
            endSession(true, false, 'inactivity'); // Pass inactivity reason
          }, 4000);
        }
      }, 5000); // Check every 5 seconds

      return () => {
        if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
      };
    }
  }, [view, activeSession?.type]);

  // Auto-clear session end reason popup after 5 seconds (enough time to read)
  useEffect(() => {
    if (sessionEndReason) {
      const timer = setTimeout(() => {
        setSessionEndReason(null);
      }, 5000); // 5 seconds for better visibility
      return () => clearTimeout(timer);
    }
  }, [sessionEndReason]);

  // Invitation Countdown Timer
  useEffect(() => {
    if (incomingInvitation && view === 'dashboard') {
      // Reset countdown to 16 seconds when new invitation arrives
      setInvitationCountdown(16);
      playInviteReceivedSound(); // Play invitation sound

      // Start countdown
      invitationTimerRef.current = setInterval(() => {
        setInvitationCountdown(prev => {
          if (prev <= 1) {
            clearInterval(invitationTimerRef.current);
            // Auto-decline with timeout status
            autoTimeoutInvitation();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (invitationTimerRef.current) clearInterval(invitationTimerRef.current);
      };
    } else {
      // Clear timer if no invitation or not on dashboard
      if (invitationTimerRef.current) {
        clearInterval(invitationTimerRef.current);
        invitationTimerRef.current = null;
      }
    }
  }, [incomingInvitation, view]);

  // Sync ref with state for cleanup access
  useEffect(() => {
    sentInviteTargetRef.current = sentInviteTarget;
  }, [sentInviteTarget]);

  // Fetch session history when Progress Report opens
  useEffect(() => {
    const fetchSessionHistory = async () => {
      if (!showProgressReport || !user) return;
      try {
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        const q = query(sessionsRef, orderBy('timestamp', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSessionHistory(sessions.reverse()); // Oldest first for chart
        console.log('[PROGRESS_REPORT] Fetched sessions:', sessions.length);

        // Auto-trigger AI analysis if user has 3+ sessions and no existing data
        console.log('[DEBUG] AI Analysis check: stats.sessions=', stats.sessions, 'progressReportData=', !!progressReportData, 'sessions fetched=', sessions.length);
        console.log('[DEBUG] Sample session data:', sessions[0]);
        if ((stats.sessions || 0) >= 3 && !progressReportData) {
          setIsLoadingReport(true);
          try {
            const token = await user.getIdToken();
            const corrections = sessions.flatMap(s => s.corrections || []).slice(-30);
            console.log('[DEBUG] AI Analysis: Found', corrections.length, 'corrections from', sessions.length, 'sessions');
            console.log('[DEBUG] Sample corrections:', corrections.slice(0, 2));
            const res = await callBackend(BACKEND_URL, 'POST', { type: 'progress_analysis', corrections }, token);
            const data = res;
            setProgressReportData(data);
          } catch (err) {
            console.error('Auto AI analysis error:', err);
          } finally {
            setIsLoadingReport(false);
          }
        }
      } catch (e) {
        console.error('Failed to fetch session history:', e);
      }
    };
    fetchSessionHistory();
  }, [showProgressReport, user]);

  // Detect level-up and streak milestones for confetti celebration
  useEffect(() => {
    if (!stats.avgScore && !stats.streak) return;

    const currentLevel = getLevelFromAccuracy(stats.avgScore || 0).name;
    const currentStreak = stats.streak || 0;

    // Check for level-up (only if prevLevel is set & different)
    if (prevLevelRef.current && prevLevelRef.current !== currentLevel) {
      const levels = ['Starter', 'Learner', 'Improver', 'Pro', 'Master'];
      const prevIndex = levels.indexOf(prevLevelRef.current);
      const newIndex = levels.indexOf(currentLevel);

      if (newIndex > prevIndex) {
        // Level UP! Trigger celebration
        console.log('[LEVEL_UP] 🎉', prevLevelRef.current, '→', currentLevel);
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 } }), 300);
      }
    }
    prevLevelRef.current = currentLevel;

    // Check for streak milestones
    const milestones = [3, 7, 15, 30, 60, 100];
    const prevStreak = prevStreakRef.current;

    for (const m of milestones) {
      if (currentStreak >= m && prevStreak < m) {
        // Hit a new milestone!
        console.log('[STREAK_MILESTONE] 🔥', m, 'days!');
        setShowStreakMilestone(m);
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        setTimeout(() => setShowStreakMilestone(null), 3000); // Auto-close after 3s
        break;
      }
    }
    prevStreakRef.current = currentStreak;
  }, [stats.avgScore, stats.streak]);

  const autoTimeoutInvitation = async () => {
    if (!incomingInvitation) return;
    try {
      const invRef = doc(db, 'invitations', user.uid);
      // Set status to 'timeout' so sender knows it auto-expired
      await setDoc(invRef, { status: 'timeout' }, { merge: true });
      playDeclinedSound(); // Play declined sound
      await new Promise(resolve => setTimeout(resolve, 500));
      await deleteDoc(invRef);
      setIncomingInvitation(null);
    } catch (e) {
      console.error('Auto timeout error:', e);
      setIncomingInvitation(null);
    }
  };

  // Clean up typing listener
  useEffect(() => {
    return () => {
      if (typingListener.current) typingListener.current();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom whenever messages list changes OR typing state changes
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpponentTyping]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const getLocalDateStr = (date = new Date()) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const handleLogin = async (p) => {
    try {
      if (p === 'google') {
        if (Capacitor.isNativePlatform()) {
          // Native Android: Use GoogleAuth plugin for native sign-in
          try {
            // Initialize GoogleAuth (only needed once, but safe to call multiple times)
            await GoogleAuth.initialize({
              clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '',
              scopes: ['profile', 'email'],
            });

            // Sign in with native Google
            const googleUser = await GoogleAuth.signIn();
            console.log('[GOOGLE_AUTH] Native sign-in success:', googleUser.email);

            // Create Firebase credential from Google ID token
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);

            // Sign in to Firebase with the credential
            await signInWithCredential(auth, credential);
          } catch (nativeErr) {
            console.error('[GOOGLE_AUTH] Native sign-in error:', nativeErr);
            // Fallback to web popup if native fails
            await signInWithPopup(auth, new GoogleAuthProvider());
          }
        } else {
          // Web: Use popup sign-in
          await signInWithPopup(auth, new GoogleAuthProvider());
        }
      } else {
        await signInAnonymously(auth);
      }
    } catch (e) {
      console.error('[LOGIN_ERROR]', e);
    }
  };

  const saveUserData = async (newStats, newAvatar) => {
    if (!user) return;
    try { await setDoc(doc(db, 'users', user.uid), { stats: newStats || stats, userAvatar: newAvatar || userAvatar }, { merge: true }); } catch (e) { }
  };

  const selectAvatar = (av) => { setUserAvatar(av); saveUserData(null, av); }; // Don't auto-close modal

  // Backend Warmup Helper
  const triggerWarmup = async () => {
    try {
      if (!user) return; // Need user for token
      const token = await user.getIdToken();
      callBackend(BACKEND_URL, 'POST', { type: 'warmup' }, token)
        .catch(err => console.log('Warmup partial fail', err));
    } catch (e) { }
  };

  // Voice-to-Text Toggle using Web Speech API
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      // Start listening
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => prev ? prev + ' ' + transcript : transcript);
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  // Text-to-Speech for Bot Responses (WaveNet Audio from Backend)
  const speakText = (text, audioBase64) => {
    console.log('[TTS] speakText called, isSpeakerOnRef.current:', isSpeakerOnRef.current, 'audioBase64:', !!audioBase64);
    if (!isSpeakerOnRef.current) {
      console.log('[TTS] Speaker is OFF, skipping');
      return;
    }

    // If we have audio from backend (WaveNet), use it
    if (audioBase64) {
      console.log(`[TTS] Playing WaveNet Audio (${Math.round(audioBase64.length / 1024)} KB)`);
      try {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.play().catch(err => console.log('[TTS] Audio play blocked:', err));
      } catch (e) {
        console.error('[TTS] Failed to play audio:', e);
      }
      return;
    }

    // Fallback to browser TTS if no audio provided
    console.log('[TTS] No audioBase64, using Browser Speech fallback');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Invitation System Functions
  const sentInvitationListenerRef = useRef(null);

  // AI Assist - Generate reply suggestions with native language context
  const getAiAssist = async (message, conversationContext) => {
    if (!user) return null;
    setIsLoadingAssist(true);
    try {
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', {
        type: 'ai_assist',
        message: message,
        context: conversationContext,
        nativeLanguage: motherTongue || 'Hindi'
      }, token);
      return data;
    } catch (e) {
      console.error('[AI_ASSIST_ERROR]', e);
      return null;
    } finally {
      setIsLoadingAssist(false);
    }
  };

  // Translation - Get native language translation
  const getTranslation = async (message) => {
    if (!user) return null;
    setIsLoadingTranslation(true);
    try {
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', {
        type: 'translate',
        message: message,
        targetLanguage: motherTongue || 'Hindi'
      }, token);
      return data.translation;
    } catch (e) {
      console.error('[TRANSLATION_ERROR]', e);
      return null;
    } finally {
      setIsLoadingTranslation(false);
    }
  };

  // Handle AI Assist button click
  const handleAiAssistClick = async (messageId, messageText) => {
    trackAnalytics('aiAssistClicks'); // Track usage
    const context = messages.filter(m => m.sender !== 'correction' && m.sender !== 'suggestion').slice(-5).map(m => `${m.sender === 'me' ? 'User' : 'Bot'}: ${m.text}`).join('\n');
    setShowAiAssistPopup({ messageId, message: messageText, loading: true });
    const assistData = await getAiAssist(messageText, context);
    if (assistData) {
      setShowAiAssistPopup({ messageId, message: messageText, ...assistData, loading: false });
    } else {
      setShowAiAssistPopup(null);
    }
  };

  // Handle Translation long press
  const handleTranslationPress = async (messageId, messageText) => {
    trackAnalytics('translationClicks'); // Track usage
    setShowTranslationPopup({ messageId, message: messageText, loading: true });
    const translation = await getTranslation(messageText);
    if (translation) {
      setShowTranslationPopup({ messageId, message: messageText, translation, loading: false });
    } else {
      setShowTranslationPopup(null);
    }
  };

  // Shake animation timer - shake buttons after 10 seconds of no user response
  useEffect(() => {
    if (view === 'chat' && messages.length > 0) {
      // Clear existing timer
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      setShouldShakeButtons(false);

      // Check if the last message is from opponent (not from user)
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.sender !== 'me' && lastMessage.sender !== 'system' && lastMessage.sender !== 'correction' && lastMessage.sender !== 'suggestion') {
        // Start 10-second timer to shake buttons
        shakeTimer.current = setTimeout(() => {
          setShouldShakeButtons(true);
          // Stop shaking after 3 seconds
          setTimeout(() => setShouldShakeButtons(false), 3000);
        }, 10000);
      }
    }
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, [messages, view]);

  const sendInvitation = async (targetUser) => {
    if (!user || !targetUser) return;
    trackAnalytics('invitesSent'); // Track invite sent
    const invitationRef = doc(db, 'invitations', targetUser.id);
    console.log('[INVITE_SEND] Attempting to create invitation at path:', invitationRef.path);
    console.log('[INVITE_SEND] Target ID:', targetUser.id, 'My UID:', user.uid);

    try {
      await setDoc(invitationRef, {
        fromUserId: user.uid,
        fromName: user.displayName || 'Player',
        fromAvatar: userAvatar,
        fromLevel: getLevelFromAccuracy(stats.avgScore || 0).name,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      console.log('[INVITE DEBUG] Invitation created successfully');

      // Track who we sent to (for the waiting modal)
      setSentInviteTarget(targetUser);

      // Show waiting state with timer
      setLoadingAction('waiting-invite');
      setSenderCountdown(16);

      // Start sender countdown timer
      if (senderTimerRef.current) clearInterval(senderTimerRef.current);
      senderTimerRef.current = setInterval(() => {
        setSenderCountdown(prev => {
          if (prev <= 1) {
            clearInterval(senderTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Listen for the invitation to be accepted/declined
      if (sentInvitationListenerRef.current) {
        console.log('[INVITE DEBUG] Cleaning up previous listener');
        sentInvitationListenerRef.current();
      }

      console.log('[INVITE DEBUG] Setting up listener for:', invitationRef.path);
      sentInvitationListenerRef.current = onSnapshot(invitationRef, (snap) => {
        console.log('[INVITE DEBUG] Listener triggered. Exists:', snap.exists());

        if (!snap.exists()) {
          console.log('[INVITE DEBUG] Document deleted - invitation declined or cleaned up');
          // Invitation was deleted (declined)
          setLoadingAction(null);
          if (senderTimerRef.current) clearInterval(senderTimerRef.current);
          if (sentInvitationListenerRef.current) {
            sentInvitationListenerRef.current();
            sentInvitationListenerRef.current = null;
          }
          return;
        }

        const data = snap.data();
        console.log('[INVITE DEBUG] Document data:', JSON.stringify(data));

        if (data.status === 'accepted' && data.roomId) {
          console.log('[INVITE DEBUG] ACCEPTED! Room:', data.roomId);
          // Invitation accepted! Join the room
          setLoadingAction(null);
          if (senderTimerRef.current) clearInterval(senderTimerRef.current);
          if (sentInvitationListenerRef.current) {
            sentInvitationListenerRef.current();
            sentInvitationListenerRef.current = null;
          }

          // Clean up the invitation
          deleteDoc(invitationRef).catch(e => console.error('Cleanup error:', e));

          // Join the match as the host (we sent the invite)
          joinMatch(data.roomId, {
            id: targetUser.id,
            name: targetUser.name,
            avatar: targetUser.avatar
          }, 'human', 'Direct Match');
        } else if (data.status === 'declined') {
          console.log('[INVITE DEBUG] DECLINED by recipient');
          setLoadingAction(null);
          if (senderTimerRef.current) clearInterval(senderTimerRef.current);
          if (sentInvitationListenerRef.current) {
            sentInvitationListenerRef.current();
            sentInvitationListenerRef.current = null;
          }
          // Clean up the invitation
          deleteDoc(invitationRef).catch(e => console.error('Cleanup error:', e));
          // Beautiful toast notification instead of ugly alert
          setToastNotification({ type: 'declined', message: 'declined your invitation', name: targetUser.name, avatar: targetUser.avatar });
          setTimeout(() => setToastNotification(null), 4000);
        } else if (data.status === 'timeout') {
          console.log('[INVITE DEBUG] TIMEOUT - no response');
          setLoadingAction(null);
          if (senderTimerRef.current) clearInterval(senderTimerRef.current);
          if (sentInvitationListenerRef.current) {
            sentInvitationListenerRef.current();
            sentInvitationListenerRef.current = null;
          }
          // Clean up the invitation
          deleteDoc(invitationRef).catch(e => console.error('Cleanup error:', e));
          // Beautiful toast notification instead of ugly alert
          setToastNotification({ type: 'timeout', message: 'did not respond', name: targetUser.name, avatar: targetUser.avatar });
          setTimeout(() => setToastNotification(null), 4000);
        } else {
          console.log('[INVITE DEBUG] Status is:', data.status, '- waiting for change...');
        }
      }, (error) => {
        console.error('[INVITE DEBUG] Listener error:', error);
        setLoadingAction(null);
        if (senderTimerRef.current) clearInterval(senderTimerRef.current);
      });

      console.log('[INVITE DEBUG] Invitation sent and listener active');
    } catch (e) {
      console.error('[INVITE DEBUG] Send invitation error:', e);
      setLoadingAction(null);
      if (senderTimerRef.current) clearInterval(senderTimerRef.current);
    }
  };

  const acceptInvitation = async () => {
    if (!incomingInvitation) return;
    trackAnalytics('invitesAccepted'); // Track invite accepted
    try {
      // Create a room for both players
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', {
        type: 'create_invitation_room',
        hostId: incomingInvitation.fromUserId,
        hostName: incomingInvitation.fromName,
        hostAvatar: incomingInvitation.fromAvatar,
        guestId: user.uid,
        guestName: user.displayName || 'Player',
        guestAvatar: userAvatar
      }, token);

      if (data.success && data.roomId) {
        // Update invitation status
        await setDoc(doc(db, 'invitations', user.uid), { status: 'accepted', roomId: data.roomId }, { merge: true });

        // Join the match
        joinMatch(data.roomId, {
          id: incomingInvitation.fromUserId,
          name: incomingInvitation.fromName,
          avatar: incomingInvitation.fromAvatar
        }, 'human', 'Direct Match');
      }
      setIncomingInvitation(null);
    } catch (e) {
      console.error('Accept invitation error:', e);
      setIncomingInvitation(null);
    }
  };

  const declineInvitation = async () => {
    if (!incomingInvitation) return;
    try {
      const invRef = doc(db, 'invitations', user.uid);
      console.log('[DECLINE DEBUG] Setting status to declined for:', user.uid);
      // First update status to 'declined' so sender's listener sees it
      await setDoc(invRef, { status: 'declined' }, { merge: true });
      playDeclinedSound(); // Play declined sound
      console.log('[DECLINE DEBUG] Status updated, waiting 500ms...');
      // Small delay to ensure sender receives the update
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('[DECLINE DEBUG] Deleting invitation...');
      // Then delete
      await deleteDoc(invRef);
      console.log('[DECLINE DEBUG] Invitation deleted');
      setIncomingInvitation(null);
    } catch (e) {
      console.error('[DECLINE DEBUG] Error:', e);
      setIncomingInvitation(null);
    }
  };

  // Cancel a sent invitation (when sender leaves dashboard)
  const cancelSentInvitation = async () => {
    if (!sentInviteTarget) return;
    try {
      const invRef = doc(db, 'invitations', sentInviteTarget.id);
      console.log('[CANCEL DEBUG] Cancelling invitation to:', sentInviteTarget.id);
      await setDoc(invRef, { status: 'cancelled' }, { merge: true });
      await new Promise(resolve => setTimeout(resolve, 500));
      await deleteDoc(invRef);
      setSentInviteTarget(null);
      setLoadingAction(null);
      if (sentInvitationListenerRef.current) {
        sentInvitationListenerRef.current();
        sentInvitationListenerRef.current = null;
      }
    } catch (e) {
      console.error('[CANCEL DEBUG] Error:', e);
    }
  };

  // Show confirmation popup before sending invitation
  const requestBattle = (targetUser) => {
    setPendingInviteTarget(targetUser);
  };

  // Confirm and send the invitation
  const confirmSendInvitation = () => {
    if (pendingInviteTarget) {
      setSentInviteTarget(pendingInviteTarget);
      sendInvitation(pendingInviteTarget);
      setPendingInviteTarget(null);
    }
  };

  // Cancel the confirmation popup
  const cancelPendingInvite = () => {
    setPendingInviteTarget(null);
  };

  // Start specific bot match
  const startBotMatch = async (botId, botName) => {
    console.log('[BOT MATCH] Starting match with:', botId, botName);
    setLoadingAction('compete');
    try {
      console.log('[BOT MATCH] Sending create_bot_room request...');
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', { type: 'create_bot_room', userId: user.uid, userName: user.displayName || 'Player', userAvatar, botId }, token);
      console.log('[BOT MATCH] Response:', data);

      if (data.success && data.roomId) {
        console.log('[BOT MATCH] Joining room:', data.roomId);
        joinMatch(data.roomId, { id: botId, name: botName, avatar: '🤖' }, 'battle-bot', 'Bot Battle');
      } else {
        console.error('[BOT MATCH] Failed to create room:', data);
        alert('Failed to start bot match: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('[BOT MATCH] Error:', e);
      alert('Error starting bot match');
    }
    setLoadingAction(null);
  };

  // Matchmaking
  const createPrivateRoom = async () => {
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);
    try {
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', { type: 'create_room', userId: user.uid, userName: user.displayName || 'Host', userAvatar }, token);
      if (data.success) {
        setRoomCode(data.roomCode);
        console.log('[CREATE_ROOM] Room created:', data.roomId, 'Code:', data.roomCode);

        const unsub = onSnapshot(doc(db, 'queue', data.roomId), (snap) => {
          if (snap.exists()) {
            const roomData = snap.data();
            console.log('[CREATE_ROOM_LISTENER] Status update:', roomData.status, 'Player2:', roomData.player2Id);

            if (roomData.status === 'matched') {
              console.log('[CREATE_ROOM_LISTENER] Match found! Joining...');
              unsub();
              joinMatch(data.roomId, { id: roomData.player2Id, name: roomData.player2Name, avatar: roomData.player2Avatar }, 'human', 'Friend Match');
              setShowRoomInput(false); setRoomCode("");
            }
          } else {
            console.log('[CREATE_ROOM_LISTENER] Doc does not exist');
          }
        }, (error) => {
          console.error('[CREATE_ROOM_LISTENER] Error:', error);
        });
      } else { setToastNotification({ type: 'error', message: data.error || 'Failed to create room', icon: '❌' }); }
    } catch (e) { setToastNotification({ type: 'error', message: e.message || 'Connection error', icon: '❌' }); } finally { setIsCreatingRoom(false); }
  };

  const joinRoom = async (code) => {
    if (!code || code.length < 4) return;
    try {
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', { type: 'join_room', roomCode: code, userId: user.uid, userName: user.displayName || 'Friend', userAvatar }, token);
      if (data.success) {
        joinMatch(data.roomId, data.opponent, 'human', 'Friend Match');
        setShowRoomInput(false);
      } else {
        setToastNotification({ type: 'error', message: data.error || 'Room not found', icon: '🚫' });
      }
    } catch (e) { setToastNotification({ type: 'error', message: e.message || 'Connection error', icon: '❌' }); }
  };

  const startRandomMatch = async () => {
    if (isSearching) return;
    setIsSearching(true); setSearchStatusText("Finding a partner...");

    // Warmup backend for faster bot response
    if (user) {
      user.getIdToken().then(token => {
        callBackend(BACKEND_URL, 'POST', { type: 'warmup' }, token)
          .catch(() => { });
      });
    }

    try {
      const token = await user.getIdToken();
      const data = await callBackend(BACKEND_URL, 'POST', { type: 'find_random_match', userId: user.uid, userName: user.displayName || 'Player', userAvatar, sessionDuration }, token);
      console.log('MATCH_DEBUG: find_random_match response:', data);
      if (data.success) {
        if (data.matched) {
          if (isJoiningRef.current) return;
          // Use the higher timer from server (if provided)
          if (data.sessionDuration !== undefined) {
            setSessionDuration(data.sessionDuration);
          }
          joinMatch(data.roomId, data.opponent, 'human', data.topic);
        } else {
          setSearchStatusText("Waiting for opponent...");
          searchTimeoutRef.current = setTimeout(() => {
            if (!isJoiningRef.current) {
              setSearchStatusText("Connecting you with a partner...");
              triggerBot(data.roomId);
            }
          }, 3000); // Reduced to 3s for faster entry

          randomSearchListener.current = onSnapshot(doc(db, 'queue', data.roomId), (snap) => {
            if (snap.exists()) {
              const r = snap.data();
              console.log('[RANDOM_MATCH_LISTENER] Status update:', r.status, 'isBotMatch:', r.isBotMatch, 'Player2:', r.player2Id);

              if (r.status === 'matched' && !r.isBotMatch) {
                console.log('[RANDOM_MATCH_LISTENER] Human match found! Joining...');
                // CRITICAL: Unsubscribe IMMEDIATELY to prevent double-firing
                if (randomSearchListener.current) {
                  randomSearchListener.current();
                  randomSearchListener.current = null;
                }
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                const amI = r.hostId === user.uid;
                if (r.sessionDuration !== undefined) {
                  setSessionDuration(r.sessionDuration);
                }
                joinMatch(data.roomId, { id: amI ? r.player2Id : r.hostId, name: amI ? r.player2Name : r.userName, avatar: amI ? r.player2Avatar : r.userAvatar }, 'human', r.roleData?.topic);
              }
            } else {
              console.log('[RANDOM_MATCH_LISTENER] Doc does not exist or was deleted');
            }
          }, (error) => {
            console.error("Match listener (queue) error:", error);
            setIsSearching(false);
          });
        }
      } else {
        const err = data.error || "Error finding match";
        setIsSearching(false); // Alert removed per user preference? Or keep alert
        alert(err);
        setIsSearching(false);
      }
    } catch (e) {
      console.error(e);
      setIsSearching(false);
    }
  };

  const triggerBot = async (roomId) => {
    if (!roomId) return;
    // Check if we are still searching before triggering bot
    try {
      if (isJoiningRef.current) return;
      const token = await user.getIdToken();
      // Use callBackend helper instead of fetch
      const data = await callBackend(BACKEND_URL, 'POST', { type: 'trigger_bot_match', roomId, userId: user.uid }, token);
      // const res = await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ type: 'trigger_bot_match', roomId, userId: user.uid }) });
      // const data = await res.json();
      // Ensure we haven't canceled or already matched with a human
      if (data.success && data.matched && !isJoiningRef.current) {
        joinMatch(data.roomId, data.opponent, data.isBotMatch ? 'battle-bot' : 'human', data.topic);
        // Inject first message immediately for Bot Match
        if (data.isBotMatch) {
          const greetingId = 'bot_init_' + Date.now();
          const greeting = "Hi! I'm " + data.opponent.name + ". Let's practice. " + (data.topic || "");

          console.log('BOT_MATCH: Queuing greeting', greetingId);
          const greetingMsg = { id: greetingId, sender: 'opponent', text: greeting, createdAt: Date.now() };
          processedMessageIds.current.add(greetingId);
          typingQueue.current.push(greetingMsg);
          processTypingQueue();
        }
      }
    } catch (e) {
      console.error("Trigger bot error:", e);
    }
  };

  const joinMatch = (roomId, opponent, type, topic) => {
    console.log('MATCH_DEBUG: joinMatch called', { roomId, type, topic });
    if (isJoiningRef.current) return;
    isJoiningRef.current = true;

    // Track battle type
    if (type === 'battle-bot') {
      trackAnalytics('battleBotsJoined');
    } else if (type === 'human') {
      trackAnalytics('battleHumansRandom'); // Generic human battle (could be random, invite, or room)
    }

    // If we're already in an active session, don't re-join
    if (activeSession && activeSession.id === roomId) {
      isJoiningRef.current = false;
      return;
    }

    // Cleanup searching state
    if (randomSearchListener.current) {
      randomSearchListener.current();
      randomSearchListener.current = null;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    setIsSearching(false);
    setLoadingAction(null);

    // Initialize session
    resetChatStates();
    setActiveSession({ id: roomId, opponent, type, topic });
    setMessages([{ id: 'sys' + Date.now(), sender: 'system', text: `Connected with ${opponent.name}`, createdAt: Date.now() }]);
    setVisibleMessageIds(new Set(['sys' + Date.now()])); // Show initial system msg
    isSyncingInitialRef.current = true;

    // Timer: Only activate if sessionDuration > 0 (0 means 'Never ends')
    if (sessionDuration > 0) {
      setTimeRemaining(sessionDuration * 60);
      setTimerActive(true);
    } else {
      setTimeRemaining(0);
      setTimerActive(false); // Timer disabled for 'Never' mode
    }
    setSessionPoints(0);
    setSessionStartTime(Date.now()); // Track session start for duration calculation
    setMessageAccuracies([]); // V7: Reset accuracy tracking
    setBattleAccuracies([]); // V8: Reset battle accuracy tracking
    setBattleCorrections([]); // Reset battle corrections for new session
    setView('chat');

    // Chat listener with error handling
    const q = query(collection(db, 'queue', roomId, 'messages'), orderBy('createdAt'));

    if (matchListener.current) matchListener.current();
    matchListener.current = onSnapshot(doc(db, 'queue', roomId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // 1. TYPING INDICATOR (Real-time)
        if (data.typing) {
          console.log('[TYPING LISTENER] Received typing data:', data.typing, 'My UID:', user.uid);
          const opponentId = Object.keys(data.typing).find(id => id !== user.uid);
          if (opponentId) {
            console.log('[TYPING LISTENER] Opponent typing:', data.typing[opponentId]);
            setIsOpponentTyping(data.typing[opponentId]);
          }
        }

        // 2. SYNC END SESSION (Listen for opponent ending it)
        if (data.status === 'ended' && data.endedBy && data.endedBy !== user.uid && !isEndingRef.current) {
          console.log('[OPPONENT_ENDED] Opponent ended session:', { endReason: data.endReason, endedBy: data.endedBy });
          isEndingRef.current = true;

          // Stop timer and cleanup
          setTimerActive(false);
          if (chatListener.current) { chatListener.current(); chatListener.current = null; }
          if (matchListener.current) { matchListener.current(); matchListener.current = null; }

          // CRITICAL: Reset refs so next match can proceed
          isJoiningRef.current = false;
          isEndingRef.current = false;

          // Capture current messages from ref
          const capturedMessages = [...messagesRef.current];
          const myMessages = capturedMessages.filter(m => m.sender === 'me');
          const oppMessages = capturedMessages.filter(m => m.sender === 'opponent');
          const combinedCount = myMessages.length + oppMessages.length;

          console.log('[OPPONENT_ENDED] Message counts:', { myCount: myMessages.length, oppCount: oppMessages.length, combined: combinedCount });

          // Show appropriate popup based on message count
          if (combinedCount < 6) {
            // Not enough messages - show transition then orange insufficient popup
            // TIMER LOGIC: Compare durations - if opponent had same or greater duration and time_over, both see "Time's Up"
            // If opponent had SHORTER duration, I see "Opponent Left" (their timer ended, not mine)
            // INACTIVITY: If endReason is 'inactivity', it means I was inactive (opponent ended because I didn't respond)
            let transitionType = 'opponent_left';
            if (data.endReason === 'inactivity') {
              // I was the inactive one - show "you_inactive" animation
              transitionType = 'you_inactive';
            } else if (data.endReason === 'time_over') {
              const enderDuration = data.enderTimerDuration || 0;
              // Same duration or I have no limit (0) → Show "Time's Up"
              if (enderDuration >= sessionDuration || sessionDuration === 0) {
                transitionType = 'time_over';
              }
              // Else opponent had shorter timer → Show "Opponent Left" (default)
            }
            setSessionEndTransition(transitionType);
            setBattleOpponentData(opponent);

            // After 4 seconds, show the scorecard (increased from 3s for better readability)
            setTimeout(() => {
              setSessionEndTransition(null);
              setDualAnalysis({
                insufficientMessages: true,
                message: data.endReason === 'time_over'
                  ? 'Time is up! Not enough messages to analyze the result.'
                  : 'Your opponent left early. Not enough messages to analyze the result.',
                player1: { total: 0, vocab: 0, grammar: 0, fluency: 0, sentence: 0 },
                player2: { total: 0, vocab: 0, grammar: 0, fluency: 0, sentence: 0 },
                winner: 'none'
              });
              setShowWinnerReveal(true);
              setView('dashboard');
              setActiveSession(null);
            }, 4000);
          } else {
            // Enough messages - show transition then analyze
            // TIMER LOGIC: Same as above - compare durations for correct animation
            // INACTIVITY: If endReason is 'inactivity', it means I was inactive
            let transitionType = 'opponent_left';
            if (data.endReason === 'inactivity') {
              transitionType = 'you_inactive';
            } else if (data.endReason === 'time_over') {
              const enderDuration = data.enderTimerDuration || 0;
              if (enderDuration >= sessionDuration || sessionDuration === 0) {
                transitionType = 'time_over';
              }
            }
            setSessionEndTransition(transitionType);
            setBattleOpponentData(opponent);

            // After 4 seconds, show analyzing (increased from 3s for better readability)
            setTimeout(() => {
              setSessionEndTransition(null);
              setView('analyzing');
            }, 4000);

            const myMsgs = myMessages.map(m => m.text);
            const oppMsgs = oppMessages.map(m => m.text);

            (async () => {
              try {
                // SYNC FIX: Check for cached analysis with retry logic
                // The player who ended should save it, but there may be a race condition
                const roomRef = doc(db, 'queue', roomId);

                // Try up to 8 times with 1.5 second delay to find cached analysis (~10.5s total)
                let cachedAnalysis = null;
                for (let attempt = 1; attempt <= 8; attempt++) {
                  console.log(`[OPPONENT_ENDED] Checking for cached analysis (attempt ${attempt}/8)...`);
                  const roomSnap = await getDoc(roomRef);
                  const roomData = roomSnap.data();

                  if (roomData?.analysis && roomData?.analysis?.player1 && roomData?.analysis?.player2) {
                    cachedAnalysis = roomData.analysis;
                    console.log('[OPPONENT_ENDED] Using cached analysis from Firestore');
                    break;
                  }

                  // Wait 1.5 seconds before retry (except on last attempt)
                  if (attempt < 8) {
                    console.log('[OPPONENT_ENDED] No cached analysis yet, waiting 1.5s...');
                    await new Promise(resolve => setTimeout(resolve, 1500));
                  }
                }

                if (cachedAnalysis) {
                  setDualAnalysis({ ...cachedAnalysis, analyzedBy: cachedAnalysis.analyzedBy || data.endedBy });
                  setBattleOpponentData(opponent);
                  setShowWinnerReveal(true);

                  // FIX: User B also saves their session and updates stats
                  const analyzedBy = cachedAnalysis?.analyzedBy || data.endedBy;
                  const amIPlayer1 = analyzedBy === user.uid; // If I analyzed, I'm player1
                  const myData = amIPlayer1 ? cachedAnalysis?.player1 : cachedAnalysis?.player2;
                  const didIWin = amIPlayer1 ? (cachedAnalysis?.winner === 'player1') : (cachedAnalysis?.winner === 'player2');
                  const myScore = myData?.total || 0;

                  // Save session to Firestore for User B
                  try {
                    const battleChatHistory = capturedMessages
                      .filter(m => m.sender === 'me' || m.sender === 'opponent')
                      .map(m => ({ sender: m.sender, text: m.text, timestamp: m.createdAt || Date.now() }));
                    const battleDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;

                    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
                    await addDoc(sessionsRef, {
                      type: '1v1',
                      score: myScore,
                      opponentId: opponent?.id,
                      opponentName: opponent?.name || 'Opponent',
                      opponentAvatar: opponent?.avatar || '👤',
                      won: didIWin,
                      corrections: battleCorrectionsRef.current,
                      correctionsCount: battleCorrectionsRef.current.length,
                      accuracy: myScore,
                      messagesCount: myMessages.length,
                      duration: battleDuration,
                      startTime: serverTimestamp(),
                      timestamp: serverTimestamp(),
                      chatHistory: battleChatHistory
                    });
                    console.log('[OPPONENT_ENDED] Session saved for User B');

                    // Update User B stats
                    const totalSent = myMessages.length;
                    if (totalSent >= 3) {
                      const todayStr = getLocalDateStr();
                      setStats(prev => {
                        const lastDate = prev.lastPracticeDate;
                        let newStreak = prev.streak || 0;
                        if (lastDate !== todayStr) {
                          const yesterday = new Date();
                          yesterday.setDate(yesterday.getDate() - 1);
                          const yesterdayStr = getLocalDateStr(yesterday);
                          if (lastDate === yesterdayStr) newStreak += 1;
                          else newStreak = 1;
                        }
                        const newTotalSessions = prev.sessions + 1;
                        const newTotalPoints = prev.points + (myScore || 0);
                        let newAvgScore;
                        if (prev.sessions < 5) {
                          newAvgScore = Math.round((prev.avgScore * prev.sessions + myScore) / newTotalSessions);
                        } else {
                          newAvgScore = Math.round(((prev.avgScore || 0) * 9 + myScore) / 10);
                        }
                        const newLevel = newAvgScore >= 95 ? 'Master' : newAvgScore >= 85 ? 'Pro' : newAvgScore >= 70 ? 'Improver' : newAvgScore >= 50 ? 'Learner' : 'Starter';
                        const n = { ...prev, sessions: newTotalSessions, points: newTotalPoints, avgScore: newAvgScore, level: newLevel, streak: newStreak, lastPracticeDate: todayStr };
                        setTimeout(() => saveUserData(n, null), 10);
                        return n;
                      });
                      console.log('[OPPONENT_ENDED] Stats updated for User B');
                    }
                  } catch (saveErr) {
                    console.error('[OPPONENT_ENDED] Failed to save session for User B:', saveErr);
                  }
                } else {
                  // Fallback: No cached analysis after 8 attempts (~10.5s), call analyze endpoint
                  console.log('[OPPONENT_ENDED] No cached analysis after retries, calling analyze endpoint');
                  const token = await user.getIdToken();
                  const result = await callBackend(BACKEND_URL, 'POST', {
                    type: 'analyze',
                    roomId: roomId,
                    player1History: myMsgs,
                    player2History: oppMsgs,
                    isBotMatch: false
                  }, token);
                  /*const res = await fetch(`${BACKEND_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                      type: 'analyze',
                      roomId: roomId,
                      player1History: myMsgs,
                      player2History: oppMsgs,
                      isBotMatch: false
                    })
                  });
                  const result = await res.json();*/
                  console.log('[OPPONENT_ENDED] Analysis result:', result);

                  if (result.player1 && result.player2) {
                    setDualAnalysis({ ...result, analyzedBy: user.uid });
                    setBattleOpponentData(opponent);
                    setShowWinnerReveal(true);

                    // FIX: User B also saves their session and updates stats (fallback case)
                    const amIPlayer1 = true; // I called analyze, so I'm player1
                    const myData = result?.player1;
                    const didIWin = result?.winner === 'player1';
                    const myScore = myData?.total || 0;

                    try {
                      const battleChatHistory = capturedMessages
                        .filter(m => m.sender === 'me' || m.sender === 'opponent')
                        .map(m => ({ sender: m.sender, text: m.text, timestamp: m.createdAt || Date.now() }));
                      const battleDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;

                      const sessionsRef = collection(db, 'users', user.uid, 'sessions');
                      await addDoc(sessionsRef, {
                        type: '1v1',
                        score: myScore,
                        opponentId: opponent?.id,
                        opponentName: opponent?.name || 'Opponent',
                        opponentAvatar: opponent?.avatar || '👤',
                        won: didIWin,
                        corrections: battleCorrectionsRef.current,
                        correctionsCount: battleCorrectionsRef.current.length,
                        accuracy: myScore,
                        messagesCount: myMessages.length,
                        duration: battleDuration,
                        startTime: serverTimestamp(),
                        timestamp: serverTimestamp(),
                        chatHistory: battleChatHistory
                      });
                      console.log('[OPPONENT_ENDED] Session saved for User B (fallback)');

                      // Update User B stats
                      const totalSent = myMessages.length;
                      if (totalSent >= 3) {
                        const todayStr = getLocalDateStr();
                        setStats(prev => {
                          const lastDate = prev.lastPracticeDate;
                          let newStreak = prev.streak || 0;
                          if (lastDate !== todayStr) {
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            const yesterdayStr = getLocalDateStr(yesterday);
                            if (lastDate === yesterdayStr) newStreak += 1;
                            else newStreak = 1;
                          }
                          const newTotalSessions = prev.sessions + 1;
                          const newTotalPoints = prev.points + (myScore || 0);
                          let newAvgScore;
                          if (prev.sessions < 5) {
                            newAvgScore = Math.round((prev.avgScore * prev.sessions + myScore) / newTotalSessions);
                          } else {
                            newAvgScore = Math.round(((prev.avgScore || 0) * 9 + myScore) / 10);
                          }
                          const newLevel = newAvgScore >= 95 ? 'Master' : newAvgScore >= 85 ? 'Pro' : newAvgScore >= 70 ? 'Improver' : newAvgScore >= 50 ? 'Learner' : 'Starter';
                          const n = { ...prev, sessions: newTotalSessions, points: newTotalPoints, avgScore: newAvgScore, level: newLevel, streak: newStreak, lastPracticeDate: todayStr };
                          setTimeout(() => saveUserData(n, null), 10);
                          return n;
                        });
                        console.log('[OPPONENT_ENDED] Stats updated for User B (fallback)');
                      }
                    } catch (saveErr) {
                      console.error('[OPPONENT_ENDED] Failed to save session for User B (fallback):', saveErr);
                    }
                  }
                }
              } catch (e) {
                console.error('[OPPONENT_ENDED] Analysis failed:', e);
                setDualAnalysis({
                  insufficientMessages: true,
                  message: 'Analysis failed. Please try again.',
                  player1: { total: 0 }, player2: { total: 0 }, winner: 'none'
                });
                setBattleOpponentData(opponent);
                setShowWinnerReveal(true);
              } finally {
                setView('dashboard');
                setActiveSession(null);
                isEndingRef.current = false;
              }
            })();
          }
        }
      }
    });


    chatListener.current = onSnapshot(q,
      (snap) => {
        const msgs = [];
        let latestOpponentMsg = null;

        snap.forEach(d => {
          const m = {
            id: d.id,
            sender: d.data().senderId === user.uid ? 'me' : 'opponent',
            text: d.data().text,
            createdAt: d.data().createdAt?.toMillis() || Date.now(),
            audioBase64: d.data().audioBase64 || null  // Include TTS audio from backend
          };
          msgs.push(m);
        });

        // Identification of opponent messages
        const opponentMsgs = msgs.filter(m => m.sender === 'opponent');

        if (isSyncingInitialRef.current) {
          // ON FIRST LOAD: Only skip animation if it looks like history (more than 2 messages)
          // Otherwise, we want to animate even the first message of a fresh match
          if (opponentMsgs.length > 2) {
            opponentMsgs.forEach(m => {
              processedMessageIds.current.add(m.id);
              setVisibleMessageIds(prev => new Set([...prev, m.id]));
            });
          }
          isSyncingInitialRef.current = false;
        }

        // ONGOING: Queue NEW messages for animation
        const newMsgs = opponentMsgs.filter(m => !processedMessageIds.current.has(m.id));
        if (newMsgs.length > 0) {
          // Update last opponent message time for inactivity tracking
          lastOpponentMsgTimeRef.current = Date.now();

          console.log('[CHAT_LISTENER] New messages:', newMsgs.length, 'Match type:', type);
          // HUMAN MATCH: Fast-path (Instant Delivery)
          if (type === 'human') {
            console.log('[CHAT_LISTENER] Using HUMAN fast-path');
            playReceiveSound(); // Play sound for incoming message
            newMsgs.forEach(m => {
              processedMessageIds.current.add(m.id);
              setVisibleMessageIds(prev => new Set([...prev, m.id]));
            });
          }
          // BOT MATCH or BATTLE-BOT: Use simulated Typing Queue
          else {
            console.log('[CHAT_LISTENER] Using BOT/BATTLE-BOT typing queue');
            newMsgs.forEach(m => {
              processedMessageIds.current.add(m.id);
              typingQueue.current.push(m);
            });
            processTypingQueue();
          }
        }

        setMessages(prev => {
          // Keep system/correction/suggestion messages and any local optimistic messages
          const nonFirestoreMsgs = prev.filter(m =>
            m.sender === 'system' ||
            m.sender === 'correction' ||
            m.sender === 'suggestion' ||  // QUICKTIPS: Keep suggestion messages!
            (m.id && typeof m.id === 'string' && (
              m.id.startsWith('loc_') ||
              m.id.startsWith('bot_') ||
              m.id.startsWith('ai_') ||
              m.id.startsWith('tip_')  // QUICKTIPS: Keep tip messages!
            ))
          );

          // Filter out optimistic messages that are now confirmed in Firestore
          const firestoreTexts = new Set(msgs.filter(m => m.sender === 'me').map(m => m.text));
          const filteredNonFirestore = nonFirestoreMsgs.filter(m =>
            m.id.startsWith('loc_') ? !firestoreTexts.has(m.text) : true
          );

          const combined = [...filteredNonFirestore, ...msgs];
          return combined.sort((a, b) => {
            const tA = adjustedTimestamps.current[a.id] || a.createdAt || 0;
            const tB = adjustedTimestamps.current[b.id] || b.createdAt || 0;
            return tA - tB;
          });
        });
      },
      (error) => {
        console.error("Chat listener error:", error);
        if (!isAlertingRef.current) {
          isAlertingRef.current = true;
          alert("Chat connection lost. Please try matching again.");
          setTimeout(() => { isAlertingRef.current = false; }, 2000);
          setView('dashboard');
          setActiveSession(null);
          isJoiningRef.current = false;
        }
      }
    );

  };

  const startSimulation = async (sim) => {
    // Show loading screen with tips
    setPreparingSim(sim);

    try {
      // Warm up backend in background
      const token = await user.getIdToken();
      fetch(`${BACKEND_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'chat', message: 'warmup', personaId: sim.id, context: sim.desc, history: [], stage: sim.stages[0] })
      }).catch(e => { });
    } catch (e) { }

    // User requested 3.5s animation for better interest
    await new Promise(resolve => setTimeout(resolve, 3500));

    // AI speaks first!
    setPreparingSim(null);
    const sessionId = 'sim_' + Date.now() + Math.random().toString(36).substring(2, 7);
    resetChatStates();

    // Get first stage NPC as opponent name
    const firstStage = sim.stages[0];
    const npcName = typeof firstStage === 'object' ? firstStage.npc : sim.title;
    const npcIcon = typeof firstStage === 'object' ? firstStage.icon : '🤖';

    setActiveSession({
      id: sim.id,
      sessionId,
      opponent: { name: npcName, avatar: npcIcon },
      type: 'bot',
      topic: sim.desc,
      simulation: sim // Include full simulation data for stage tracking
    });
    setSessionStartTime(Date.now()); // Track session start for duration calculation
    // Reset typing status for bots
    setIsOpponentTyping(false);

    // Instead of instant reveal, trigger typing
    const greetingId = 'ai_init_' + Date.now();
    console.log('SIM_CHAT: Queuing AI greeting', greetingId);
    processedMessageIds.current.add(greetingId);
    typingQueue.current.push({ id: greetingId, sender: 'opponent', text: sim.greeting, createdAt: Date.now() });
    setTimeout(processTypingQueue, 600); // Wait for the 'chat' view to mount

    // Set initial stage (handle both old string format and new object format)
    const firstStageName = typeof firstStage === 'object' ? firstStage.name : firstStage;
    setCurrentStage(firstStageName);
    setCurrentStageIndex(0);
    setSessionPoints(0);
    setMessageAccuracies([]); // V7: Reset accuracy tracking
    setView('chat');
  };




  const sendMessage = async () => {
    if (!inputText.trim() || !activeSession) return;
    const text = inputText; setInputText("");
    if (activeSession.type === 'bot') {  // Simulations only - NOT battle-bot
      const now = Date.now();
      const msgId = 'loc' + now;

      // Step 1: Add message with status='sending'
      setMessages(prev => [...prev, { id: msgId, sender: 'me', text, createdAt: now, status: 'sending' }].sort((a, b) => {
        const tA = adjustedTimestamps.current[a.id] || a.createdAt || 0;
        const tB = adjustedTimestamps.current[b.id] || b.createdAt || 0;
        return tA - tB;
      }));
      playSendSound(); // Play send sound

      try {
        const token = await user.getIdToken();
        const history = messages.filter(m => m.sender !== 'system' && m.sender !== 'correction' && m.sender !== 'suggestion').map(m => `${m.sender === 'me' ? 'User' : 'AI'}: ${m.text}`);

        // Build stage info for backend (for stage transitions)
        const sim = activeSession?.simulation;
        const allStages = sim?.stages?.map(s => typeof s === 'object' ? s.name : s) || [];
        const stageInfo = {
          currentStage: currentStage,
          currentIndex: currentStageIndex,
          allStages: allStages,
          totalStages: allStages.length,
          simId: activeSession.id,
          simTitle: sim?.title || 'Simulation'
        };

        const res = await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            type: 'chat',
            message: text,
            personaId: activeSession.id,
            context: activeSession.topic,
            history,
            stage: currentStage,
            stageInfo: stageInfo  // Full stage context for transitions
          })
        });

        // Step 2: Update to status='sent' (single tick ✓)
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));

        // Step 3: After 500ms, update to status='seen' (double blue tick ✓✓)
        await new Promise(r => setTimeout(r, 500));
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'seen' } : m));

        // Step 4: After 1-2 sec realistic delay, show typing dots
        const typingDelay = 1000 + Math.random() * 1000; // 1-2 seconds
        await new Promise(r => setTimeout(r, typingDelay));
        setIsOpponentTyping(true);

        const data = await res.json();

        if (data.reply) {
          const earnedPoints = data.points || 5;
          setSessionPoints(prev => prev + earnedPoints);
          setShowPointsAnimation({ points: earnedPoints, id: Date.now() });
          setTimeout(() => setShowPointsAnimation(null), 1500);

          // V7 ACCURACY: Track per-message accuracy score from AI
          const msgAccuracy = data.accuracy ?? 100; // Default 100 if not provided
          setMessageAccuracies(prev => [...prev, msgAccuracy]);
          console.log('[V7 ACCURACY] Message:', text, 'Accuracy:', msgAccuracy, 'Summary:', data.errorSummary);

          // 3-LEVEL CLASSIFICATION: Handle errorLevel (perfect/suggestion/mistake)
          const errorLevel = data.errorLevel || (data.hasCorrection ? 'mistake' : 'perfect');

          if (errorLevel === 'mistake' && data.correction) {
            // RED CARD: Clear grammar error - show full correction card
            const correctionId = 'correction' + Date.now();
            const now = Date.now();
            adjustedTimestamps.current[correctionId] = now;
            setMessages(prev => [...prev, {
              id: correctionId,
              sender: 'correction',
              errorLevel: 'mistake',
              correction: data.correction,
              originalText: text,
              createdAt: now
            }]);
            try { new Audio('/sounds/correction.mp3').play().catch(() => { }); } catch { }
            setTimeout(() => setMinimizedCorrections(prev => ({ ...prev, [correctionId]: true })), 8000);
          } else if (errorLevel === 'suggestion' && data.correction) {
            // YELLOW TIP: Minor suggestion - show inline tip (less intrusive)
            const suggestionId = 'suggestion' + Date.now();
            const now = Date.now();
            adjustedTimestamps.current[suggestionId] = now;
            setMessages(prev => [...prev, {
              id: suggestionId,
              sender: 'suggestion',
              errorLevel: 'suggestion',
              correction: data.correction,
              originalText: text,
              createdAt: now
            }]);
            // Auto-minimize suggestions faster since they're minor
            setTimeout(() => setMinimizedCorrections(prev => ({ ...prev, [suggestionId]: true })), 5000);
          } else {
            // PERFECT: No issues - play success sound
            try { new Audio('/sounds/success.mp3').play().catch(() => { }); } catch { }
          }

          // Handle stage transition from API
          if (data.stageTransition && activeSession?.simulation?.stages) {
            const stages = activeSession.simulation.stages;
            const newStageIdx = stages.findIndex(s =>
              (typeof s === 'object' ? s.name : s).toLowerCase() === data.stageTransition.toLowerCase()
            );
            if (newStageIdx > currentStageIndex && newStageIdx < stages.length) {
              setCurrentStageIndex(newStageIdx);
              const newStage = stages[newStageIdx];
              setCurrentStage(typeof newStage === 'object' ? newStage.name : newStage);
              // Update opponent/NPC if it changed
              if (typeof newStage === 'object' && newStage.npc) {
                setActiveSession(prev => ({
                  ...prev,
                  opponent: { name: newStage.npc, avatar: newStage.icon || prev.opponent?.avatar }
                }));
              }
              console.log('[STAGE] Transitioned to:', data.stageTransition);
            }
          }

          // UNIFIED: Add bot reply to typing queue for sequential reveal
          const botMsgId = 'bot_' + Date.now();
          processedMessageIds.current.add(botMsgId);
          typingQueue.current.push({
            id: botMsgId,
            sender: 'opponent',
            text: data.reply,
            audioBase64: data.audioBase64, // WaveNet audio from backend
            createdAt: Date.now()
          });
          processTypingQueue();
        } else {
          setIsOpponentTyping(false);
          if (data.error) setMessages(prev => [...prev, { id: 'err_' + Date.now(), sender: 'opponent', text: 'Sorry, I didn\'t catch that.' }]);
        }
      } catch (e) {
        setIsOpponentTyping(false);
        setMessages(prev => [...prev, { id: 'err_' + Date.now(), sender: 'opponent', text: 'Connection issue. Try again.' }]);
      }
    } else {  // Human or Battle-Bot - use send_message
      // Optimistic Update for Human Match
      const now = Date.now();
      const msgId = 'loc_' + now;
      const optimisticMsg = { id: msgId, sender: 'me', text, createdAt: now, status: 'sending' };
      setMessages(prev => [...prev, optimisticMsg].sort((a, b) => {
        const tA = adjustedTimestamps.current[a.id] || a.createdAt || 0;
        const tB = adjustedTimestamps.current[b.id] || b.createdAt || 0;
        return tA - tB;
      }));
      playSendSound(); // Play send sound
      // Track when I sent my last message for inactivity detection
      lastMyMsgTimeRef.current = now;

      try {
        const token = await user.getIdToken();
        const data = await callBackend(BACKEND_URL, 'POST', { type: 'send_message', roomId: activeSession.id, text, senderId: user.uid, difficulty: difficultyLevel }, token);
        /*const res = await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'send_message', roomId: activeSession.id, text, senderId: user.uid, difficulty: difficultyLevel })
        });

        // V8: Parse accuracy from response
        const data = await res.json();*/
        const msgAccuracy = data.accuracy ?? 100;
        const errorLevel = data.errorLevel || 'perfect';
        const correction = data.correction;

        // Track accuracy for running average
        setBattleAccuracies(prev => [...prev, msgAccuracy]);
        console.log('[V8 BATTLE_ACCURACY] Message:', text.slice(0, 30), 'Accuracy:', msgAccuracy, 'Level:', errorLevel);

        // Step 2: Update message with status and accuracy indicator
        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          status: 'sent',
          accuracy: msgAccuracy,
          errorLevel: errorLevel
        } : m));

        // V8: Battle Mode - ALWAYS save corrections for PDF analysis
        // Tip cards shown only if isBattleTipsOn is true
        if (correction) {
          // ALWAYS save correction (for PDF Study Guide)
          setBattleCorrections(prev => [...prev, correction]);
          console.log('[BATTLE_CORRECTION] Saved:', correction.original, '->', correction.corrected);

          // Show tip card ONLY if toggle is ON
          console.log('[QUICK_TIPS_DEBUG] Toggle state:', isBattleTipsOnRef.current, 'State:', isBattleTipsOn);
          if (isBattleTipsOnRef.current) {
            const tipId = 'tip_' + Date.now();
            const tipNow = Date.now();
            adjustedTimestamps.current[tipId] = tipNow;
            setMessages(prev => [...prev, {
              id: tipId,
              sender: 'suggestion', // Yellow tip style, NOT red mistake card
              errorLevel: 'suggestion',
              correction: correction,
              originalText: text,
              createdAt: tipNow
            }]);
            // Auto-minimize after 5s (same timing as simulations)
            setTimeout(() => setMinimizedCorrections(prev => ({ ...prev, [tipId]: true })), 5000);
          }
        }

        // For Battle-Bot: Simulate seen + typing with delays
        if (activeSession.type === 'battle-bot') {
          // Step 3: After 500ms, status='seen' (double blue tick ✓✓)
          await new Promise(r => setTimeout(r, 500));
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'seen' } : m));

          // Step 4: After 1-2 sec, show typing dots
          const typingDelay = 1000 + Math.random() * 1000;
          await new Promise(r => setTimeout(r, typingDelay));
          setIsOpponentTyping(true);
        } else {
          // For Human matches: status will be updated when other user actually sees it
          // For now, just mark as delivered after a short delay
          await new Promise(r => setTimeout(r, 300));
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'delivered' } : m));
        }
      } catch (e) {
        console.error('Send message error:', e);
        // Mark as failed (keep as sending to show there was an issue)
      }
    }
  };


  // Get detailed explanation from AI professor
  const getDetailedExplanation = async (correction) => {
    setIsLoadingExplanation(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          type: 'detailed_explanation',
          original: correction.original,
          corrected: correction.corrected,
          reason: correction.reason,
          motherTongue: motherTongue
        })
      });
      const data = await res.json();
      setIsLoadingExplanation(false);
      setShowDetailedExplanation({
        ...correction,
        detailed: data.explanation || "This is a common grammar mistake. Practice using this structure in different sentences to improve your fluency.",
        examples: data.examples || ["Try: " + correction.corrected],
        tips: data.tips || ["Practice daily", "Read English content"]
      });
    } catch (e) {
      setIsLoadingExplanation(false);
      setShowDetailedExplanation({
        ...correction,
        detailed: "This grammar pattern is commonly confused. The key is subject-verb agreement and proper tense usage.",
        examples: [correction.corrected],
        tips: ["Practice this pattern daily"]
      });
    }
  };

  const endSession = async (initiatedByMe = true, timeEnded = false, inactivityReason = null) => {
    if (!activeSession || isEndingRef.current) return;
    isEndingRef.current = true;

    // IMMEDIATE: Show ending animation right away to avoid freeze
    const isCompetitive = activeSession?.type !== 'bot';
    // Bug 6 Fix: Use REFS for capturing to avoid stale closure issues in auto-end
    const capturedMessages = [...messagesRef.current];
    const capturedSession = { ...activeSession }; // Capture session info
    const capturedBattleAccuracies = [...battleAccuraciesRef.current];
    console.log('[BUG6 FIX] Captured latest data from refs:', { msgCount: capturedMessages.length, accCount: capturedBattleAccuracies.length });

    // Show ending view for Simulation only (Bug 4 fix: skip for Battle to avoid animation flash)
    // UPDATE: For simulation, show 'analyzing' IMMEDIATELY and start API call right away
    if (!isCompetitive) {
      setView('analyzing'); // Skip 'ending', go straight to 'analyzing' for faster UX
    }

    resetChatStates();

    // Prepare for feedback
    setFeedbackSessionId(capturedSession.sessionId || capturedSession.id);
    setFeedbackRating(0);
    setFeedbackText('');
    setFeedbackSubmitted(false);

    setTimerActive(false);

    // UPDATE FIRESTORE: Notify opponent that session ended
    if (initiatedByMe && isCompetitive && capturedSession.id) {
      try {
        const roomRef = doc(db, 'queue', capturedSession.id);
        await setDoc(roomRef, {
          status: 'ended',
          endReason: inactivityReason || (timeEnded ? 'time_over' : 'left_early'),
          endedBy: user.uid,
          endedAt: serverTimestamp(),
          enderTimerDuration: sessionDuration // Pass ender's timer duration for comparison
        }, { merge: true });
        console.log('[SESSION_END] Updated Firestore:', { roomId: capturedSession.id, endReason: timeEnded ? 'time_over' : 'left_early', enderTimerDuration: sessionDuration });
      } catch (e) {
        console.error('[SESSION_END] Firestore update failed:', e);
      }
    }
    if (chatListener.current) { chatListener.current(); chatListener.current = null; }
    if (matchListener.current) { matchListener.current(); matchListener.current = null; }

    // CRITICAL: Reset isJoiningRef so next match can proceed
    isJoiningRef.current = false;
    isEndingRef.current = false;

    // Calculate accuracy based on messages and corrections
    const myMessages = capturedMessages.filter(m => m.sender === 'me');
    const totalSent = myMessages.length;
    // Count BOTH corrections (red) AND suggestions (yellow) as mistakes
    const rawCorrectionCount = capturedMessages.filter(m => m.sender === 'correction' || m.sender === 'suggestion').length;
    // FIX: Ensure correction count doesn't exceed messages sent (edge case protection)
    const correctionCount = Math.min(rawCorrectionCount, totalSent);
    const cleanCount = totalSent - correctionCount;
    // Store actual corrections for session-specific feedback (include both corrections and suggestions)
    const sessionCorrections = capturedMessages.filter(m => m.sender === 'correction' || m.sender === 'suggestion').map(m => m.correction);

    let sessionAccuracy = 100;
    if (totalSent === 0) {
      sessionAccuracy = 0;
    } else if (totalSent < 3) {
      // Engagement Guard: Under 3 messages gets 0% accuracy
      sessionAccuracy = 0;
    } else if (messageAccuracies.length > 0) {
      // V7 FORMULA: Average of all per-message accuracy scores
      const sum = messageAccuracies.reduce((a, b) => a + b, 0);
      sessionAccuracy = Math.round(sum / messageAccuracies.length);
    } else {
      // Fallback: Old weighted formula if no V7 data
      sessionAccuracy = Math.round(((cleanCount * 100) + (correctionCount * 65)) / totalSent);
    }
    console.log('[V7 ACCURACY] Session:', { totalSent, messageAccuracies, sessionAccuracy });

    // SIMULATION MODE ONLY - Call PRO model for accurate analysis (same as battle)
    if (capturedSession?.type === 'bot') {
      // View is already set to 'analyzing' at the top of endSession

      // Prepare messages for PRO analysis
      const myMsgs = myMessages.map(m => m.text);

      // START API CALL IMMEDIATELY (don't wait for calculations)
      // This happens IN PARALLEL with the animation
      let proAccuracy = sessionAccuracy; // Fallback to Flash average
      const analyzePromise = (async () => {
        try {
          const token = await user.getIdToken();
          console.log('[SIM PRO ANALYSIS] Starting API call immediately...');
          const data = await callBackend(BACKEND_URL, 'POST', {
            type: 'analyze_simulation',
            simId: capturedSession.id,
            simName: capturedSession.opponent?.name || 'Simulation',
            playerHistory: myMsgs
          }, token);
          /*const res = await fetch(`${BACKEND_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              type: 'analyze_simulation',
              simId: capturedSession.id,
              simName: capturedSession.opponent?.name || 'Simulation',
              playerHistory: myMsgs
            })
          });
          const data = await res.json();*/
          if (data.accuracy !== undefined) {
            proAccuracy = Math.round(data.accuracy);
            console.log('[SIM PRO ANALYSIS] PRO accuracy:', proAccuracy, 'vs Flash average:', sessionAccuracy);
          }
        } catch (e) {
          console.error('[SIM PRO ANALYSIS] Failed, using Flash average:', e);
        }
        return proAccuracy;
      })();

      // Wait for API to complete with 15 second timeout to prevent UI blocking
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Analyze timeout')), 15000)
      );
      try {
        sessionAccuracy = await Promise.race([analyzePromise, timeoutPromise]);
      } catch (e) {
        console.warn('[ANALYZE_TIMEOUT] Using fallback accuracy:', sessionAccuracy);
        // Keep sessionAccuracy as the pre-calculated Flash average
      }

      // Store session history to Firestore
      const sessionDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0; // Duration in seconds

      // Prepare chat history (both sides) for analytics
      const chatHistory = capturedMessages
        .filter(m => m.sender === 'me' || m.sender === 'opponent' || m.sender === 'bot')
        .map(m => ({
          sender: m.sender,
          text: m.text,
          timestamp: m.createdAt || Date.now()
        }));

      const sessionData = {
        simId: capturedSession.id,
        simName: capturedSession.opponent?.name || 'Simulation',
        opponentAvatar: capturedSession.opponent?.avatar || '🤖',
        points: sessionPoints,
        accuracy: sessionAccuracy,
        messagesCount: totalSent,
        correctionsCount: correctionCount,
        corrections: sessionCorrections, // IMPORTANT: Include actual corrections for AI Analysis
        duration: sessionDuration, // Session duration in seconds for time tracking
        startTime: serverTimestamp(), // For PDF Study Guide query
        timestamp: serverTimestamp(),
        lastMessage: myMessages[myMessages.length - 1]?.text || '',
        chatHistory: chatHistory // Full chat for analytics
      };

      console.log('[DEBUG_SAVE] Session corrections:', sessionCorrections);
      console.log('[DEBUG_SAVE] Full sessionData:', sessionData);

      try {
        // Add to sessions subcollection
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        await addDoc(sessionsRef, sessionData);
        console.log('[DEBUG_SAVE] Session saved successfully!');
      } catch (e) { console.error('Failed to save session:', e); }

      // Update stats with cumulative accuracy and streak
      const todayStr = getLocalDateStr();
      setStats(prev => {
        const lastDate = prev.lastPracticeDate;
        let newStreak = prev.streak || 0;

        if (lastDate !== todayStr) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = getLocalDateStr(yesterday);

          if (lastDate === yesterdayStr) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }

        // EARLY END FIX: <3 messages should NOT affect anything at all
        // No streak, no points, no accuracy contribution - session doesn't count
        if (totalSent < 3) {
          // DON'T update anything - just return unchanged stats
          // This prevents gaming the system by starting/ending sessions quickly
          return prev;
        }

        // NORMAL: 3+ messages update everything
        const newTotalSessions = prev.sessions + 1;
        const newTotalPoints = prev.points + sessionPoints;
        // HYBRID FORMULA: Simple average for first 5 sessions, then EMA
        let newAvgScore;
        if (prev.sessions < 5) {
          // Simple average for new users (fair weight to each session)
          newAvgScore = Math.round((prev.avgScore * prev.sessions + sessionAccuracy) / newTotalSessions);
        } else {
          // EMA after 5 sessions (stability)
          newAvgScore = Math.round(((prev.avgScore || 0) * 9 + sessionAccuracy) / 10);
        }
        // Level based on ACCURACY (not points) - Stage naming
        const newLevel = newAvgScore >= 95 ? 'Master' : newAvgScore >= 85 ? 'Pro' : newAvgScore >= 70 ? 'Improver' : newAvgScore >= 50 ? 'Learner' : 'Starter';

        const n = {
          ...prev,
          sessions: newTotalSessions,
          points: newTotalPoints,
          avgScore: newAvgScore,
          level: newLevel,
          streak: newStreak,
          lastPracticeDate: todayStr
        };
        setTimeout(() => saveUserData(n, null), 10);
        return n;
      });

      // Show session summary modal with session-specific corrections
      setShowSessionSummary({
        simName: capturedSession.opponent?.name || 'Session',
        simId: capturedSession.id,
        points: sessionPoints,
        accuracy: sessionAccuracy,
        messagesCount: totalSent,
        correctionsCount: correctionCount,
        corrections: sessionCorrections
      });

      // IMPORTANT: Transition to dashboard IMMEDIATELY - don't wait for feedback
      setView('dashboard'); setActiveSession(null);

      // Fetch AI-powered personalized feedback (in background - doesn't block UI)
      setIsLoadingFeedback(true);
      setAiFeedback('');

      // Check message count - need at least 3 for proper assessment
      if (totalSent < 3) {
        setAiFeedback(totalSent === 0
          ? "You didn't send any messages. Please try at least 3+ messages for us to assess your English level."
          : `You only sent ${totalSent} message${totalSent > 1 ? 's' : ''}. Please send at least 3+ messages for a proper assessment of your skills.`
        );
        setIsLoadingFeedback(false);
      } else {
        try {
          const token = await user.getIdToken();
          const feedbackRes = await fetch(`${BACKEND_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              type: 'session_feedback',
              messages: capturedMessages.filter(m => m.sender === 'me' || m.sender === 'bot').slice(-20),
              corrections: sessionCorrections,
              accuracy: sessionAccuracy,
              messageCount: totalSent,
              simName: capturedSession.opponent?.name || 'Practice Session'
            })
          });
          const feedbackData = await feedbackRes.json();
          if (feedbackData.feedback) {
            setAiFeedback(feedbackData.feedback);
          }
        } catch (e) {
          console.error('[AI_FEEDBACK_ERROR]', e);
          setAiFeedback('Great effort today! Keep practicing daily to improve your fluency.');
        } finally {
          setIsLoadingFeedback(false);
        }
      }


    } else {
      // Calculate combined messages for proper analysis threshold
      const oppMessages = capturedMessages.filter(m => m.sender === 'opponent');
      const combinedMessageCount = totalSent + oppMessages.length;
      console.log('[BATTLE] Message counts - Me:', totalSent, 'Opponent:', oppMessages.length, 'Combined:', combinedMessageCount);

      // Check if combined messages < 6: Show WinnerReveal with "insufficient" message, don't update stats
      if (combinedMessageCount < 6) {
        console.log('[BATTLE] Insufficient messages (<6 combined), showing scorecard without analysis');
        // Set special "insufficient" state for WinnerReveal
        setDualAnalysis({
          insufficientMessages: true,
          message: 'Not enough messages to analyze the result. Play longer next time!',
          player1: { total: 0, vocab: 0, grammar: 0, fluency: 0, sentence: 0 },
          player2: { total: 0, vocab: 0, grammar: 0, fluency: 0, sentence: 0 },
          winner: 'none'
        });
        setBattleOpponentData(capturedSession?.opponent);
        setShowWinnerReveal(true);
        setView('dashboard');
        setActiveSession(null);
        setIsEnding(false);
        setShowExitWarning(false);
        isEndingRef.current = false;
        // Don't update stats - accuracy remains unchanged
        setTimeout(() => { isEndingRef.current = false; isJoiningRef.current = false; }, 1500);
        return; // Exit early without stats update
      }

      // Show transition animation for the initiating player (time_over or left_early)
      // SKIP if already showing transition OR if timer/inactivity already showed animation before calling endSession
      // When timeEnded=true or inactivityReason is set, animation was already shown in the timer/inactivity handlers
      if (!sessionEndTransition && !timeEnded && !inactivityReason) {
        const transitionType = 'opponent_left'; // Only used for manual "End Session" button
        setSessionEndTransition(transitionType);
      }
      setBattleOpponentData(capturedSession?.opponent);

      // Start API call IMMEDIATELY (runs in parallel with transition animation)
      const myMsgs = myMessages.map(m => m.text);
      const oppMsgs = oppMessages.map(m => m.text);
      const isBotMatch = capturedSession?.type === 'battle-bot';
      console.log('[ANALYZE DEBUG] Starting API call in parallel with animation...');

      // Use requestAnimationFrame to GUARANTEE the browser paints the transition
      // before starting async work (setTimeout(0) does NOT guarantee paint)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double RAF ensures we're after the paint
          // FIRE-AND-FORGET: Start background async so we can return and let React render
          (async () => {
            // Create the API promise (starts immediately)
            const analyzePromise = (async () => {
              const token = await user.getIdToken();
              const res = await fetch(`${BACKEND_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  type: 'analyze',
                  roomId: capturedSession.id,
                  analyzedBy: user.uid,
                  player1History: myMsgs,
                  player2History: oppMsgs,
                  isBotMatch: isBotMatch
                })
              });
              const data = await res.json();
              console.log('[ANALYZE] Received from backend:', data);
              return data;
            })();

            // Wait for both: animation (4s) AND API call to complete (increased from 2.5s)
            const minAnimationTime = new Promise(resolve => setTimeout(resolve, 4000));
            const [apiResult] = await Promise.all([analyzePromise, minAnimationTime]);

            // Clear transition and show analyzing briefly
            setSessionEndTransition(null);
            setView('analyzing');

            try {
              // Use backend scores directly (handicap already applied if bot match)
              let adjustedData = { ...apiResult };

              // For backward compatibility: ensure player scores exist
              if (!adjustedData.player1) {
                adjustedData.player1 = { vocab: 0, grammar: 0, fluency: 0, sentence: 0, total: 0, feedback: 'No data' };
              }
              if (!adjustedData.player2) {
                adjustedData.player2 = { vocab: 0, grammar: 0, fluency: 0, sentence: 0, total: 0, feedback: 'No data' };
              }

              console.log('[ANALYZE] Final scores - You:', adjustedData.player1?.total, 'Opponent:', adjustedData.player2?.total, 'Winner:', adjustedData.winner);

              // SYNC FIX: Save analysis to Firestore for other player to read
              // Only save for human vs human matches (not bot matches)
              if (!isBotMatch && capturedSession?.id) {
                try {
                  const roomRef = doc(db, 'queue', capturedSession.id);
                  await updateDoc(roomRef, {
                    analysis: adjustedData,
                    analyzedAt: serverTimestamp()
                  });
                  console.log('[ANALYZE] Saved analysis to Firestore for sync');
                } catch (syncErr) {
                  console.error('[ANALYZE] Failed to save analysis to Firestore:', syncErr);
                }
              }

              setDualAnalysis(adjustedData);

              // Determine win BEFORE try block so it's accessible in setStats
              const analyzedBy = adjustedData?.analyzedBy;
              const amIPlayer1 = !analyzedBy || analyzedBy === user.uid;
              const didIWin = amIPlayer1 ? (adjustedData?.winner === 'player1') : (adjustedData?.winner === 'player2');

              // Calculate scores BEFORE try block so they're in scope for setStats
              const myData = amIPlayer1 ? adjustedData?.player1 : adjustedData?.player2;
              const oppData = amIPlayer1 ? adjustedData?.player2 : adjustedData?.player1;
              const myScore = myData?.total || 0;
              const totalSent = myMsgs?.length || 0;

              // Store competitive session
              try {

                // Prepare battle chat history for analytics
                const battleChatHistory = capturedMessages
                  .filter(m => m.sender === 'me' || m.sender === 'opponent')
                  .map(m => ({
                    sender: m.sender,
                    text: m.text,
                    timestamp: m.createdAt || Date.now()
                  }));
                const battleDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;

                const sessionsRef = collection(db, 'users', user.uid, 'sessions');
                await addDoc(sessionsRef, {
                  type: capturedSession.type === 'battle-bot' ? 'battle-bot' : '1v1',
                  score: myData?.total || 0,
                  opponentId: capturedSession.opponent?.id, // For replay with same opponent
                  opponentName: capturedSession.opponent?.name || 'Opponent',
                  opponentAvatar: capturedSession.opponent?.avatar || '👤',
                  won: didIWin,
                  corrections: battleCorrectionsRef.current, // Use battleCorrections (tracked during battle)
                  correctionsCount: battleCorrectionsRef.current.length,
                  accuracy: myScore,
                  messagesCount: totalSent,
                  duration: battleDuration, // Session duration for time tracking
                  startTime: serverTimestamp(),
                  timestamp: serverTimestamp(),
                  chatHistory: battleChatHistory // Full chat for analytics
                });
                console.log('[DEBUG_SAVE] Battle session saved with corrections:', battleCorrectionsRef.current);
              } catch (e) { console.error('Session save error:', e); }


              const todayStr = getLocalDateStr();
              setStats(prev => {
                const lastDate = prev.lastPracticeDate;
                let newStreak = prev.streak || 0;

                if (lastDate !== todayStr) {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yesterdayStr = getLocalDateStr(yesterday);

                  if (lastDate === yesterdayStr) {
                    newStreak += 1;
                  } else {
                    newStreak = 1;
                  }
                }

                // EARLY END FIX: <3 messages should NOT affect stats at all
                // No wins, no losses, no avgScore contribution - battle doesn't count
                if (totalSent < 3) {
                  // Only update streak, DON'T count as win OR loss
                  const n = {
                    ...prev,
                    streak: newStreak,
                    lastPracticeDate: todayStr
                    // NO battleWins/battleLosses update - battle doesn't count
                  };
                  setTimeout(() => saveUserData(n, null), 10);
                  return n;
                }

                // NORMAL: 3+ messages update everything
                const newTotalSessions = prev.sessions + 1;
                // V8: Battle Mode uses same HYBRID formula as Simulation
                console.log('[V8 BATTLE_SCORE] Contributing to avgScore:', myScore, 'sessions:', prev.sessions);
                // HYBRID FORMULA: Simple average for first 5 sessions, then EMA
                let newAvgScore;
                if (prev.sessions < 5) {
                  // Simple average for new users (fair weight)
                  newAvgScore = Math.round((prev.avgScore * prev.sessions + myScore) / newTotalSessions);
                } else {
                  // EMA after 5 sessions (stability)
                  newAvgScore = Math.round(((prev.avgScore || 0) * 9 + myScore) / 10);
                }
                // Level based on ACCURACY (not points) - Stage naming
                const newLevel = newAvgScore >= 95 ? 'Master' : newAvgScore >= 85 ? 'Pro' : newAvgScore >= 70 ? 'Improver' : newAvgScore >= 50 ? 'Learner' : 'Starter';
                const n = {
                  ...prev,
                  sessions: newTotalSessions,
                  points: prev.points + myScore,
                  avgScore: newAvgScore,
                  level: newLevel,
                  streak: newStreak,
                  lastPracticeDate: todayStr,
                  // Track battle wins AND losses for proper battles (3+ messages)
                  battleWins: (prev.battleWins || 0) + (didIWin ? 1 : 0),
                  battleLosses: (prev.battleLosses || 0) + (!didIWin && adjustedData?.winner !== 'draw' ? 1 : 0)
                };
                setTimeout(() => saveUserData(n, null), 10);
                return n;
              });
              setShowWinnerReveal(true);
              setView('dashboard');
            } catch (e) {
              setSessionEndTransition(null);
              setView('dashboard');
            }
            setActiveSession(null);
            setIsEnding(false);
            setShowExitWarning(false);

            // Reset guards after delay
            setTimeout(() => {
              isEndingRef.current = false;
              isJoiningRef.current = false;
            }, 1500);
          })(); // End of fire-and-forget async IIFE
        }); // End of inner requestAnimationFrame
      }); // End of outer requestAnimationFrame - ensures paint before async

      // Return immediately so React can render the transition
      return;
    }

    setIsEnding(false);
    setShowExitWarning(false);

    // Reset guards after delay
    setTimeout(() => {
      isEndingRef.current = false;
      isJoiningRef.current = false;
    }, 1500);
  };

  const handleEndClick = () => {
    const myMsgCount = messages.filter(m => m.sender === 'me').length;
    const oppMsgCount = messages.filter(m => m.sender === 'opponent').length;

    // For human matches: warn if EITHER player has < 3 messages
    // For bot matches: warn if MY messages < 3
    const minMsgs = activeSession?.type === 'human'
      ? Math.min(myMsgCount, oppMsgCount)
      : myMsgCount;

    if (minMsgs < 3) {
      setShowExitWarning(true);
    } else {
      endSession(true);
    }
  };

  const renderGlobalModals = () => {
    if (!user) return null;
    return (
      <>
        {/* Offline User Popup */}
        <AnimatePresence>
          {offlineUserTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={() => setOfflineUserTarget(null)}
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm grayscale opacity-70">
                  {offlineUserTarget.opponentAvatar || '👤'}
                </div>

                <h3 className="text-2xl font-black text-gray-800 mb-3">{offlineUserTarget.title} is Offline</h3>
                <p className="text-gray-500 text-sm mb-8 font-medium">
                  This user is away.<br /><span className="text-emerald-600 font-bold">Challenge a Bot instead! 🤖</span>
                </p>

                <button
                  onClick={() => setOfflineUserTarget(null)}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Send Invitation Confirmation Popup */}
        <AnimatePresence>
          {pendingInviteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>

                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
                  <Swords className="text-emerald-600" size={32} />
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">Send Battle Request?</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Challenge <span className="font-bold text-gray-800">{pendingInviteTarget.name}</span> to a live speaking battle. They will have 16 seconds to accept.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={cancelPendingInvite}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSendInvitation}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/30 transform hover:scale-[1.02]"
                  >
                    Send Request 🚀
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incoming Match Invitation Popup */}
        <AnimatePresence>
          {incomingInvitation && view === 'dashboard' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl"
              >
                {/* Countdown Timer */}
                <div className="mb-4">
                  <div className={`text-sm font-bold ${invitationCountdown <= 5 ? 'text-red-500' : 'text-gray-500'}`}>
                    ⏱️ {invitationCountdown}s remaining
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: `${(invitationCountdown / 16) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${invitationCountdown <= 5 ? 'bg-red-500' : invitationCountdown <= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />
                  </div>
                </div>

                <div className="text-5xl mb-4">{incomingInvitation.fromAvatar || '👤'}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">{incomingInvitation.fromName}</h3>
                <p className="text-sm text-emerald-600 font-semibold mb-2">{incomingInvitation.fromLevel}</p>
                <p className="text-gray-500 text-sm mb-6">wants to practice with you!</p>

                <div className="flex gap-3">
                  <button
                    onClick={declineInvitation}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={acceptInvitation}
                    className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/30"
                  >
                    Accept ✓
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notification (Beautiful replacement for ugly browser alerts) */}
        <AnimatePresence>
          {toastNotification && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
            >
              <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto ${toastNotification.type === 'declined' ? 'bg-gradient-to-r from-red-500 to-pink-500' :
                toastNotification.type === 'timeout' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  'bg-gradient-to-r from-emerald-500 to-teal-500'
                } text-white`}>
                <span className="text-3xl flex-shrink-0">{toastNotification.avatar || '😔'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{toastNotification.name}</p>
                  <p className="text-sm opacity-90 leading-tight">{toastNotification.message}</p>
                </div>
                <button
                  onClick={() => setToastNotification(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sender Waiting for Response Modal (with countdown timer) */}
        <AnimatePresence>
          {loadingAction === 'waiting-invite' && sentInviteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl"
              >
                {/* Countdown Timer Bar */}
                <div className="mb-4">
                  <div className={`text-sm font-bold ${senderCountdown <= 5 ? 'text-red-500' : 'text-gray-500'}`}>
                    ⏱️ {senderCountdown}s remaining
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <motion.div
                      initial={{ width: '100%' }}
                      animate={{ width: `${(senderCountdown / 16) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${senderCountdown <= 5 ? 'bg-red-500' : senderCountdown <= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    />
                  </div>
                </div>

                {/* Pulsing Avatar */}
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-5xl mb-4"
                >
                  {sentInviteTarget.avatar || '👤'}
                </motion.div>

                <h3 className="text-xl font-bold text-gray-800 mb-1">{sentInviteTarget.name}</h3>
                <p className="text-gray-500 text-sm mb-4">Waiting for response...</p>

                {/* Loading Spinner */}
                <div className="flex justify-center mb-4">
                  <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                </div>

                <button
                  onClick={() => {
                    setLoadingAction(null);
                    if (senderTimerRef.current) clearInterval(senderTimerRef.current);
                    if (sentInvitationListenerRef.current) {
                      sentInvitationListenerRef.current();
                      sentInvitationListenerRef.current = null;
                    }
                    // Cancel the invitation in Firestore
                    deleteDoc(doc(db, 'invitations', sentInviteTarget.id)).catch(e => console.error('Cancel error:', e));
                    setSentInviteTarget(null);
                  }}
                  className="py-2 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Cancel Request
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preparing Simulation Modal */}
        <AnimatePresence>
          {preparingSim && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-900 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center max-w-sm w-full"
              >
                {/* Simulation Icon */}
                <motion.div
                  className="w-24 h-24 mx-auto mb-6 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/20"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {preparingSim.icon && <preparingSim.icon size={48} className="text-white" />}
                </motion.div>

                <h2 className="text-2xl font-black text-white mb-2">Preparing {preparingSim.title}...</h2>
                <p className="text-emerald-200 text-sm mb-8">Setting up your practice session</p>

                {/* Loading Dots */}
                <div className="flex justify-center gap-2 mb-8">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-3 h-3 bg-white rounded-full"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    />
                  ))}
                </div>

                {/* Tips Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold mb-2">
                    <Sparkles size={14} /> Scenario Tips
                  </div>
                  <p className="text-white/80 text-xs leading-relaxed">
                    {preparingSim.id === 'sim_interview' && "Be confident! Start with a firm greeting and maintain eye contact (even virtually)."}
                    {preparingSim.id === 'sim_cafe' && "Practice ordering clearly. Don't forget to say 'please' and 'thank you'!"}
                    {preparingSim.id === 'sim_doctor' && "Describe your symptoms clearly. Use phrases like 'I have been feeling...'"}
                    {preparingSim.id === 'sim_train' && "Know your destination! Ask about timings, platform numbers, and ticket prices."}
                    {preparingSim.id === 'sim_airport' && "Keep your passport ready! Practice phrases for check-in and security."}
                    {preparingSim.id === 'sim_friend' && "Just be yourself! Casual conversations are great for building fluency."}
                    {!['sim_interview', 'sim_cafe', 'sim_doctor', 'sim_train', 'sim_airport', 'sim_friend'].includes(preparingSim.id) && "Take your time and speak naturally. There's no rush!"}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Early Exit Warning Modal */}
        <AnimatePresence>
          {showExitWarning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Leaving so soon?</h3>
                <p className="text-gray-500 text-sm mb-6">
                  You've only sent <span className="font-bold text-gray-900">{messages.filter(m => m.sender === 'me').length} messages</span>.
                  Ending now will mark your accuracy as <span className="text-red-600 font-bold">0%</span> and won't count towards your streak!
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setShowExitWarning(false)}
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md"
                  >
                    CONTINUE CHATTING
                  </button>
                  <button
                    onClick={() => { setShowExitWarning(false); endSession(true); }}
                    className="w-full py-3 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    EXIT ANYWAY
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streak Progress Popup - GLOBAL */}
        <AnimatePresence>
          {showStreakProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowStreakProgress(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-black text-gray-900 mb-4 text-center">🔥 Streak Journey</h3>
                <div className="text-center mb-4">
                  <div className="text-4xl font-black text-orange-500">{stats.streak || 0}</div>
                  <div className="text-sm text-gray-500">Current streak days</div>
                </div>
                <div className="space-y-2">
                  {[3, 7, 15, 30, 60, 100].map(milestone => {
                    const current = stats.streak || 0;
                    const isReached = current >= milestone;
                    const isNext = !isReached && (milestone === 3 || current >= [0, 3, 7, 15, 30, 60][[3, 7, 15, 30, 60, 100].indexOf(milestone)]);
                    return (
                      <div
                        key={milestone}
                        className={`flex items-center gap-3 p-2 rounded-xl transition-all ${isReached ? 'bg-gradient-to-r from-orange-400 to-red-400 text-white' :
                          isNext ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-100 opacity-60'
                          }`}
                      >
                        <div className="text-xl">{isReached ? '✅' : isNext ? '🎯' : '🔒'}</div>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${isReached ? 'text-white' : 'text-gray-700'}`}>
                            {milestone} Day Streak {isNext && '← Next'}
                          </div>
                          <div className={`text-xs ${isReached ? 'text-white/80' : 'text-gray-400'}`}>
                            {isReached ? 'Achieved! 🎉' : `${milestone - current} days to go`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowStreakProgress(false)}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:opacity-90"
                >
                  Keep the Fire Burning! 🔥
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accuracy Info Popup - GLOBAL with Premium Shield Badges */}
        <AnimatePresence>
          {showAccuracyInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={() => setShowAccuracyInfo(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-gradient-to-b from-slate-50 to-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-black text-gray-900 mb-2 text-center">🎯 Your Accuracy</h3>
                <div className="text-center mb-3">
                  <div className="text-4xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{stats.avgScore || 0}%</div>
                </div>

                {/* What is Accuracy? */}
                <div className="bg-purple-50 rounded-xl p-3 mb-4 text-xs text-purple-700 leading-relaxed">
                  <div className="font-bold mb-1">📊 What is Accuracy?</div>
                  Your accuracy measures how well you communicate in English. It's calculated from your <span className="font-semibold">grammar, vocabulary,</span> and <span className="font-semibold">fluency</span> across all practice sessions.
                </div>

                {/* Shield Badge Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { name: 'Bronze', min: 50, color: 'from-amber-600 via-amber-500 to-yellow-600', borderColor: 'border-amber-700', star: '★', shadow: 'shadow-amber-200' },
                    { name: 'Silver', min: 70, color: 'from-slate-400 via-slate-300 to-slate-400', borderColor: 'border-slate-500', star: '★★', shadow: 'shadow-slate-200' },
                    { name: 'Gold', min: 85, color: 'from-yellow-500 via-yellow-400 to-amber-500', borderColor: 'border-yellow-600', star: '★★★', shadow: 'shadow-yellow-200' },
                    { name: 'Diamond', min: 95, color: 'from-cyan-400 via-sky-300 to-blue-400', borderColor: 'border-cyan-500', star: '★★★★', shadow: 'shadow-cyan-200' }
                  ].map(badge => {
                    const isEarned = (stats.avgScore || 0) >= badge.min;
                    const isNext = !isEarned && (stats.avgScore || 0) >= (badge.min === 50 ? 0 : badge.min - 20);
                    return (
                      <div key={badge.name} className="flex flex-col items-center">
                        {/* Shield Badge */}
                        <div
                          className={`relative w-16 h-20 flex flex-col items-center justify-center transition-all ${isEarned ? 'scale-100' : 'scale-90 opacity-40 grayscale'
                            }`}
                          style={{
                            clipPath: 'polygon(50% 0%, 100% 15%, 100% 75%, 50% 100%, 0% 75%, 0% 15%)',
                            background: isEarned ? `linear-gradient(135deg, var(--tw-gradient-stops))` : '#94a3b8'
                          }}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${badge.color} ${isEarned ? '' : 'hidden'}`}
                            style={{ clipPath: 'polygon(50% 0%, 100% 15%, 100% 75%, 50% 100%, 0% 75%, 0% 15%)' }} />
                          <div className="absolute inset-1 bg-gradient-to-b from-white/30 to-transparent rounded-t-lg"
                            style={{ clipPath: 'polygon(50% 2%, 98% 16%, 98% 74%, 50% 98%, 2% 74%, 2% 16%)' }} />
                          <div className={`relative z-10 text-white text-center ${isEarned ? '' : 'text-slate-400'}`}>
                            <div className="text-[10px] font-bold tracking-wider drop-shadow-md">{badge.star}</div>
                            <div className="text-[8px] font-black mt-0.5 drop-shadow">{badge.name.toUpperCase()}</div>
                          </div>
                          {isNext && <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold animate-pulse">!</div>}
                        </div>
                        <div className={`text-[10px] mt-1 font-bold ${isEarned ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {badge.min}%+ {isEarned ? '✓' : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress to Next Badge */}
                {(() => {
                  const current = stats.avgScore || 0;
                  const nextBadge = current < 50 ? { name: 'Bronze', min: 50 } :
                    current < 70 ? { name: 'Silver', min: 70 } :
                      current < 85 ? { name: 'Gold', min: 85 } :
                        current < 95 ? { name: 'Diamond', min: 95 } : null;
                  if (!nextBadge) return (
                    <div className="bg-gradient-to-r from-yellow-100 to-amber-100 rounded-2xl p-3 text-center border border-yellow-200">
                      <div className="text-sm font-bold text-yellow-800">🏆 All Badges Earned!</div>
                      <div className="text-xs text-yellow-600">You're a Diamond Champion!</div>
                    </div>
                  );
                  const progress = Math.round((current / nextBadge.min) * 100);
                  return (
                    <div className="bg-slate-100 rounded-2xl p-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">Next: <span className="font-bold">{nextBadge.name}</span></span>
                        <span className="text-purple-600 font-bold">{nextBadge.min - current}% to go</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={() => setShowAccuracyInfo(false)}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-2xl hover:opacity-90 shadow-lg shadow-purple-200"
                >
                  Keep Earning Badges! 🎖️
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Progression Popup - GLOBAL */}
        <AnimatePresence>
          {showLevelProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowLevelProgress(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-black text-gray-900 mb-4 text-center">🎖️ Level Journey</h3>
                <div className="space-y-2">
                  {[
                    { name: 'Starter', stars: '☆', min: 0, color: 'from-slate-400 to-slate-500', desc: 'Beginning your journey' },
                    { name: 'Learner', stars: '★', min: 50, color: 'from-emerald-500 to-teal-500', desc: 'Building foundations' },
                    { name: 'Improver', stars: '★★', min: 70, color: 'from-blue-500 to-cyan-500', desc: 'Making great progress' },
                    { name: 'Pro', stars: '★★★', min: 85, color: 'from-purple-500 to-indigo-500', desc: 'Advanced speaker' },
                    { name: 'Master', stars: '★★★★', min: 95, color: 'from-yellow-500 to-amber-500', desc: 'English champion!' }
                  ].map(level => {
                    const currentLevel = getLevelFromAccuracy(stats.avgScore || 0).name;
                    const isUnlocked = (stats.avgScore || 0) >= level.min;
                    const isCurrent = currentLevel === level.name;
                    return (
                      <div
                        key={level.name}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isCurrent ? `bg-gradient-to-r ${level.color} text-white ring-2 ring-offset-2 ring-emerald-400` :
                          isUnlocked ? 'bg-gray-100' : 'bg-gray-50 opacity-50'
                          }`}
                      >
                        <div className={`text-lg font-bold ${isCurrent ? 'text-yellow-300' : isUnlocked ? 'text-yellow-500' : 'text-gray-400'}`}>{level.stars}</div>
                        <div className="flex-1">
                          <div className={`font-bold ${isCurrent ? 'text-white' : 'text-gray-700'}`}>
                            {level.name} {isCurrent && '← You'}
                          </div>
                          <div className={`text-xs ${isCurrent ? 'text-white/80' : 'text-gray-400'}`}>
                            {level.desc} • {level.min}%+
                          </div>
                        </div>
                        {!isUnlocked && <div className="text-lg">🔒</div>}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowLevelProgress(false)}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl hover:opacity-90"
                >
                  Keep Practicing! 💪
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Points Info Popup - GLOBAL (Detailed) */}
        <AnimatePresence>
          {showPointsInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={() => setShowPointsInfo(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-gradient-to-b from-purple-50 via-white to-purple-50 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-purple-100"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-200 rotate-3">
                    <Award className="text-white" size={28} />
                  </div>
                  <div className="text-4xl font-black text-gray-900 mb-1 tracking-tight">{(stats.points || 0).toLocaleString()}</div>
                  <div className="text-xs uppercase tracking-widest font-bold text-purple-600 mb-4">Total Experience</div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 text-left">
                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      ⚡ How to Earn XP
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Practice Message</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">+5 XP</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Learn from Correction</span>
                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">+2 XP</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div> Win a Battle</span>
                        <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">+50 XP</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-500 italic">
                    "Consistent practice is the key to mastery!" 🗝️
                  </div>
                </div>
                <button
                  onClick={() => setShowPointsInfo(false)}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-200 active:scale-95"
                >
                  Keep Grinding! 🚀
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Study Guide PDF Modal */}
        <AnimatePresence>
          {showStudyGuideModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={() => !isGeneratingPdf && setShowStudyGuideModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-200">
                    <FileText className="text-white" size={28} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900">📄 Download Study Guide</h3>
                  <p className="text-xs text-gray-500 mt-1">Get a PDF of your corrections to practice offline</p>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="text-sm font-bold text-gray-700 mb-2">Select corrections to include:</div>
                  {[
                    { id: 'new', label: 'New since last download', desc: lastPdfDownload ? `Since ${new Date(lastPdfDownload).toLocaleDateString()}` : 'First download' },
                    { id: '7days', label: 'Last 7 days', desc: 'Recent practice' },
                    { id: '30days', label: 'Last 30 days', desc: 'Monthly review' },
                    { id: 'all', label: 'All time', desc: 'Complete history' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setStudyGuideFilter(opt.id)}
                      className={`w-full p-3 rounded-xl text-left transition-all ${studyGuideFilter === opt.id
                        ? 'bg-emerald-50 ring-2 ring-emerald-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${studyGuideFilter === opt.id ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                          }`}>
                          {studyGuideFilter === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className={`font-semibold ${studyGuideFilter === opt.id ? 'text-emerald-700' : 'text-gray-700'}`}>
                          {opt.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 ml-6">{opt.desc}</div>
                    </button>
                  ))}
                </div>

                {lastPdfDownload && (
                  <div className="text-xs text-gray-400 text-center mb-3">
                    Last download: {new Date(lastPdfDownload).toLocaleDateString()}
                  </div>
                )}

                <button
                  onClick={async () => {
                    setIsGeneratingPdf(true);
                    try {
                      const token = await user.getIdToken();
                      const res = await fetch(BACKEND_URL, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          type: 'generate_study_guide',
                          userId: user.uid,
                          dateFilter: studyGuideFilter
                        })
                      });
                      const data = await res.json();

                      if (data.error === 'no_corrections') {
                        alert(data.message || 'No corrections found. Complete more practice sessions first!');
                        setIsGeneratingPdf(false);
                        return;
                      }

                      if (data.error) {
                        alert('Error: ' + data.error);
                        setIsGeneratingPdf(false);
                        return;
                      }

                      if (data.pdf) {
                        // Convert base64 to blob and download
                        const byteCharacters = atob(data.pdf);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'application/pdf' });

                        // Create download link
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `fluency-pro-study-guide-${new Date().toISOString().split('T')[0]}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        // Update last download date locally
                        setLastPdfDownload(new Date().toISOString());
                        setShowStudyGuideModal(false);
                      }
                    } catch (err) {
                      console.error('PDF generation error:', err);
                      alert('Failed to generate PDF. Please try again.');
                    }
                    setIsGeneratingPdf(false);
                  }}
                  disabled={isGeneratingPdf}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Generate & Download PDF
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowPdfHistory(!showPdfHistory)}
                  className="w-full mt-2 py-2 text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center justify-center gap-1"
                >
                  <History size={16} />
                  {showPdfHistory ? 'Hide Past Downloads' : `View Past Downloads${pdfHistory.length > 0 ? ` (${pdfHistory.length})` : ''}`}
                </button>

                {showPdfHistory && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Clock size={16} className="text-emerald-500" />
                      Recent Downloads
                    </h4>
                    {loadingHistory ? (
                      <div className="flex justify-center p-4"><Loader2 className="animate-spin text-emerald-500" /></div>
                    ) : pdfHistory.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-2">No history found.</p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {pdfHistory.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg hover:bg-emerald-50 transition-colors">
                            <div className="text-left">
                              <p className="text-xs font-bold text-gray-700">{new Date(item.generatedAt).toLocaleDateString()}</p>
                              <p className="text-[10px] text-gray-500">{item.filterLabel} • {item.pages} pgs</p>
                            </div>
                            <button
                              disabled={downloadingPdfId === item.id}
                              onClick={async () => {
                                setDownloadingPdfId(item.id);
                                try {
                                  const token = await user.getIdToken();
                                  const res = await fetch(`${BACKEND_URL}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ type: 'get_pdf_by_id', userId: user.uid, pdfId: item.id })
                                  });
                                  const data = await res.json();
                                  if (data.pdf) {
                                    const byteCharacters = atob(data.pdf);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `fluency-pro-history-${item.id.slice(0, 5)}.pdf`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }
                                } catch (e) { console.error(e); alert('Download failed'); }
                                setDownloadingPdfId(null);
                              }}
                              className="p-1.5 bg-white text-emerald-600 rounded-md shadow-sm border border-emerald-100 hover:bg-emerald-50 transition-colors"
                            >
                              {downloadingPdfId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowStudyGuideModal(false)}
                  disabled={isGeneratingPdf}
                  className="w-full mt-2 py-2 text-gray-500 hover:text-gray-700 font-medium text-sm"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </>
    );
  };

  // Loading
  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>;

  // LOGIN
  if (view === 'landing') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-teal-200 to-emerald-200 rounded-full opacity-50 blur-3xl"></div>

        {/* Premium Logo */}
        <div className="relative z-10 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <MessageCircle className="text-white" size={26} />
            </div>
            <h1 className="text-4xl font-black">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">Flu</span>
              <span className="text-gray-900">ency</span>
            </h1>
            <span className="px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">PRO</span>
          </div>
        </div>

        {/* Feature-focused tagline */}
        <div className="relative z-10 mb-8">
          <p className="text-gray-600 text-lg font-medium mb-3">Master English Through</p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold flex items-center gap-1">
              <MessageCircle size={14} /> Real Conversations
            </span>
            <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold flex items-center gap-1">
              <Swords size={14} /> Live Competitions
            </span>
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-semibold flex items-center gap-1">
              <Sparkles size={14} /> AI Feedback
            </span>
          </div>
        </div>

        {/* Social Proof */}
        <div className="relative z-10 mb-8 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
          <div className="flex -space-x-2">
            {['🦁', '🐯', '🦊', '🐼'].map((emoji, i) => (
              <div key={i} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg shadow-sm border-2 border-white">{emoji}</div>
            ))}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-emerald-700 font-bold text-sm">4,200+ learners</span>
            </div>
            <span className="text-gray-500 text-xs">practicing right now</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 space-y-3">
          <button
            onClick={() => { setLoadingAction('google'); handleLogin('google'); }}
            disabled={loadingAction === 'google'}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-emerald-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {loadingAction === 'google' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-4 text-gray-400 text-sm">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span>or try it first</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <button
            onClick={() => { setLoadingAction('guest'); handleLogin('guest'); }}
            disabled={loadingAction === 'guest'}
            className="w-full py-4 border-2 border-gray-200 rounded-2xl font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loadingAction === 'guest' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <User size={18} />
                Continue as Guest
              </>
            )}
          </button>
        </div>

        <p className="relative z-10 mt-8 text-xs text-gray-400">By continuing you agree to Terms & Privacy Policy.</p>
      </div>
    </div>
  );

  // DASHBOARD
  if (view === 'dashboard' && user) return (
    <div className="min-h-screen bg-gray-100 font-sans md:py-8">
      <div className="max-w-2xl mx-auto bg-white shadow-xl md:rounded-3xl relative">
        {/* HEADER - BROADER with safe area padding for mobile status bar */}
        <header className="px-5 pt-4 pb-5 flex justify-between items-center border-b border-gray-100 bg-white sticky top-0 z-20 safe-area-top shadow-sm">
          <button onClick={() => setShowMenu(true)} className="w-12 h-12 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-2xl transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <MessageCircle className="text-white" size={20} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">Flu</span>
              <span className="text-gray-900">ency</span>
            </h1>
            <span className="px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-full shadow-md shadow-orange-200">PRO</span>
          </div>
          <button onClick={() => setShowProfile(true)} className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center text-2xl ring-2 ring-white shadow-lg hover:ring-emerald-200 transition-all">
            {userAvatar}
          </button>
        </header>

        <main className="p-4 space-y-4">
          {/* Quick Stats Bar - BROADER with vertical layout */}
          <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              {/* Streak */}
              <button onClick={() => { console.log('[DEBUG] Streak clicked - opening showStreakProgress'); setShowStreakProgress(true); }} className="flex-1 flex flex-col items-center gap-2 py-2 hover:bg-white rounded-2xl transition-colors">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center shadow-inner">
                  <Zap className="text-orange-500 fill-orange-500" size={24} />
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-gray-900">
                    {(() => {
                      if (!stats.lastPracticeDate) return 0;
                      const todayStr = getLocalDateStr();
                      const lastDate = stats.lastPracticeDate;
                      if (lastDate === todayStr) return stats.streak;
                      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                      const yesterdayStr = getLocalDateStr(yesterday);
                      if (lastDate === yesterdayStr) return stats.streak;
                      return 0;
                    })()} days
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Streak</div>
                </div>
              </button>

              <div className="w-px h-16 bg-gray-200"></div>

              {/* Points */}
              <button onClick={() => { console.log('[DEBUG] Points clicked'); setShowPointsInfo(true); }} className="flex-1 flex flex-col items-center gap-2 py-2 hover:bg-white rounded-2xl transition-colors">
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center shadow-inner">
                  <Award className="text-purple-500" size={24} />
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-gray-900">{stats.points || 0}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Points</div>
                </div>
              </button>

              <div className="w-px h-16 bg-gray-200"></div>

              {/* Accuracy */}
              <button onClick={() => { console.log('[DEBUG] Accuracy clicked - opening showAccuracyInfo'); setShowAccuracyInfo(true); }} className="flex-1 flex flex-col items-center gap-2 py-2 hover:bg-white rounded-2xl transition-colors">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shadow-inner">
                  <Target className="text-emerald-500" size={24} />
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-emerald-600">{stats.avgScore || 0}%</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Accuracy</div>
                </div>
              </button>
            </div>
          </div>

          {/* MAIN ACTION - Free Practice */}
          <button
            onClick={() => { triggerWarmup(); setLoadingAction('practice'); setTimeout(() => { setView('simlab'); setLoadingAction(null); }, 300); }}
            disabled={loadingAction === 'practice'}
            className="w-full py-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-3xl shadow-xl shadow-emerald-200 text-white group relative overflow-hidden hover:shadow-2xl hover:shadow-emerald-300 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <div className="relative flex items-center justify-center gap-4">
              {loadingAction === 'practice' ? (
                <Loader2 className="animate-spin" size={32} />
              ) : (
                <>
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <Play className="fill-white" size={28} />
                  </div>
                  <div className="text-left">
                    <div className="text-2xl font-black">Start Practicing</div>
                    <div className="text-emerald-100 text-sm">Master real-life conversations</div>
                  </div>
                </>
              )}
            </div>
          </button>

          {/* SECONDARY ACTIONS */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { triggerWarmup(); setLoadingAction('compete'); startRandomMatch(); }}
              disabled={isSearching || loadingAction === 'compete'}
              className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white text-left hover:from-black hover:to-gray-900 transition-all relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              {(isSearching || loadingAction === 'compete') ? (
                <Loader2 className="animate-spin absolute right-4 top-4 text-yellow-400" size={20} />
              ) : (
                <Swords className="absolute right-3 top-3 opacity-20" size={36} />
              )}
              <Trophy className="text-yellow-400 mb-2" size={24} />
              <div className="font-bold text-lg">Battle Mode</div>
              <div className="text-gray-400 text-xs">Challenge global players</div>
            </button>
            <button
              onClick={() => { triggerWarmup(); setLoadingAction('friend'); setShowRoomInput(true); setTimeout(() => setLoadingAction(null), 300); }}
              disabled={loadingAction === 'friend'}
              className="p-5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white text-left hover:from-indigo-700 hover:to-violet-700 transition-all relative overflow-hidden group transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              {loadingAction === 'friend' ? (
                <Loader2 className="animate-spin absolute right-4 top-4" size={20} />
              ) : (
                <Users className="absolute right-3 top-3 opacity-20" size={36} />
              )}
              <Hash className="text-indigo-200 mb-2" size={24} />
              <div className="font-bold text-lg">With Friends</div>
              <div className="text-indigo-200 text-xs">Create private room</div>
            </button>
          </div>

          {/* User Info Card */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
              {userAvatar}
            </div>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{user.isAnonymous ? 'Guest Player' : user.displayName || 'Player'}</div>
              {/* Level badge - computed from avgScore, smaller and stylish - CLICKABLE */}
              {(() => {
                const levelData = getLevelFromAccuracy(stats.avgScore || 0);
                return (
                  <span
                    onClick={() => setShowLevelProgress(true)}
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-gradient-to-r ${levelData.gradient} cursor-pointer hover:opacity-90 hover:scale-105 transition-all`}
                  >
                    {levelData.icon} {levelData.name}
                  </span>
                );
              })()}
            </div>
            <button onClick={() => setShowProgressReport(true)} className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1">
              <FileText size={12} /> Progress Report
            </button>
          </div>

          {/* Pending Friend Invites */}
          {pendingInvites.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-xl animate-bounce">
                🎮
              </div>
              <div className="flex-1">
                <div className="font-bold text-indigo-900 text-sm">{pendingInvites[0].name} wants to practice!</div>
                <div className="text-xs text-indigo-600">Waiting for you to join...</div>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                Join Now
              </button>
            </motion.div>
          )}

          {/* Live Users / Recent Sessions Section */}
          <div>
            {/* Tab Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setActiveUsersTab('live')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeUsersTab === 'live'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                🟢 Live Users ({liveUsers.length})
              </button>
              <button
                onClick={() => setActiveUsersTab('recent')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeUsersTab === 'recent'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                Recent ({recentChats.length})
              </button>
            </div>

            {/* Cards Container */}
            {activeUsersTab === 'live' ? (
              // LIVE USERS TAB
              liveUsers.length === 0 ? (
                <div className="bg-gradient-to-br from-gray-50 to-emerald-50/30 rounded-2xl p-6 text-center">
                  <div className="text-3xl mb-2">🌐</div>
                  <div className="font-semibold text-gray-600">No one online right now</div>
                  <div className="text-xs text-gray-400 mt-1">Check back soon to find practice partners!</div>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                  {liveUsers.map(liveUser => (
                    <motion.button
                      key={liveUser.id}
                      whileHover={{ y: -4, scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => requestBattle(liveUser)}
                      className="flex-shrink-0 w-20 bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all group relative"
                    >
                      {/* Status Indicator - Green=Live, Yellow=Busy */}
                      <div className="absolute top-2 right-2">
                        {liveUser.status === 'busy' ? (
                          // Busy - Yellow static dot
                          <span className="relative flex h-2.5 w-2.5" title="In battle/chat">
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                          </span>
                        ) : (
                          // Live - Green pulsing dot
                          <span className="relative flex h-2.5 w-2.5" title="Available">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="text-2xl mb-1">{liveUser.avatar || '👤'}</div>

                      {/* Name */}
                      <div className="font-bold text-gray-800 text-xs truncate">{liveUser.name}</div>

                      {/* Level + Status */}
                      <div className="text-[9px] font-semibold uppercase" style={{ color: liveUser.status === 'busy' ? '#d97706' : '#059669' }}>
                        {liveUser.status === 'busy' ? '🟡 Busy' : liveUser.level}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )
            ) : (
              // RECENT SESSIONS TAB
              recentChats.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <div className="text-3xl mb-2">📝</div>
                  <div className="font-semibold text-gray-600">No sessions yet</div>
                  <div className="text-xs text-gray-400 mt-1">Start a simulation to see your history here</div>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                  {recentChats.map(chat => {
                    const sim = SIMULATIONS.find(s => s.id === chat.simId);
                    const isBattle = chat.type === 'battle';
                    const isLive = liveUsers.some(u => u.name === chat.title);

                    return (
                      <motion.button
                        key={chat.id}
                        whileHover={{ y: -4, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          triggerWarmup();
                          if (isLive) {
                            const liveUser = liveUsers.find(u => u.name === chat.title);
                            if (liveUser) requestBattle(liveUser);
                          } else if (chat.type === 'simulation' && chat.simId) {
                            const s = SIMULATIONS.find(simul => simul.id === chat.simId);
                            if (s) startSimulation(s);
                          } else if (chat.type === 'battle') {
                            console.log('[RECENT CLICK] Clicked:', chat.title);
                            // Check if known bot
                            const botId = KNOWN_BOTS[chat.title] || (chat.opponentId && chat.opponentId.startsWith('bot_') ? chat.opponentId : null);
                            console.log('[RECENT CLICK] Detected botId:', botId);

                            if (botId) {
                              startBotMatch(botId, chat.title);
                            } else {
                              // Human: check if online
                              const liveUser = liveUsers.find(u => u.name === chat.title);
                              if (liveUser) {
                                requestBattle(liveUser);
                              } else {
                                // Offline
                                setOfflineUserTarget(chat);
                              }
                            }
                          }
                        }}
                        className="flex-shrink-0 w-20 bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all group relative"
                      >
                        {/* Live Indicator (if online) */}
                        {isLive && (
                          <div className="absolute top-2 right-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                          </div>
                        )}

                        {/* Win/Loss Badge */}
                        {isBattle && chat.won !== undefined && (
                          <div className="absolute top-1 left-1">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${chat.won ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                              {chat.won ? 'W' : 'L'}
                            </span>
                          </div>
                        )}

                        {/* Avatar - Battle shows bot/player avatar with fallback, Simulation shows sim icon */}
                        <div className="text-2xl mb-1">
                          {isBattle ? (chat.opponentAvatar || BOT_AVATARS[chat.title] || '👤') : (sim ? React.createElement(sim.icon, { size: 24, className: 'mx-auto text-gray-600' }) : '📝')}
                        </div>

                        {/* Name */}
                        <div className="font-bold text-gray-800 text-xs truncate">{chat.title}</div>

                        {/* Score */}
                        <div className={`text-[9px] font-semibold ${chat.accuracy >= 80 ? 'text-emerald-600' : chat.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                          {chat.accuracy}%
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )
            )}
          </div>

        </main>

        {/* MENU DRAWER */}
        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMenu(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl overflow-y-auto flex flex-col"
              >
                <div className="p-6 flex flex-col flex-1 min-h-0 safe-area-top">
                  {/* Menu Header */}
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
                        <MessageCircle className="text-white" size={18} />
                      </div>
                      <h1 className="text-xl font-black">
                        <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">Flu</span>
                        <span className="text-gray-900">ency</span>
                      </h1>
                      <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold rounded-full">PRO</span>
                    </div>
                    <button onClick={() => setShowMenu(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {/* User Profile */}
                  <button onClick={() => { setShowMenu(false); setShowProfile(true); }} className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-6 hover:bg-gray-100 transition-colors">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">{userAvatar}</div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">{user.isAnonymous ? 'Guest' : user.displayName?.split(' ')[0]}</div>
                      {/* Level badge - computed from avgScore */}
                      {(() => {
                        const levelData = getLevelFromAccuracy(stats.avgScore || 0);
                        return (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-gradient-to-r ${levelData.gradient}`}>
                            {levelData.icon} {levelData.name}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-gray-400">›</div>
                  </button>

                  {/* Quick Practice Section - Show first 3 simulations */}
                  <div className="mb-4">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 px-2">Quick Practice</div>
                    <div className="space-y-1">
                      {/* Show first 3 simulations for quick access */}
                      {SIMULATIONS.slice(0, 3).map(sim => (
                        <button
                          key={sim.id}
                          onClick={() => { setShowMenu(false); startSimulation(sim); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors group"
                        >
                          <div className={`w-8 h-8 ${sim.color} rounded-lg flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                            <sim.icon size={16} />
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-gray-700 text-sm">{sim.title}</div>
                            <div className="text-[10px] text-gray-400">{sim.desc}</div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => { setShowMenu(false); setView('simlab'); }}
                        className="w-full text-center text-xs text-emerald-600 font-semibold py-2 hover:text-emerald-700"
                      >
                        View All Simulations →
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 mb-4"></div>

                  {/* Menu Items - Removed Profile & Avatar (redundant with header profile) */}
                  <nav className="space-y-1">
                    <button onClick={() => { setShowMenu(false); setShowAchievements(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <Award size={20} />
                      <span className="font-medium">Achievements</span>
                    </button>

                    <button onClick={() => { setShowMenu(false); setShowSettings(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <Settings size={20} />
                      <span className="font-medium">Settings</span>
                    </button>
                    <button onClick={() => { setShowMenu(false); setShowHelp(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <HelpCircle size={20} />
                      <span className="font-medium">Help & Support</span>
                    </button>
                  </nav>


                  {/* Divider */}
                  <div className="my-6 border-t border-gray-100"></div>

                  {/* Sign Out */}
                  <button onClick={() => { setShowMenu(false); signOut(auth); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={20} />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* MODALS */}

        {/* Session End Transition Overlay */}
        <AnimatePresence>
          {sessionEndTransition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white rounded-3xl p-8 text-center max-w-sm shadow-2xl"
              >
                <div className="text-6xl mb-4">
                  {sessionEndTransition === 'time_over' ? '⏰' : '🚪'}
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">
                  {sessionEndTransition === 'time_over' ? "Time's Up!" : 'Opponent Left'}
                </h2>
                <p className="text-gray-600 mb-4">
                  {sessionEndTransition === 'time_over'
                    ? 'The battle session has ended. Calculating results...'
                    : 'Your opponent has left the chat. Calculating results...'}
                </p>
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent"></div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showWinnerReveal && (
            <WinnerReveal
              dualAnalysis={dualAnalysis}
              myUserId={user.uid}
              opponentData={battleOpponentData}
              soundEnabled={soundEnabled}
              feedbackState={{ rating: feedbackRating, text: feedbackText, submitted: feedbackSubmitted }}
              onFeedback={async (rating, text) => {
                try {
                  await addDoc(collection(db, 'feedback'), {
                    userId: user.uid,
                    rating: rating,
                    text: text,
                    sessionId: feedbackSessionId,
                    opponentId: activeSession?.opponent?.id || null,
                    type: 'battle',
                    timestamp: serverTimestamp()
                  });
                  setFeedbackSubmitted(true);
                } catch (e) { console.error(e); }
              }}
              onSetFeedbackRating={setFeedbackRating}
              onSetFeedbackText={setFeedbackText}
              onDashboard={() => { setShowWinnerReveal(false); setView('dashboard'); }}
              onClose={() => setShowWinnerReveal(false)}
              onShowTips={() => setShowScoringGuide(true)}
            />
          )}
        </AnimatePresence>

        {/* Scoring Tips Guide */}
        <ScoringGuide isOpen={showScoringGuide} onClose={() => setShowScoringGuide(false)} />

        <AnimatePresence>
          {showRoomInput && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onAnimationComplete={() => { if (!roomCode) setRoomCodeInput(''); }}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => { setShowRoomInput(false); setRoomCode(""); setRoomCodeInput(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>
                <h3 className="text-2xl font-black mb-6 text-center">Play with Friend</h3>
                {roomCode ? (
                  <div className="text-center space-y-4">
                    <div className="text-6xl font-mono font-black text-emerald-600 bg-emerald-50 py-6 rounded-2xl">{roomCode}</div>

                    {/* Step-by-step instructions */}
                    <div className="bg-gray-50 rounded-xl p-4 text-left">
                      <div className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">How to Join:</div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                          <span className="bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">1</span>
                          <span>Share this code with your friend</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">2</span>
                          <span>Friend opens <strong>Fluency Pro</strong> app</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">3</span>
                          <span>Clicks <strong>"Play with Friend"</strong></span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="bg-emerald-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">4</span>
                          <span>Enters this code: <strong className="text-emerald-600">{roomCode}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🎮 Let's practice English together!\n\n📱 Open Fluency Pro app\n👆 Click "Play with Friend"\n🔢 Enter code: ${roomCode}\n\n🔗 Download: https://project-fluency-ai-pro-d3189.web.app`)}`)} className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors">
                      <MessageCircle size={20} /> Share on WhatsApp
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button onClick={createPrivateRoom} disabled={isCreatingRoom} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
                      {isCreatingRoom ? <Loader2 className="animate-spin" /> : <Hash />} Create Room
                    </button>
                    <div className="text-center text-gray-400 text-sm">— or join with code —</div>
                    <input
                      placeholder="Enter 4-digit code"
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 5))}
                      className="w-full p-4 text-center text-2xl font-mono bg-gray-50 rounded-2xl border-2 border-gray-200 focus:border-emerald-400 focus:outline-none"
                      maxLength={5}
                    />
                    <button
                      onClick={() => { if (roomCodeInput.length >= 4) joinRoom(roomCodeInput); }}
                      disabled={roomCodeInput.length < 4}
                      className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Users /> Join Room
                    </button>
                  </div>
                )}
              </motion.div >
            </motion.div >
          )}
        </AnimatePresence >

        <AnimatePresence>
          {showProfile && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>
                <h3 className="text-2xl font-black mb-4 text-center">Choose Avatar</h3>
                {/* Swipe indicator */}
                <div className="text-center text-[10px] text-gray-400 mb-3 flex items-center justify-center gap-1">
                  ← Swipe to see more →
                </div>
                {/* Avatar slider - horizontal scroll with large icons */}
                <div className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
                  {AVATARS.map(av => {
                    const unlocked = isAvatarUnlocked(av, stats.avgScore || 0);
                    const requiredAccuracy = AVATAR_TIERS.tier95.includes(av) ? 95 :
                      AVATAR_TIERS.tier85.includes(av) ? 85 :
                        AVATAR_TIERS.tier70.includes(av) ? 70 :
                          AVATAR_TIERS.tier50.includes(av) ? 50 : 0;

                    return (
                      <button
                        key={av}
                        onClick={() => {
                          if (unlocked) {
                            selectAvatar(av);
                          } else {
                            // Bug 5 Fix: Show beautiful modal instead of ugly alert
                            setLockedAvatarModal({ avatar: av, required: requiredAccuracy, current: stats.avgScore || 0 });
                          }
                        }}
                        className={`relative flex-shrink-0 text-4xl p-3 rounded-xl transition-all ${userAvatar === av ? 'bg-emerald-100 ring-2 ring-emerald-500 scale-110' :
                          unlocked ? 'hover:bg-gray-100' : 'opacity-50'
                          }`}
                        style={{ scrollSnapAlign: 'start' }}
                      >
                        {av}
                        {/* Lock overlay for locked avatars */}
                        {!unlocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                            <span className="text-lg">🔒</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Tier legend */}
                <div className="text-[9px] text-gray-400 text-center mb-4">
                  🔓 Free • 50% • 70% • 85% • 95% 🔒
                </div>
                <div className="border-t border-gray-100 pt-6">
                  <button
                    onClick={() => setShowProfile(false)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg"
                  >
                    <Home size={20} />
                    Done ✨
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bug 5 Fix: Beautiful Locked Avatar Modal */}
        <AnimatePresence>
          {lockedAvatarModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setLockedAvatarModal(null)}
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center"
                onClick={e => e.stopPropagation()}
              >
                {/* Locked Avatar Display */}
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="text-6xl grayscale opacity-50">{lockedAvatarModal.avatar}</div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/40 rounded-full p-3">
                      <span className="text-3xl">🔒</span>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-black text-gray-900 mb-2">Keep Practicing!</h3>

                {/* Progress */}
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-2">
                    Unlock at <span className="font-bold text-purple-600">{lockedAvatarModal.required}%</span> accuracy
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (lockedAvatarModal.current / lockedAvatarModal.required) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Your accuracy: {lockedAvatarModal.current}% / {lockedAvatarModal.required}%
                  </div>
                </div>

                {/* Encouragement */}
                <p className="text-sm text-gray-600 mb-4">
                  {lockedAvatarModal.current < lockedAvatarModal.required * 0.5
                    ? "You're making great progress! Keep chatting to boost your accuracy 💪"
                    : lockedAvatarModal.current < lockedAvatarModal.required * 0.8
                      ? "Almost there! A few more practice sessions will unlock this 🌟"
                      : "So close! Just a little more practice to unlock this beauty ✨"}
                </p>

                {/* Dismiss Button */}
                <button
                  onClick={() => setLockedAvatarModal(null)}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-2xl hover:opacity-90 transition-opacity"
                >
                  Got it! 👍
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Report Modal */}
        <AnimatePresence>
          {showProgressReport && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
              onClick={() => setShowProgressReport(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 30, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white rounded-3xl max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-4 rounded-t-3xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={24} />
                    <h2 className="text-xl font-black">Progress Report</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowProgressReport(false); setShowStudyGuideModal(true); }}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold"
                      title="Download Study Guide PDF"
                    >
                      <Download size={16} />
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button onClick={() => setShowProgressReport(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Stats Grid - Clickable items */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Sessions */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-3 text-center">
                      <div className="text-xl font-black text-blue-600">{stats.sessions || 0}</div>
                      <div className="text-[9px] text-blue-500 font-semibold">Sessions</div>
                    </div>
                    {/* Points */}
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-3 text-center">
                      <div className="text-xl font-black text-amber-600">{stats.points || 0}</div>
                      <div className="text-[9px] text-amber-500 font-semibold">Points</div>
                    </div>

                    {/* Accuracy - Clickable */}
                    <button
                      onClick={() => setShowAccuracyInfo(true)}
                      className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-3 text-center hover:ring-2 hover:ring-purple-300 transition-all"
                    >
                      <div className="text-xl font-black text-purple-600">{stats.avgScore || 0}%</div>
                      <div className="text-[9px] text-purple-500 font-semibold">Accuracy 📊</div>
                    </button>
                    {/* Streak - Clickable */}
                    <button
                      onClick={() => setShowStreakProgress(true)}
                      className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-3 text-center hover:ring-2 hover:ring-orange-300 transition-all"
                    >
                      <div className="text-xl font-black text-orange-600">{stats.streak || 0}</div>
                      <div className="text-[9px] text-orange-500 font-semibold">🔥 Streak</div>
                    </button>
                    {/* Level - Shield Badge, shows progression popup */}
                    <button
                      onClick={() => setShowLevelProgress(true)}
                      className="relative flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      <div
                        className={`relative w-14 h-16 flex flex-col items-center justify-center bg-gradient-to-br ${getLevelFromAccuracy(stats.avgScore || 0).gradient}`}
                        style={{
                          clipPath: 'polygon(50% 0%, 100% 15%, 100% 75%, 50% 100%, 0% 75%, 0% 15%)'
                        }}
                      >
                        {/* Inner shine */}
                        <div className="absolute inset-1 bg-gradient-to-b from-white/40 to-transparent"
                          style={{ clipPath: 'polygon(50% 2%, 98% 16%, 98% 74%, 50% 98%, 2% 74%, 2% 16%)' }} />
                        <div className="relative z-10 text-white text-center">
                          <div className="text-[10px] font-bold tracking-wider drop-shadow-md">{getLevelFromAccuracy(stats.avgScore || 0).icon}</div>
                          <div className="text-[7px] font-black mt-0.5 drop-shadow uppercase">{getLevelFromAccuracy(stats.avgScore || 0).name}</div>
                        </div>
                      </div>
                    </button>
                    {/* Battles Won - Using real stats */}
                    <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl p-3 text-center">
                      <div className="text-xl font-black text-rose-600">
                        {stats.battleWins || 0}/{(stats.battleWins || 0) + (stats.battleLosses || 0)}
                      </div>
                      <div className="text-[9px] text-rose-500 font-semibold">Battles ⚔️</div>
                    </div>
                  </div>

                  {/* Progress Graph - Toggle between Accuracy and Time */}
                  {(stats.sessions || 0) >= 2 && sessionHistory.length > 0 ? (
                    <div className="bg-gray-50 rounded-2xl p-4">
                      {/* Toggle Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-emerald-500" />
                          <span className="text-xs font-bold text-gray-700">
                            {progressGraphMode === 'accuracy' ? 'Last 10 Sessions' : 'Last 10 Days'}
                          </span>
                        </div>
                        {/* Toggle Buttons */}
                        <div className="flex bg-white rounded-lg p-0.5 shadow-sm border">
                          <button
                            onClick={() => setProgressGraphMode('accuracy')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${progressGraphMode === 'accuracy'
                              ? 'bg-emerald-500 text-white'
                              : 'text-gray-500 hover:bg-gray-100'
                              }`}
                          >
                            📊 Accuracy
                          </button>
                          <button
                            onClick={() => setProgressGraphMode('time')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${progressGraphMode === 'time'
                              ? 'bg-blue-500 text-white'
                              : 'text-gray-500 hover:bg-gray-100'
                              }`}
                          >
                            ⏱️ Daily Time
                          </button>
                        </div>
                      </div>

                      {/* Graph Bars */}
                      <div className="flex items-end gap-1 h-24">
                        {progressGraphMode === 'accuracy' ? (
                          // Accuracy: Per session (last 10 sessions)
                          sessionHistory.slice(-10).map((s, i) => {
                            const colors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];
                            const color = colors[i % colors.length];
                            const acc = s.accuracy || s.score || 50;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center group relative">
                                <div className="absolute -top-8 bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  {acc}%
                                </div>
                                <div
                                  className="w-full rounded-t transition-all group-hover:opacity-80"
                                  style={{
                                    height: `${Math.min(60, Math.max(8, acc * 0.6))}px`,
                                    backgroundColor: color
                                  }}
                                />
                                <div className="text-[8px] font-bold mt-1" style={{ color }}>{acc}%</div>
                              </div>
                            );
                          })
                        ) : (
                          // Time: Aggregate by day (last 10 days)
                          (() => {
                            const colors = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#10b981'];
                            // Group sessions by day
                            const dailyData = {};
                            const today = new Date();
                            for (let i = 9; i >= 0; i--) {
                              const d = new Date(today);
                              d.setDate(d.getDate() - i);
                              const key = d.toISOString().split('T')[0];
                              dailyData[key] = { date: d, duration: 0, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
                            }
                            // Sum durations per day
                            sessionHistory.forEach(s => {
                              if (s.startTime) {
                                const dateKey = new Date(s.startTime?.seconds ? s.startTime.seconds * 1000 : s.startTime).toISOString().split('T')[0];
                                if (dailyData[dateKey]) {
                                  dailyData[dateKey].duration += s.duration || 0;
                                }
                              }
                            });
                            const days = Object.values(dailyData);
                            const maxTime = Math.max(...days.map(d => d.duration), 1);

                            return days.map((day, i) => {
                              const mins = Math.round(day.duration / 60);
                              const color = colors[i % colors.length];
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center relative">
                                  {/* Permanent label above bar */}
                                  {day.duration > 0 && (
                                    <div className="text-[8px] font-bold text-gray-600 mb-0.5 whitespace-nowrap">
                                      {mins > 0 ? `${mins}m` : `${day.duration}s`}
                                    </div>
                                  )}
                                  <div
                                    className="w-full rounded-t transition-all hover:opacity-80"
                                    style={{
                                      height: `${Math.min(60, Math.max(4, (day.duration / maxTime) * 60))}px`,
                                      backgroundColor: day.duration > 0 ? color : '#e5e7eb'
                                    }}
                                  />
                                  <div className="text-[6px] font-bold mt-1 text-gray-500 truncate w-full text-center">
                                    {day.label.split(' ')[1]}
                                  </div>
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 text-center mt-2">
                        {progressGraphMode === 'accuracy'
                          ? '📈 Your accuracy is improving - keep it up! 💪'
                          : '⏱️ Daily practice builds fluency! Keep chatting! 🗣️'}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-4 text-center">
                      <div className="text-gray-400 text-sm">📈 Complete 2+ sessions to see your progress chart!</div>
                    </div>
                  )}

                  {/* AI Analysis Section - Placeholder */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-indigo-500" />
                      <span className="text-sm font-bold text-indigo-700">AI Analysis</span>
                    </div>
                    {isLoadingReport ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={24} className="animate-spin text-indigo-500" />
                        <span className="ml-2 text-sm text-indigo-500">Analyzing your progress...</span>
                      </div>
                    ) : progressReportData ? (
                      <div className="space-y-3">
                        {/* Weak Points */}
                        {progressReportData.weakPoints?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-rose-600 mb-1">🔴 Areas to Improve</div>
                            {progressReportData.weakPoints.map((wp, i) => (
                              <div key={i} className="text-xs text-gray-600 bg-rose-50 rounded-lg p-2 mb-1">
                                <span className="font-semibold">{wp.category}:</span> {wp.detail}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Strong Points */}
                        {progressReportData.strongPoints?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-emerald-600 mb-1">🟢 Your Strengths</div>
                            {progressReportData.strongPoints.map((sp, i) => (
                              <div key={i} className="text-xs text-gray-600 bg-emerald-50 rounded-lg p-2 mb-1">
                                <span className="font-semibold">{sp.category}:</span> {sp.detail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <button
                          onClick={async () => {
                            if (!user || (stats.sessions || 0) < 3) return;
                            setIsLoadingReport(true);
                            try {
                              const token = await user.getIdToken();
                              // Use stats.sessions which is accurate, fetch corrections from recent sessions
                              const corrections = sessionHistory.flatMap(s => s.corrections || []).slice(-30);
                              const res = await fetch(`${BACKEND_URL}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ type: 'progress_analysis', corrections })
                              });
                              const data = await res.json();
                              setProgressReportData(data);
                            } catch (e) {
                              console.error('Progress analysis error:', e);
                            } finally {
                              setIsLoadingReport(false);
                            }
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full hover:opacity-90 transition-opacity"
                          disabled={(stats.sessions || 0) < 3}
                        >
                          {(stats.sessions || 0) < 3 ? `Need ${3 - (stats.sessions || 0)} more sessions` : 'Analyze My Progress ✨'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Date Range Selector */}
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-3">
                    <span className="text-sm font-semibold text-gray-700">📅 Report Period:</span>
                    <select
                      value={studyGuideFilter}
                      onChange={(e) => setStudyGuideFilter(e.target.value)}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="3days">Last 3 Days</option>
                      <option value="5days">Last 5 Days</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="15days">Last 15 Days</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  {/* Download Learning Pack Button (Combined) */}
                  {isGeneratingPdf ? (
                    <div className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 text-center">
                      {/* Animated Step Display */}
                      <div className="text-lg font-bold text-emerald-700 mb-2 flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={20} />
                        {pdfGenerationStep || 'Preparing...'}
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-emerald-100 rounded-full h-3 mb-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${pdfProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-emerald-600">{pdfProgress}% complete</div>
                    </div>
                  ) : (
                    <button
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-98 shadow-lg shadow-emerald-200"
                      onClick={async () => {
                        if (!user) return;
                        setIsGeneratingPdf(true);
                        setPdfProgress(0);

                        // Animated step sequence for combined PDF - runs in PARALLEL with API call
                        const steps = [
                          { text: '📊 Gathering your stats...', progress: 10, delay: 800 },
                          { text: '🔍 Analyzing corrections...', progress: 20, delay: 1000 },
                          { text: '🧠 AI generating 25 quiz questions...', progress: 35, delay: 1500 },
                          { text: '📚 Creating vocabulary list...', progress: 50, delay: 1200 },
                          { text: '💡 Identifying strengths & weaknesses...', progress: 65, delay: 1200 },
                          { text: '📝 Building 6-page pack...', progress: 80, delay: 1500 },
                          { text: '🎨 Adding finishing touches...', progress: 90, delay: 2000 }
                        ];

                        try {
                          // Track PDF generation
                          trackAnalytics('pdfGenerations');

                          // Start API call IMMEDIATELY (in parallel with animation)
                          const token = await user.getIdToken();
                          const apiPromise = callBackend(BACKEND_URL, 'POST', {
                            type: 'generate_learning_pack',
                            userId: user.uid,
                            dateFilter: studyGuideFilter
                          }, token);

                          // Run animation steps while API is processing
                          let apiFinished = false;
                          apiPromise.then(() => { apiFinished = true; });

                          for (const step of steps) {
                            if (apiFinished) break; // API finished early, stop animation
                            setPdfGenerationStep(step.text);
                            setPdfProgress(step.progress);
                            await new Promise(r => setTimeout(r, step.delay));
                          }

                          // Wait for API to complete
                          const data = await apiPromise;

                          if (data.pdf) {
                            setPdfProgress(100);
                            setPdfGenerationStep('🎉 Your Learning Pack is ready!');

                            // CELEBRATION - Fire confetti BEFORE opening!
                            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                            await new Promise(r => setTimeout(r, 800));

                            // Download the PDF - Native Android or Web Browser
                            const now = new Date();
                            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                            const fileName = `fluency-learning-pack-${timestamp}.pdf`;

                            if (Capacitor.isNativePlatform()) {
                              // NATIVE ANDROID: Save file and open directly (no share dialog)
                              try {
                                // Save to Documents directory
                                const result = await Filesystem.writeFile({
                                  path: fileName,
                                  data: data.pdf, // Already base64
                                  directory: Directory.Documents,
                                });
                                console.log('[PDF_NATIVE] Saved to:', result.uri);
                                setPdfGenerationStep('✅ Saved to Documents! 📖');

                                // Try to open the file directly using the file URI
                                // On Android, we can use window.open with the content URI
                                // Or just show success message - user can find it in Documents
                                try {
                                  // Try opening with Share but configure as "open" action
                                  await Share.share({
                                    title: 'Open Your Learning Pack',
                                    url: result.uri,
                                    dialogTitle: 'Open PDF'
                                  });
                                } catch (openErr) {
                                  // If share fails, that's okay - file is saved
                                  console.log('[PDF_NATIVE] Could not auto-open, but file is saved');
                                }
                              } catch (fsError) {
                                console.error('[PDF_NATIVE] Filesystem error:', fsError);
                                setPdfGenerationStep('⚠️ Could not save PDF. Please try again.');
                              }
                            } else {
                              // WEB BROWSER: Use blob download
                              const byteCharacters = atob(data.pdf);
                              const byteNumbers = new Array(byteCharacters.length);
                              for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                              }
                              const byteArray = new Uint8Array(byteNumbers);
                              const blob = new Blob([byteArray], { type: 'application/pdf' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = fileName;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);

                              setPdfGenerationStep('✅ Downloaded! Open it and practice daily! 📖');
                            }

                            // Update history from server (single source of truth)
                            // Small delay to ensure Firestore has propagated the write
                            console.log('[PDF Generation] Waiting for Firestore to sync...');
                            await new Promise(r => setTimeout(r, 1000));
                            console.log('[PDF Generation] Refreshing history...');
                            await refreshPdfHistory();
                            console.log(`[PDF Generation] History now has ${pdfHistory.length} items`);

                            await new Promise(r => setTimeout(r, 2000)); // Show success message
                          } else if (data.error === 'no_corrections') {
                            setPdfGenerationStep('');
                            alert('Complete a few more sessions to generate your report! Keep practicing! 💪');
                          } else {
                            setPdfGenerationStep('');
                            alert(data.error || 'Could not generate PDF. Try again later!');
                          }
                        } catch (e) {
                          console.error('PDF error:', e);
                          alert('Something went wrong. Please try again!');
                        } finally {
                          setIsGeneratingPdf(false);
                          setPdfGenerationStep('');
                          setPdfProgress(0);
                        }
                      }}
                    >
                      <Download size={20} /> Download Learning Pack 📦
                    </button>
                  )}
                  <div className="text-center text-xs text-gray-500 mt-2">
                    5 pages: Stats + 25 Quiz Questions + Vocab + Answers + Corrections
                  </div>

                  <button
                    onClick={() => setShowPdfHistory(!showPdfHistory)}
                    className="w-full mt-4 py-2 text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center justify-center gap-1 border-t border-gray-100 pt-3"
                  >
                    <History size={16} />
                    {showPdfHistory ? 'Hide Past Downloads' : `View Past Downloads${pdfHistory.length > 0 ? ` (${pdfHistory.length})` : ''}`}
                  </button>

                  {showPdfHistory && (
                    <div className="mt-2 bg-gray-50 rounded-xl p-3">
                      <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                        <Clock size={14} className="text-emerald-500" />
                        Recent Downloads
                      </h4>
                      {loadingHistory ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin text-emerald-500" /></div>
                      ) : pdfHistory.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-2">No history found.</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                          {pdfHistory.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all">
                              <div className="text-left">
                                <p className="text-xs font-bold text-gray-700">
                                  {new Date(item.generatedAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-[10px] text-gray-500">{item.filterLabel} • {item.pages} pgs</p>
                              </div>
                              <button
                                disabled={downloadingPdfId === item.id}
                                onClick={async () => {
                                  setDownloadingPdfId(item.id);
                                  try {
                                    const token = await user.getIdToken();
                                    const res = await fetch(`${BACKEND_URL}`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                      body: JSON.stringify({ type: 'get_pdf_by_id', userId: user.uid, pdfId: item.id })
                                    });
                                    const data = await res.json();
                                    if (data.pdf) {
                                      const byteCharacters = atob(data.pdf);
                                      const byteNumbers = new Array(byteCharacters.length);
                                      for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                      }
                                      const byteArray = new Uint8Array(byteNumbers);
                                      const blob = new Blob([byteArray], { type: 'application/pdf' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      // Use original timestamp for filename (LOCAL time)
                                      const origDate = new Date(item.generatedAt);
                                      const ts = `${origDate.getFullYear()}-${String(origDate.getMonth() + 1).padStart(2, '0')}-${String(origDate.getDate()).padStart(2, '0')}-${String(origDate.getHours()).padStart(2, '0')}-${String(origDate.getMinutes()).padStart(2, '0')}-${String(origDate.getSeconds()).padStart(2, '0')}`;
                                      a.download = `fluency-learning-pack-${ts}.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      URL.revokeObjectURL(url);
                                    }
                                  } catch (e) { console.error(e); alert('Download failed'); }
                                  setDownloadingPdfId(null);
                                }}
                                className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors"
                              >
                                {downloadingPdfId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}


                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Search Modal */}
        <AnimatePresence>
          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center max-w-sm w-full"
              >
                {/* Pulsing Globe Animation */}
                <div className="relative w-32 h-32 mx-auto mb-8">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                  <div className="absolute inset-2 bg-emerald-500/30 rounded-full animate-pulse"></div>
                  <div className="absolute inset-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/50">
                    <span className="text-5xl">🌍</span>
                  </div>
                </div>

                {/* Status Text */}
                <motion.h2
                  key={searchStatusText}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-black text-white mb-2"
                >
                  {searchStatusText}
                </motion.h2>
                <p className="text-gray-400 text-sm mb-8">Searching across 150+ countries</p>

                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden mb-6">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 8, ease: "linear" }}
                  />
                </div>

                {/* Tips */}
                <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-1">
                    <Sparkles size={14} /> Pro Tip
                  </div>
                  <p className="text-gray-300 text-xs">Speak confidently! Your partner is also learning.</p>
                </div>

                {/* Cancel Button */}
                <button
                  onClick={() => {
                    setIsSearching(false);
                    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                    if (randomSearchListener.current) randomSearchListener.current();
                    setLoadingAction(null);
                  }}
                  className="mt-6 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel Search
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SHARED MODALS & OVERLAYS */}
        {renderGlobalModals()}


        <AnimatePresence>
          {showStatInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setShowStatInfo(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.85, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.85, y: 20, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="bg-white rounded-2xl p-6 max-w-xs text-center shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-3xl mb-2">{showStatInfo === 'streak' ? '🔥' : showStatInfo === 'points' ? '⭐' : showStatInfo === 'level' ? '🏆' : '📊'}</div>
                <h3 className="text-xl font-black text-gray-900 mb-2">{STAT_INFO[showStatInfo]?.title}</h3>
                <p className="text-gray-500 text-sm">{STAT_INFO[showStatInfo]?.desc}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session Summary Modal */}
        <AnimatePresence>
          {showSessionSummary && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl w-full max-w-sm text-center my-auto max-h-[90vh] overflow-y-auto shadow-2xl"
              >
                {/* Check if < 3 messages - show "Need More Practice" screen */}
                {showSessionSummary.messagesCount < 3 ? (
                  <>
                    {/* Orange Header - Like Battle Mode */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
                      <div className="text-lg font-bold uppercase tracking-wide">SESSION ENDED</div>
                      <div className="text-sm opacity-90">Not enough messages for analysis</div>
                    </div>

                    <div className="p-6">
                      {/* Speech bubble icon */}
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <MessageCircle size={32} className="text-gray-400" />
                      </div>

                      <h2 className="text-2xl font-black text-gray-900 mb-2">Need More Practice!</h2>
                      <p className="text-gray-500 mb-6">Not enough messages to analyze the result. Play longer next time!</p>

                      {/* Yellow TIP Box - Like Battle Mode */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-1">
                          <Lightbulb size={16} />
                          <span>TIP</span>
                        </div>
                        <p className="text-amber-800 text-sm">
                          Play a bit longer next time to get your scores analyzed! Your accuracy wasn't affected by this session.
                        </p>
                      </div>

                      {/* Back Button */}
                      <button
                        onClick={() => setShowSessionSummary(null)}
                        className="w-full py-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold rounded-2xl hover:from-gray-700 hover:to-gray-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Home size={18} />
                        <span>Back to Home</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* Normal feedback screen for 3+ messages */
                  <div className="p-6">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                      <span className="text-4xl">{showSessionSummary.accuracy >= 80 ? '🌟' : showSessionSummary.accuracy >= 50 ? '👍' : '💪'}</span>
                    </div>

                    <h2 className="text-2xl font-black text-gray-900 mb-2">
                      {showSessionSummary.accuracy >= 80 ? 'Excellent Work!' : showSessionSummary.accuracy >= 50 ? 'Good Progress!' : 'Keep Practicing!'}
                    </h2>
                    <p className="text-gray-500 mb-4">{showSessionSummary.simName}</p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-emerald-50 rounded-2xl p-4">
                        <div className="text-3xl font-black text-emerald-600">+{showSessionSummary.points}</div>
                        <div className="text-xs text-emerald-700 font-semibold">Points Earned</div>
                      </div>
                      <div className={`rounded-2xl p-4 ${showSessionSummary.accuracy >= 80 ? 'bg-emerald-50' : showSessionSummary.accuracy >= 60 ? 'bg-amber-50' : 'bg-red-50'}`}>
                        <div className={`text-3xl font-black ${showSessionSummary.accuracy >= 80 ? 'text-emerald-600' : showSessionSummary.accuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{showSessionSummary.accuracy}%</div>
                        <div className={`text-xs font-semibold ${showSessionSummary.accuracy >= 80 ? 'text-emerald-700' : showSessionSummary.accuracy >= 60 ? 'text-amber-700' : 'text-red-700'}`}>Accuracy</div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4 text-sm text-gray-500 mb-4">
                      <span>{showSessionSummary.messagesCount} messages</span>
                      <span>•</span>
                      <span>{showSessionSummary.correctionsCount} corrections</span>
                    </div>


                    {/* AI Feedback Section - Modern with thin orange border */}
                    <div className="bg-white border border-orange-300 rounded-2xl p-5 mb-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🎓</span>
                        <span className="font-bold uppercase tracking-wide text-orange-600">Your Feedback</span>
                      </div>

                      {/* Scrollable content - LARGER */}
                      <div className="max-h-48 overflow-y-auto pr-2 text-base leading-relaxed text-gray-800">
                        {isLoadingFeedback ? (
                          <span className="animate-pulse text-orange-500">Analyzing your session...</span>
                        ) : (
                          // Parse markdown: **text** → bold, color-code keywords
                          (aiFeedback || "Great effort! Keep practicing to improve.").split(/(\*\*[^*]+\*\*)/).map((part, idx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              const text = part.slice(2, -2);
                              // Color-code specific keywords
                              if (text.toLowerCase().includes('needs work') || text.toLowerCase().includes('error') || text.toLowerCase().includes('mistake')) {
                                return <span key={idx} className="font-bold text-red-600">{text}</span>;
                              } else if (text.toLowerCase().includes('good') || text.toLowerCase().includes('strength') || text.toLowerCase().includes('okay')) {
                                return <span key={idx} className="font-bold text-emerald-600">{text}</span>;
                              } else {
                                return <span key={idx} className="font-bold text-orange-700">{text}</span>;
                              }
                            }
                            return part;
                          })
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-3 text-center">↓ scroll if more content</div>
                    </div>

                    {/* Scoring Tips Link - Sleek, subtle design */}
                    <button
                      onClick={() => setShowScoringGuide(true)}
                      className="w-full mb-4 py-2 px-4 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-indigo-100 hover:border-indigo-300 transition-all"
                    >
                      <span>💡</span>
                      <span>Want to score better? See tips →</span>
                    </button>

                    {/* Mistakes - Blinking Button */}
                    {showSessionSummary.corrections && showSessionSummary.corrections.length > 0 ? (
                      <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-300 rounded-2xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📝</span>
                            <span className="text-sm font-bold text-amber-800">Found {showSessionSummary.corrections.length} area{showSessionSummary.corrections.length > 1 ? 's' : ''} to improve</span>
                          </div>
                          <button
                            onClick={() => setShowMistakesPopup(true)}
                            className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-full shadow-md hover:bg-amber-600 transition-all animate-pulse"
                          >
                            View All →
                          </button>
                        </div>
                      </div>
                    ) : showSessionSummary.messagesCount === 0 ? (
                      <div className="bg-gradient-to-r from-gray-100 to-slate-100 border-2 border-gray-300 rounded-2xl p-4 mb-4 text-center">
                        <div className="text-2xl mb-1">💬</div>
                        <div className="text-gray-700 font-bold">No Messages to Analyze</div>
                        <div className="text-sm text-gray-600">Send messages to see your mistakes and areas to improve.</div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-emerald-100 to-green-100 border-2 border-emerald-300 rounded-2xl p-4 mb-4 text-center">
                        <div className="text-2xl mb-1">🎉</div>
                        <div className="text-emerald-700 font-bold">Perfect Session!</div>
                        <div className="text-sm text-emerald-600">No corrections needed - excellent work!</div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowSessionSummary(null)}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-sm"
                    >
                      Continue Practicing 🚀
                    </button>
                  </div>
                )}
              </motion.div>

              {/* Full-Screen Mistakes Popup */}
              <AnimatePresence>
                {showMistakesPopup && showSessionSummary?.corrections && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setShowMistakesPopup(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📝</span>
                            <span className="font-bold text-lg">Your Mistakes</span>
                          </div>
                          <button
                            onClick={() => setShowMistakesPopup(false)}
                            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-sm text-amber-100 mt-1">{showSessionSummary.corrections.length} corrections from this session</div>
                      </div>

                      <div className="p-4 overflow-y-auto max-h-[60vh]">
                        <div className="space-y-3">
                          {showSessionSummary.corrections.map((c, i) => (
                            <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${c?.type === 'spelling' ? 'bg-purple-100 text-purple-700' :
                                  c?.type === 'grammar' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                  {c?.type || 'grammar'}
                                </span>
                              </div>
                              <div className="text-base mb-2">
                                <span className="text-red-500 line-through font-medium">{c?.original}</span>
                                <span className="text-gray-400 mx-3">→</span>
                                <span className="text-emerald-600 font-bold">{c?.corrected}</span>
                              </div>
                              <div className="text-sm text-gray-600 bg-white rounded-lg p-2 border border-gray-100">{c?.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Achievements Modal */}
        <AnimatePresence>
          {showAchievements && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowAchievements(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>

                <h3 className="text-2xl font-black text-gray-900 mb-2 text-center">🏆 Achievements</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  {(() => {
                    const achievements = [
                      stats.sessions >= 1, stats.streak >= 3, stats.streak >= 7, stats.streak >= 14, stats.streak >= 30,
                      stats.sessions >= 10, stats.sessions >= 50, stats.points >= 100, stats.points >= 1000,
                      stats.avgScore >= 90, stats.avgScore >= 95, (stats.battleWins || 0) >= 1, (stats.battleWins || 0) >= 5
                    ];
                    const unlocked = achievements.filter(a => a).length;
                    return `${unlocked} of ${achievements.length} unlocked`;
                  })()}
                </p>

                {/* Streak Achievements */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    🔥 Streaks
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Streak Starter', desc: '3-day practice streak', icon: '🔥', unlocked: stats.streak >= 3 },
                      { name: 'Week Warrior', desc: '7-day practice streak', icon: '⚡', unlocked: stats.streak >= 7 },
                      { name: 'Habit Builder', desc: '14-day practice streak', icon: '💪', unlocked: stats.streak >= 14 },
                      { name: 'Legend', desc: '30-day practice streak', icon: '👑', unlocked: stats.streak >= 30 },
                    ].map(a => (
                      <div key={a.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${a.unlocked ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                        <span className="text-xl">{a.unlocked ? a.icon : '🔒'}</span>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${a.unlocked ? 'text-emerald-700' : 'text-gray-500'}`}>{a.name}</div>
                          <div className="text-xs text-gray-400">{a.desc}</div>
                        </div>
                        {a.unlocked && <span className="text-emerald-500">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session Achievements */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    📚 Sessions
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'First Steps', desc: 'Complete your first session', icon: '🌟', unlocked: stats.sessions >= 1 },
                      { name: 'On Fire', desc: 'Complete 10 sessions', icon: '🎯', unlocked: stats.sessions >= 10 },
                      { name: 'Dedicated', desc: 'Complete 50 sessions', icon: '📚', unlocked: stats.sessions >= 50 },
                    ].map(a => (
                      <div key={a.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${a.unlocked ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                        <span className="text-xl">{a.unlocked ? a.icon : '🔒'}</span>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${a.unlocked ? 'text-emerald-700' : 'text-gray-500'}`}>{a.name}</div>
                          <div className="text-xs text-gray-400">{a.desc}</div>
                        </div>
                        {a.unlocked && <span className="text-emerald-500">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Points Achievements */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    💰 Points
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Century Club', desc: 'Earn 100 points', icon: '💯', unlocked: stats.points >= 100 },
                      { name: 'High Scorer', desc: 'Earn 1,000 points', icon: '🏆', unlocked: stats.points >= 1000 },
                    ].map(a => (
                      <div key={a.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${a.unlocked ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                        <span className="text-xl">{a.unlocked ? a.icon : '🔒'}</span>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${a.unlocked ? 'text-emerald-700' : 'text-gray-500'}`}>{a.name}</div>
                          <div className="text-xs text-gray-400">{a.desc}</div>
                        </div>
                        {a.unlocked && <span className="text-emerald-500">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accuracy Achievements */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    ⭐ Accuracy
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Grammar Guru', desc: 'Maintain 90%+ accuracy', icon: '📝', unlocked: stats.avgScore >= 90 },
                      { name: 'Master Level', desc: 'Reach 95%+ accuracy', icon: '⭐', unlocked: stats.avgScore >= 95 },
                    ].map(a => (
                      <div key={a.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${a.unlocked ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                        <span className="text-xl">{a.unlocked ? a.icon : '🔒'}</span>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${a.unlocked ? 'text-emerald-700' : 'text-gray-500'}`}>{a.name}</div>
                          <div className="text-xs text-gray-400">{a.desc}</div>
                        </div>
                        {a.unlocked && <span className="text-emerald-500">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Battle Achievements */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    ⚔️ Battles
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Battle Ready', desc: 'Win your first battle', icon: '⚔️', unlocked: (stats.battleWins || 0) >= 1 },
                      { name: 'Battle Champion', desc: 'Win 5 battles', icon: '🥇', unlocked: (stats.battleWins || 0) >= 5 },
                    ].map(a => (
                      <div key={a.name} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${a.unlocked ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100 opacity-60'}`}>
                        <span className="text-xl">{a.unlocked ? a.icon : '🔒'}</span>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${a.unlocked ? 'text-emerald-700' : 'text-gray-500'}`}>{a.name}</div>
                          <div className="text-xs text-gray-400">{a.desc}</div>
                        </div>
                        {a.unlocked && <span className="text-emerald-500">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => setShowAchievements(false)} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl hover:opacity-90 transition-opacity">
                  Keep Practicing! 💪
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        <AnimatePresence>
          {showHelp && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => { setShowHelp(false); setHelpFeedbackSubmitted(false); setHelpFeedbackText(''); setHelpFeedbackRating(0); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>

                {/* App Header */}
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
                    <MessageCircle className="text-white" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">Fluency Pro</h3>
                  <p className="text-gray-500 text-sm">Version 1.2.0</p>
                </div>

                {/* About the App */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 mb-4 text-left">
                  <h4 className="font-bold text-emerald-800 mb-2">🇮🇳 Made in India with ❤️</h4>
                  <p className="text-emerald-700 text-sm leading-relaxed mb-3">
                    Fluency Pro is an AI-powered English learning app designed to help millions practice spoken English through immersive simulations and real-time feedback.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <span className="bg-emerald-200 px-2 py-0.5 rounded-full">🚀 Built by Deepak</span>
                  </div>
                </div>

                {/* Contact & Support */}
                <div className="bg-indigo-50 rounded-2xl p-4 mb-4 text-left">
                  <h4 className="font-bold text-indigo-800 mb-2 text-xs uppercase tracking-widest">💬 Need Help?</h4>
                  <p className="text-sm text-indigo-700">
                    Use the <strong>Feedback form</strong> below to share your thoughts, report bugs, or ask questions. We read every message!
                  </p>
                  <p className="text-indigo-500 text-xs mt-2 italic">Your feedback helps us improve Fluency Pro ✨</p>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-4">
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-widest text-gray-400">✨ Features</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Sparkles size={16} className="text-amber-500" /> Real-time grammar feedback
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Users size={16} className="text-indigo-500" /> Battle mode with global players
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Target size={16} className="text-emerald-500" /> Scenario-based simulations
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Award size={16} className="text-pink-500" /> Achievements & progress tracking
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-left">
                  <h4 className="font-bold text-gray-800 mb-2 text-xs uppercase tracking-widest">📜 Terms & Conditions</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• This app is for educational purposes only</li>
                    <li>• AI responses are generated and may not be perfect</li>
                    <li>• Your chat data helps improve the AI experience</li>
                    <li>• Be respectful when chatting with other users</li>
                    <li>• We don't share your personal data with third parties</li>
                    <li>• You must be 13+ years old to use this app</li>
                  </ul>
                </div>

                {/* Privacy */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-left">
                  <h4 className="font-bold text-gray-800 mb-2 text-xs uppercase tracking-widest">🔒 Privacy</h4>
                  <p className="text-xs text-gray-600">
                    Your data is stored securely on Google Firebase. We collect only what's needed to improve your experience.
                    You can request data deletion by contacting support.
                  </p>
                </div>

                {/* Feedback Form */}
                <div className="border-t pt-6 text-left">
                  <h4 className="font-bold text-gray-900 mb-3 uppercase text-xs tracking-widest text-gray-400">💬 Share Your Experience</h4>
                  {helpFeedbackSubmitted ? (
                    <div className="bg-emerald-50 text-emerald-700 rounded-2xl p-4 text-center font-bold">
                      <div className="text-2xl mb-2">🎉</div>
                      Thank you! Deepak has received your feedback!
                    </div>
                  ) : (
                    <>
                      {/* Rating */}
                      <div className="flex justify-center gap-3 mb-5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => { console.log('Star clicked:', star); setHelpFeedbackRating(star); }}
                            className={`p-1 transition-all rounded-full hover:bg-gray-50 ${helpFeedbackRating >= star ? 'scale-125' : 'grayscale opacity-30 shadow-none'}`}
                          >
                            <span className="text-3xl">⭐</span>
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={helpFeedbackText}
                        onChange={(e) => setHelpFeedbackText(e.target.value)}
                        placeholder="What can we improve? Found a bug? Share your thoughts!"
                        className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:border-emerald-400 focus:outline-none text-sm resize-none h-28 mb-4 border-gray-100"
                      />
                      <button
                        onClick={async () => {
                          if (helpFeedbackRating > 0) {
                            try {
                              console.log('Submitting general feedback:', helpFeedbackRating, helpFeedbackText);
                              await addDoc(collection(db, 'feedback'), {
                                userId: user.uid,
                                rating: helpFeedbackRating,
                                text: helpFeedbackText,
                                sessionId: feedbackSessionId,
                                source: 'help_modal',
                                timestamp: serverTimestamp()
                              });
                              setHelpFeedbackSubmitted(true);
                            } catch (e) { alert('Failed to send! Check connection.'); }
                          } else {
                            alert('Please select a star rating first!');
                          }
                        }}
                        className={`w-full py-4 rounded-xl font-black transition-all shadow-lg ${helpFeedbackRating > 0 ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                      >
                        SUBMIT FEEDBACK
                      </button>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t text-center">
                  <p className="text-xs text-gray-400">© 2024 Fluency Pro by Deepak</p>
                  <p className="text-xs text-gray-400">Made with ❤️ in India 🇮🇳</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto safe-area-top">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-white rounded-3xl w-full max-w-md relative my-auto max-h-[85vh] overflow-hidden flex flex-col"
              >
                {/* Sticky Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                  <h3 className="text-xl font-black text-gray-900">⚙️ Settings</h3>
                  <button onClick={() => setShowSettings(false)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-4 overflow-y-auto flex-1 space-y-3">

                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">Dark Theme</div>
                      <div className="text-xs text-gray-500">Switch to dark mode</div>
                    </div>
                    <button
                      onClick={() => setIsDarkTheme(!isDarkTheme)}
                      className={`w-14 h-8 rounded-full transition-colors relative ${isDarkTheme ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${isDarkTheme ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Mother Tongue */}
                  <div className="p-4 bg-gray-50 rounded-xl mb-3">
                    <div className="font-semibold text-gray-900 mb-2">Mother Tongue</div>
                    <select
                      value={motherTongue}
                      onChange={(e) => setMotherTongue(e.target.value)}
                      className="w-full p-3 bg-white rounded-xl border border-gray-200 focus:border-emerald-400 focus:outline-none"
                    >
                      <option value="Hindi">हिंदी (Hindi)</option>
                      <option value="Punjabi">ਪੰਜਾਬੀ (Punjabi)</option>
                      <option value="Tamil">தமிழ் (Tamil)</option>
                      <option value="Telugu">తెలుగు (Telugu)</option>
                      <option value="Bengali">বাংলা (Bengali)</option>
                      <option value="Marathi">मराठी (Marathi)</option>
                      <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                      <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                      <option value="Malayalam">മലയാളം (Malayalam)</option>
                      <option value="Odia">ଓଡ଼ିଆ (Odia)</option>
                      <option value="Assamese">অসমীয়া (Assamese)</option>
                    </select>
                  </div>

                  {/* Session Timer */}
                  <div className="p-4 bg-gray-50 rounded-xl mb-3">
                    <div className="font-semibold text-gray-900 mb-2">Session Timer</div>
                    <div className="flex gap-2">
                      {[3, 5, 7, 0].map(mins => (
                        <button
                          key={mins}
                          onClick={() => setSessionDuration(mins)}
                          className={`flex-1 py-2 rounded-xl font-bold transition-all ${sessionDuration === mins ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                        >
                          {mins === 0 ? '∞' : `${mins} min`}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      {sessionDuration === 0 ? 'Session never ends automatically' : `Session auto-ends after ${sessionDuration} minutes`}
                    </div>
                  </div>

                  {/* Difficulty Level */}
                  <div className="p-4 bg-gray-50 rounded-xl mb-3">
                    <div className="font-semibold text-gray-900 mb-2">AI Difficulty</div>
                    <div className="flex gap-2">
                      {['Easy', 'Medium', 'Hard'].map(level => (
                        <button
                          key={level}
                          onClick={() => setDifficultyLevel(level)}
                          className={`flex-1 py-2 rounded-xl font-bold transition-all ${difficultyLevel === level ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      {difficultyLevel === 'Easy' && '🌱 Simple vocabulary, slower responses'}
                      {difficultyLevel === 'Medium' && '🎯 Balanced conversation, natural pace'}
                      {difficultyLevel === 'Hard' && '🔥 Advanced vocabulary, challenging topics'}
                    </div>
                  </div>

                  {/* Sound Effects */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-3">
                    <div>
                      <div className="font-semibold text-gray-900">Sound Effects</div>
                      <div className="text-xs text-gray-500">Audio feedback during practice</div>
                    </div>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`w-14 h-8 rounded-full transition-colors relative ${soundEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${soundEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Daily Reminders - Coming Soon */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-6">
                    <div>
                      <div className="font-semibold text-gray-900">Daily Reminders</div>
                      <div className="text-xs text-gray-500">Get notified to practice</div>
                    </div>
                    <button
                      className="w-14 h-8 rounded-full bg-gray-300 relative cursor-not-allowed opacity-50"
                      title="Coming soon"
                    >
                      <div className="w-6 h-6 bg-white rounded-full absolute top-1 translate-x-1" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 text-center mt-4">
                    Made with ❤️ in India 🇮🇳
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div >
    </div >
  );


  // SIMULATION LAB
  if (view === 'simlab') return (
    <div className="min-h-screen bg-gray-100 font-sans md:py-8">
      <div className="max-w-2xl mx-auto bg-white shadow-xl md:rounded-3xl relative">
        <header className="px-6 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 bg-white z-10 safe-area-top">
          <button onClick={() => setView('dashboard')} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          <h1 className="text-xl font-black text-gray-900">Simulation Lab</h1>
        </header>
        <main className="p-6">
          <p className="text-gray-500 mb-6">Choose a real-life scenario to practice your English conversation skills.</p>
          <div className="grid grid-cols-2 gap-4">
            {SIMULATIONS.map(sim => (
              sim.id === 'sim_friend' ? (
                <motion.button
                  key={sim.id}
                  onClick={() => startSimulation(sim)}
                  className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-left hover:border-emerald-500 hover:shadow-lg transition-all group relative overflow-hidden"
                  animate={{ rotate: [0, -3, 3, -3, 3, 0] }}
                  transition={{ duration: 0.6, delay: 0.5, ease: "easeInOut" }}
                >
                  <div className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">🔥 POPULAR</div>
                  <div className={`w-12 h-12 ${sim.color} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}><sim.icon size={24} /></div>
                  <div className="font-bold text-gray-900">{sim.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{sim.desc}</div>
                </motion.button>
              ) : (
                <button key={sim.id} onClick={() => startSimulation(sim)} className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-left hover:border-emerald-500 hover:shadow-lg transition-all group">
                  <div className={`w-12 h-12 ${sim.color} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}><sim.icon size={24} /></div>
                  <div className="font-bold text-gray-900">{sim.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{sim.desc}</div>
                </button>
              )
            ))}
          </div>
        </main>
        {renderGlobalModals()}
      </div>
    </div>
  );

  // CHAT
  if (view === 'chat') return (
    <div className="h-screen bg-gray-100 font-sans flex flex-col">
      <div className="max-w-2xl w-full mx-auto bg-white flex-1 shadow-xl md:my-4 md:rounded-3xl md:max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Fixed Header - with safe area for mobile status bar */}
        <header className="px-4 py-3 flex flex-col gap-2 border-b border-gray-100 bg-white shrink-0 safe-area-top">
          {/* Main Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">{activeSession?.opponent?.avatar || '👤'}</div>
              <div>
                <div className="font-bold text-gray-900">{activeSession?.opponent?.name}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <Sparkles size={12} /> +{sessionPoints} pts
                  </div>
                  {/* V8: Live Accuracy Bar for Battle Mode */}
                  {activeSession?.type?.includes('battle') && battleAccuracies.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-500">🎯</span>
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${Math.round(battleAccuracies.reduce((a, b) => a + b, 0) / battleAccuracies.length) >= 80 ? 'bg-emerald-500' :
                            Math.round(battleAccuracies.reduce((a, b) => a + b, 0) / battleAccuracies.length) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                          style={{ width: `${Math.round(battleAccuracies.reduce((a, b) => a + b, 0) / battleAccuracies.length)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${Math.round(battleAccuracies.reduce((a, b) => a + b, 0) / battleAccuracies.length) >= 80 ? 'text-emerald-600' :
                        Math.round(battleAccuracies.reduce((a, b) => a + b, 0) / battleAccuracies.length) >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                        {Math.round(battleAccuracies.reduce((a, b) => a + b, 0) / battleAccuracies.length)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* FIX: Check sessionDuration === 0 FIRST to prevent flickering */}
              {sessionDuration === 0 ? (
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <Clock size={12} /> ∞ No Limit
                </div>
              ) : timerActive ? (
                <div className="text-xs text-red-500 font-bold flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-full">
                  <Clock size={12} /> {formatTime(timeRemaining)}
                </div>
              ) : null}
              <button
                onClick={handleEndClick}
                disabled={isEnding}
                className={`px-4 py-2 text-white font-bold rounded-full text-sm transition-all flex items-center gap-2 ${isEnding ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 shadow-md active:scale-95'}`}
              >
                {isEnding ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Ending...
                  </>
                ) : (
                  'End Session'
                )}
              </button>
            </div>
          </div>

          {/* Stage Progress Bar - Compact for Simulations */}
          {activeSession?.type === 'bot' && activeSession?.simulation?.stages && (() => {
            const sim = activeSession.simulation;
            const stages = sim.stages;
            const currentIdx = currentStageIndex;
            const currentStageData = stages[currentIdx] || stages[0];

            return (
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg px-3 py-1.5">
                <span className="text-base">{currentStageData?.icon || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-700 truncate">{currentStageData?.name || 'Stage'}</span>
                    <span className="text-[10px] font-bold text-indigo-500 bg-white px-1.5 py-0.5 rounded shrink-0">{currentIdx + 1}/{stages.length}</span>
                  </div>
                  <div className="h-1 bg-indigo-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / stages.length) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </header>

        {/* Points Animation Popup */}
        <AnimatePresence>
          {showPointsAnimation && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="absolute top-20 right-4 z-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2"
            >
              <Sparkles size={16} /> +{showPointsAnimation.points} points!
            </motion.div>
          )}
        </AnimatePresence>


        {/* OLD showTimeOver overlay REMOVED - now using sessionEndTransition instead */}

        {/* Session End Transition Animation - ADDED: This was missing! */}
        <AnimatePresence>
          {sessionEndTransition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-white via-emerald-50 to-teal-50 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: -50 }}
                transition={{ type: 'spring', damping: 20 }}
                className="text-center bg-white rounded-3xl shadow-2xl p-8 max-w-sm mx-4 border border-emerald-100"
              >
                <motion.div
                  className="text-8xl mb-6"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  {sessionEndTransition === 'time_over' ? '⏰' :
                    sessionEndTransition === 'you_inactive' ? '😴' : '👋'}
                </motion.div>
                <h2 className="text-3xl font-black text-gray-900 mb-3">
                  {sessionEndTransition === 'time_over' ? "Time's Up!" :
                    sessionEndTransition === 'you_inactive' ? 'Session Ended' : 'Opponent Left'}
                </h2>
                <p className="text-lg text-gray-600">
                  {sessionEndTransition === 'time_over'
                    ? 'Great practice session!'
                    : sessionEndTransition === 'you_inactive'
                      ? 'No response from your side for 1 minute'
                      : 'Your partner ended the session'}
                </p>
                <div className="mt-6 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-sm text-gray-400 mt-2">Analyzing your performance...</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* OLD sessionEndReason overlay REMOVED - now using sessionEndTransition instead */}

        {/* Streak Milestone Celebration Popup */}
        <AnimatePresence>
          {showStreakMilestone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowStreakMilestone(null)}
            >
              <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                className="bg-gradient-to-br from-orange-500 to-red-500 text-white px-8 py-6 rounded-3xl shadow-2xl text-center max-w-xs"
              >
                <div className="text-6xl mb-3">🔥</div>
                <div className="text-2xl font-black mb-1">{showStreakMilestone} Day Streak!</div>
                <div className="text-sm opacity-90 mb-3">
                  {showStreakMilestone >= 30 ? "You're on fire! Legendary dedication! 🌟" :
                    showStreakMilestone >= 15 ? "Incredible commitment! Keep blazing! 💪" :
                      showStreakMilestone >= 7 ? "Amazing! A full week of practice! 🎯" :
                        "Great start! Keep the momentum going! 🚀"}
                </div>
                <div className="text-xs opacity-70">Next: {showStreakMilestone < 7 ? 7 : showStreakMilestone < 15 ? 15 : showStreakMilestone < 30 ? 30 : 60} day milestone</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Progression Popup */}
        <AnimatePresence>
          {showLevelProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowLevelProgress(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-black text-gray-900 mb-4 text-center">🏆 Level Journey</h3>
                <div className="space-y-3">
                  {[
                    { name: 'Master', icon: '★★★★★', range: '95%+', gradient: 'from-yellow-400 to-amber-500' },
                    { name: 'Pro', icon: '★★★★', range: '85-94%', gradient: 'from-purple-400 to-indigo-500' },
                    { name: 'Improver', icon: '★★★', range: '70-84%', gradient: 'from-blue-400 to-cyan-500' },
                    { name: 'Learner', icon: '★★', range: '50-69%', gradient: 'from-emerald-400 to-teal-500' },
                    { name: 'Starter', icon: '★', range: '0-49%', gradient: 'from-gray-300 to-gray-400' },
                  ].map((level, i) => {
                    const currentLevel = getLevelFromAccuracy(stats.avgScore || 0).name;
                    const isCurrentLevel = level.name === currentLevel;
                    const currentIndex = ['Master', 'Pro', 'Improver', 'Learner', 'Starter'].indexOf(currentLevel);
                    const isUnlocked = i >= currentIndex;

                    return (
                      <div
                        key={level.name}
                        className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${isCurrentLevel ? `bg-gradient-to-r ${level.gradient} text-white ring-2 ring-offset-2 ring-yellow-400` :
                          isUnlocked ? 'bg-gray-100' : 'bg-gray-50 opacity-50'
                          }`}
                      >
                        <div className="text-2xl">{isUnlocked ? level.icon : '🔒'}</div>
                        <div className="flex-1">
                          <div className={`font-bold ${isCurrentLevel ? 'text-white' : 'text-gray-700'}`}>
                            {level.name} {isCurrentLevel && '← You'}
                          </div>
                          <div className={`text-xs ${isCurrentLevel ? 'text-white/80' : 'text-gray-400'}`}>
                            {isUnlocked ? level.range : 'Practice more to unlock!'}
                          </div>
                        </div>
                        {isCurrentLevel && <div className="text-lg">✨</div>}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowLevelProgress(false)}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl hover:opacity-90"
                >
                  Keep Practicing! 💪
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streak Progress Popup */}
        <AnimatePresence>
          {showStreakProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowStreakProgress(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-black text-gray-900 mb-4 text-center">🔥 Streak Journey</h3>
                <div className="text-center mb-4">
                  <div className="text-4xl font-black text-orange-500">{stats.streak || 0}</div>
                  <div className="text-sm text-gray-500">Current streak days</div>
                </div>
                <div className="space-y-2">
                  {[3, 7, 15, 30, 60, 100].map(milestone => {
                    const current = stats.streak || 0;
                    const isReached = current >= milestone;
                    const isNext = current < milestone && (milestone === 3 || current >= [3, 7, 15, 30, 60, 100][[3, 7, 15, 30, 60, 100].indexOf(milestone) - 1]);
                    return (
                      <div
                        key={milestone}
                        className={`flex items-center gap-3 p-2 rounded-xl transition-all ${isReached ? 'bg-gradient-to-r from-orange-400 to-red-400 text-white' :
                          isNext ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-100 opacity-60'
                          }`}
                      >
                        <div className="text-xl">{isReached ? '✅' : isNext ? '🎯' : '🔒'}</div>
                        <div className="flex-1">
                          <div className={`font-bold text-sm ${isReached ? 'text-white' : 'text-gray-700'}`}>
                            {milestone} Day Streak {isNext && '← Next'}
                          </div>
                          <div className={`text-xs ${isReached ? 'text-white/80' : 'text-gray-400'}`}>
                            {isReached ? 'Achieved! 🎉' : `${milestone - current} days to go`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowStreakProgress(false)}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:opacity-90"
                >
                  Keep the Fire Burning! 🔥
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accuracy Info Popup */}
        <AnimatePresence>
          {showAccuracyInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowAccuracyInfo(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-xl font-black text-gray-900 mb-4 text-center">📊 Your Accuracy</h3>
                <div className="text-center mb-4">
                  <div className="text-5xl font-black text-purple-500">{stats.avgScore || 0}%</div>
                  <div className="text-sm text-gray-500 mt-1">Overall Performance</div>
                </div>
                <div className="bg-purple-50 rounded-2xl p-4 mb-4">
                  <div className="text-sm text-purple-800 leading-relaxed">
                    <span className="font-bold">How it's calculated:</span> Your accuracy reflects a deep analysis of your grammar, vocabulary, and fluency across all practice sessions and battles. Each message you send is analyzed by AI to track your improvement. ✨
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 text-center">
                  <div className="text-xs text-gray-500">
                    {stats.avgScore >= 80 ? "🌟 Excellent! You're doing amazing!" :
                      stats.avgScore >= 60 ? "💪 Great progress! Keep practicing!" :
                        stats.avgScore >= 40 ? "📈 You're improving! Stay consistent!" :
                          "🚀 Every practice session helps you grow!"}
                  </div>
                </div>
                <button
                  onClick={() => setShowAccuracyInfo(false)}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-2xl hover:opacity-90"
                >
                  Got it! 👍
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Slit - Left Side Expandable Panel */}
        <AnimatePresence>
          {showChatSettings && (
            <>
              {/* Overlay for click-outside-to-close */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowChatSettings(false)}
                className="absolute inset-0 bg-black/20 z-35"
              />
              <motion.div
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                className="absolute left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-emerald-50 to-white border-r border-emerald-200 shadow-xl z-40 p-4 pt-10 safe-area-top overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings size={18} className="text-emerald-600" />
                    <span className="font-bold text-gray-800">Chat Settings</span>
                  </div>
                  <button onClick={() => setShowChatSettings(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>

                {/* Speaker Toggle */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Speaker</span>
                  </div>
                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`w-10 h-5 rounded-full transition-all ${isSpeakerOn ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${isSpeakerOn ? 'ml-5' : 'ml-0.5'}`} />
                  </button>
                </div>

                {/* AI Assist Toggle */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={16} className="text-emerald-500" />
                    <span className="text-sm text-gray-700">AI Assist</span>
                    <div className="group relative">
                      <Info size={12} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-6 w-48 bg-gray-800 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Click "Assist" button on any message to get reply suggestions in your language.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAiAssistOn(!isAiAssistOn)}
                    className={`w-10 h-5 rounded-full transition-all ${isAiAssistOn ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${isAiAssistOn ? 'ml-5' : 'ml-0.5'}`} />
                  </button>
                </div>

                {/* Translation Toggle */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-orange-500" />
                    <span className="text-sm text-gray-700">Translation</span>
                    <div className="group relative">
                      <Info size={12} className="text-gray-400 cursor-help" />
                      <div className="absolute left-0 bottom-6 w-48 bg-gray-800 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Click translation button on any message to see it in your native language.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsTranslationOn(!isTranslationOn)}
                    className={`w-10 h-5 rounded-full transition-all ${isTranslationOn ? 'bg-orange-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${isTranslationOn ? 'ml-5' : 'ml-0.5'}`} />
                  </button>
                </div>

                {/* Quick Tips Toggle - Only show in Battle mode (hide in simulation/bot mode) */}
                {activeSession?.type !== 'bot' && (
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={16} className="text-yellow-500" />
                      <span className="text-sm text-gray-700">Quick Tips</span>
                      <div className="group relative">
                        <Info size={12} className="text-gray-400 cursor-help" />
                        <div className="absolute left-0 bottom-6 w-48 bg-gray-800 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          Show grammar tips during battles. Tips are always saved for your progress report.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newValue = !isBattleTipsOn;
                        setIsBattleTipsOn(newValue);
                        // Sync to Firestore for persistence
                        if (user) {
                          setDoc(doc(db, 'users', user.uid), {
                            settings: { isBattleTipsOn: newValue }
                          }, { merge: true });
                        }
                      }}
                      className={`w-10 h-5 rounded-full transition-all ${isBattleTipsOn ? 'bg-yellow-500' : 'bg-gray-300'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${isBattleTipsOn ? 'ml-5' : 'ml-0.5'}`} />
                    </button>
                  </div>
                )}

                {/* Session Timer Selector */}
                <div className="py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={16} className="text-blue-500" />
                    <span className="text-sm text-gray-700">Session Timer</span>
                  </div>
                  <div className="flex gap-1">
                    {[3, 5, 7, 0].map(mins => (
                      <button
                        key={mins}
                        onClick={() => setSessionDuration(mins)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${sessionDuration === mins ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {mins === 0 ? '∞' : `${mins}m`}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 text-center">
                    {sessionDuration === 0 ? 'No auto-end' : `Auto-ends in ${sessionDuration} min`}
                  </div>
                </div>

                {/* Language Selector */}
                <div className="py-3">
                  <div className="text-xs text-gray-500 mb-2">Native Language</div>
                  <select
                    value={motherTongue}
                    onChange={(e) => setMotherTongue(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Hindi">हिंदी (Hindi)</option>
                    <option value="Punjabi">ਪੰਜਾਬੀ (Punjabi)</option>
                    <option value="Tamil">தமிழ் (Tamil)</option>
                    <option value="Telugu">తెలుగు (Telugu)</option>
                    <option value="Bengali">বাংলা (Bengali)</option>
                    <option value="Marathi">मराठी (Marathi)</option>
                    <option value="Gujarati">ગુજરાતી (Gujarati)</option>
                    <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                    <option value="Malayalam">മലയാളം (Malayalam)</option>
                    <option value="Odia">ଓଡ଼ିଆ (Odia)</option>
                    <option value="Assamese">অসমীয়া (Assamese)</option>
                  </select>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Settings Toggle Button - Left Edge */}
        <button
          onClick={() => setShowChatSettings(!showChatSettings)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-r-xl p-2 shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Settings size={14} className={`transition-transform ${showChatSettings ? 'rotate-90' : ''} text-white`} />
        </button>

        {/* AI Assist Popup */}
        <AnimatePresence>
          {showAiAssistPopup && (
            <>
              {/* Overlay for click-outside-to-close */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAiAssistPopup(null)}
                className="absolute inset-0 bg-black/40 z-45"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute inset-x-4 top-16 bottom-20 z-50 bg-white rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden flex flex-col max-h-[65vh]"
              >
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Lightbulb size={20} />
                    <span className="font-bold">AI Assist</span>
                  </div>
                  <button onClick={() => setShowAiAssistPopup(null)} className="text-white/80 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {showAiAssistPopup.loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-gray-500 text-sm">Generating suggestions...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Context in Native Language */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">📝</span>
                          <span className="text-sm font-bold text-amber-700">What they're saying ({motherTongue})</span>
                        </div>
                        <p className="text-amber-800 text-sm leading-relaxed">{showAiAssistPopup.contextExplanation}</p>
                      </div>

                      {/* Suggestions */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">💬</span>
                          <span className="text-sm font-bold text-gray-700">You can reply like this:</span>
                        </div>
                        <div className="space-y-2">
                          {showAiAssistPopup.suggestions?.map((suggestion, i) => (
                            <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-sm">
                              {i + 1}. "{suggestion}"
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tip */}
                      {showAiAssistPopup.tip && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <span>💡</span>
                            <span className="text-xs text-blue-600">{showAiAssistPopup.tip}</span>
                          </div>
                        </div>
                      )}

                      <div className="text-center text-gray-400 text-xs pt-2">
                        ⬆️ Now try typing your own reply!
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Translation Popup */}
        <AnimatePresence>
          {showTranslationPopup && (
            <>
              {/* Overlay for click-outside-to-close */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTranslationPopup(null)}
                className="absolute inset-0 bg-black/30 z-45"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute left-4 right-4 top-1/3 z-50"
              >
                <div className="bg-white rounded-2xl shadow-2xl border border-orange-200 p-4 max-w-sm mx-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-orange-500" />
                      <span className="font-bold text-sm text-gray-700">{motherTongue} Translation</span>
                    </div>
                    <button onClick={() => setShowTranslationPopup(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>

                  {showTranslationPopup.loading ? (
                    <div className="flex items-center justify-center py-4 gap-2">
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3">
                        <p className="text-orange-800 text-sm leading-relaxed">{showTranslationPopup.translation}</p>
                      </div>
                      {/* Speaker button to hear translation - Uses Advanced WaveNet TTS */}
                      <button
                        onClick={async (e) => {
                          // Show loading state by disabling button temporarily
                          const btn = e.currentTarget;
                          const originalText = btn.querySelector('span').innerText;
                          btn.disabled = true;
                          btn.querySelector('span').innerText = 'Loading...';

                          try {
                            const langMap = { 'Hindi': 'hi-IN', 'Punjabi': 'pa-IN', 'Tamil': 'ta-IN', 'Telugu': 'te-IN', 'Bengali': 'bn-IN', 'Marathi': 'mr-IN', 'Gujarati': 'gu-IN', 'Kannada': 'kn-IN', 'Malayalam': 'ml-IN', 'Odia': 'or-IN', 'Assamese': 'as-IN' };
                            const lang = langMap[motherTongue] || 'hi-IN';
                            console.log('[TRANSLATION_TTS] Requesting WaveNet TTS for lang:', lang);
                            const token = await user.getIdToken();
                            const data = await callBackend(BACKEND_URL, 'POST', { type: 'tts', text: showTranslationPopup.translation, lang }, token);
                            console.log('[TRANSLATION_TTS] Response:', data.audioBase64 ? 'Got WaveNet audio!' : 'No audio, error:', data.error);

                            if (data.audioBase64) {
                              console.log('[TRANSLATION_TTS] Playing WaveNet audio');
                              const audio = new Audio(`data:audio/mp3;base64,${data.audioBase64}`);
                              audio.play().catch(() => { });
                            } else {
                              // Fallback to browser TTS if API fails
                              if ('speechSynthesis' in window) {
                                const utterance = new SpeechSynthesisUtterance(showTranslationPopup.translation);
                                utterance.lang = lang;
                                utterance.rate = 0.9;
                                window.speechSynthesis.speak(utterance);
                              }
                            }
                          } catch (e) {
                            console.error('[TTS] Error:', e);
                            // Fallback to browser TTS on error
                            if ('speechSynthesis' in window) {
                              const utterance = new SpeechSynthesisUtterance(showTranslationPopup.translation);
                              utterance.lang = motherTongue === 'Hindi' ? 'hi-IN' : motherTongue === 'Tamil' ? 'ta-IN' : 'hi-IN';
                              window.speechSynthesis.speak(utterance);
                            }
                          } finally {
                            btn.disabled = false;
                            btn.querySelector('span').innerText = originalText;
                          }
                        }}
                        className="w-full py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Volume2 size={14} />
                        <span>Listen in {motherTongue}</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Scrollable Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => {
            // Visibility Filter: 
            // - Show if sender is 'me', 'system', or 'correction'
            // - Show if sender is 'opponent' AND has finished typing (exists in visibleMessageIds)
            const isVisible = m.sender !== 'opponent' || visibleMessageIds.has(m.id);
            if (!isVisible) return null;
            return (
              <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : m.sender === 'system' ? 'justify-center' : m.sender === 'correction' || m.sender === 'suggestion' ? 'justify-center' : 'justify-start'}`}>
                {m.sender === 'system' ? (
                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 px-3 py-1 rounded-full">{m.text}</span>
                ) : m.sender === 'suggestion' ? (
                  // YELLOW SUGGESTION - Compact, less intrusive tip
                  minimizedCorrections[m.id] ? (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setMinimizedCorrections(prev => ({ ...prev, [m.id]: false }))}
                      className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-full px-3 py-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                      <Lightbulb size={14} className="text-amber-500" />
                      <span className="text-amber-700 font-medium text-xs">Tip available</span>
                      <ChevronDown size={12} className="text-amber-500" />
                    </motion.button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb size={16} className="text-amber-500" />
                          <span className="font-bold text-amber-700 text-sm">Quick Tip</span>
                        </div>
                        <button
                          onClick={() => setMinimizedCorrections(prev => ({ ...prev, [m.id]: true }))}
                          className="text-amber-400 hover:text-amber-600 p-1 hover:bg-amber-100 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="text-xs text-amber-800 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500">"{m.correction?.original}"</span>
                          <span className="text-amber-400">→</span>
                          <span className="font-semibold text-amber-700">"{m.correction?.corrected}"</span>
                        </div>
                        <div className="text-amber-600 italic">{m.correction?.reason}</div>
                      </div>
                    </motion.div>
                  )
                ) : m.sender === 'correction' ? (
                  // ALL CORRECTIONS NOW USE QUICK TIP STYLE (compact, yellow/amber)
                  minimizedCorrections[m.id] ? (
                    // Minimized pill - click to expand
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setMinimizedCorrections(prev => ({ ...prev, [m.id]: false }))}
                      className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-full px-3 py-1.5 shadow-sm hover:shadow transition-all cursor-pointer blinking-alert"
                    >
                      <Lightbulb size={14} className="text-amber-500" />
                      <span className="text-amber-700 font-medium text-xs">Tip available</span>
                      <ChevronDown size={12} className="text-amber-500" />
                    </motion.button>
                  ) : (
                    // Expanded Quick Tip style for corrections
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-sm bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb size={16} className="text-amber-500" />
                          <span className="font-bold text-amber-700 text-sm">Quick Tip</span>
                        </div>
                        <button
                          onClick={() => setMinimizedCorrections(prev => ({ ...prev, [m.id]: true }))}
                          className="text-amber-400 hover:text-amber-600 p-1 hover:bg-amber-100 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="text-xs text-amber-800 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500">"{m.originalText || m.correction?.original}"</span>
                          <span className="text-amber-400">→</span>
                          <span className="font-semibold text-amber-700">"{m.correction?.corrected}"</span>
                        </div>
                        <div className="text-amber-600 italic">{m.correction?.reason}</div>
                      </div>
                    </motion.div>
                  )

                ) : (
                  // Regular messages (user and opponent)
                  m.sender === 'me' ? (
                    <div className="flex flex-col items-end max-w-[85%]">
                      <div className="px-4 py-2.5 rounded-2xl text-sm bg-emerald-600 text-white rounded-br-sm">
                        {m.text}
                      </div>
                      {/* WhatsApp-style: Time + Ticks BELOW bubble */}
                      <div className="flex items-center gap-1 mt-0.5 mr-1">
                        <span className="text-[10px] text-gray-400">
                          {new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.status === 'sending' && (
                          <Loader2 size={10} className="text-gray-400 animate-spin" />
                        )}
                        {m.status === 'sent' && (
                          <span className="text-gray-400 text-[10px]">✓</span>
                        )}
                        {(m.status === 'delivered' || m.status === 'seen' || !m.status) && (
                          <span className="text-blue-500 text-[10px]">✓✓</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Opponent message with AI Assist & Translation buttons
                    <div className="flex flex-col items-start max-w-[85%]">
                      <div className="flex items-end gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0 mb-1">
                          {activeSession?.opponent?.avatar || '🤖'}
                        </div>
                        <div className="px-4 py-3 rounded-2xl text-sm bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm">
                          {m.text}
                        </div>
                      </div>
                      {/* AI Assist & Translation Buttons with Shake Animation - Only last message shakes */}
                      {(isAiAssistOn || isTranslationOn) && (
                        <motion.div
                          className="flex items-center gap-2 ml-9 mt-1"
                          animate={shouldShakeButtons && i === messages.length - 1 ? { x: [0, -3, 3, -3, 3, 0] } : {}}
                          transition={{ duration: 0.5, repeat: shouldShakeButtons && i === messages.length - 1 ? 2 : 0 }}
                        >
                          {isAiAssistOn && (
                            <button
                              onClick={() => handleAiAssistClick(m.id, m.text)}
                              className={`flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full transition-all ${shouldShakeButtons && i === messages.length - 1 ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                            >
                              <Lightbulb size={10} />
                              <span>Assist</span>
                            </button>
                          )}
                          {isTranslationOn && (
                            <button
                              onMouseDown={() => { longPressTimer.current = setTimeout(() => handleTranslationPress(m.id, m.text), 500); }}
                              onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                              onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                              onTouchStart={() => { longPressTimer.current = setTimeout(() => handleTranslationPress(m.id, m.text), 500); }}
                              onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                              onClick={() => handleTranslationPress(m.id, m.text)}
                              className={`flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full transition-all ${shouldShakeButtons && i === messages.length - 1 ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                            >
                              <Globe size={10} />
                              <span>{motherTongue === 'Hindi' ? 'हिंदी' : motherTongue}</span>
                            </button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })}

          {/* Opponent Typing Indicator */}
          {isOpponentTyping && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex gap-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <span className="text-xs text-gray-400 ml-2 font-medium">Typing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </main>

        {/* Fixed Input - with safe area for mobile navigation */}
        <div className="p-3 sm:p-4 bg-white border-t border-gray-100 shrink-0 safe-area-bottom">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-50 p-1.5 sm:p-2 rounded-full border border-gray-100">
            <input
              autoFocus
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                // Real-time typing for human matches
                if (activeSession?.type === 'human' && activeSession?.id) {
                  handleTyping(true);
                }
              }}
              onFocus={() => {
                // Close popups when user focuses on input
                setShowAiAssistPopup(null);
                setShowTranslationPopup(null);
              }}
              onBlur={() => {
                if (activeSession?.type === 'human') handleTyping(false);
              }}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className="flex-1 min-w-0 bg-transparent px-2 sm:px-3 py-2 text-sm focus:outline-none"
            />

            {/* Quick Assist Button - Opens AI Assist for last bot message - with Shake */}
            {isAiAssistOn && messages.length > 0 && (() => {
              const lastBotMsg = [...messages].reverse().find(m => m.sender !== 'me' && m.sender !== 'system' && m.sender !== 'correction' && m.sender !== 'suggestion');
              return lastBotMsg ? (
                <motion.button
                  onClick={() => handleAiAssistClick(lastBotMsg.id, lastBotMsg.text)}
                  animate={shouldShakeButtons ? { x: [0, -3, 3, -3, 3, 0] } : {}}
                  transition={{ duration: 0.5, repeat: shouldShakeButtons ? 2 : 0 }}
                  className={`p-2 flex-shrink-0 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full hover:bg-emerald-100 hover:scale-105 transition-all ${shouldShakeButtons ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                  title="Need help replying?"
                >
                  <Lightbulb size={16} />
                </motion.button>
              ) : null;
            })()}

            {/* Voice Input Button with Enhanced Styling */}
            <div className="relative flex-shrink-0">
              <button
                onClick={toggleVoiceInput}
                className={`p-2 sm:p-2.5 rounded-full transition-all duration-300 ${isListening
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/40 scale-110'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 hover:scale-105'
                  }`}
                title={isListening ? 'Stop listening' : 'Speak to type'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              {/* Listening Indicator */}
              {isListening && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] px-2 py-1 rounded-full whitespace-nowrap font-semibold shadow-lg"
                >
                  <span className="animate-pulse">🎙️ Listening...</span>
                </motion.div>
              )}
            </div>

            <button onClick={sendMessage} disabled={!inputText.trim() || (activeSession?.type === 'bot' && isOpponentTyping)} className="p-2.5 sm:p-3 flex-shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full disabled:opacity-50 disabled:bg-gray-300 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:scale-105 transition-all duration-200">
              {activeSession?.type === 'bot' && isOpponentTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>

        {/* Discussing with Professor Loading Modal */}
        <AnimatePresence>
          {isLoadingExplanation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <motion.div
                  className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/30"
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <span className="text-5xl">👨‍🏫</span>
                </motion.div>
                <h2 className="text-xl font-black text-white mb-2">Consulting with Professor...</h2>
                <p className="text-purple-200 text-sm">Getting detailed explanation for you</p>
                <div className="flex justify-center gap-2 mt-6">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-3 h-3 bg-purple-400 rounded-full"
                      animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detailed Explanation Modal */}
        <AnimatePresence>
          {showDetailedExplanation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto"
              >
                <button onClick={() => setShowDetailedExplanation(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-3xl">👨‍🏫</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Professor's Explanation</h3>
                    <p className="text-sm text-gray-500">{showDetailedExplanation.type || 'Grammar'} Lesson</p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4">
                  <div className="text-xs text-red-500 font-bold uppercase mb-1">❌ What you said:</div>
                  <div className="text-red-700 font-medium line-through">{showDetailedExplanation.original}</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
                  <div className="text-xs text-emerald-600 font-bold uppercase mb-1">✓ Correct way:</div>
                  <div className="text-emerald-700 font-semibold">{showDetailedExplanation.corrected}</div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-4">
                  <div className="text-xs text-indigo-600 font-bold uppercase mb-2">📚 Detailed Explanation:</div>
                  <p className="text-gray-700 text-sm leading-relaxed">{showDetailedExplanation.detailed}</p>
                </div>

                {showDetailedExplanation.examples && showDetailedExplanation.examples.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                    <div className="text-xs text-amber-600 font-bold uppercase mb-2">💡 More Examples:</div>
                    <ul className="space-y-2">
                      {showDetailedExplanation.examples.map((ex, i) => (
                        <li key={i} className="text-gray-700 text-sm flex items-start gap-2">
                          <span className="text-amber-500">•</span> {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {showDetailedExplanation.tips && showDetailedExplanation.tips.length > 0 && (
                  <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 mb-6">
                    <div className="text-xs text-teal-600 font-bold uppercase mb-2">🎯 Tips to Remember:</div>
                    <ul className="space-y-1">
                      {showDetailedExplanation.tips.map((tip, i) => (
                        <li key={i} className="text-gray-700 text-sm flex items-start gap-2">
                          <span className="text-teal-500">→</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setShowDetailedExplanation(null)}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all"
                >
                  Got it! 👍
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {renderGlobalModals()}
    </div >
  );




  // ENDING SESSION - Show animated transition
  if (view === 'ending') return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-10 text-center border border-white/20"
      >
        {/* Animated Paper Stack */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <motion.div
            animate={{ rotate: [-5, 5, -5], y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-white rounded-xl shadow-lg flex items-center justify-center text-4xl"
          >📝</motion.div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-lg"
          >✓</motion.div>
        </div>

        <h2 className="text-2xl font-black text-white mb-2">Checking Your Conversation...</h2>
        <p className="text-purple-200 text-sm">Analyzing grammar, vocabulary & fluency</p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              className="w-3 h-3 bg-purple-400 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );

  // ANALYZING
  if (view === 'analyzing') return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans">
      <div className="max-w-md bg-white rounded-3xl shadow-xl p-10 text-center">
        <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={48} />
        <h2 className="text-xl font-black text-gray-900">Analyzing...</h2>
        <p className="text-gray-400 text-sm mt-2">Checking grammar, vocabulary, and fluency.</p>
      </div>
    </div>
  );

  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
};

export default App;

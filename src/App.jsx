import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore, collection, query, getDoc, setDoc, addDoc, onSnapshot,
  doc, serverTimestamp, orderBy, getDocs, limit, where, deleteDoc
} from 'firebase/firestore';

import {
  Send, Zap, Swords, Sword, MessageSquare, Trophy, Briefcase, Coffee, Stethoscope,
  Train, Plane, Loader2, LogOut, MessageCircle, Target,
  Users, Hash, Clock, Award, User, X, Info, Play, Menu, Settings, HelpCircle, Sparkles,
  ChevronUp, ChevronDown, AlertTriangle, Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import WinnerReveal from './WinnerReveal';

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
  db = getFirestore(app);
  analytics = getAnalytics(app);
} catch (e) { console.error("Firebase init error", e); }

const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🦄', '🐲', '🦅', '🐬', '🦋', '🌸'];

const SIMULATIONS = [
  { id: 'sim_interview', cat: 'Career', title: 'Job Interview', icon: Briefcase, color: 'bg-blue-500', desc: 'Nail your next interview.', stages: ['Reception', 'Interview', 'Exit'], greeting: "Welcome! Have a seat. Why should we hire you? 💼" },
  { id: 'sim_cafe', cat: 'Social', title: 'Coffee Shop', icon: Coffee, color: 'bg-amber-500', desc: 'Order complex drinks.', stages: ['Counter', 'Table', 'Exit'], greeting: "Hi! What can I get you today? ☕" },
  { id: 'sim_doctor', cat: 'Health', title: 'Doctor Visit', icon: Stethoscope, color: 'bg-red-500', desc: 'Describe symptoms clearly.', stages: ['Waiting', 'Consultation', 'Pharmacy'], greeting: "Come in. What's the problem? 🏥" },
  { id: 'sim_station', cat: 'Travel', title: 'Train Station', icon: Train, color: 'bg-green-500', desc: 'Buy tickets confidently.', stages: ['Counter', 'Platform', 'Train'], greeting: "Ticket for which train? 🚉" },
  { id: 'sim_travel', cat: 'Travel', title: 'Travel Agency', icon: Plane, color: 'bg-indigo-500', desc: 'Plan your trip.', stages: ['Meeting', 'Planning', 'Booking'], greeting: "Hey! Where would you like to go? 🗺️" },
  { id: 'sim_friend', cat: 'Social', title: 'Casual Chat', icon: Users, color: 'bg-pink-500', desc: 'Small talk practice.', stages: ['Meeting', 'Chatting', 'Goodbye'], greeting: "Hi friend! How have you been? 👋" },
];

const STAT_INFO = {
  streak: { title: 'Streak 🔥', desc: 'Number of consecutive days you have practiced. Keep it going!' },
  points: { title: 'Total Points ⭐', desc: 'Points earned from sessions. Higher scores = more points.' },
  level: { title: 'Your Level 🏆', desc: 'Your rank based on total points. Level up by practicing!' },
  avgScore: { title: 'Average Score 📊', desc: 'Your average performance score across all sessions.' },
};

const App = () => {
  const KNOWN_BOTS = {
    'Aman': 'bot_aman', 'Rahul': 'bot_rahul', 'Neha': 'bot_neha', 'Pooja': 'bot_pooja',
    'Rohit': 'bot_rohit', 'Simran': 'bot_simran', 'Ankit': 'bot_ankit',
    'Priya': 'bot_priya', 'Kavya': 'bot_kavya', 'Diya': 'bot_diya', 'Riya': 'bot_riya'
  };

  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [view, setView] = useState('landing');

  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [currentStage, setCurrentStage] = useState("");
  const [stats, setStats] = useState({ streak: 0, points: 0, level: 'Rookie', sessions: 0, avgScore: 0, lastPracticeDate: null });
  const [userAvatar, setUserAvatar] = useState('🦁');
  const [sessionPoints, setSessionPoints] = useState(0);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [lastCorrection, setLastCorrection] = useState(null);
  const [showPointsAnimation, setShowPointsAnimation] = useState(null);
  const [minimizedCorrections, setMinimizedCorrections] = useState({});

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatusText, setSearchStatusText] = useState("Finding a partner...");
  const searchTimeoutRef = useRef(null);
  const matchListener = useRef(null);
  const chatListener = useRef(null);
  const randomSearchListener = useRef(null);

  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showStatInfo, setShowStatInfo] = useState(null);

  const [dualAnalysis, setDualAnalysis] = useState(null);
  const [showWinnerReveal, setShowWinnerReveal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null); // 'practice' | 'compete' | 'friend' | 'google' | 'guest'
  const [recentChats, setRecentChats] = useState([]);

  const [pendingInvites, setPendingInvites] = useState([]);
  const [preparingSim, setPreparingSim] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [motherTongue, setMotherTongue] = useState('Hindi');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState(null);
  const [helpFeedbackText, setHelpFeedbackText] = useState('');
  const [helpFeedbackRating, setHelpFeedbackRating] = useState(0);
  const [helpFeedbackSubmitted, setHelpFeedbackSubmitted] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showDetailedExplanation, setShowDetailedExplanation] = useState(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const isEndingRef = useRef(false);
  const isJoiningRef = useRef(false);
  const isAlertingRef = useRef(false);

  // Typing & Visibility Logic for Battle/Bot Mode
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [visibleMessageIds, setVisibleMessageIds] = useState(new Set());
  const processedMessageIds = useRef(new Set());

  // Voice-to-Text & Text-to-Speech
  const [isListening, setIsListening] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // TTS enabled by default
  const recognitionRef = useRef(null);
  const typingQueue = useRef([]);
  const isSyncingQueue = useRef(false);
  const isSyncingInitialRef = useRef(true);
  const [isEnding, setIsEnding] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const messagesEndRef = useRef(null);

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



  // Effects
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

  useEffect(() => {
    if (!user) {
      setStats({ streak: 0, points: 0, level: 'Rookie', sessions: 0, avgScore: 0, lastPracticeDate: null });
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
      } else {
        // Initial setup if doc doesn't exist
        await setDoc(docRef, { uid: user.uid, stats: { streak: 0, points: 0, level: 'Rookie', sessions: 0, avgScore: 0, lastPracticeDate: null }, userAvatar, lastBots: [] });
      }
    }, (err) => console.error("Stats listener error:", err));

    // 2. Recent Sessions Listener
    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const sessionsQuery = query(sessionsRef, orderBy('timestamp', 'desc'), limit(5));

    const unsubSessions = onSnapshot(sessionsQuery, (snap) => {
      const recentSessions = snap.docs.map(docSnap => {
        const data = docSnap.data();
        const sim = SIMULATIONS.find(s => s.id === data.simId);
        return {
          id: docSnap.id,
          type: data.type === '1v1' ? 'battle' : 'simulation',
          title: data.simName || data.opponentName || 'Session',
          simId: data.simId,
          lastMessage: data.lastMessage || `Score: ${data.score || data.accuracy || 0}%`,
          timestamp: data.timestamp?.toDate() || new Date(),
          accuracy: data.accuracy || data.score || 0,
          points: data.points,
          opponentAvatar: data.opponentAvatar || (data.type === '1v1' ? '👤' : (sim?.icon && '🤖')),
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
        fetch(`${BACKEND_URL}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'warmup' })
        }).catch(() => { });
      });
    }
  }, [view, user]);

  // Presence Tracking System with Tab Visibility Detection
  useEffect(() => {
    if (!user || !db) return;

    // Only track presence when on dashboard (not in session)
    if (view === 'dashboard') {
      const presenceDocRef = doc(db, 'presence', user.uid);

      // Function to update presence based on visibility
      const updatePresence = (isVisible) => {
        console.log('[PRESENCE] Tab visibility changed. Visible:', isVisible);
        setDoc(presenceDocRef, {
          name: user.displayName || 'Player',
          avatar: userAvatar,
          level: stats.level || 'Rookie',
          lastSeen: serverTimestamp(),
          isOnline: isVisible, // Only online if tab is visible
          view: 'dashboard'
        }, { merge: true }).catch(e => console.error('Presence set error:', e));
      };

      // Initial set - only online if tab is visible
      const isTabVisible = document.visibilityState === 'visible';
      console.log('[PRESENCE] Initial tab visibility:', isTabVisible);
      updatePresence(isTabVisible);

      // Listen for visibility changes (tab switching, minimize, etc.)
      const handleVisibilityChange = () => {
        const isVisible = document.visibilityState === 'visible';
        updatePresence(isVisible);
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Also handle window focus/blur for more accuracy
      const handleFocus = () => {
        console.log('[PRESENCE] Window focused');
        updatePresence(true);
      };
      const handleBlur = () => {
        console.log('[PRESENCE] Window blurred');
        updatePresence(false);
      };
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      // Heartbeat every 30 seconds (only if tab is visible)
      heartbeatRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          setDoc(presenceDocRef, { lastSeen: serverTimestamp(), isOnline: true }, { merge: true })
            .catch(e => console.error('Heartbeat error:', e));
        }
      }, 30000);

      // Listen for all live users (excluding self)
      const liveQuery = query(
        collection(db, 'presence'),
        where('isOnline', '==', true)
      );
      presenceListenerRef.current = onSnapshot(liveQuery, (snap) => {
        const now = Date.now();
        const staleThreshold = 2 * 60 * 1000; // 2 minutes in milliseconds

        const live = snap.docs
          .filter(d => d.id !== user.uid)
          .map(d => ({ id: d.id, ...d.data() }))
          // Filter out stale users (lastSeen more than 2 minutes ago)
          .filter(u => {
            if (!u.lastSeen) return false; // No lastSeen means stale
            const lastSeenMs = u.lastSeen.toMillis ? u.lastSeen.toMillis() : u.lastSeen;
            const isRecent = (now - lastSeenMs) < staleThreshold;
            if (!isRecent) {
              console.log('[PRESENCE] Filtering out stale user:', u.name, 'Last seen:', Math.round((now - lastSeenMs) / 1000), 'seconds ago');
            }
            return isRecent;
          });
        console.log('[PRESENCE] My UID:', user.uid, '| Live users:', live.map(u => ({ name: u.name, id: u.id })));
        setLiveUsers(live);
      }, e => console.error('Live users listener error:', e));

      // Cleanup
      return () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (presenceListenerRef.current) presenceListenerRef.current();

        // Remove visibility event listeners
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);

        // Cancel pending invitation if we leave dashboard
        if (sentInviteTargetRef.current) {
          const targetId = sentInviteTargetRef.current.id;
          console.log('[CLEANUP] Cancelling invitation to:', targetId);
          // Set cancelled status so they know we left
          const invRef = doc(db, 'invitations', targetId);
          setDoc(invRef, { status: 'cancelled' }, { merge: true }).catch(e => console.error('Cancel error:', e));
          // Delete after short delay (fire and forget)
          setTimeout(() => deleteDoc(invRef).catch(e => console.error('Delete error:', e)), 500);
        }

        // Set offline when leaving dashboard
        setDoc(presenceDocRef, { isOnline: false, lastSeen: serverTimestamp() }, { merge: true })
          .catch(e => console.error('Presence cleanup error:', e));
      };
    } else {
      // Set away status when not on dashboard
      const presenceDocRef = doc(db, 'presence', user.uid);
      setDoc(presenceDocRef, { isOnline: false, view: view }, { merge: true })
        .catch(e => console.error('Away status error:', e));
    }
  }, [view, user, userAvatar, stats.level]);

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
          if (prev <= 1) { clearInterval(timerRef.current); setTimerActive(false); endSession(true); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [timerActive]);

  // Invitation Countdown Timer
  useEffect(() => {
    if (incomingInvitation && view === 'dashboard') {
      // Reset countdown to 16 seconds when new invitation arrives
      setInvitationCountdown(16);

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

  const autoTimeoutInvitation = async () => {
    if (!incomingInvitation) return;
    try {
      const invRef = doc(db, 'invitations', user.uid);
      // Set status to 'timeout' so sender knows it auto-expired
      await setDoc(invRef, { status: 'timeout' }, { merge: true });
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
  const handleLogin = async (p) => { try { if (p === 'google') await signInWithPopup(auth, new GoogleAuthProvider()); else await signInAnonymously(auth); } catch (e) { } };

  const saveUserData = async (newStats, newAvatar) => {
    if (!user) return;
    try { await setDoc(doc(db, 'users', user.uid), { stats: newStats || stats, userAvatar: newAvatar || userAvatar }, { merge: true }); } catch (e) { }
  };

  const selectAvatar = (av) => { setUserAvatar(av); saveUserData(null, av); setShowProfile(false); };

  // Backend Warmup Helper
  const triggerWarmup = async () => {
    try {
      if (!user) return; // Need user for token
      const token = await user.getIdToken();
      fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'warmup' })
      }).catch(err => console.log('Warmup partial fail', err));
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
    if (!isSpeakerOn) return;

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
    console.log('[TTS] Fallback to Browser Speech');
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

  const sendInvitation = async (targetUser) => {
    if (!user || !targetUser) return;
    const invitationRef = doc(db, 'invitations', targetUser.id);
    console.log('[INVITE_SEND] Attempting to create invitation at path:', invitationRef.path);
    console.log('[INVITE_SEND] Target ID:', targetUser.id, 'My UID:', user.uid);

    try {
      await setDoc(invitationRef, {
        fromUserId: user.uid,
        fromName: user.displayName || 'Player',
        fromAvatar: userAvatar,
        fromLevel: stats.level || 'Rookie',
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
    try {
      // Create a room for both players
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'create_invitation_room',
          hostId: incomingInvitation.fromUserId,
          hostName: incomingInvitation.fromName,
          hostAvatar: incomingInvitation.fromAvatar,
          guestId: user.uid,
          guestName: user.displayName || 'Player',
          guestAvatar: userAvatar
        })
      });
      const data = await res.json();

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
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'create_bot_room', userId: user.uid, userName: user.displayName || 'Player', userAvatar, botId })
      });
      const data = await res.json();
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
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'create_room', userId: user.uid, userName: user.displayName || 'Host', userAvatar })
      });
      const data = await res.json();
      if (data.success) {
        setRoomCode(data.roomCode);
        const unsub = onSnapshot(doc(db, 'queue', data.roomId), (snap) => {
          if (snap.exists() && snap.data().status === 'matched') {
            unsub();
            joinMatch(data.roomId, { id: snap.data().player2Id, name: snap.data().player2Name, avatar: snap.data().player2Avatar }, 'human', 'Friend Match');
            setShowRoomInput(false); setRoomCode("");
          }
        });
      } else { alert(data.error || 'Failed to create room'); }
    } catch (e) { alert(e.message); } finally { setIsCreatingRoom(false); }
  };

  const joinRoom = async (code) => {
    if (!code || code.length < 4) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'join_room', roomCode: code, userId: user.uid, userName: user.displayName || 'Friend', userAvatar })
      });
      const data = await res.json();
      if (data.success) {
        joinMatch(data.roomId, data.opponent, 'human', 'Friend Match');
        setShowRoomInput(false);
      } else alert(data.error || 'Failed to join room');
    } catch (e) { alert(e.message); }
  };

  const startRandomMatch = async () => {
    if (isSearching) return;
    setIsSearching(true); setSearchStatusText("Finding a partner...");

    // Warmup backend for faster bot response
    if (user) {
      user.getIdToken().then(token => {
        fetch(`${BACKEND_URL}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'warmup' })
        }).catch(() => { });
      });
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'find_random_match', userId: user.uid, userName: user.displayName || 'Player', userAvatar })
      });
      const data = await res.json();
      console.log('MATCH_DEBUG: find_random_match response:', data);
      if (data.success) {
        if (data.matched) {
          if (isJoiningRef.current) return;
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
            if (snap.exists() && snap.data().status === 'matched' && !snap.data().isBotMatch) {
              if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
              const r = snap.data(); const amI = r.hostId === user.uid;
              joinMatch(data.roomId, { id: amI ? r.player2Id : r.hostId, name: amI ? r.player2Name : r.userName, avatar: amI ? r.player2Avatar : r.userAvatar }, 'human', r.roleData?.topic);
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
      const res = await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ type: 'trigger_bot_match', roomId, userId: user.uid }) });
      const data = await res.json();
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

    setTimeRemaining(420);
    setTimerActive(true);
    setSessionPoints(0);
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
        if (data.status === 'ended' && data.endedBy && data.endedBy !== user.uid) {
          // If opponent ended it, we act as if we just finished.
          // But we need the results! They should be in data.results
          if (data.results) {
            setDualAnalysis(data.results);
            setShowWinnerReveal(true);
            setView('dashboard');
            setActiveSession(null);
            setTimerActive(false);
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
          console.log('[CHAT_LISTENER] New messages:', newMsgs.length, 'Match type:', type);
          // HUMAN MATCH: Fast-path (Instant Delivery)
          if (type === 'human') {
            console.log('[CHAT_LISTENER] Using HUMAN fast-path');
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
          // Keep system/correction messages and any local optimistic messages
          const nonFirestoreMsgs = prev.filter(m =>
            m.sender === 'system' ||
            m.sender === 'correction' ||
            (m.id && typeof m.id === 'string' && (
              m.id.startsWith('loc_') ||
              m.id.startsWith('bot_') ||
              m.id.startsWith('ai_')
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
    setActiveSession({
      id: sim.id,
      sessionId,
      opponent: { name: sim.title, avatar: '🤖' },
      type: 'bot',
      topic: sim.desc
    });
    // Reset typing status for bots
    setIsOpponentTyping(false);

    // Instead of instant reveal, trigger typing
    const greetingId = 'ai_init_' + Date.now();
    console.log('SIM_CHAT: Queuing AI greeting', greetingId);
    processedMessageIds.current.add(greetingId);
    typingQueue.current.push({ id: greetingId, sender: 'opponent', text: sim.greeting, createdAt: Date.now() });
    setTimeout(processTypingQueue, 600); // Wait for the 'chat' view to mount

    setCurrentStage(sim.stages[0]);
    setSessionPoints(0);
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

      try {
        const token = await user.getIdToken();
        const history = messages.filter(m => m.sender !== 'system' && m.sender !== 'correction').map(m => `${m.sender === 'me' ? 'User' : 'AI'}: ${m.text}`);
        const res = await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'chat', message: text, personaId: activeSession.id, context: activeSession.topic, history, stage: currentStage })
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

          if (data.hasCorrection && data.correction) {
            const correctionId = 'correction' + Date.now();
            const now = Date.now();

            // FORCE VISUAL APPEND: Track in adjustedTimestamps like bot messages
            adjustedTimestamps.current[correctionId] = now;

            setMessages(prev => [...prev, { id: correctionId, sender: 'correction', correction: data.correction, originalText: text, createdAt: now }]);
            try { new Audio('/sounds/correction.mp3').play().catch(() => { }); } catch { }
            setTimeout(() => setMinimizedCorrections(prev => ({ ...prev, [correctionId]: true })), 8000);
          } else {
            try { new Audio('/sounds/success.mp3').play().catch(() => { }); } catch { }
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

      try {
        const token = await user.getIdToken();
        await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'send_message', roomId: activeSession.id, text, senderId: user.uid })
        });

        // Step 2: Update to status='sent' (single tick ✓)
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'sent' } : m));

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

  const endSession = async (initiatedByMe = true) => {
    if (!activeSession || isEndingRef.current) return;
    isEndingRef.current = true;

    // IMMEDIATE: For non-bot sessions, show analyzing view right away to avoid blank screen
    const isCompetitive = activeSession?.type !== 'bot';
    const capturedMessages = [...messages]; // Capture messages BEFORE reset
    const capturedSession = { ...activeSession }; // Capture session info

    if (isCompetitive) {
      setView('analyzing'); // Instant visual feedback
    }

    resetChatStates();

    // Prepare for feedback
    setFeedbackSessionId(capturedSession.sessionId || capturedSession.id);
    setFeedbackRating(0);
    setFeedbackText('');
    setFeedbackSubmitted(false);

    setTimerActive(false);
    if (initiatedByMe && isCompetitive) {
      try {
        const token = await user.getIdToken();
        await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ type: 'end_session', roomId: capturedSession.id, endedBy: user.uid }) });
      } catch (e) { }
    }
    if (chatListener.current) { chatListener.current(); chatListener.current = null; }
    if (matchListener.current) { matchListener.current(); matchListener.current = null; }

    // Calculate accuracy based on messages and corrections
    const myMessages = capturedMessages.filter(m => m.sender === 'me');
    const totalSent = myMessages.length;
    const correctionCount = capturedMessages.filter(m => m.sender === 'correction').length;
    const cleanCount = totalSent - correctionCount;

    let sessionAccuracy = 100;
    if (totalSent === 0) {
      sessionAccuracy = 0;
    } else if (totalSent < 3) {
      // Engagement Guard: Under 3 messages gets 0% accuracy
      sessionAccuracy = 0;
    } else {
      // Weighted Accuracy Formula: Clean=100%, Corrected=65%
      sessionAccuracy = Math.round(((cleanCount * 100) + (correctionCount * 65)) / totalSent);
    }

    if (capturedSession?.type === 'bot') {
      // Store session history to Firestore
      const sessionData = {
        simId: capturedSession.id,
        simName: capturedSession.opponent?.name || 'Simulation',
        opponentAvatar: capturedSession.opponent?.avatar || '🤖',
        points: sessionPoints,
        accuracy: sessionAccuracy,
        messagesCount: totalSent,
        correctionsCount: correctionCount,
        timestamp: serverTimestamp(),
        lastMessage: myMessages[myMessages.length - 1]?.text || ''
      };

      try {
        // Add to sessions subcollection
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        await addDoc(sessionsRef, sessionData);
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

        const newTotalSessions = prev.sessions + 1;
        const newTotalPoints = prev.points + sessionPoints;
        const newAvgScore = Math.round(((prev.avgScore || 0) * prev.sessions + sessionAccuracy) / newTotalSessions);
        const newLevel = newTotalPoints >= 1000 ? 'Master' : newTotalPoints >= 500 ? 'Expert' : newTotalPoints >= 200 ? 'Advanced' : newTotalPoints >= 50 ? 'Intermediate' : 'Rookie';

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

      // Show session summary modal
      setShowSessionSummary({
        simName: capturedSession.opponent?.name || 'Session',
        points: sessionPoints,
        accuracy: sessionAccuracy,
        messagesCount: totalSent,
        correctionsCount: correctionCount
      });
      setView('dashboard'); setActiveSession(null);

    } else {
      setView('analyzing');
      try {
        const myMsgs = myMessages.map(m => m.text);
        const oppMsgs = capturedMessages.filter(m => m.sender === 'opponent').map(m => m.text);
        console.log('[ANALYZE DEBUG] Sending:', { roomId: capturedSession.id, analyzedBy: user.uid, myMsgs, oppMsgs });
        const token = await user.getIdToken();
        const res = await fetch(`${BACKEND_URL}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ type: 'analyze', roomId: capturedSession.id, analyzedBy: user.uid, player1History: myMsgs, player2History: oppMsgs }) });
        const data = await res.json();
        setDualAnalysis(data);
        const myScore = data?.player1?.total || 70;

        // Store competitive session
        try {
          // Determine win correctly based on perspective (same logic as WinnerReveal)
          const analyzedBy = data?.analyzedBy;
          const amIPlayer1 = !analyzedBy || analyzedBy === user.uid;
          const myData = amIPlayer1 ? data?.player1 : data?.player2;
          const oppData = amIPlayer1 ? data?.player2 : data?.player1;
          const didIWin = amIPlayer1 ? (data?.winner === 'player1') : (data?.winner === 'player2');

          const sessionsRef = collection(db, 'users', user.uid, 'sessions');
          await addDoc(sessionsRef, {
            type: '1v1',
            score: myData?.total || 0,
            opponentName: capturedSession.opponent?.name || 'Opponent',
            opponentAvatar: capturedSession.opponent?.avatar || '👤',
            won: didIWin,
            timestamp: serverTimestamp()
          });
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

          const newTotalSessions = prev.sessions + 1;
          const newAvgScore = Math.round((prev.avgScore * prev.sessions + myScore) / newTotalSessions);
          const n = {
            ...prev,
            sessions: newTotalSessions,
            points: prev.points + myScore,
            avgScore: newAvgScore,
            streak: newStreak,
            lastPracticeDate: todayStr
          };
          setTimeout(() => saveUserData(n, null), 10);
          return n;
        });
        setShowWinnerReveal(true);
        setView('dashboard');
      } catch (e) { setView('dashboard'); }
      setActiveSession(null);
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
        {/* HEADER */}
        <header className="px-4 py-3 flex justify-between items-center border-b border-gray-100 bg-white sticky top-0 z-20">
          <button onClick={() => setShowMenu(true)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            <Menu size={22} />
          </button>
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
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl hover:ring-2 hover:ring-emerald-200 transition-all">
            {userAvatar}
          </button>
        </header>

        <main className="p-4 space-y-4">
          {/* Quick Stats Bar */}
          <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-3">
            <button onClick={() => setShowStatInfo('streak')} className="flex items-center gap-2 hover:bg-white/50 rounded-xl px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Zap className="text-orange-500" size={16} />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Streak</div>
                <div className="text-sm font-black text-gray-900">
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
              </div>
            </button>
            <div className="w-px h-8 bg-gray-200"></div>
            <button onClick={() => setShowStatInfo('points')} className="flex items-center gap-2 hover:bg-white/50 rounded-xl px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="text-purple-500" size={16} />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Points</div>
                <div className="text-sm font-black text-gray-900">{stats.points || 0}</div>
              </div>
            </button>
            <div className="w-px h-8 bg-gray-200"></div>
            <button onClick={() => setShowStatInfo('avgScore')} className="flex items-center gap-2 hover:bg-white/50 rounded-xl px-3 py-2 transition-colors">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Target className="text-emerald-500" size={16} />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Accuracy</div>
                <div className="text-sm font-black text-emerald-600">{stats.avgScore || 0}%</div>
              </div>
            </button>
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
              <div className="text-xs text-gray-500">Level: <span className="text-emerald-600 font-semibold">{stats.level}</span></div>
            </div>
            <button onClick={() => setShowStatInfo('level')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold hover:bg-emerald-200 transition-colors">
              View Stats
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
                      {/* Live Indicator - Blinking */}
                      <div className="absolute top-2 right-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                      </div>

                      {/* Avatar */}
                      <div className="text-2xl mb-1">{liveUser.avatar || '👤'}</div>

                      {/* Name */}
                      <div className="font-bold text-gray-800 text-xs truncate">{liveUser.name}</div>

                      {/* Level */}
                      <div className="text-[9px] text-emerald-600 font-semibold uppercase">{liveUser.level}</div>
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

                        {/* Avatar */}
                        <div className="text-2xl mb-1">
                          {isBattle && chat.opponentAvatar ? chat.opponentAvatar : (sim?.icon ? '🤖' : '👤')}
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
                <div className="p-6 flex flex-col flex-1 min-h-0">
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
                      <div className="text-xs text-emerald-600 font-medium">{stats.level}</div>
                    </div>
                    <div className="text-gray-400">›</div>
                  </button>

                  {/* Quick Practice Section */}
                  <div className="mb-4">
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 px-2">Quick Practice</div>
                    <div className="space-y-1">
                      {SIMULATIONS.slice(0, 4).map(sim => (
                        <button
                          key={sim.id}
                          onClick={() => { setShowMenu(false); startSimulation(sim); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors group"
                        >
                          <div className={`w - 8 h - 8 ${sim.color} rounded - lg flex items - center justify - center text - white shadow - sm group - hover: scale - 110 transition - transform`}>
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

                  {/* Menu Items */}
                  <nav className="space-y-1">
                    <button onClick={() => { setShowMenu(false); setShowProfile(true); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                      <User size={20} />
                      <span className="font-medium">Profile & Avatar</span>
                    </button>
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
        <AnimatePresence>
          {showWinnerReveal && (
            <WinnerReveal
              dualAnalysis={dualAnalysis}
              myUserId={user.uid}
              opponentData={activeSession?.opponent}
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
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRoomInput && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-sm p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => { setShowRoomInput(false); setRoomCode(""); setRoomCodeInput(""); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>
                <h3 className="text-2xl font-black mb-6 text-center">Play with Friend</h3>
                {roomCode ? (
                  <div className="text-center space-y-4">
                    <div className="text-6xl font-mono font-black text-emerald-600 bg-emerald-50 py-6 rounded-2xl">{roomCode}</div>
                    <p className="text-gray-500">Share this code with your friend!</p>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on Fluency Pro! Code: ${roomCode}`)}`)} className="w-full py-4 bg-green-500 text-white font-bold rounded-2xl">Share on WhatsApp</button>
                  </div >
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
                <h3 className="text-2xl font-black mb-6 text-center">Choose Avatar</h3>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {AVATARS.map(av => (
                    <button key={av} onClick={() => selectAvatar(av)} className={`text-4xl p-3 rounded-xl hover:bg-gray-100 transition-colors ${userAvatar === av ? 'bg-emerald-100 ring-2 ring-emerald-500' : ''}`}>{av}</button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-6">
                  <button
                    onClick={() => { setShowProfile(false); signOut(auth); }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-colors"
                  >
                    <LogOut size={20} />
                    Sign Out
                  </button>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStatInfo(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-2xl p-6 max-w-xs text-center" onClick={e => e.stopPropagation()}>
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
                className="bg-white rounded-3xl w-full max-w-sm p-6 text-center my-auto max-h-[90vh] overflow-y-auto shadow-2xl"
              >
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

                {/* Areas to Work On */}
                {showSessionSummary.correctionsCount > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4 text-left">
                    <div className="text-xs text-amber-600 font-bold uppercase mb-2">📝 Areas to improve:</div>
                    <ul className="text-sm text-amber-800 space-y-1">
                      <li>• Focus on subject-verb agreement</li>
                      <li>• Practice article usage (a, an, the)</li>
                      {showSessionSummary.correctionsCount >= 2 && <li>• Review sentence structure patterns</li>}
                    </ul>
                  </div>
                )}

                {/* Encouragement Message */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-4">
                  <div className="text-sm text-indigo-800">
                    {showSessionSummary.accuracy >= 80
                      ? "🔥 You're on fire! Your English skills are impressive. Keep up the great work!"
                      : showSessionSummary.accuracy >= 50
                        ? "👏 Great effort! You're making steady progress. Practice makes perfect!"
                        : "💪 Every expert was once a beginner. Keep practicing and you'll see amazing improvement!"}
                  </div>
                </div>

                {/* Motivation - Compare with peers */}
                <div className="bg-teal-50 border border-teal-100 rounded-2xl p-3 mb-6 text-left">
                  <div className="flex items-center gap-2 text-teal-700 text-sm">
                    <Users size={16} />
                    <span><strong>4,200+ learners</strong> at your level practice daily. You're not alone! 🌍</span>
                  </div>
                </div>

                {/* Contextual Feedback Section */}
                <div className="mt-8 pt-6 border-t border-gray-100 text-left">
                  <div className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest">How was this session?</div>
                  {feedbackSubmitted ? (
                    <div className="bg-emerald-50 text-emerald-700 rounded-2xl p-4 text-center text-sm font-bold flex items-center justify-center gap-2">
                      <Sparkles size={16} /> Thank you for the feedback!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => setFeedbackRating(star)}
                            className={`text-2xl transition-all ${feedbackRating >= star ? 'text-amber-400 scale-110' : 'text-gray-200'}`}
                          >
                            ⭐
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Any comments on the AI or match quality?"
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:border-emerald-400 focus:outline-none h-20 resize-none"
                      />
                      {feedbackRating > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await addDoc(collection(db, 'feedback'), {
                                userId: user.uid,
                                rating: feedbackRating,
                                text: feedbackText,
                                sessionId: feedbackSessionId,
                                simId: showSessionSummary.simId || null,
                                simName: showSessionSummary.simName,
                                timestamp: serverTimestamp()
                              });
                              setFeedbackSubmitted(true);
                            } catch (e) { console.error(e); }
                          }}
                          className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors"
                        >
                          Send Feedback
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowSessionSummary(null)}
                  className="w-full py-4 mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-200 uppercase tracking-widest text-sm"
                >
                  Continue Practicing 🚀
                </button>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Achievements Modal */}
        <AnimatePresence>
          {showAchievements && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowAchievements(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>

                <h3 className="text-2xl font-black text-gray-900 mb-6 text-center">🏆 Achievements</h3>

                <div className="space-y-4 mb-6">
                  <div className={`p-4 rounded-2xl ${stats.sessions >= 1 ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 border-2 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{stats.sessions >= 1 ? '🌟' : '🔒'}</span>
                      <div>
                        <div className="font-bold text-gray-900">First Steps</div>
                        <div className="text-xs text-gray-500">Complete your first session</div>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl ${stats.sessions >= 10 ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 border-2 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{stats.sessions >= 10 ? '🔥' : '🔒'}</span>
                      <div>
                        <div className="font-bold text-gray-900">On Fire</div>
                        <div className="text-xs text-gray-500">Complete 10 sessions</div>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl ${stats.points >= 100 ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 border-2 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{stats.points >= 100 ? '💯' : '🔒'}</span>
                      <div>
                        <div className="font-bold text-gray-900">Century Club</div>
                        <div className="text-xs text-gray-500">Earn 100 points</div>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-2xl ${stats.avgScore >= 90 ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-gray-50 border-2 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{stats.avgScore >= 90 ? '🎯' : '🔒'}</span>
                      <div>
                        <div className="font-bold text-gray-900">Perfect Speaker</div>
                        <div className="text-xs text-gray-500">Maintain 90%+ accuracy</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-gray-400 text-sm">
                  More achievements coming soon! 🚀
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        <AnimatePresence>
          {showHelp && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => { setShowHelp(false); setHelpFeedbackSubmitted(false); setHelpFeedbackText(''); setHelpFeedbackRating(0); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>

                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
                    <MessageCircle className="text-white" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900">Fluency Pro</h3>
                  <p className="text-gray-500 text-sm">Version 1.1.0</p>
                </div>

                {/* About */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 mb-4 text-left">
                  <h4 className="font-bold text-emerald-800 mb-2">🇮🇳 Made in India</h4>
                  <p className="text-emerald-700 text-sm leading-relaxed">
                    Built by a passionate solo developer to help millions of Indians improve their spoken English through AI-powered practice sessions.
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Sparkles size={16} className="text-amber-500" /> Real-time grammar feedback
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Users size={16} className="text-indigo-500" /> Battle mode matching global players
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Target size={16} className="text-emerald-500" /> Scenario-based simulations
                  </div>
                </div>

                {/* Feedback Form */}
                <div className="border-t pt-6 text-left">
                  <h4 className="font-bold text-gray-900 mb-3 uppercase text-xs tracking-widest text-gray-400">💬 Share Your Experience</h4>
                  {helpFeedbackSubmitted ? (
                    <div className="bg-emerald-50 text-emerald-700 rounded-2xl p-4 text-center font-bold">
                      <div className="text-2xl mb-2">🎉</div>
                      We've received your feedback!
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
                        placeholder="What can we improve? (Found a bug? Match issues?)"
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white rounded-3xl w-full max-w-md p-6 relative my-auto max-h-[90vh] overflow-y-auto">
                <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 z-10"><X size={24} /></button>

                <h3 className="text-2xl font-black text-gray-900 mb-6 text-center">Settings</h3>

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
                    <option>Hindi</option>
                    <option>Tamil</option>
                    <option>Telugu</option>
                    <option>Bengali</option>
                    <option>Marathi</option>
                    <option>Kannada</option>
                    <option>Malayalam</option>
                    <option>Punjabi</option>
                    <option>Gujarati</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Session Reminders */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-6">
                  <div>
                    <div className="font-semibold text-gray-900">Daily Reminders</div>
                    <div className="text-xs text-gray-500">Get notified to practice</div>
                  </div>
                  <button
                    className="w-14 h-8 rounded-full bg-emerald-500 relative cursor-not-allowed opacity-50"
                    title="Coming soon"
                  >
                    <div className="w-6 h-6 bg-white rounded-full absolute top-1 translate-x-7" />
                  </button>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  More settings coming soon! 🚀
                </p>
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
        <header className="px-6 py-4 flex items-center gap-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => setView('dashboard')} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
          <h1 className="text-xl font-black text-gray-900">Simulation Lab</h1>
        </header>
        <main className="p-6">
          <p className="text-gray-500 mb-6">Choose a real-life scenario to practice your English conversation skills.</p>
          <div className="grid grid-cols-2 gap-4">
            {SIMULATIONS.map(sim => (
              <button key={sim.id} onClick={() => startSimulation(sim)} className="bg-white border-2 border-gray-100 rounded-2xl p-5 text-left hover:border-emerald-500 hover:shadow-lg transition-all group">
                <div className={`w-12 h-12 ${sim.color} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}><sim.icon size={24} /></div>
                <div className="font-bold text-gray-900">{sim.title}</div>
                <div className="text-xs text-gray-400 mt-1">{sim.desc}</div>
              </button>
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
        {/* Fixed Header */}
        <header className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">{activeSession?.opponent?.avatar || '👤'}</div>
            <div>
              <div className="font-bold text-gray-900">{activeSession?.opponent?.name}</div>
              <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Sparkles size={12} /> +{sessionPoints} pts
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {timerActive && (
              <div className="text-xs text-red-500 font-bold flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-full">
                <Clock size={12} /> {formatTime(timeRemaining)}
              </div>
            )}
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

        {/* Scrollable Messages */}
        <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => {
            // Visibility Filter: 
            // - Show if sender is 'me', 'system', or 'correction'
            // - Show if sender is 'opponent' AND has finished typing (exists in visibleMessageIds)
            const isVisible = m.sender !== 'opponent' || visibleMessageIds.has(m.id);
            if (!isVisible) return null;
            return (
              <div key={i} className={`flex ${m.sender === 'me' ? 'justify-end' : m.sender === 'system' ? 'justify-center' : m.sender === 'correction' ? 'justify-center' : 'justify-start'}`}>
                {m.sender === 'system' ? (
                  <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 px-3 py-1 rounded-full">{m.text}</span>
                ) : m.sender === 'correction' ? (
                  // Check if this correction is minimized
                  minimizedCorrections[m.id] ? (
                    // Minimized compact pill with RED indicator - clickable to expand
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setMinimizedCorrections(prev => ({ ...prev, [m.id]: false }))}
                      className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-full px-4 py-2 shadow-md hover:shadow-lg transition-all cursor-pointer group blinking-alert"
                    >
                      <div className="relative">
                        <AlertTriangle size={16} className="text-red-500" />
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      </div>
                      <span className="text-red-700 font-bold text-sm">Mistake Found</span>
                      <span className="text-red-500 text-xs">tap to view</span>
                      <ChevronDown size={14} className="text-red-500 group-hover:translate-y-0.5 transition-transform" />
                    </motion.button>
                  ) : (
                    // Full expanded correction card
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="w-full max-w-md bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 border-2 border-red-200 rounded-2xl p-4 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center shadow-md">
                            <AlertTriangle size={20} className="text-white" />
                          </div>
                          <div>
                            <div className="font-black text-red-700 text-base">Your Mistake</div>
                            <div className="text-[10px] text-red-500 uppercase font-bold tracking-wide">{m.correction?.type || 'Needs Improvement'}</div>
                          </div>
                        </div>
                        {/* Minimize button */}
                        <button
                          onClick={() => setMinimizedCorrections(prev => ({ ...prev, [m.id]: true }))}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Minimize"
                        >
                          <ChevronUp size={18} />
                        </button>
                      </div>

                      <div className="space-y-3 text-sm">
                        {/* What you said - with strikethrough */}
                        <div className="bg-red-100/80 border border-red-200 rounded-xl p-3">
                          <div className="text-[10px] text-red-600 font-black uppercase mb-1 tracking-wide flex items-center gap-1">
                            <X size={12} /> What you said:
                          </div>
                          <div className="text-red-800 line-through font-medium">{m.originalText}</div>
                        </div>

                        {/* Correct way - highlighted */}
                        <div className="bg-emerald-100/80 border border-emerald-300 rounded-xl p-3">
                          <div className="text-[10px] text-emerald-700 font-black uppercase mb-1 tracking-wide flex items-center gap-1">
                            ✓ Correct way:
                          </div>
                          <div className="text-emerald-800 font-bold text-base">{m.correction?.corrected}</div>
                        </div>

                        {/* Explanation */}
                        <div className="bg-white/80 border border-gray-200 rounded-xl p-3">
                          <div className="text-[10px] text-gray-600 font-black uppercase mb-1 tracking-wide">💡 Why this matters:</div>
                          <div className="text-gray-800">{m.correction?.reason}</div>
                          {m.correction?.example && (
                            <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2 text-blue-700 text-xs">
                              <span className="font-semibold">Example:</span> "{m.correction.example}"
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Detailed Explanation Button */}
                      <button
                        onClick={() => getDetailedExplanation(m.correction)}
                        className="mt-4 w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                      >
                        <MessageCircle size={16} /> Learn More from Professor
                      </button>
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
                    // Opponent message with simulation emoji
                    <div className="flex items-end gap-2 max-w-[85%]">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0 mb-1">
                        {activeSession?.opponent?.avatar || '🤖'}
                      </div>
                      <div className="px-4 py-3 rounded-2xl text-sm bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm">
                        {m.text}
                      </div>
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

        {/* Fixed Input */}
        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-full border border-gray-100">
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
              onBlur={() => {
                if (activeSession?.type === 'human') handleTyping(false);
              }}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
            {/* Voice Input Button with Enhanced Styling */}
            <div className="relative">
              <button
                onClick={toggleVoiceInput}
                className={`p-2.5 rounded-full transition-all duration-300 ${isListening
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
            {/* Speaker Toggle Button */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={`p-2.5 rounded-full transition-all duration-200 ${isSpeakerOn
                ? 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              title={isSpeakerOn ? 'Turn off voice replies' : 'Turn on voice replies'}
            >
              {isSpeakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={sendMessage} disabled={!inputText.trim() || (activeSession?.type === 'bot' && isOpponentTyping)} className="p-2.5 bg-emerald-600 text-white rounded-full disabled:opacity-50 disabled:bg-gray-300">
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

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, query, where, getDocs, getDoc, setDoc, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import {
  Send, Menu, X, CheckCircle, Zap, Swords, Trophy, Briefcase, Coffee, Stethoscope,
  Train, Plane, GraduationCap, Loader2, LayoutDashboard, LogOut, User, Settings, Award, MessageCircle, BookOpen, Target,
  Users, Hash, Play, Info, Check, CheckCheck, Bell, Sparkles, Heart, HelpCircle, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import WinnerReveal from './WinnerReveal';

// --- CONFIGURATION ---
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// --- INIT FIREBASE ---
let auth, db;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase config error:", e);
}

// --- CONSTANTS ---
const PERSONAS = [
  { id: 'arjun_ind', name: 'Arjun', flag: '👔', role: 'Global Recruiter' },
  { id: 'priya_ind', name: 'Priya', flag: '💼', role: 'Station Superintendent' },
  { id: 'rahul_ind', name: 'Rahul', flag: '🎓', role: 'Senior Mentor' },
];

const AVATARS = ['🦁', '🦊', '🐼', '🐯', '🐧', '🦉', '🦋', '🐘', '🤖', '🚀', '⭐', '🔥'];

const SIMULATIONS = [
  {
    id: 'sim_train', cat: 'Travel', title: 'Train Station', icon: Train, desc: 'Buy tickets & find platform.',
    stages: ['At the Ticket Counter', 'On the Platform', 'Inside the Train'],
    greeting: "Hello. Ticket for which train do you want? 🚉"
  },
  {
    id: 'sim_airport', cat: 'Travel', title: 'Airport Security', icon: Plane, desc: 'Handle security checks.',
    stages: ['At the Check-in Desk', 'Security Checkpoint', 'At the Boarding Gate'],
    greeting: "Passport and ticket, please. Keep your bags open. 🛂"
  },
  {
    id: 'sim_interview', cat: 'Career', title: 'Job Interview', icon: Briefcase, desc: 'Sell your skills.',
    stages: ['Reception Desk', 'Interview Room', 'Post-Interview Exit'],
    greeting: "Welcome. Why should we hire you for this Indian firm? 💼"
  },
  {
    id: 'sim_doctor', cat: 'Health', title: 'Doctor Visit', icon: Stethoscope, desc: 'Describe symptoms.',
    stages: ['Waiting Room', 'Consultation Room', 'Pharmacy Desk'],
    greeting: "Yes, come in. What problems are you facing today? 🏥"
  },
  {
    id: 'sim_cafe', cat: 'Social', title: 'Coffee Shop', icon: Coffee, desc: 'Order intricate drinks.',
    stages: ['At the Counter', 'Seated Area', 'Leaving the Cafe'],
    greeting: "Hi there! Which coffee can I get you today? ☕"
  },
];

const App = () => {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true); // START WITH LOADING
  const [view, setView] = useState('landing');
  const [appMode, setAppMode] = useState('practice'); // 'practice' or 'compete'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [matchStatus, setMatchStatus] = useState('idle');
  const [analysis, setAnalysis] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [stats, setStats] = useState({ streak: 0, points: 0, level: 'Newbie', sessions: 0 });
  const [roomCode, setRoomCode] = useState("");
  const [roomId, setRoomId] = useState(""); // FIX: Add missing state
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [userAvatar, setUserAvatar] = useState('🦁');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [currentStage, setCurrentStage] = useState("");
  const [dualAnalysis, setDualAnalysis] = useState(null);
  const [showWinnerReveal, setShowWinnerReveal] = useState(false);

  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(420); // 7 minutes = 420 seconds
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  // Random matchmaking states
  const [isSearchingRandom, setIsSearchingRandom] = useState(false);
  const [randomRoomId, setRandomRoomId] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [sessionTopic, setSessionTopic] = useState(null);
  const randomSearchListener = useRef(null);

  const scrollRef = useRef(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const matchListener = useRef(null);
  const chatListener = useRef(null);

  useEffect(() => {
    if (auth) {
      // FORCE PERSISTENCE
      setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence error:", e));

      const unsub = onAuthStateChanged(auth, (u) => {
        // 1. INSTANT ACCESS (Don't wait for DB)
        setUser(u);
        setIsAuthChecking(false);

        if (u) {
          // If logged in, ensure we are not on landing
          setView(v => v === 'landing' ? 'dashboard' : v);
        } else {
          setUser(null);
          setView('landing');
        }
      });
      return () => unsub();
    } else {
      setIsAuthChecking(false);
    }
  }, []);

  // 2. BACKGROUND DATA FETCH (Non-blocking)
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStats(data.stats || { streak: 0, points: 0, level: 'Newbie', sessions: 0 });
          if (data.userAvatar) setUserAvatar(data.userAvatar);
        } else {
          const initialStats = { streak: 0, points: 0, level: 'Newbie', sessions: 0 };
          await setDoc(doc(db, 'users', user.uid), { uid: user.uid, stats: initialStats, userAvatar: '🦁', lastSession: null });
        }
      } catch (err) { console.error("Background data fetch error:", err); }
    };
    fetchUserData();
  }, [user]);

  const saveStatsToFirestore = async (newStats) => {
    if (!user) return;
    try {
      const today = new Date().toDateString();
      await setDoc(doc(db, 'users', user.uid), {
        stats: newStats,
        userAvatar,
        lastSession: today
      }, { merge: true });
    } catch (e) { console.error("Save error", e); }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && !e.target.closest('.sidebar-panel') && !e.target.closest('.menu-btn')) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  // TIMER COUNTDOWN EFFECT
  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer ended - auto-end session
            clearInterval(timerRef.current);
            setTimerActive(false);
            if (activeSession?.type === 'human') {
              endSession();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [timerActive]);

  // Format timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playPop = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
      audio.volume = 0.4;
      audio.play();
    } catch (e) { }
  };

  // RANDOM MATCHMAKING
  const findRandomMatch = async () => {
    if (isSearchingRandom) return;
    setIsSearchingRandom(true);
    setMatchStatus('searching');

    try {
      const response = await fetch(`${BACKEND_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'find_random_match',
          userId: user.uid,
          userName: user.displayName || 'Player',
          userAvatar: userAvatar
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.matched) {
          // Matched instantly!
          setMyRole({ role: data.myRole, icon: data.myIcon, desc: data.myDesc });
          setSessionTopic(data.topic);
          startRealChat(data.roomId, {
            id: data.opponent.id,
            name: data.opponent.name,
            avatar: data.opponent.avatar,
            flag: '🎲',
            creatorId: data.opponent.id
          });
          setTimeRemaining(420);
          setTimerActive(true);
        } else {
          // Waiting for match - set up listener
          setRandomRoomId(data.roomId);
          setMatchStatus('waiting');

          randomSearchListener.current = onSnapshot(doc(db, 'queue', data.roomId), (docSnap) => {
            if (docSnap.exists()) {
              const roomData = docSnap.data();
              if (roomData.status === 'matched') {
                const roleData = roomData.roleData;
                const amIHost = roomData.hostId === user.uid;

                setMyRole({
                  role: amIHost ? roleData.player1Role : roleData.player2Role,
                  icon: amIHost ? roleData.player1Icon : roleData.player2Icon,
                  desc: amIHost ? roleData.player1Desc : roleData.player2Desc
                });
                setSessionTopic(roleData.topic);

                startRealChat(data.roomId, {
                  id: amIHost ? roomData.player2Id : roomData.hostId,
                  name: amIHost ? roomData.player2Name : roomData.userName,
                  avatar: amIHost ? roomData.player2Avatar : roomData.userAvatar,
                  flag: '🎲',
                  creatorId: roomData.hostId
                });
                setTimeRemaining(420);
                setTimerActive(true);
                setIsSearchingRandom(false);
                if (randomSearchListener.current) randomSearchListener.current();
              }
            }
          });
        }
      } else {
        alert(data.error || 'Failed to find match');
        setMatchStatus('idle');
      }
    } catch (err) {
      console.error('Random match error:', err);
      alert('Network error: ' + err.message);
      setMatchStatus('idle');
    }
    setIsSearchingRandom(false);
  };

  const cancelRandomSearch = async () => {
    if (randomSearchListener.current) randomSearchListener.current();
    if (randomRoomId) {
      try {
        await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cancel_random_search', roomId: randomRoomId })
        });
      } catch (e) { }
    }
    setRandomRoomId(null);
    setIsSearchingRandom(false);
    setMatchStatus('idle');
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Popup login error:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch (redirectError) {
          setAuthError("Login failed. Please try again.");
          setIsLoggingIn(false);
        }
      } else {
        setAuthError(error.message);
        setIsLoggingIn(false);
      }
    }
  };

  const handleGuestLogin = async () => {
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Guest login error:", error);
      setAuthError("Guest login failed: " + error.message);
      setIsLoggingIn(false);
    }
  };

  const shareRoomWhatsApp = () => {
    const text = encodeURIComponent(`Join my AI Practice session on FluencyPro! Room Code: ${roomCode}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const startPrivateMatch = async (code) => {
    if (isJoiningRoom) return; // Prevent double-click
    setIsJoiningRoom(true);
    const cleanCode = code.trim();
    if (!cleanCode) {
      alert("Please enter a room code!");
      setIsJoiningRoom(false);
      return;
    }
    setMatchStatus('searching');
    setView('dashboard');
    try {
      console.log("Requesting Backend Join for:", cleanCode);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'join_room',
          roomCode: cleanCode,
          userId: user.uid,
          userName: user.displayName || 'Friend',
          userAvatar: user.photoURL
        })
      });

      const data = await response.json();

      if (data.success) {
        startRealChat(data.roomId, {
          id: data.opponent.id,
          name: data.opponent.name,
          avatar: data.opponent.avatar,
          flag: '🤝',
          creatorId: data.opponent.id // The opponent is the creator (host)
        });
      } else {
        alert(data.error || "Room join failed.");
        setMatchStatus('idle');
      }
    } catch (err) {
      console.error("Join Room Error:", err);
      alert("Network Error: " + err.message);
      setMatchStatus('idle');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const createPrivateRoom = async () => {
    if (isCreatingRoom) return; // Prevent double-click
    setIsCreatingRoom(true);
    setMatchStatus('waiting');
    setView('dashboard');
    try {
      console.log("Creating Room via Backend...");
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_room',
          userId: user.uid,
          userName: user.displayName || 'Host',
          userAvatar: user.photoURL
        })
      });

      const data = await response.json();

      if (data.success) {
        setRoomCode(data.roomCode);
        setShowRoomInput(true); // Keep this for UI visibility
        setRoomId(data.roomId); // Track            
        // Listen for match (player 2 joining)
        const unsubscribe = onSnapshot(doc(db, 'queue', data.roomId), (docSnap) => {
          if (docSnap.exists()) {
            const roomData = docSnap.data();

            // Detect match - session end is handled in startRealChat
            if (roomData.status === 'matched') {
              unsubscribe(); // Stop listening for match once matched
              startRealChat(data.roomId, {
                id: roomData.player2Id,
                name: roomData.player2Name,
                avatar: roomData.player2Avatar,
                flag: '🤝',
                creatorId: user.uid // Pass creator ID for determining player1 vs player2
              });
            }
          }
        });
      } else {
        alert("Error creating room: " + data.error);
        setMatchStatus('idle');
      }
    } catch (err) {
      console.error("Create Room API Error:", err);
      alert("Network Error: " + err.message);
      setMatchStatus('idle');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const startBotMatch = (sim = null) => {
    const opponent = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    const topic = sim ? `${sim.title}: ${sim.desc}` : 'Should remote work be mandatory?';
    const initialStage = sim?.stages?.[0] || "Global Context";

    // FIX: Use sim?.id as the session ID prefix so we can find the simulation data later
    setActiveSession({ type: 'bot', id: sim ? sim.id : 'bot_' + Date.now(), opponent, topic });
    setCurrentStage(initialStage);
    setMessages([{ id: 'sys_1', sender: 'system', text: `Session started. Stage: ${initialStage}` }]);
    setMatchStatus('connected');
    setView('chat');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      playPop();
      const greeting = sim?.greeting || `Hi! I'm ${opponent.name}. Ready to debate? 🥊`;
      setMessages(prev => [...prev, { id: 'bot_hello', sender: 'opponent', text: greeting }]);
    }, 1500);
  };

  const startRealChat = (matchId, opponent) => {
    if (matchListener.current) matchListener.current();
    setActiveSession({ type: 'human', id: matchId, opponent, topic: 'Open Chat' });
    setMatchStatus('connected');
    setView('chat');
    setMessages([{ id: 'sys_start', sender: 'system', text: `Connected with ${opponent.name}! Say hi.` }]);

    // Listen for messages
    const msgsRef = collection(db, 'queue', matchId, 'messages');
    const q = query(msgsRef, orderBy('createdAt'));
    chatListener.current = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        msgs.push({ id: doc.id, sender: data.senderId === user.uid ? 'me' : 'opponent', text: data.text });
      });
      setMessages(prev => [...prev.filter(m => m.sender === 'system'), ...msgs]);
    });

    // Listen for session end (so BOTH players get notified)
    matchListener.current = onSnapshot(doc(db, 'queue', matchId), (docSnap) => {
      if (docSnap.exists()) {
        const roomData = docSnap.data();
        // If session ended by the OTHER player, trigger analysis for this player too
        if (roomData.status === 'ended' && roomData.endedBy !== user.uid) {
          console.log('Partner ended session, triggering analysis...');
          // Clean up listeners
          if (chatListener.current) chatListener.current();
          if (matchListener.current) matchListener.current();
          // Trigger analysis (uses current messages state)
          handleDualAnalysis(matchId);
        }
      }
    });
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeSession) return;
    const text = inputText;
    setInputText("");

    if (activeSession.type === 'bot') {
      const userMsg = { id: Date.now(), sender: 'me', text };
      setMessages(prev => [...prev, userMsg]);
      playPop();
      setIsTyping(true);
      try {
        const history = messages.filter(m => m.sender !== 'system');
        const response = await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, personaId: activeSession.opponent.id, history, stage: currentStage })
        });
        const data = await response.json();

        // Auto-progress stage after 4 messages
        const userMsgCount = messages.filter(m => m.sender === 'me').length + 1;
        const currentSim = SIMULATIONS.find(s => s.id === activeSession.id);
        if (currentSim && currentSim.stages.length > 1) {
          const stageIndex = Math.floor(userMsgCount / 4); // Change stage every 4 messages
          if (stageIndex < currentSim.stages.length) {
            setCurrentStage(currentSim.stages[stageIndex]);
          }
        }

        setTimeout(() => {
          setIsTyping(false);
          playPop();
          setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'opponent', text: data.reply || "I'm sorry, I couldn't process that. Can you try again?" }]);
        }, 1000);
      } catch (e) {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'opponent', text: "Connection error. Please check your internet and try again." }]);
      }
    } else {
      // HUMAN CHAT: Send via backend
      try {
        await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'send_message',
            roomId: activeSession.id,
            text: text,
            senderId: user.uid
          })
        });
        playPop();
      } catch (err) {
        console.error("Message send error:", err);
        alert("Failed to send message: " + err.message);
      }
    }
  };

  const handleDualAnalysis = async (roomId) => {
    try {
      // Stop timer
      setTimerActive(false);
      if (timerRef.current) clearInterval(timerRef.current);

      // Get both players' messages from active session
      const myMessages = messages.filter(m => m.sender === 'me').map(m => m.text);
      const oppMessages = messages.filter(m => m.sender === 'opponent').map(m => m.text);

      const res = await fetch(`${BACKEND_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze',
          player1History: myMessages,
          player2History: oppMessages
        })
      });
      const data = await res.json();
      setDualAnalysis(data);
      setShowWinnerReveal(true);
      setMatchStatus('idle');
      setView('dashboard');

      // UPDATE STREAK FOR COMPETE MODE
      const today = new Date().toDateString();
      const myScore = data?.player1?.overall || data?.player2?.overall || 70;
      setStats(prev => {
        const isNewDay = prev.lastSessionDate !== today;
        const newStats = {
          ...prev,
          sessions: prev.sessions + 1,
          points: prev.points + myScore,
          streak: isNewDay ? prev.streak + 1 : prev.streak,
          lastSessionDate: today
        };
        saveStatsToFirestore(newStats);
        return newStats;
      });
    } catch (err) {
      console.error('Dual analysis error:', err);
      // Provide fallback analysis
      const fallback = {
        player1: { vocabulary: 65, grammar: 68, fluency: 70, sentence_making: 65, overall: 67, feedback: "Good conversation! Keep practicing." },
        player2: { vocabulary: 62, grammar: 70, fluency: 68, sentence_making: 63, overall: 66, feedback: "Nice effort! Practice more." }
      };
      setDualAnalysis(fallback);
      setShowWinnerReveal(true);
      setView('dashboard');
    }
  };

  const endSession = async () => {
    if (activeSession?.type === 'bot') {
      const currentHistory = messages.map(m => m.text);
      setView('analysis');
      setAnalysis(null);
      try {
        const res = await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'analyze', history: currentHistory })
        });
        const data = await res.json();
        setAnalysis(data);
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

        // FIX: simplified Streak Logic
        const today = new Date().toDateString();
        setStats(prev => {
          const isNewDay = prev.lastSessionDate !== today;
          const newStats = {
            ...prev,
            sessions: prev.sessions + 1,
            points: prev.points + (data.score || 0),
            streak: isNewDay ? prev.streak + 1 : prev.streak,
            lastSessionDate: today
          };
          saveStatsToFirestore(newStats);
          return newStats;
        });
      } catch (e) {
        setAnalysis({ score: 78, feedback: "Good conversation! Keep practicing to improve your fluency.", corrections: [] });
      }
    } else {
      // HUMAN MATCH: Notify backend + trigger analysis for BOTH players
      try {
        // Mark session as ended in Firestore (so other player gets notified)
        await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'end_session',
            roomId: activeSession.id,
            endedBy: user.uid
          })
        });

        // Clean up listeners
        if (chatListener.current) chatListener.current();
        if (matchListener.current) matchListener.current();

        // Trigger dual analysis for the person who ended
        await handleDualAnalysis(activeSession.id);
      } catch (err) {
        console.error('End session error:', err);
        alert('Failed to end session: ' + err.message);
        // Fallback: just go to dashboard
        if (chatListener.current) chatListener.current();
        if (matchListener.current) matchListener.current();
        setView('dashboard');
        setMatchStatus('idle');
        setActiveSession(null);
      }
    }
  };

  // ==================== GLOBAL LOADING ====================
  if (isAuthChecking) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden relative">
      <div className="text-center z-10 bg-white p-8 rounded-2xl relative">
        <Loader2 size={48} className="animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-900 font-bold text-xl mb-2">FluencyPro</p>
        <p className="text-gray-500 font-medium">Loading your profile...</p>
      </div>

      {/* Marquee Footer */}
      <div className="absolute bottom-10 left-0 w-full bg-emerald-50 py-3 border-y border-emerald-100 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap text-emerald-700 font-medium text-sm flex gap-12 items-center">
          <span>🚀 Gemini 2.5 Flash AI</span>
          <span>💬 Real-time Feedback</span>
          <span>👔 Professional Roleplays</span>
          <span>🌏 Indian Context</span>
          <span>🧠 Smart Analysis</span>
          <span>🔒 Secure Login</span>
          <span>🚀 Gemini 2.5 Flash AI</span>
          <span>💬 Real-time Feedback</span>
          <span>👔 Professional Roleplays</span>
          <span>🌏 Indian Context</span>
          <span>🧠 Smart Analysis</span>
          <span>🔒 Secure Login</span>
        </div>
      </div>
    </div>
  );

  // ==================== LANDING PAGE ====================
  if (view === 'landing') return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 font-sans">
      {/* Header */}
      <header className="px-6 py-5 flex justify-between items-center max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <MessageCircle size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800">Fluency<span className="text-emerald-600">Pro</span></span>
        </div>
        <button onClick={handleGuestLogin} className="px-5 py-2.5 text-sm font-semibold text-emerald-700 border-2 border-emerald-200 rounded-full hover:bg-emerald-50 transition-colors">
          Sign In
        </button>
      </header>

      {/* Hero */}
      <main className="px-6 py-16 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-8">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          4,200+ learners practicing now
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Master English Through<br />
          <span className="text-emerald-600">Real Conversations</span>
        </h1>

        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Practice speaking with AI personas in real-world scenarios. Get instant feedback on grammar, vocabulary, and fluency.
        </p>

        {authError && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm">{authError}</div>}

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white border border-gray-300 text-gray-700 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? <Loader2 className="animate-spin" size={24} /> : <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" />}
            {isLoggingIn ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-400">Or continue as</span>
            </div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={isLoggingIn}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isLoggingIn ? <Loader2 className="animate-spin" size={24} /> : <User size={20} />}
            {isLoggingIn ? "Starting..." : "Guest User"}
          </button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {[
            { icon: MessageCircle, title: 'AI Conversations', desc: 'Chat with intelligent personas' },
            { icon: Target, title: 'Real Scenarios', desc: 'Practice job interviews, travel, & more' },
            { icon: Award, title: 'Instant Feedback', desc: 'Get grammar & fluency scores' }
          ].map((f, i) => (
            <div key={i} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <f.icon size={24} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  // ==================== CHAT VIEW ====================
  if (view === 'chat') return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header - Fixed/Sticky */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center text-xl">
            {activeSession?.opponent?.flag || '🤖'}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{activeSession?.opponent?.name || 'AI Partner'}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">{sessionTopic || activeSession?.topic || 'Practice Session'}</span>
              {myRole && (
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-bold border border-indigo-100">
                  {myRole.icon} {myRole.role}
                </span>
              )}
              {currentStage && (
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-emerald-100">
                  📍 {currentStage}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Timer Display */}
          {timerActive && activeSession?.type === 'human' && (
            <div className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${timeRemaining <= 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'
              }`}>
              ⏱️ {formatTime(timeRemaining)}
            </div>
          )}
          <button onClick={endSession} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
            End Session
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
            {msg.sender === 'system' ? (
              <div className="px-4 py-2 bg-gray-100 text-gray-500 text-xs rounded-full">{msg.text}</div>
            ) : (
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative ${msg.sender === 'me'
                ? 'bg-emerald-600 text-white rounded-br-md'
                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                }`}>
                <div className="whitespace-pre-wrap">
                  {msg.text}
                </div>
                {msg.sender === 'me' && (
                  <div className="absolute -bottom-5 right-0 flex items-center gap-0.5 text-[10px] text-gray-400">
                    <CheckCheck size={12} className="text-emerald-500" />
                    Seen
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
          />
          <button onClick={handleSend} className="px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  // ==================== ANALYSIS VIEW ====================
  if (view === 'analysis') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
      {!analysis ? (
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Analyzing Your Session</h2>
          <p className="text-gray-500">Checking grammar and fluency...</p>
        </div>
      ) : (
        <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Score Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-center text-white">
            <div className="text-6xl font-bold mb-2">{analysis.score}</div>
            <div className="text-emerald-100 text-sm font-medium">Fluency Score</div>
          </div>

          {/* Feedback */}
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Feedback</h3>
              <p className="text-gray-600 leading-relaxed">{analysis.feedback}</p>
            </div>

            {analysis.corrections?.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Suggestions</h3>
                <div className="space-y-3">
                  {analysis.corrections.map((c, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl">
                      <div className="text-red-500 line-through text-sm mb-1">{c.original}</div>
                      <div className="text-emerald-600 font-medium flex items-center gap-2">
                        <CheckCircle size={16} /> {c.corrected}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setView('dashboard'); setAnalysis(null); }} className="w-full py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ==================== DASHBOARD ====================
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

      {/* Sidebar */}
      <aside className={`sidebar-panel fixed md:static inset-y-0 left-0 w-72 md:w-64 bg-white border-r border-gray-200 z-30 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-800">FluencyPro</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Menu</div>
          <button onClick={() => { setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button onClick={() => { setView('profile'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${view === 'profile' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <User size={18} /> Profile
          </button>
          <button onClick={() => { setView('leaderboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${view === 'leaderboard' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Trophy size={18} /> Leaderboard
          </button>

          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-6 mb-2">Practice</div>
          {SIMULATIONS.map(s => (
            <button key={s.id} onClick={() => { startBotMatch(s); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <s.icon size={16} className="text-gray-400" /> {s.title}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-xl cursor-pointer hover:bg-emerald-200 transition-colors" onClick={() => setShowAvatarPicker(true)}>
              {userAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{user?.displayName || 'User'}</div>
              <div className="text-xs text-gray-400">Streak: {stats.streak}🔥</div>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden p-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="menu-btn p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={24} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-900">FluencyPro</span>
          <div className="w-10"></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'profile' ? (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center text-4xl shadow-sm">
                      {userAvatar}
                    </div>
                    <button
                      onClick={() => setShowAvatarPicker(true)}
                      className="absolute -bottom-2 -right-2 p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-500"
                    >
                      <Settings size={14} />
                    </button>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{user?.displayName || 'User'}</h2>
                    <p className="text-gray-500 text-sm">Level: {stats.level}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Sessions', value: stats.sessions, icon: MessageCircle },
                    { label: 'Points', value: stats.points, icon: Award },
                    { label: 'Streak', value: stats.streak, icon: Zap },
                    { label: 'Accuracy', value: '88%', icon: Target }
                  ].map((s, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="text-gray-400 mb-1"><s.icon size={16} /></div>
                      <div className="text-xl font-bold text-gray-900">{s.value}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : view === 'leaderboard' ? (
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h1>
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                {[
                  { rank: 1, name: 'Aarav Sharma', score: 94, badge: '🥇' },
                  { rank: 2, name: 'Ananya Patel', score: 91, badge: '🥈' },
                  { rank: 3, name: 'Vihaan Reddy', score: 88, badge: '🥉' },
                  { rank: 4, name: 'Diya Gupta', score: 85, badge: '' },
                  { rank: 5, name: 'Ishaan Kumar', score: 82, badge: '' },
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <div className="w-8 text-center font-semibold text-gray-400">{p.badge || `#${p.rank}`}</div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-semibold text-gray-600">
                      {p.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                    </div>
                    <div className="text-emerald-600 font-semibold">{p.score} pts</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Mode Toggle */}
              <div className="flex bg-white p-1 rounded-2xl border border-gray-200 w-fit mx-auto shadow-sm">
                <button
                  onClick={() => setAppMode('practice')}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${appMode === 'practice' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Sparkles size={16} /> Free Practice
                </button>
                <button
                  onClick={() => setAppMode('compete')}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${appMode === 'compete' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Swords size={16} /> Compete Mode
                </button>
              </div>

              {appMode === 'practice' ? (
                <>
                  <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-3xl p-8 border border-emerald-200 relative overflow-hidden group">
                    <div className="relative z-10">
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">Master English Daily 🔥</h1>
                      <p className="text-gray-600 mb-6 max-w-lg">Practice with world-class AI personas and keep your {stats.streak} day streak alive!</p>
                      <div className="flex gap-3">
                        <button onClick={() => startBotMatch()} className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-3">
                          <Play size={20} /> Quick Start
                        </button>
                        <button className="px-6 py-3 bg-white/50 text-gray-700 font-semibold rounded-xl hover:bg-white/80 transition-all border border-emerald-200">
                          View Roadmap
                        </button>
                      </div>
                    </div>
                    <div className="absolute right-[-20px] bottom-[-20px] opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <MessageCircle size={200} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Sessions', value: stats.sessions, icon: MessageCircle, color: 'text-blue-500' },
                      { label: 'Avg Score', value: stats.sessions > 0 ? Math.round(stats.points / stats.sessions) : '--', icon: Target, color: 'text-emerald-500' },
                      { label: 'Streak', value: `${stats.streak} days`, icon: Zap, color: 'text-orange-500' },
                      { label: 'Points', value: stats.points, icon: Award, color: 'text-purple-500' }
                    ].map((s, i) => (
                      <div key={i} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-2">
                          <s.icon size={18} className={s.color} />
                          <span className="text-gray-500 text-xs font-semibold uppercase">{s.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      Active Simulations <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full uppercase">Updated</div>
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {SIMULATIONS.map((sim) => (
                        <button key={sim.id} onClick={() => startBotMatch(sim)} className="bg-white p-5 rounded-2xl border border-gray-200 text-left hover:border-emerald-300 hover:shadow-lg transition-all group">
                          <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <sim.icon size={22} className="text-emerald-600" />
                          </div>
                          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">{sim.cat}</div>
                          <h3 className="font-semibold text-gray-900 mb-1">{sim.title}</h3>
                          <p className="text-sm text-gray-500">{sim.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  {/* Random Match Section */}
                  <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                      <h2 className="text-3xl font-bold mb-2">🎲 Random Match</h2>
                      <p className="text-pink-100 mb-4">Get matched with a random player and AI assigns you roles! 7-minute timed challenge.</p>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm">🩺 Doctor-Patient</span>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm">⚖️ Lawyer-Client</span>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm">📚 Teacher-Student</span>
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm">💼 Interviewer-Candidate</span>
                      </div>
                      {matchStatus === 'waiting' && isSearchingRandom ? (
                        <div className="flex gap-3">
                          <div className="px-6 py-3 bg-white/20 text-white font-bold rounded-xl flex items-center gap-3">
                            <Loader2 size={20} className="animate-spin" />
                            Searching for opponent...
                          </div>
                          <button onClick={cancelRandomSearch} className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl border border-white/30 hover:bg-white/20 transition-all">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={findRandomMatch}
                          disabled={isSearchingRandom}
                          className="px-8 py-4 bg-white text-rose-600 font-bold rounded-xl shadow-lg hover:bg-rose-50 transition-all flex items-center gap-3 text-lg"
                        >
                          {isSearchingRandom ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} />}
                          {isSearchingRandom ? 'Finding...' : 'Find Random Match'}
                        </button>
                      )}
                    </div>
                    <div className="absolute right-[-10px] bottom-[-30px] opacity-20 rotate-12">
                      <Users size={180} />
                    </div>
                  </div>

                  {/* Friend Match Section */}
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                      <h2 className="text-3xl font-bold mb-2">👫 Play with Friends</h2>
                      <p className="text-indigo-100 mb-6">Create a room or join with a code. Challenge your friends!</p>
                      <div className="flex flex-wrap gap-4">
                        <button onClick={createPrivateRoom} disabled={isCreatingRoom} className={`px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${isCreatingRoom ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50'}`}>
                          {isCreatingRoom ? <Loader2 size={20} className="animate-spin" /> : <Hash size={20} />}
                          {isCreatingRoom ? 'Creating...' : 'Create Room'}
                        </button>
                        <button onClick={shareRoomWhatsApp} className="px-6 py-3 bg-[#25D366] text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center gap-2">
                          <MessageSquare size={20} /> Share on WhatsApp
                        </button>
                        <button onClick={() => setShowRoomInput(true)} className="px-6 py-3 bg-indigo-400/30 text-white font-bold rounded-xl border border-indigo-300 hover:bg-indigo-400/50 transition-all flex items-center gap-2">
                          <Users size={20} /> Join by ID
                        </button>
                      </div>
                    </div>
                    <div className="absolute right-[-10px] bottom-[-30px] opacity-20 rotate-12">
                      <Swords size={180} />
                    </div>
                  </div>

                  {showRoomInput && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-xl max-w-md mx-auto"
                    >
                      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Settings size={18} /> {roomCode ? "Your Room Code" : "Enter Room Code"}</h3>
                      {roomCode ? (
                        <div className="text-4xl font-mono font-black text-indigo-600 tracking-widest p-4 bg-indigo-50 rounded-xl text-center mb-4">{roomCode}</div>
                      ) : (
                        <div className="space-y-4">
                          <input
                            placeholder="e.g. 123456"
                            className="w-full text-3xl font-mono text-center p-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-indigo-500 outline-none"
                            id="roomCodeInput"
                          />
                          <button
                            onClick={() => startPrivateMatch(document.getElementById('roomCodeInput').value)}
                            disabled={isJoiningRoom}
                            className={`w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${isJoiningRoom ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
                          >
                            {isJoiningRoom && <Loader2 size={20} className="animate-spin" />}
                            {isJoiningRoom ? 'Joining...' : 'Join Room Now'}
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-4 mb-4">Sharing this ID allows an AI-monitored 1v1 session with friends.</p>
                      <button onClick={() => setShowRoomInput(false)} className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700">Close</button>
                    </motion.div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg"><Bell size={20} className="text-blue-600" /></div>
                        <h3 className="font-bold text-gray-900">Battle Inbox</h3>
                      </div>
                      <div className="text-center py-8 text-gray-400 italic text-sm">No recent battle invites...</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg"><Trophy size={20} className="text-orange-600" /></div>
                        <h3 className="font-bold text-gray-900">Hall of Fame</h3>
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400">#{i}</div>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400" style={{ width: `${100 - (i * 20)}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {showAvatarPicker && (
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Choose Your Avatar</h3>
              <div className="grid grid-cols-4 gap-4 mb-8">
                {AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => { setUserAvatar(emoji); setShowAvatarPicker(false); }}
                    className={`text-3xl p-4 rounded-2xl hover:bg-emerald-50 transition-all ${userAvatar === emoji ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-gray-50'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAvatarPicker(false)} className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800">
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Winner Reveal Overlay */}
      {showWinnerReveal && dualAnalysis && (
        <WinnerReveal
          dualAnalysis={dualAnalysis}
          myUserId={user?.uid}
          opponentData={activeSession?.opponent}
          onClose={() => {
            setShowWinnerReveal(false);
            setDualAnalysis(null);
            setActiveSession(null);
          }}
        />
      )}
    </div>
  );
};

export default App;

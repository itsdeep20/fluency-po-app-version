import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Zap, MessageCircle, Share2, Home, RotateCw, CheckCircle2, XCircle, Globe } from 'lucide-react';
import confetti from 'canvas-confetti';

// AnimatedNumber - Defined at MODULE LEVEL to prevent recreation on parent re-renders
const AnimatedNumber = React.memo(({ value, delay = 0, shouldAnimate }) => {
    const [count, setCount] = useState(0);
    const hasStarted = useRef(false);

    useEffect(() => {
        if (shouldAnimate && !hasStarted.current && value > 0) {
            hasStarted.current = true;

            const startTimeout = setTimeout(() => {
                const duration = 1500;
                const steps = 30;
                const increment = value / steps;
                let current = 0;
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= value) {
                        setCount(value);
                        clearInterval(timer);
                    } else {
                        setCount(Math.floor(current));
                    }
                }, duration / steps);
            }, delay);

            return () => clearTimeout(startTimeout);
        } else if (shouldAnimate && value === 0) {
            setCount(0);
        }
    }, []); // Empty deps - only run on mount

    return <span>{count}</span>;
});

const WinnerReveal = ({ dualAnalysis, myUserId, opponentData, onDashboard, onClose, soundEnabled = true, onListenFeedback, motherTongue = 'Hindi', onShowTips }) => {
    const [step, setStep] = useState(0); // 0: Intro, 1: Counting, 2: Final Result

    // GUARD: If dualAnalysis is null/undefined, show loading or return early
    if (!dualAnalysis) {
        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 text-center max-w-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading results...</p>
                    <button
                        onClick={onDashboard}
                        className="mt-4 px-6 py-2 bg-gray-800 text-white rounded-xl font-bold"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    // Check for insufficient messages (early exit case)
    const isInsufficientMessages = dualAnalysis?.insufficientMessages === true;

    // Determine if we need to flip the perspective
    // analyzedBy is the UID of the person who called the analyze endpoint (they are player1)
    const analyzedBy = dualAnalysis?.analyzedBy;
    const amIPlayer1 = !analyzedBy || analyzedBy === myUserId;

    // Extract Data - FLIP if I'm not the analyzer
    const myData = amIPlayer1 ? (dualAnalysis?.player1 || {}) : (dualAnalysis?.player2 || {});
    const oppData = amIPlayer1 ? (dualAnalysis?.player2 || {}) : (dualAnalysis?.player1 || {});

    // Determine winner from MY perspective
    const winnerFromBackend = dualAnalysis?.winner; // 'player1' or 'player2'
    const didMyPlayerWin = amIPlayer1 ? (winnerFromBackend === 'player1') : (winnerFromBackend === 'player2');
    const isWinner = didMyPlayerWin;
    const isDraw = !winnerFromBackend || winnerFromBackend === 'draw' || winnerFromBackend === 'none';

    // Calculate total - ALWAYS sum individual scores to avoid backend inconsistencies
    const myTotal = (myData.vocab || 0) + (myData.grammar || 0) + (myData.fluency || 0) + (myData.sentence || 0);
    const oppTotal = (oppData.vocab || 0) + (oppData.grammar || 0) + (oppData.fluency || 0) + (oppData.sentence || 0);


    // Sound Effects using Web Audio API
    const playSound = (type) => {
        // Check if sound is enabled
        if (!soundEnabled) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === 'drumroll') {
                // Quick repeating tones for drumroll effect
                oscillator.frequency.value = 200;
                oscillator.type = 'triangle';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.8);
            } else if (type === 'win') {
                // Ascending happy tones
                oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
                oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
                oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.5);
            } else if (type === 'lose') {
                // Descending sad tones
                oscillator.frequency.setValueAtTime(392, audioContext.currentTime); // G4
                oscillator.frequency.setValueAtTime(330, audioContext.currentTime + 0.15); // E4
                oscillator.frequency.setValueAtTime(262, audioContext.currentTime + 0.3); // C4
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.5);
            }
        } catch (e) {
            console.log('Sound not supported');
        }
    };

    useEffect(() => {
        // Sequence Logic
        if (soundEnabled) playSound('drumroll');
        setTimeout(() => {
            setStep(1); // Start counting skills
        }, 1000);

        // DELAY REVEAL to allow for sequential animation (approx 2s total for rows)
        setTimeout(() => {
            setStep(2); // Reveal Winner
            if (isWinner) {
                playSound('win');
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#10B981', '#F59E0B', '#3B82F6']
                });
            } else {
                playSound('lose');
            }
        }, 5500); // Extended time for counting animation
    }, [isWinner]);

    // Framer Motion Variants
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.9 },
        visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
        exit: { opacity: 0, scale: 0.9, transition: { duration: 0.3 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.2, duration: 0.5 } })
    };

    // Pre-calculate shouldAnimate once
    const shouldAnimate = step >= 1;

    // SPECIAL DISPLAY for insufficient messages (early exit)
    if (isInsufficientMessages) {
        return (
            <motion.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={containerVariants}
                className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
            >
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative my-auto">
                    {/* HEADER */}
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg border border-white/30"
                        >
                            <MessageCircle className="text-white drop-shadow-md" size={40} />
                        </motion.div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-1">
                            Session Ended
                        </h2>
                        <p className="text-amber-100 text-sm font-medium">
                            Not enough messages for analysis
                        </p>
                    </div>

                    {/* MESSAGE */}
                    <div className="p-6 text-center">
                        <div className="text-6xl mb-4">💬</div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">Need More Practice!</h3>

                        {/* Check if opponent left early - show highlighted message */}
                        {dualAnalysis?.message?.includes('opponent left') ? (
                            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4">
                                <div className="text-2xl mb-2">🚪</div>
                                <p className="text-red-700 font-bold text-base">
                                    Your opponent left early!
                                </p>
                                <p className="text-red-600 text-sm mt-1">
                                    Not enough messages to analyze the result.
                                </p>
                            </div>
                        ) : (
                            <p className="text-gray-600 mb-4">
                                {dualAnalysis?.message || 'Both players need to send at least 6 messages combined for a proper analysis.'}
                            </p>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                            <div className="text-xs font-bold text-amber-700 uppercase mb-1">💡 Tip</div>
                            <p className="text-sm text-amber-800">
                                Play a bit longer next time to get your scores analyzed! Your accuracy wasn't affected by this session.
                            </p>
                        </div>
                    </div>

                    {/* ACTION BUTTON */}
                    <div className="p-5 bg-gray-50 border-t border-gray-100">
                        <button
                            onClick={onDashboard}
                            className="w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                        >
                            <Home size={18} /> Back to Home
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative my-auto max-h-[90vh] overflow-y-auto">

                {/* HEADER */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg border border-white/30"
                    >
                        <Trophy className="text-yellow-300 drop-shadow-md" size={40} fill="currentColor" />
                    </motion.div>

                    <h2 className="text-2xl font-black text-white uppercase tracking-wider mb-1">
                        Match Result
                    </h2>
                    <p className="text-emerald-100 text-sm font-medium">
                        {step < 2 ? "Calculating Scores..." : (isWinner ? "Victory is Yours!" : isDraw ? "It's a Draw!" : `${opponentData?.name || 'Opponent'} Won!`)}
                    </p>
                </div>

                {/* SCORE COMPARISON CARD */}
                <div className="p-5 -mt-6">
                    <div className="grid grid-cols-2 gap-4">
                        {/* YOU */}
                        <motion.div
                            custom={0} variants={itemVariants}
                            className={`bg-white rounded-2xl p-4 text-center shadow-lg border-2 ${isWinner && step === 2 ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-gray-100'} relative z-10`}
                        >
                            <div className="text-3xl mb-1">🦁</div>
                            <div className="font-bold text-gray-900 text-sm mb-1">You</div>
                            {step === 2 && (
                                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${isWinner ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                                    {isWinner ? 'WINNER' : 'DEFEAT'}
                                </div>
                            )}
                            <div className={`mt-2 text-4xl font-black ${isWinner ? 'text-emerald-600' : 'text-gray-800'}`}>
                                {step >= 1 ? <AnimatedNumber value={myTotal} delay={2500} shouldAnimate={shouldAnimate} /> : 0}
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Total Score</div>
                        </motion.div>

                        {/* OPPONENT */}
                        <motion.div
                            custom={1} variants={itemVariants}
                            className={`bg-white rounded-2xl p-4 text-center shadow-lg border-2 ${!isWinner && !isDraw && step === 2 ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-gray-100'} relative z-10`}
                        >
                            <div className="text-3xl mb-1">{opponentData?.avatar || '👤'}</div>
                            <div className="font-bold text-gray-900 text-sm mb-1">{opponentData?.name || 'Opponent'}</div>
                            {step === 2 && (
                                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${!isWinner && !isDraw ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                                    {!isWinner && !isDraw ? 'WINNER' : 'DEFEAT'}
                                </div>
                            )}
                            <div className={`mt-2 text-4xl font-black ${!isWinner && !isDraw ? 'text-emerald-600' : 'text-gray-800'}`}>
                                {step >= 1 ? <AnimatedNumber value={oppTotal} delay={2500} shouldAnimate={shouldAnimate} /> : 0}
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Total Score</div>
                        </motion.div>
                    </div>
                </div>

                {/* DETAILED METRICS */}
                <div className="px-6 pb-6">
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 tracking-widest mb-3 uppercase">
                        <span>You</span>
                        <span>Skill Breakdown</span>
                        <span>Them</span>
                    </div>

                    <div className="space-y-3">
                        {[
                            { label: 'Vocabulary', color: 'bg-blue-100 text-blue-700', myScore: myData.vocab, oppScore: oppData.vocab },
                            { label: 'Grammar', color: 'bg-purple-100 text-purple-700', myScore: myData.grammar, oppScore: oppData.grammar },
                            { label: 'Fluency', color: 'bg-emerald-100 text-emerald-700', myScore: myData.fluency, oppScore: oppData.fluency },
                            { label: 'Sentence', color: 'bg-amber-100 text-amber-700', myScore: myData.sentence, oppScore: oppData.sentence },
                        ].map((skill, i) => (
                            <motion.div
                                key={skill.label}
                                custom={i + 2}
                                variants={itemVariants}
                                className="grid grid-cols-3 items-center group hover:bg-gray-50 p-2 rounded-xl transition-colors"
                            >
                                <div className={`text-xl font-black text-left ${skill.myScore > skill.oppScore ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {step >= 1 ? <AnimatedNumber value={skill.myScore || 0} delay={i * 500} shouldAnimate={shouldAnimate} /> : '-'}
                                </div>

                                <div className="flex justify-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${skill.color}`}>
                                        {skill.label}
                                    </span>
                                </div>

                                <div className={`text-xl font-black text-right ${skill.oppScore > skill.myScore ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {step >= 1 ? <AnimatedNumber value={skill.oppScore || 0} delay={i * 500} shouldAnimate={shouldAnimate} /> : '-'}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-5 bg-gray-50 border-t border-gray-100">
                    <div className="bg-white border border-gray-200 rounded-xl p-3 text-center mb-4 shadow-sm">
                        <div className="text-xs text-emerald-600 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                            <Zap size={12} fill="currentColor" /> feedback
                        </div>
                        <p className="text-gray-600 text-sm leading-snug">
                            {myData.feedback || "Great match! Keep practicing to improve accuracy."}
                        </p>

                        {/* Read in Native Language Button */}
                        {onListenFeedback && myData.feedback && (
                            <div className="mt-3 flex justify-center">
                                <button
                                    onClick={async (e) => {
                                        const btn = e.currentTarget;
                                        const originalContent = btn.innerHTML;
                                        btn.disabled = true;
                                        btn.innerHTML = `<span class="animate-pulse">Translating...</span>`;

                                        try {
                                            await onListenFeedback(myData.feedback);
                                        } catch (err) {
                                            console.error('[BATTLE_NATIVE_FEEDBACK] Error:', err);
                                        } finally {
                                            btn.disabled = false;
                                            btn.innerHTML = originalContent;
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity shadow-sm"
                                >
                                    <Globe size={12} />
                                    <span>Read in {motherTongue}</span>
                                </button>
                            </div>
                        )}

                        {/* Scoring Tips Link */}
                        {onShowTips && (
                            <button
                                onClick={onShowTips}
                                className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline transition-colors"
                            >
                                💡 Want to score better? See tips →
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onDashboard}
                            className="flex-1 py-3.5 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                        >
                            <Home size={18} /> Home
                        </button>
                        <button
                            onClick={() => {
                                // Share logic could go here
                                alert('Shared result!');
                            }}
                            className="px-4 py-3.5 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
                        >
                            <Share2 size={18} />
                        </button>
                    </div>
                </div>

            </div>
        </motion.div>
    );
};

export default WinnerReveal;

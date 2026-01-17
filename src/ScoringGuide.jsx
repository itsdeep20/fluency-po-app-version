import React from 'react';
import { X, MessageSquare, BookOpen, CheckCircle, TrendingUp, Lightbulb, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ScoringGuide = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const tips = [
        {
            icon: <MessageSquare className="w-5 h-5" />,
            title: "Write Complete Sentences",
            subtitle: "One-word answers limit your score",
            color: "from-emerald-500 to-teal-500",
            bad: ["Yes.", "No.", "Ok."],
            good: ["Yes, I completely agree with that.", "No, I think we should consider other options."]
        },
        {
            icon: <BookOpen className="w-5 h-5" />,
            title: "Use Better Words",
            subtitle: "Replace simple words with richer ones",
            color: "from-teal-500 to-cyan-500",
            bad: ["It was good.", "I feel bad."],
            good: ["It was absolutely wonderful!", "I feel quite disappointed about it."]
        },
        {
            icon: <CheckCircle className="w-5 h-5" />,
            title: "Check Your Grammar",
            subtitle: "Proper spelling, capitalization & punctuation",
            color: "from-emerald-500 to-teal-500",
            bad: ["i going home", "she dont like"],
            good: ["I am going home.", "She doesn't like it."]
        },
        {
            icon: <TrendingUp className="w-5 h-5" />,
            title: "Build Longer Sentences",
            subtitle: "Connect your ideas naturally",
            color: "from-cyan-500 to-emerald-500",
            bad: ["I like coffee. It is tasty."],
            good: ["I like coffee because it gives me energy and tastes great."]
        }
    ];

    const powerWords = [
        { word: "because", hint: "give reasons" },
        { word: "although", hint: "show contrast" },
        { word: "however", hint: "introduce change" },
        { word: "therefore", hint: "show result" },
        { word: "furthermore", hint: "add more" },
        { word: "in my opinion", hint: "share views" }
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
                        <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Improve Your Score</h2>
                                    <p className="text-white/80 text-sm">Follow these tips to speak better English</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
                        {/* Tips Cards */}
                        {tips.map((tip, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-gray-50 rounded-2xl p-4 border border-gray-100"
                            >
                                {/* Tip Header */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 bg-gradient-to-br ${tip.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                                        {tip.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{tip.title}</h3>
                                        <p className="text-xs text-gray-500">{tip.subtitle}</p>
                                    </div>
                                </div>

                                {/* Examples */}
                                <div className="space-y-2">
                                    {/* Bad Examples */}
                                    <div className="flex items-start gap-2">
                                        <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <X className="w-3 h-3 text-red-500" />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {tip.bad.map((example, i) => (
                                                <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-100">
                                                    "{example}"
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Good Examples */}
                                    <div className="flex items-start gap-2">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                                        </div>
                                        <div className="space-y-1.5">
                                            {tip.good.map((example, i) => (
                                                <div key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg border border-emerald-100">
                                                    "{example}"
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}

                        {/* Power Words Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Lightbulb className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-amber-800">Words That Impress</h3>
                            </div>
                            <p className="text-xs text-amber-700 mb-3">Use these words to connect your ideas and sound more fluent:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {powerWords.map((item, i) => (
                                    <div key={i} className="bg-white/80 rounded-xl p-2.5 border border-amber-100">
                                        <span className="font-bold text-amber-600 text-sm">"{item.word}"</span>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{item.hint}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-gray-50 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition-all active:scale-[0.98]"
                        >
                            Got it! Let's Practice
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ScoringGuide;

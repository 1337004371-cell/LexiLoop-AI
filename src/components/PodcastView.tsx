import React, { useState, useEffect, useRef } from 'react';
import { FileText, Languages, Volume2, Square, Pause, RefreshCcw, ThumbsUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function PodcastView({
  data,
  loading,
  onSpeak,
  onStop,
  onInspect,
  onFinish,
  onRegenerate,
  highlightWords,
  isInspecting,
}: {
  data: any;
  loading: boolean;
  onSpeak: (t: string, opts?: any) => void;
  onStop?: () => void;
  onInspect: (word: string) => void;
  onFinish: () => void;
  onRegenerate?: () => void;
  highlightWords?: string[];
  isInspecting?: boolean;
  key?: string | number;
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'article' | 'dialogue'>('article');
  const [dialoguePlayingIdx, setDialoguePlayingIdx] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const stripTags = (text: string) => (text || '').replace(/<\/?w>/gi, '');

  const renderTaggedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(<w>[\s\S]*?<\/w>)/gi);
    return parts.map((part, i) => {
      const match = part.match(/^<w>([\s\S]*?)<\/w>$/i);
      if (match) {
        return (
          <span
            key={i}
            onClick={() => onInspect(match[1].trim())}
            className="bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-blue-100 transition-all border border-blue-100"
          >
            {match[1]}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderDialogueText = (text: string, isDark: boolean) => {
    if (!text) return null;
    const wordSet = new Set((highlightWords || []).map(w => w.toLowerCase()));
    const tokens = text.match(/[\w']+|[^\w']+/g) || [];
    return tokens.map((token, i) => {
      const clean = token.replace(/[.,!?;:'"]/g, '').toLowerCase();
      if (/^[\w']+$/.test(token) && clean) {
        const isTarget = wordSet.has(clean);
        return (
          <span
            key={i}
            onClick={() => onInspect(clean)}
            className={cn(
              'cursor-pointer transition-all',
              isTarget && (isDark
                ? 'bg-blue-500/30 text-blue-300 font-semibold px-0.5 rounded'
                : 'bg-blue-50 text-blue-700 font-semibold px-0.5 rounded')
            )}
          >
            {token}
          </span>
        );
      }
      return <span key={i}>{token}</span>;
    });
  };

  const playFullArticle = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentLineIndex(null);
      onStop?.();
      abortControllerRef.current?.abort();
      return;
    }

    const lines = activeSection === 'article' ? data?.lines : data?.dialogue;
    if (!lines) return;
    setIsPlaying(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for (let i = 0; i < lines.length; i++) {
        if (controller.signal.aborted) break;
        setCurrentLineIndex(i);
        const text = stripTags(lines[i].text);
        onSpeak(text);

        const wordsCount = text.split(' ').length;
        const delay = wordsCount * 400 + 800;

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          controller.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('aborted'));
          });
        });
      }
    } catch (e: any) {
      if (e.message !== 'aborted') console.error(e);
    } finally {
      if (!controller.signal.aborted) {
        setIsPlaying(false);
        setCurrentLineIndex(null);
      }
    }
  };

  useEffect(() => {
    return () => {
      onStop?.();
      abortControllerRef.current?.abort();
    };
  }, [onStop]);

  const hasDialogue = data?.dialogue && data.dialogue.length > 0;

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || !hasDialogue) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      const next = diff > 0 ? 'dialogue' : 'article';
      if (next !== activeSection) {
        setActiveSection(next);
        setIsPlaying(false);
        setCurrentLineIndex(null);
      }
    }
    setTouchStart(null);
  };

  const toggleDialogueLine = (idx: number, text: string) => {
    if (dialoguePlayingIdx === idx) {
      onStop?.();
      setDialoguePlayingIdx(null);
    } else {
      onStop?.();
      setDialoguePlayingIdx(idx);
      onSpeak(text);
      const delay = text.split(' ').length * 400 + 600;
      setTimeout(() => setDialoguePlayingIdx((prev) => (prev === idx ? null : prev)), delay);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* ── Hero Card (App Store "Today" style) ── */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        {/* Header — large title area */}
        <div className="px-5 pt-5 pb-4 space-y-4">
          {/* Top bar: icon + title + actions */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <FileText size={18} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 flex-1 truncate leading-tight">
              {stripTags(data?.title) || '情景化记单词'}
            </h3>
          </div>

          {/* Action pills */}
          <div className="flex items-center gap-2">
            {activeSection === 'article' && (
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={cn(
                  'h-8 px-4 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-all',
                  showTranslation
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                )}
              >
                <Languages size={14} />
                {showTranslation ? '原文' : 'EN'}
              </button>
            )}
            <button
              disabled={loading}
              onClick={playFullArticle}
              className={cn(
                'h-8 px-4 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-all',
                isPlaying
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              )}
            >
              {isPlaying ? <Square size={12} fill="currentColor" /> : <Volume2 size={12} />}
              {isPlaying ? '停止' : '播放全文'}
            </button>
          </div>

          {/* Segmented control */}
          {hasDialogue && !loading && (
            <div className="flex bg-slate-100 rounded-xl p-1 relative">
              <motion.div
                className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm"
                animate={{ left: activeSection === 'article' ? '4px' : '50%', width: 'calc(50% - 4px)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
              <button
                onClick={() => { setActiveSection('article'); setIsPlaying(false); setCurrentLineIndex(null); }}
                className={cn(
                  'relative z-10 flex-1 py-2 rounded-lg text-sm font-semibold transition-colors duration-200',
                  activeSection === 'article' ? 'text-slate-900' : 'text-slate-400'
                )}
              >
                趣味短文
              </button>
              <button
                onClick={() => { setActiveSection('dialogue'); setIsPlaying(false); setCurrentLineIndex(null); }}
                className={cn(
                  'relative z-10 flex-1 py-2 rounded-lg text-sm font-semibold transition-colors duration-200',
                  activeSection === 'dialogue' ? 'text-slate-900' : 'text-slate-400'
                )}
              >
                职场对话
              </button>
            </div>
          )}
        </div>

        {/* ── Content area ── */}
        <div className="relative">
          {isInspecting && (
            <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-md flex items-center justify-center">
              <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-lg ring-1 ring-black/5">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold text-slate-500">正在查词...</span>
              </div>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="px-5 pb-5 space-y-4 select-none"
          >
            {loading ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-400 animate-pulse">AI 努力编故事中</p>
              </div>
            ) : activeSection === 'article' && data?.lines ? (
              <div className="space-y-3">
                {data.lines
                  .filter((line: any) => line && line.text)
                  .map((line: any, i: number) => (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      key={i}
                      className={cn(
                        'transition-all duration-300',
                        isPlaying && currentLineIndex !== null && currentLineIndex !== i ? 'opacity-20 scale-[0.98]' : 'opacity-100'
                      )}
                    >
                      <div
                        className={cn(
                          'p-5 rounded-2xl relative group bg-white',
                          'shadow-[0_2px_12px_rgb(0,0,0,0.03)] ring-1 ring-black/[0.03]',
                          currentLineIndex === i && 'ring-2 ring-blue-500 shadow-[0_4px_20px_rgb(59,130,246,0.15)]'
                        )}
                      >
                        <div className="text-[16px] leading-relaxed text-slate-800 break-words">
                          {showTranslation ? line.translation : renderTaggedText(line.text)}
                        </div>
                        <button
                          onClick={() => onSpeak(stripTags(showTranslation ? line.translation : line.text))}
                          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
              </div>
            ) : activeSection === 'dialogue' && data?.dialogue ? (
              <div className="space-y-3">
                {data.dialogue
                  .filter((line: any) => line && line.text)
                  .map((line: any, i: number) => {
                    const isA = line.speaker === 'A';
                    return (
                      <motion.div
                        initial={{ opacity: 0, x: isA ? -8 : 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        key={i}
                        className={cn(
                          'flex items-start gap-3 transition-all duration-300',
                          isA ? 'justify-start' : 'justify-end',
                          isPlaying && currentLineIndex !== null && currentLineIndex !== i ? 'opacity-20' : 'opacity-100'
                        )}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm shadow-sm',
                            isA ? 'bg-blue-600 text-white order-1' : 'bg-slate-800 text-white order-3'
                          )}
                        >
                          {isA ? '🧑‍💼' : '🧑‍💻'}
                        </div>
                        {/* Bubble */}
                        <div
                          className={cn(
                            'max-w-[calc(100%-52px)] p-4 rounded-2xl relative order-2',
                            isA
                              ? 'bg-slate-50 text-slate-800 rounded-bl-md'
                              : 'bg-slate-900 text-white rounded-br-md',
                            'shadow-[0_2px_12px_rgb(0,0,0,0.03)]',
                            currentLineIndex === i && 'ring-2 ring-blue-500',
                            dialoguePlayingIdx === i && 'ring-2 ring-blue-400'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[16px] leading-relaxed break-words text-left">
                              {renderDialogueText(line.text, !isA)}
                            </p>
                            <button
                              onClick={() => toggleDialogueLine(i, line.text)}
                              className={cn(
                                'shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all mt-0.5',
                                dialoguePlayingIdx === i
                                  ? 'bg-blue-600 text-white scale-110'
                                  : isA
                                    ? 'bg-slate-200/80 text-slate-400 hover:bg-blue-100 hover:text-blue-600'
                                    : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                              )}
                            >
                              {dialoguePlayingIdx === i ? <Pause size={10} /> : <Volume2 size={10} />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-slate-300">暂无内容，请稍后再试</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Actions ── */}
      {!loading && (
        <div className="flex gap-3">
          <button
            onClick={onRegenerate}
            disabled={!onRegenerate}
            className="flex-1 py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 bg-white text-slate-500 hover:text-slate-700 active:scale-[0.97] transition-all shadow-[0_2px_12px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.03]"
          >
            <RefreshCcw size={16} />
            换个主题
          </button>
          <button
            onClick={onFinish}
            className="flex-1 py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2 bg-blue-600 text-white shadow-[0_4px_16px_rgb(37,99,235,0.25)] hover:bg-blue-700 active:scale-[0.97] transition-all"
          >
            <ThumbsUp size={16} />
            学会了
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MediaRole } from '../types.ts';
import { STORAGE_KEYS } from '../constants.ts';
import {
  Sparkles,
  Send,
  Brain,
  Zap,
  Trash2,
  Copy,
  Check,
  Bot,
  User,
  Loader2,
  Film,
  Mic,
  Video,
  Flame,
  ChevronDown
} from 'lucide-react';

interface GeminiChatbotProps {
  currentMember: string;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({ currentMember }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'initial',
        role: 'model',
        text: `Hello ${currentMember || 'Media Crew'}! 👋 I am your **COC Media Team AI Producer & Coach**.\n\nI can help you:\n- Plan Sunday live stream switching & camera angles\n- Dial in broadcast sound mixing, EQ & LUFS loudness\n- Write viral short-form Reel hooks from pastor sermons\n- Troubleshoot A/V hardware glitches & rundown timing\n- Break down any task on the board to earn maximum points!\n\nWhat are we producing today?`,
        modelUsed: 'gemini-3.8-flash',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon'>('gemini-3.8-flash');
  const [enableThinking, setEnableThinking] = useState(false);
  const [selectedRole, setSelectedRole] = useState<MediaRole>('producer');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // When high thinking is toggled, recommend gemini-4-argon
  const handleThinkingToggle = () => {
    const nextState = !enableThinking;
    setEnableThinking(nextState);
    if (nextState) {
      setSelectedModel('gemini-4-argon');
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Map history for server API
      const payloadMessages = updatedMessages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          model: selectedModel,
          enableThinking: enableThinking || selectedModel === 'gemini-4-argon',
          role: selectedRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to communicate with AI model.');
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.reply,
        modelUsed: data.modelUsed || selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isThinking: enableThinking || selectedModel === 'gemini-4-argon',
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Connection error';
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: `⚠️ **Notice:** ${errMsg}\n\nPlease try sending your message again or switch models using the selector above.`,
        modelUsed: 'system',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm('Clear chat history?')) {
      const initialMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: `Chat reset. Ready for next media assignment! How can I assist you, ${currentMember || 'teammate'}?`,
        modelUsed: selectedModel,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([initialMessage]);
    }
  };

  const quickPrompts = [
    { label: '5 Viral Reel Hooks', prompt: 'Give me 5 punchy high-retention video hooks for Sunday sermon Instagram Reels / TikToks.' },
    { label: 'Audio Mix & LUFS Guide', prompt: 'What are the recommended gain staging, EQ, compressor, and LUFS broadcast limiter settings for live church stream audio?' },
    { label: '3-Camera Sunday Checklist', prompt: 'Provide a pre-service checklist for 3 camera operators (wide, tight pulpit, audience/worship reactions).' },
    { label: 'Solve OBS/ATEM Stream Lag', prompt: 'Troubleshoot dropped frames and audio sync delay between ATEM switcher and OBS YouTube broadcast.' },
  ];

  return (
    <div className="flex flex-col h-[760px] rounded-3xl glass-panel border border-white/10 overflow-hidden shadow-2xl relative">
      
      {/* Top Configuration Bar */}
      <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-neutral-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Bot Identity & Role */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 p-0.5 shadow-lg shadow-purple-600/30 flex items-center justify-center">
            <div className="w-full h-full bg-[#0d111c] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm sm:text-base tracking-tight">
                COC Media AI Producer
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Ready" />
            </div>
            {/* Role Selector */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-neutral-400">Persona:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as MediaRole)}
                className="bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-neutral-200 text-xs rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors cursor-pointer"
              >
                <option value="producer" className="bg-neutral-900 text-white">Executive Producer</option>
                <option value="director" className="bg-neutral-900 text-white">Technical Director</option>
                <option value="audio" className="bg-neutral-900 text-white">Sound Engineer</option>
                <option value="creative" className="bg-neutral-900 text-white">Creative &amp; Social</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Model Selector & Thinking Mode Toggle */}
        <div className="flex items-center flex-wrap gap-2">
          
          {/* Model Selector */}
          <div className="flex items-center rounded-xl bg-white/[0.05] border border-white/10 p-1">
            <button
              onClick={() => {
                setSelectedModel('gemini-3.8-flash');
                setEnableThinking(false);
              }}
              title="General tasks (Fast & balanced)"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedModel === 'gemini-3.8-flash' && !enableThinking
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              3.8 Flash
            </button>
            <button
              onClick={() => {
                setSelectedModel('gemini-3.1-flash-lite');
                setEnableThinking(false);
              }}
              title="Fast tasks (Instant ideas & hooks)"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedModel === 'gemini-3.1-flash-lite'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Lite
            </button>
            <button
              onClick={() => {
                setSelectedModel('gemini-4-argon');
                setEnableThinking(true);
              }}
              title="Complex tasks (High Reasoning / Gemini 4 Argon)"
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedModel === 'gemini-4-argon'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Brain className="w-3 h-3 inline mr-1 text-purple-300" />
              4 Argon
            </button>
          </div>

          {/* High Thinking Toggle (Required feature) */}
          <button
            onClick={handleThinkingToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              enableThinking
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20'
                : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
            }`}
            title="Toggle High Thinking mode for complex reasoning tasks"
          >
            <Brain className={`w-3.5 h-3.5 ${enableThinking ? 'text-purple-300 animate-pulse' : 'text-neutral-400'}`} />
            <span>High Thinking</span>
            <span className={`w-2 h-2 rounded-full ${enableThinking ? 'bg-purple-400 shadow-sm shadow-purple-400' : 'bg-neutral-600'}`} />
          </button>

          {/* Clear button */}
          <button
            onClick={handleClearHistory}
            className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-rose-400 border border-white/10 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>

        </div>
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md ${
                  isUser
                    ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white'
                    : 'bg-gradient-to-tr from-neutral-800 to-neutral-700 text-purple-300 border border-white/10'
                }`}
              >
                {isUser ? (
                  currentMember ? currentMember.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              {/* Message Content */}
              <div
                className={`group/msg relative max-w-[85%] sm:max-w-[75%] rounded-3xl px-5 py-3.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-600/20'
                    : 'bg-white/[0.05] border border-white/10 text-neutral-200 rounded-tl-sm backdrop-blur-md'
                }`}
              >
                {/* Thinking / Model tag on bot messages */}
                {!isUser && message.modelUsed && (
                  <div className="flex items-center justify-between gap-3 text-[10px] text-neutral-400 mb-1.5 pb-1 border-b border-white/[0.06]">
                    <span className="font-semibold text-purple-400 flex items-center gap-1">
                      {message.isThinking && <Brain className="w-3 h-3 text-purple-400 inline" />}
                      {message.modelUsed}
                    </span>
                    <span>{message.timestamp}</span>
                  </div>
                )}

                {/* Render Text with formatting */}
                <div className="whitespace-pre-wrap break-words space-y-1.5 font-normal">
                  {message.text}
                </div>

                {/* Copy button */}
                {!isUser && (
                  <button
                    onClick={() => handleCopy(message.id, message.text)}
                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white opacity-0 group-hover/msg:opacity-100 transition-opacity border border-white/10"
                    title="Copy response"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-purple-300 shadow-md">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-3xl rounded-tl-sm px-5 py-3.5 bg-white/[0.05] border border-white/10 text-neutral-300 text-sm flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-xs text-neutral-300 font-medium">
                {enableThinking ? 'Analyzing with High Thinking...' : 'Generating production advice...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-4 py-2 border-t border-white/[0.06] bg-neutral-950/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-neutral-500 flex-shrink-0">
          Suggestions:
        </span>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p.prompt)}
            disabled={isLoading}
            className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-neutral-300 hover:text-white transition-all text-left truncate max-w-xs"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-white/[0.08] bg-neutral-900/60 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                enableThinking
                  ? 'Ask a complex media question (High Thinking active)...'
                  : 'Ask AI Producer about gear, audio settings, hooks, tasks...'
              }
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/15 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 active:scale-95 flex-shrink-0"
            title="Send Message"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>

    </div>
  );
};

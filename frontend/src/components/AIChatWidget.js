import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, Bot, User, Minimize2, Maximize2, Mic, MicOff, Upload, Sparkles, Phone, RefreshCw } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "🙏 Namaste! Welcome to **ASR Enterprises**!\n\nI'm your AI Solar Expert powered by Gemini AI. How can I help you today?\n\n1️⃣ Home Solar Installation\n2️⃣ Shop / Office Solar\n3️⃣ PM Surya Ghar Subsidy (₹78,000)\n4️⃣ Price / Quotation\n5️⃣ Book Free Site Visit\n6️⃣ Upload Electricity Bill\n7️⃣ Talk to Human Expert\n\n💡 You can also use voice — just tap the mic!",
  quickReplies: [
    { label: "🏠 Home Solar", value: "I want home solar installation" },
    { label: "🏢 Shop/Office", value: "I want shop or office solar" },
    { label: "💰 PM Subsidy", value: "Tell me about PM Surya Ghar subsidy" },
    { label: "📋 Get Quote", value: "I want a price quotation" },
    { label: "📍 Site Visit", value: "I want a free site visit" },
    { label: "📞 Call Expert", value: "I want to talk to a solar expert" }
  ],
  timestamp: new Date()
};

export const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [humanHandover, setHumanHandover] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", location: "" });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadFormDone, setLeadFormDone] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [voiceSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Show lead capture form after 4 user messages exchanged
  useEffect(() => {
    if (msgCount >= 4 && !leadFormDone && !showLeadForm) {
      setShowLeadForm(true);
    }
  }, [msgCount, leadFormDone, showLeadForm]);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { ...msg, timestamp: new Date() }]);
  }, []);

  const handleSend = useCallback(async (messageToSend = null) => {
    const message = messageToSend || inputMessage.trim();
    if (!message || isLoading) return;

    setInputMessage("");
    addMessage({ role: "user", content: message });
    setMsgCount(c => c + 1);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai/chat/public`, {
        session_id: sessionId,
        message: message
      });

      if (response.data.success) {
        if (response.data.human_handover) setHumanHandover(true);
        if (response.data.lead_id) setLeadCaptured(true);
        addMessage({ role: "assistant", content: response.data.response });
      } else {
        addMessage({
          role: "assistant",
          content: response.data.response || `I'm here to help! 📞 Call us at **9296389097** or WhatsApp for instant help.`
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage({
        role: "assistant",
        content: `Sorry, there was a connection issue. Please call **9296389097** or WhatsApp us for instant support! 📞`
      });
    }

    setIsLoading(false);
  }, [inputMessage, isLoading, sessionId, addMessage]);

  const handleQuickReply = (value) => {
    handleSend(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice Recording using Web Speech API (real speech-to-text)
  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN'; // Hindi + English (works for Hinglish)
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setInputMessage(transcript);
    };

    recognition.onerror = (e) => {
      console.error("Speech error:", e.error);
      setIsRecording(false);
      if (e.error === 'not-allowed') {
        alert("Please allow microphone access to use voice input.");
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      // Auto-send if text was captured
      setTimeout(() => {
        setInputMessage(prev => {
          if (prev.trim()) handleSend(prev.trim());
          return '';
        });
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [handleSend]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Bill Upload Handler
  const handleBillUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    addMessage({ role: "user", content: `📄 Uploaded: ${file.name}` });

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API}/crm/leads/smart-import`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const analysisMsg = `A customer uploaded their electricity bill for solar analysis. Please suggest the right solar system size based on a Bihar residential electricity bill. Mention subsidy benefits under PM Surya Ghar Yojana and expected savings. Be helpful and specific.`;
      await handleSend(analysisMsg);
    } catch {
      addMessage({
        role: "assistant",
        content: "Please tell me your **monthly electricity bill amount** and I'll calculate your solar savings and subsidy eligibility! 💡"
      });
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Lead capture form submission
  const handleLeadSubmit = async () => {
    if (!leadForm.phone || leadForm.phone.length < 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }
    setLeadSubmitting(true);
    try {
      await axios.post(`${API}/leads`, {
        name: leadForm.name || "Website Visitor",
        phone: leadForm.phone,
        location: leadForm.location || "Bihar",
        source: "ai_chatbot",
        notes: `Chat inquiry - Session: ${sessionId}`
      });
      setLeadFormDone(true);
      setShowLeadForm(false);
      addMessage({
        role: "assistant",
        content: `✅ Thank you, **${leadForm.name || 'friend'}**! Our solar expert will call you on **${leadForm.phone}** shortly.\n\nMeanwhile, you can also WhatsApp us: [wa.me/919296389097](https://wa.me/919296389097?text=Hi%20ASR%20Enterprises!%20I%20need%20solar%20help.)\n\n☀️ ASR Enterprises — Bihar's Trusted Solar Experts`
      });
    } catch {
      addMessage({
        role: "assistant",
        content: "Thanks! Please call us directly at 📞 **9296389097** or WhatsApp for quick assistance!"
      });
      setShowLeadForm(false);
      setLeadFormDone(true);
    }
    setLeadSubmitting(false);
  };

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setMsgCount(0);
    setHumanHandover(false);
    setLeadCaptured(false);
    setShowLeadForm(false);
    setLeadFormDone(false);
    setLeadForm({ name: "", phone: "", location: "" });
  };

  // Format message content (bold support)
  const formatContent = (content) => {
    return content.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          {i < content.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Closed state - floating icon button
  if (!isOpen) {
    return (
      <div className="fixed bottom-20 sm:bottom-6 left-4 sm:left-6 z-30 print:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="relative bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3.5 rounded-full shadow-2xl hover:from-amber-600 hover:to-orange-600 transition-all hover:scale-110 group"
          data-testid="ai-chat-toggle"
          aria-label="Open Solar Expert Chat"
        >
          <div className="relative">
            <Bot className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
          </div>
          {/* Tooltip */}
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none hidden sm:block shadow-lg">
            ASR Solar Expert AI
          </span>
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-20"></span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ${
        isMinimized
          ? 'bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:w-80 h-14'
          : 'bottom-4 left-2 right-2 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[26rem] h-[36rem] sm:h-[38rem]'
      }`}
      style={{ maxHeight: 'calc(100vh - 80px)', maxWidth: isMinimized ? undefined : '100%' }}
    >
      {/* Header */}
      <div
        className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 flex items-center justify-between cursor-pointer flex-shrink-0"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center relative flex-shrink-0">
            <Bot className="w-5 h-5" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-orange-500"></span>
          </div>
          <div>
            <h3 className="font-bold text-sm flex items-center gap-1">
              ASR Solar Expert
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
            </h3>
            <p className="text-xs text-amber-100">
              {isRecording ? '🎤 Listening...' : 'Online • Gemini AI Powered'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); resetChat(); }}
            className="p-1.5 hover:bg-white/20 rounded-lg transition"
            title="Reset chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1.5 hover:bg-white/20 rounded-lg transition"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="p-1.5 hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50" style={{ height: 'calc(100% - 160px)' }}>
            {messages.map((msg, idx) => (
              <div key={idx}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-end space-x-2 max-w-[88%] ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-1 ${
                      msg.role === "user" ? "bg-blue-500" : "bg-gradient-to-r from-amber-500 to-orange-500"
                    }`}>
                      {msg.role === "user" ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                      }`}>
                        <p className="whitespace-pre-line leading-relaxed">
                          {formatContent(msg.content)}
                        </p>
                      </div>
                      {msg.timestamp && (
                        <p className={`text-[10px] text-gray-400 mt-0.5 ${msg.role === "user" ? "text-right" : "text-left"} px-1`}>
                          {formatTime(msg.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Reply Buttons */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
                    {msg.quickReplies.map((qr, qrIdx) => (
                      <button
                        key={qrIdx}
                        onClick={() => handleQuickReply(qr.value)}
                        className="px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-full text-xs text-amber-700 hover:bg-amber-100 transition font-medium"
                      >
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Lead capture form */}
            {showLeadForm && !leadFormDone && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mx-1">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-5 h-5 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Get a FREE Solar Quote!</p>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={leadForm.name}
                    onChange={e => setLeadForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number *"
                    value={leadForm.phone}
                    onChange={e => setLeadForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    maxLength={10}
                  />
                  <input
                    type="text"
                    placeholder="Your Location (City/District)"
                    value={leadForm.location}
                    onChange={e => setLeadForm(f => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleLeadSubmit}
                      disabled={leadSubmitting}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                    >
                      {leadSubmitting ? 'Saving...' : '📞 Get Free Quote'}
                    </button>
                    <button
                      onClick={() => { setShowLeadForm(false); setLeadFormDone(true); }}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Human Handover Notice */}
            {humanHandover && (
              <div className="flex justify-center">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700 text-center">
                  ✅ Our team has been notified! We'll contact you shortly.
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-end space-x-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <div className="flex space-x-1 items-center">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Bar */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex space-x-1.5 overflow-x-auto flex-shrink-0">
            {[
              { label: "💰 Subsidy", msg: "Tell me about PM Surya Ghar subsidy of ₹78000" },
              { label: "📋 Quote", msg: "I want a price quotation for solar panels" },
              { label: "📍 Site Visit", msg: "Book a free site visit for solar installation" },
              { label: "📞 Expert", msg: "I want to talk to a solar expert now" }
            ].map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(action.msg)}
                className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 hover:bg-amber-100 whitespace-nowrap transition font-medium"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* WhatsApp CTA */}
          <div className="px-3 pt-1 pb-1 bg-white border-t border-gray-100 flex-shrink-0">
            <a
              href="https://wa.me/919296389097?text=Hi%20ASR%20Enterprises!%20I%20need%20help%20with%20solar%20installation."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition"
            >
              <Phone className="w-3.5 h-3.5" />
              WhatsApp: 9296389097
            </a>
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center space-x-2">
              {/* Voice Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2.5 rounded-full transition flex-shrink-0 ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                    : voiceSupported
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                }`}
                title={isRecording ? "Stop recording" : voiceSupported ? "Voice input (Hindi/English)" : "Voice not supported in this browser"}
                disabled={!voiceSupported && !isRecording}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Upload Bill Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleBillUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition disabled:opacity-50 flex-shrink-0"
                title="Upload electricity bill for AI analysis"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isRecording ? "🎤 Listening..." : "Type or speak..."}
                className="flex-1 px-3.5 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition min-w-0"
                disabled={isLoading || isRecording}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-1.5">
              🎤 Hindi/English Voice • 📄 Bill Analysis • ✨ Gemini AI
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChatWidget;

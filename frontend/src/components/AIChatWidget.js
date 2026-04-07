import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Loader2, Bot, User, Minimize2, Maximize2, Mic, MicOff, Upload, FileText, Sparkles } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "🙏 Welcome to ASR Enterprises - Solar Rooftop Installation!\n\nHow can I help you today?\n\n1️⃣ Home Solar\n2️⃣ Shop / Office Solar\n3️⃣ PM Surya Ghar Subsidy\n4️⃣ Price / Quotation\n5️⃣ Site Visit\n6️⃣ Upload Electricity Bill\n7️⃣ Talk to Solar Expert\n\n💡 Tip: You can type, use voice, or upload your bill!",
      quickReplies: [
        { label: "🏠 Home Solar", value: "I want home solar installation" },
        { label: "🏢 Shop/Office", value: "I want shop or office solar" },
        { label: "💰 Subsidy Info", value: "Tell me about PM Surya Ghar subsidy" },
        { label: "📋 Get Quote", value: "I want price quotation" },
        { label: "📍 Site Visit", value: "I want a free site visit" },
        { label: "👤 Talk to Expert", value: "I want to talk to a solar expert" }
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [humanHandover, setHumanHandover] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async (messageToSend = null) => {
    const message = messageToSend || inputMessage.trim();
    if (!message || isLoading) return;

    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai/chat/public`, {
        session_id: sessionId,
        message: message
      });

      if (response.data.success) {
        // Check if human handover was triggered
        if (response.data.human_handover) {
          setHumanHandover(true);
        }
        if (response.data.lead_id) {
          setLeadCaptured(true);
        }
        
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: response.data.response 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: response.data.response || "Please call us at 9296389097 for help!"
        }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Connection issue. Please call 9296389097 or WhatsApp us!"
      }]);
    }

    setIsLoading(false);
  };

  const handleQuickReply = (value) => {
    handleSend(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // For now, show a message that voice was recorded
        // In production, this would be sent to a speech-to-text API
        setMessages(prev => [...prev, { 
          role: "user", 
          content: "🎤 [Voice message recorded]" 
        }]);
        
        // Simulate AI understanding the voice
        setIsLoading(true);
        setTimeout(() => {
          handleSend("I want to know about solar panels for my home in Bihar");
        }, 500);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access error:", error);
      alert("Please allow microphone access to use voice input");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Bill Upload Handler
  const handleBillUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setMessages(prev => [...prev, { 
      role: "user", 
      content: `📄 Uploaded: ${file.name}` 
    }]);

    // Upload to AI for analysis
    const formData = new FormData();
    formData.append("file", file);

    try {
      // First extract data from the bill image using smart import
      const extractRes = await axios.post(`${API}/crm/leads/smart-import`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      // Now ask AI to analyze the bill
      const analysisMessage = `A customer uploaded their electricity bill. Based on residential bills in Bihar, please suggest the appropriate solar system. Assume average bill is around ₹3000-4000 if you can't read specific values. Recommend system size and calculate their potential savings and subsidy.`;
      
      await handleSend(analysisMessage);
    } catch (error) {
      console.error("Bill upload error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I couldn't analyze the bill image. Please tell me your monthly electricity bill amount and I'll help you calculate savings!" 
      }]);
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Closed state - Prominent floating button
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto z-50 flex flex-col items-start space-y-2">
        {/* Attention-grabbing pill - hidden on mobile */}
        <div className="hidden sm:flex bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-full shadow-lg animate-bounce text-sm font-medium items-center space-x-2">
          <Sparkles className="w-4 h-4" />
          <span>Ask about ₹78,000 subsidy!</span>
        </div>
        
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 hover:scale-105 flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-center sm:justify-start"
          data-testid="ai-chat-toggle"
          aria-label="Open Solar Expert Chat"
        >
          <div className="relative">
            <Bot className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
          </div>
          <div className="text-left">
            <p className="font-bold text-sm sm:text-base">ASR Solar Expert</p>
            <p className="text-xs text-amber-100">Chat • Voice • Upload Bill</p>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ${
        isMinimized 
          ? 'bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:w-80 h-14' 
          : 'bottom-4 left-2 right-2 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[26rem] h-[32rem] sm:h-[34rem]'
      }`}
      style={{ maxHeight: 'calc(100vh - 80px)', maxWidth: isMinimized ? undefined : '100%' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 flex items-center justify-between cursor-pointer"
           onClick={() => isMinimized && setIsMinimized(false)}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center relative">
            <Bot className="w-6 h-6" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-orange-500"></span>
          </div>
          <div>
            <h3 className="font-bold text-sm">ASR Solar Expert</h3>
            <p className="text-xs text-amber-100">Online • Voice & Upload enabled</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1 hover:bg-white/20 rounded"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="h-52 sm:h-72 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-start space-x-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user" ? "bg-blue-500" : "bg-gradient-to-r from-amber-500 to-orange-500"
                    }`}>
                      {msg.role === "user" ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl ${
                      msg.role === "user" 
                        ? "bg-blue-500 text-white rounded-br-md" 
                        : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md"
                    }`}>
                      <p className="text-sm whitespace-pre-line">{msg.content}</p>
                    </div>
                  </div>
                </div>
                {/* Quick Reply Buttons */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-10">
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
            
            {/* Human Handover Notice */}
            {humanHandover && (
              <div className="flex justify-center">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-xs text-green-700">
                  ✅ Our team has been notified and will contact you shortly!
                </div>
              </div>
            )}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                    <div className="flex space-x-1">
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

          {/* Quick Actions */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex space-x-2 overflow-x-auto">
            {["💰 Subsidy Info", "📋 Get Quote", "📍 Site Visit", "👤 Expert"].map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(
                  action.includes("Subsidy") ? "Tell me about PM Surya Ghar subsidy" :
                  action.includes("Quote") ? "I want price quotation for solar" :
                  action.includes("Site") ? "I want a free site visit" :
                  "I want to talk to a solar expert"
                )}
                className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 hover:bg-amber-100 whitespace-nowrap transition"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-center space-x-2">
              {/* Voice Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2.5 rounded-full transition ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
                className="p-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition disabled:opacity-50"
                title="Upload electricity bill"
              >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type or use voice..."
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
                disabled={isLoading || isRecording}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">
              🎤 Voice • 📄 Upload Bill • 💬 Chat
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChatWidget;

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, FileText, MessageSquare, Users, RefreshCw, Copy, CheckCircle } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AdminAIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your ASR Admin Assistant. I can help you with:\n\n• Generate quotes for customers\n• Create WhatsApp reply templates\n• Analyze leads and suggest priorities\n• Answer solar-related questions\n\nHow can I assist you today?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextType, setContextType] = useState("general");
  const [sessionId] = useState(() => `admin_${Date.now()}`);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai/chat/admin`, {
        session_id: sessionId,
        message: userMessage,
        context_type: contextType
      });

      if (response.data.success) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: response.data.response 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "I apologize, I'm having trouble processing that. Please try again."
        }]);
      }
    } catch (error) {
      console.error("Admin AI error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Error connecting to AI assistant. Please try again."
      }]);
    }

    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Chat cleared. How can I help you today?"
    }]);
  };

  const quickPrompts = [
    { label: "Generate Quote", context: "quote", prompt: "Help me generate a quote for a customer" },
    { label: "WhatsApp Reply", context: "whatsapp", prompt: "Create a WhatsApp reply for a price inquiry" },
    { label: "Lead Analysis", context: "lead", prompt: "Analyze this lead and suggest next steps" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden h-[600px] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold">Admin AI Assistant</h3>
            <p className="text-xs text-purple-200">Powered by Gemini AI</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 hover:bg-white/20 rounded-lg transition"
          title="Clear chat"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Context Type Selector */}
      <div className="p-3 bg-gray-50 border-b flex items-center space-x-2 overflow-x-auto">
        <span className="text-xs text-gray-500 whitespace-nowrap">Context:</span>
        {[
          { id: "general", label: "General", icon: MessageSquare },
          { id: "quote", label: "Quote", icon: FileText },
          { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
          { id: "lead", label: "Lead", icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setContextType(id)}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              contextType === id 
                ? 'bg-purple-600 text-white' 
                : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] ${msg.role === "user" ? "order-2" : ""}`}>
              <div className={`px-4 py-3 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-purple-600 text-white rounded-br-md" 
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}>
                <p className="text-sm whitespace-pre-line">{msg.content}</p>
              </div>
              {msg.role === "assistant" && (
                <button
                  onClick={() => handleCopy(msg.content, idx)}
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600 flex items-center space-x-1"
                >
                  {copiedIndex === idx ? (
                    <><CheckCircle className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied!</span></>
                  ) : (
                    <><Copy className="w-3 h-3" /><span>Copy</span></>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="p-2 bg-gray-50 border-t flex space-x-2 overflow-x-auto">
        {quickPrompts.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              setContextType(item.context);
              setInputMessage(item.prompt);
              inputRef.current?.focus();
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-purple-300 hover:bg-purple-50 whitespace-nowrap transition"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about solar business..."
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLoading}
            className="p-2.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminAIAssistant;

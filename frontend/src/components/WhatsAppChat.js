import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, Loader2, Bot, User, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const WhatsAppChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [chatStarted, setChatStarted] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startChat = () => {
    if (userPhone.trim()) {
      setChatStarted(true);
      setMessages([{
        type: "bot",
        text: "Hello! Welcome to ASR Enterprises. I'm your AI assistant. How can I help you with solar energy solutions today?"
      }]);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userMsg = inputMessage;
    setMessages(prev => [...prev, { type: "user", text: userMsg }]);
    setInputMessage("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chat/whatsapp`, {
        user_phone: userPhone,
        message: userMsg,
        session_id: sessionId || undefined
      });

      if (!sessionId) {
        setSessionId(response.data.session_id);
      }

      setMessages(prev => [...prev, {
        type: "bot",
        text: response.data.response
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        type: "bot",
        text: "Sorry, I'm having trouble connecting. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!chatStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
            <ChevronRight className="w-5 h-5 rotate-180" />
            <span>Back to Home</span>
          </Link>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <Bot className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">AI WhatsApp Chatbot</h1>
              <p className="text-gray-600">Get instant answers to your solar energy questions</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Enter Your Phone Number</label>
                <input
                  type="tel"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  data-testid="chat-phone-input"
                />
              </div>

              <button
                onClick={startChat}
                disabled={!userPhone.trim()}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="start-chat-btn"
              >
                Start Chatting
              </button>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">What you can ask:</h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Solar panel costs and installation</li>
                  <li>• Government subsidies and incentives</li>
                  <li>• ROI and savings calculations</li>
                  <li>• Maintenance and warranty information</li>
                  <li>• System sizing and requirements</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Home</span>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-green-600 text-white p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">ASR Solar AI Assistant</h2>
                <p className="text-green-100 text-sm">Online • Powered by AI</p>
              </div>
            </div>
          </div>

          <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50" data-testid="chat-messages-container">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start space-x-3 ${msg.type === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
                data-testid={`chat-message-${index}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.type === "user" ? "bg-blue-500" : "bg-green-500"
                }`}>
                  {msg.type === "user" ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  msg.type === "user" 
                    ? "bg-blue-500 text-white rounded-tr-none" 
                    : "bg-white text-gray-800 shadow-md rounded-tl-none"
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-md">
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-6 bg-white border-t">
            <div className="flex space-x-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={loading}
                data-testid="chat-input"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                data-testid="send-message-btn"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

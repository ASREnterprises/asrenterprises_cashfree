import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Send, Phone, User, Clock, CheckCircle, 
  CheckCheck, XCircle, AlertTriangle, ArrowLeft, Search,
  RefreshCw, FileText, ChevronDown, X, Inbox, MessageCircle
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Status badge component
const StatusBadge = ({ status, direction }) => {
  const getStatusConfig = () => {
    if (direction === 'incoming') {
      return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Received', icon: <MessageCircle className="w-3 h-3" /> };
    }
    
    switch (status) {
      case 'sent':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Sent', icon: <CheckCircle className="w-3 h-3" /> };
      case 'delivered':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Delivered', icon: <CheckCheck className="w-3 h-3" /> };
      case 'read':
        return { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Read', icon: <CheckCheck className="w-3 h-3" /> };
      case 'failed':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed', icon: <XCircle className="w-3 h-3" /> };
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending', icon: <Clock className="w-3 h-3" /> };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: status || 'Unknown', icon: null };
    }
  };
  
  const config = getStatusConfig();
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon}
      {config.label}
    </span>
  );
};

// Conversation List Item
const ConversationItem = ({ conversation, isActive, onClick }) => {
  const { phone, lead, last_message, unread_count, last_activity, within_24h_window } = conversation;
  
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-IN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
  };
  
  const displayName = lead?.name || phone;
  const preview = last_message?.content || last_message?.template_name || '';
  
  return (
    <div
      onClick={onClick}
      data-testid={`conversation-item-${phone}`}
      className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
        isActive ? 'bg-green-50 border-l-4 border-l-green-500' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          lead ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'
        }`}>
          <User className="w-6 h-6 text-white" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {formatTime(last_activity)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">{phone}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 truncate flex-1">
              {last_message?.direction === 'incoming' ? (
                <span className="text-blue-600">📥 </span>
              ) : (
                <span className="text-green-600">📤 </span>
              )}
              {preview.length > 40 ? preview.substring(0, 40) + '...' : preview}
            </p>
            
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {within_24h_window && (
                <span className="w-2 h-2 rounded-full bg-green-500" title="Within 24h window" />
              )}
              {unread_count > 0 && (
                <span className="bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Chat Message Bubble
const ChatBubble = ({ message }) => {
  const isIncoming = message.direction === 'incoming';
  
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
        isIncoming 
          ? 'bg-white border border-gray-200 rounded-tl-md' 
          : 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-tr-md'
      }`}>
        {/* Template indicator */}
        {message.template_name && (
          <div className={`flex items-center gap-1 text-xs mb-1 ${isIncoming ? 'text-purple-600' : 'text-green-100'}`}>
            <FileText className="w-3 h-3" />
            <span>Template: {message.template_name}</span>
          </div>
        )}
        
        {/* Message content */}
        <p className={`text-sm whitespace-pre-wrap ${isIncoming ? 'text-gray-800' : 'text-white'}`}>
          {message.content || message.template_name || '(No content)'}
        </p>
        
        {/* Footer with time and status */}
        <div className={`flex items-center justify-end gap-2 mt-2 ${isIncoming ? 'text-gray-400' : 'text-green-100'}`}>
          <span className="text-xs">{formatTime(message.created_at)}</span>
          {!isIncoming && <StatusBadge status={message.status} direction={message.direction} />}
        </div>
      </div>
    </div>
  );
};

// Template Selector Component
const TemplateSelector = ({ templates, selectedTemplate, onSelect, variables, onVariablesChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = templates.find(t => t.template_name === selectedTemplate);
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-100 rounded-xl text-left flex items-center justify-between hover:bg-gray-200 transition"
      >
        <div>
          <span className="text-sm font-medium text-gray-700">
            {selected?.display_name || 'Select Template'}
          </span>
          {selected && (
            <span className="ml-2 text-xs text-gray-500">({selected.template_name})</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-500 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-64 overflow-y-auto z-50">
          {templates.map(template => (
            <button
              key={template.template_name}
              type="button"
              onClick={() => {
                onSelect(template.template_name);
                // Initialize variables
                if (template.has_variables && template.variable_count > 0) {
                  onVariablesChange(Array(template.variable_count).fill(''));
                } else {
                  onVariablesChange([]);
                }
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 ${
                selectedTemplate === template.template_name ? 'bg-green-50' : ''
              }`}
            >
              <div className="font-medium text-gray-800">{template.display_name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {template.template_name} • {template.category} 
                {template.has_variables && ` • ${template.variable_count} variable(s)`}
              </div>
              <div className="text-xs text-gray-400 mt-1">{template.description}</div>
            </button>
          ))}
        </div>
      )}
      
      {/* Variables input */}
      {selected?.has_variables && selected?.variable_count > 0 && (
        <div className="mt-3 space-y-2">
          {Array(selected.variable_count).fill(0).map((_, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Variable ${idx + 1} (e.g., customer name)`}
              value={variables[idx] || ''}
              onChange={(e) => {
                const newVars = [...variables];
                newVars[idx] = e.target.value;
                onVariablesChange(newVars);
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main WhatsApp Inbox Component
export const WhatsAppInbox = ({ onOpenFromLead = null }) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatThread, setChatThread] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Reply form state
  const [replyMode, setReplyMode] = useState('template'); // 'template' or 'text'
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVariables, setTemplateVariables] = useState([]);
  const [textMessage, setTextMessage] = useState('');
  
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const [convRes, unreadRes] = await Promise.all([
        axios.get(`${API}/api/whatsapp/conversations?limit=100`),
        axios.get(`${API}/api/whatsapp/conversations/unread-count`)
      ]);
      setConversations(convRes.data.conversations || []);
      setUnreadCount(unreadRes.data.unread_count || 0);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/whatsapp/templates`);
      setTemplates(res.data || []);
      if (res.data.length > 0) {
        setSelectedTemplate(res.data[0].template_name);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, []);
  
  // Fetch chat thread
  const fetchChatThread = useCallback(async (phone) => {
    setChatLoading(true);
    try {
      const res = await axios.get(`${API}/api/whatsapp/conversations/${encodeURIComponent(phone)}`);
      setChatThread(res.data);
      // Reset reply form
      setTextMessage('');
      setError('');
      // Refresh unread count
      const unreadRes = await axios.get(`${API}/api/whatsapp/conversations/unread-count`);
      setUnreadCount(unreadRes.data.unread_count || 0);
    } catch (err) {
      console.error('Error fetching chat thread:', err);
      setError('Failed to load conversation');
    } finally {
      setChatLoading(false);
    }
  }, []);
  
  // Open conversation by lead ID
  const openConversationByLead = useCallback(async (leadId) => {
    setChatLoading(true);
    try {
      const res = await axios.get(`${API}/api/whatsapp/conversations/by-lead/${leadId}`);
      setChatThread(res.data);
      setSelectedConversation(res.data.phone);
    } catch (err) {
      console.error('Error opening lead conversation:', err);
      setError(err.response?.data?.detail || 'Failed to load conversation');
    } finally {
      setChatLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchConversations();
    fetchTemplates();
    
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchTemplates]);
  
  // Handle external open from lead
  useEffect(() => {
    if (onOpenFromLead) {
      openConversationByLead(onOpenFromLead);
    }
  }, [onOpenFromLead, openConversationByLead]);
  
  // Scroll to bottom when chat loads
  useEffect(() => {
    if (chatContainerRef.current && chatThread?.messages) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatThread?.messages]);
  
  // Handle conversation selection
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv.phone);
    fetchChatThread(conv.phone);
  };
  
  // Send template message
  const handleSendTemplate = async () => {
    if (!selectedConversation || !selectedTemplate) return;
    
    setSending(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/api/whatsapp/conversations/${encodeURIComponent(selectedConversation)}/send-template`, {
        template_name: selectedTemplate,
        variables: templateVariables.filter(v => v)
      });
      
      if (res.data.success) {
        // Refresh chat thread
        await fetchChatThread(selectedConversation);
        setTemplateVariables([]);
      } else {
        setError(res.data.error || 'Failed to send template');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };
  
  // Send free-form text
  const handleSendText = async () => {
    if (!selectedConversation || !textMessage.trim()) return;
    
    if (!chatThread?.within_24h_window) {
      setError('Outside 24-hour window. Please send an approved template.');
      return;
    }
    
    setSending(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/api/whatsapp/conversations/${encodeURIComponent(selectedConversation)}/send-text`, {
        text: textMessage.trim()
      });
      
      if (res.data.success) {
        // Refresh chat thread
        await fetchChatThread(selectedConversation);
        setTextMessage('');
      } else {
        setError(res.data.error || 'Failed to send message');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };
  
  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      conv.phone.toLowerCase().includes(search) ||
      conv.lead?.name?.toLowerCase().includes(search) ||
      conv.last_message?.content?.toLowerCase().includes(search)
    );
  });
  
  // Mobile view state
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  const handleMobileBack = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
    setChatThread(null);
  };
  
  const handleMobileSelectConversation = (conv) => {
    handleSelectConversation(conv);
    setShowMobileChat(true);
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
      <div className="flex h-full">
        {/* Conversation List - Hidden on mobile when chat is open */}
        <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-green-600">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Inbox className="w-6 h-6 text-white" />
                <h2 className="text-lg font-bold text-white">WhatsApp Inbox</h2>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <span className="bg-white text-green-600 text-xs font-bold rounded-full px-2 py-1">
                    {unreadCount} new
                  </span>
                )}
                <button
                  onClick={fetchConversations}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-200" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/20 text-white placeholder-green-100 rounded-xl focus:bg-white/30 focus:outline-none transition"
              />
            </div>
          </div>
          
          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <ConversationItem
                  key={conv.phone}
                  conversation={conv}
                  isActive={selectedConversation === conv.phone}
                  onClick={() => handleMobileSelectConversation(conv)}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Chat Panel - Full screen on mobile when open */}
        <div className={`flex-1 flex flex-col ${!showMobileChat && !selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a conversation from the list to view messages</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  {/* Back button for mobile */}
                  <button
                    onClick={handleMobileBack}
                    className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    chatThread?.lead ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'
                  }`}>
                    <User className="w-6 h-6 text-white" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">
                      {chatThread?.lead?.name || selectedConversation}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="w-3 h-3" />
                      <span>{selectedConversation}</span>
                      {chatThread?.lead && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">{chatThread.lead.stage}</span>
                          {chatThread.lead.district && (
                            <>
                              <span>•</span>
                              <span>{chatThread.lead.district}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* 24h Window Indicator */}
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
                    chatThread?.within_24h_window 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {chatThread?.within_24h_window ? '24h Active' : 'Template Only'}
                  </div>
                </div>
              </div>
              
              {/* Chat Messages */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 bg-gray-100"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
              >
                {chatLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                  </div>
                ) : chatThread?.messages?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Send a template to start the conversation</p>
                  </div>
                ) : (
                  chatThread?.messages?.map((msg, idx) => (
                    <ChatBubble key={msg.id || idx} message={msg} />
                  ))
                )}
              </div>
              
              {/* Reply Box */}
              <div className="border-t border-gray-200 bg-white p-4">
                {/* Error message */}
                {error && (
                  <div className="mb-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* 24h Warning */}
                {!chatThread?.within_24h_window && replyMode === 'text' && (
                  <div className="mb-3 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Outside 24-hour window. Please send an approved template instead.</span>
                  </div>
                )}
                
                {/* Mode Tabs */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setReplyMode('template')}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition ${
                      replyMode === 'template'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-1" />
                    Send Template
                  </button>
                  <button
                    onClick={() => setReplyMode('text')}
                    disabled={!chatThread?.within_24h_window}
                    className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition ${
                      replyMode === 'text'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${!chatThread?.within_24h_window ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    Free Text {!chatThread?.within_24h_window && '(Locked)'}
                  </button>
                </div>
                
                {/* Template Selector */}
                {replyMode === 'template' && (
                  <div className="mb-3">
                    <TemplateSelector
                      templates={templates}
                      selectedTemplate={selectedTemplate}
                      onSelect={setSelectedTemplate}
                      variables={templateVariables}
                      onVariablesChange={setTemplateVariables}
                    />
                  </div>
                )}
                
                {/* Text Input */}
                {replyMode === 'text' && chatThread?.within_24h_window && (
                  <div className="mb-3">
                    <textarea
                      ref={inputRef}
                      value={textMessage}
                      onChange={(e) => setTextMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-100 rounded-xl resize-none focus:ring-2 focus:ring-green-500 focus:bg-white transition"
                    />
                  </div>
                )}
                
                {/* Send Button */}
                <button
                  onClick={replyMode === 'template' ? handleSendTemplate : handleSendText}
                  disabled={sending || (replyMode === 'template' ? !selectedTemplate : !textMessage.trim() || !chatThread?.within_24h_window)}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="send-reply-btn"
                >
                  {sending ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInbox;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Send, Phone, User, Clock, CheckCircle, 
  CheckCheck, XCircle, AlertTriangle, ArrowLeft, Search,
  RefreshCw, FileText, ChevronDown, X, Inbox, MessageCircle,
  Trash2, Paperclip, Image, File, Video, Upload, CheckSquare, Square, Bell
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
const ConversationItem = ({ conversation, isActive, onClick, selectionMode, isSelected, onToggleSelect }) => {
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
  
  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect && onToggleSelect(phone);
    } else {
      onClick();
    }
  };
  
  return (
    <div
      onClick={handleClick}
      data-testid={`conversation-item-${phone}`}
      className={`p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition ${
        isActive ? 'bg-green-50 border-l-4 border-l-green-500' : ''
      } ${isSelected ? 'bg-red-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        {selectionMode && (
          <div className="flex items-center justify-center pt-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect && onToggleSelect(phone)}
              className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
          </div>
        )}
        
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

// Chat Message Bubble - Mobile Optimized & Fixed Width
const ChatBubble = ({ message, selectionMode, isSelected, onToggleSelect, onDelete }) => {
  const isIncoming = message.direction === 'incoming';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
  };
  
  const handleDelete = () => {
    onDelete(message.id);
    setShowDeleteConfirm(false);
  };
  
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-2 px-1 sm:px-2 group`}>
      {/* Selection checkbox */}
      {selectionMode && (
        <button 
          onClick={() => onToggleSelect(message.id)}
          className={`mr-1 flex-shrink-0 self-center p-1 rounded ${isSelected ? 'text-green-500' : 'text-gray-400'}`}
        >
          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      )}
      
      <div className={`relative max-w-[90%] sm:max-w-[80%] md:max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
        isIncoming 
          ? 'bg-white text-gray-800 rounded-tl-none' 
          : 'bg-[#dcf8c6] text-gray-800 rounded-tr-none'
      }`}>
        {/* Delete button (tap on mobile, hover on desktop) */}
        {!selectionMode && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className={`absolute -top-2 ${isIncoming ? '-right-2' : '-left-2'} md:opacity-0 md:group-hover:opacity-100 opacity-100 transition p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600`}
            title="Delete message"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        
        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className={`absolute -top-10 ${isIncoming ? 'left-0' : 'right-0'} bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-10 flex items-center gap-1`}>
            <span className="text-xs text-gray-600">Delete?</span>
            <button onClick={handleDelete} className="text-xs bg-red-500 text-white px-2 py-1 rounded">Yes</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">No</button>
          </div>
        )}
        
        {/* Template indicator */}
        {message.template_name && (
          <div className="flex items-center gap-1 text-xs mb-1 text-purple-600">
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="break-all">Template: {message.template_name}</span>
          </div>
        )}
        
        {/* Media content */}
        {message.type && message.type !== 'text' && message.media_url && (
          <div className="mb-2">
            {message.type === 'image' && (
              <img src={message.media_url} alt="Shared" className="max-w-full rounded-lg max-h-40 object-cover" />
            )}
            {message.type === 'video' && (
              <video src={message.media_url} controls className="max-w-full rounded-lg max-h-40" />
            )}
            {message.type === 'document' && (
              <a href={message.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600">
                <File className="w-4 h-4" />
                <span className="text-sm underline truncate">{message.filename || 'Document'}</span>
              </a>
            )}
          </div>
        )}
        
        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content || message.template_name || '(No content)'}
        </p>
        
        {/* Footer with time and status - WhatsApp style */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-500">
          <span>{formatTime(message.created_at)}</span>
          {!isIncoming && <StatusBadge status={message.status} direction={message.direction} />}
        </div>
      </div>
    </div>
  );
};

// Collapsible variables panel — hidden by default to preserve chat space on mobile
const VariablesPanel = ({ count, variables, onVariablesChange }) => {
  const [open, setOpen] = useState(false);
  const filled = variables.filter(v => v && v.trim()).length;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-gray-500 hover:text-green-700 transition py-1"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
        <span>
          {open ? 'Hide' : 'Fill'} template variables
          {filled > 0 && !open && (
            <span className="ml-1 text-green-600 font-medium">({filled}/{count} filled)</span>
          )}
          {filled === 0 && !open && (
            <span className="ml-1 text-amber-500">(optional)</span>
          )}
        </span>
      </button>
      {open && (
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {Array(count).fill(0).map((_, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Var ${idx + 1}`}
              value={variables[idx] || ''}
              onChange={(e) => {
                const newVars = [...variables];
                newVars[idx] = e.target.value;
                onVariablesChange(newVars);
              }}
              className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-green-500 focus:border-transparent"
            />
          ))}
        </div>
      )}
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
      
      {/* Variables input — collapsed by default to save screen space */}
      {selected?.has_variables && selected?.variable_count > 0 && (
        <VariablesPanel
          count={selected.variable_count}
          variables={variables}
          onVariablesChange={onVariablesChange}
        />
      )}
    </div>
  );
};

// Main WhatsApp Inbox Component with Real-time Updates
export const WhatsAppInbox = ({ onOpenFromLead = null, staffMode = false, staffId = null, staffLeadIds = [], openLeadPhone = null, onLeadOpened = null, onNewMessage = null }) => {
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
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [newMessagePhone, setNewMessagePhone] = useState(null);
  
  // Mobile state
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  // Reply form state
  const [replyMode, setReplyMode] = useState('template'); // 'template', 'text', or 'media'
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVariables, setTemplateVariables] = useState([]);
  const [textMessage, setTextMessage] = useState('');
  
  // Quick reply state
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const quickReplies = [
    { label: "👋 Hello", text: "Hello! How can I help you today?" },
    { label: "📞 Call You", text: "I'll call you shortly to discuss further." },
    { label: "✅ Noted", text: "Noted. I'll follow up on this." },
    { label: "📅 Schedule", text: "Would you like to schedule a site visit?" },
    { label: "💰 Quote", text: "I'll prepare a quotation and share it with you soon." },
    { label: "🙏 Thanks", text: "Thank you for your interest in our solar solutions!" }
  ];
  
  // Delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Conversation bulk selection state
  const [conversationSelectionMode, setConversationSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState(new Set());
  const [deletingConversations, setDeletingConversations] = useState(false);
  
  // Media upload state
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Handle openLeadPhone prop to auto-open a conversation
  useEffect(() => {
    if (openLeadPhone) {
      const cleanPhone = openLeadPhone.replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
      setSelectedConversation(phoneWithCountry);
      fetchChatThread(phoneWithCountry);
      setShowMobileChat(true);
      if (onLeadOpened) onLeadOpened();
    }
  }, [openLeadPhone]);
  
  // Fetch conversations - staff mode filters by assigned leads
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const [convRes, unreadRes] = await Promise.all([
        axios.get(`${API}/api/whatsapp/conversations?limit=100`),
        axios.get(`${API}/api/whatsapp/conversations/unread-count`)
      ]);
      
      let allConversations = convRes.data.conversations || [];
      
      // In staff mode, filter to only show conversations for staff's assigned leads
      if (staffMode && staffLeadIds.length > 0) {
        allConversations = allConversations.filter(conv => 
          conv.lead && staffLeadIds.includes(conv.lead.id)
        );
      }
      
      // Check for new messages (compare total message count)
      const totalMessages = allConversations.reduce((sum, c) => sum + (c.message_count || 0), 0);
      if (lastMessageCount > 0 && totalMessages > lastMessageCount) {
        setHasNewMessages(true);
        // Find which conversation has new messages
        const newConv = allConversations.find(c => c.has_unread);
        if (newConv) {
          setNewMessagePhone(newConv.phone);
          // Callback for parent component (StaffPortal) notification
          if (onNewMessage) {
            onNewMessage({
              phone: newConv.phone,
              lead: newConv.lead,
              unread: unreadRes.data.unread_count
            });
          }
        }
        // Auto-refresh current chat if we have new messages there
        if (selectedConversation) {
          const currentConv = allConversations.find(c => c.phone === selectedConversation);
          if (currentConv?.has_unread) {
            fetchChatThread(selectedConversation);
          }
        }
      }
      setLastMessageCount(totalMessages);
      
      setConversations(allConversations);
      setUnreadCount(unreadRes.data.unread_count || 0);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [staffMode, staffLeadIds, lastMessageCount, selectedConversation, onNewMessage]);
  
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
    
    // Poll for new messages - faster interval for staff mode (5s) vs admin (10s)
    const pollInterval = staffMode ? 5000 : 10000;
    const interval = setInterval(() => fetchConversations(true), pollInterval);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchTemplates, staffMode]);
  
  // Re-fetch when staff leads change (immediate refresh when lead assigned)
  useEffect(() => {
    if (staffMode && staffLeadIds.length > 0) {
      // Immediate fetch when leads change
      fetchConversations();
      setHasNewMessages(false); // Reset notification
    }
  }, [staffMode, staffLeadIds.length, fetchConversations]);
  
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
  
  // ==================== DELETE FUNCTIONS ====================
  
  // Delete single message
  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(`${API}/api/whatsapp/messages/${messageId}`);
      // Refresh chat thread
      await fetchChatThread(selectedConversation);
    } catch (err) {
      setError('Failed to delete message');
    }
  };
  
  // Toggle message selection
  const toggleMessageSelection = (messageId) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };
  
  // Bulk delete selected messages
  const handleBulkDelete = async () => {
    if (selectedMessages.size === 0) return;
    
    setDeleting(true);
    try {
      await axios.post(`${API}/api/whatsapp/messages/bulk-delete`, {
        message_ids: [...selectedMessages]
      });
      setSelectedMessages(new Set());
      setSelectionMode(false);
      await fetchChatThread(selectedConversation);
    } catch (err) {
      setError('Failed to delete messages');
    } finally {
      setDeleting(false);
    }
  };
  
  // Clear entire conversation
  const handleClearConversation = async () => {
    if (!selectedConversation) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${API}/api/whatsapp/conversations/${encodeURIComponent(selectedConversation)}/clear`);
      setShowClearConfirm(false);
      await fetchChatThread(selectedConversation);
      await fetchConversations();
    } catch (err) {
      setError('Failed to clear conversation');
    } finally {
      setDeleting(false);
    }
  };
  
  // ==================== MEDIA UPLOAD FUNCTIONS ====================
  
  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: Images, Videos, PDF, Word documents');
      return;
    }
    
    // Validate file size (max 25MB for videos, 8MB for images/docs)
    const maxSize = file.type.startsWith('video') ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`);
      return;
    }
    
    setMediaFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image')) {
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }
    
    setShowMediaUpload(true);
  };
  
  // Get media type from file
  const getMediaType = (file) => {
    if (file.type.startsWith('image')) return 'image';
    if (file.type.startsWith('video')) return 'video';
    return 'document';
  };
  
  // Send media message
  const handleSendMedia = async () => {
    if (!mediaFile || !selectedConversation) return;
    
    if (!chatThread?.within_24h_window) {
      setError('Outside 24-hour window. Media can only be sent within 24 hours of customer\'s last message.');
      return;
    }
    
    setUploadingMedia(true);
    setError('');
    
    try {
      // First upload to object storage
      const formData = new FormData();
      formData.append('file', mediaFile);
      
      const uploadRes = await axios.post(`${API}/api/social/upload/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (!uploadRes.data.success) {
        throw new Error('Failed to upload file');
      }
      
      // Get public URL for the file
      const urlRes = await axios.get(`${API}/api/social/files/${uploadRes.data.file_id}/url`);
      const mediaUrl = urlRes.data.url;
      
      // Send media via WhatsApp
      const res = await axios.post(`${API}/api/whatsapp/conversations/${encodeURIComponent(selectedConversation)}/send-media`, {
        media_type: getMediaType(mediaFile),
        media_url: mediaUrl,
        caption: mediaCaption.trim(),
        filename: mediaFile.name
      });
      
      if (res.data.success) {
        // Reset and refresh
        setMediaFile(null);
        setMediaPreview(null);
        setMediaCaption('');
        setShowMediaUpload(false);
        await fetchChatThread(selectedConversation);
      } else {
        setError(res.data.error || 'Failed to send media');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to send media');
    } finally {
      setUploadingMedia(false);
    }
  };
  
  // Cancel media upload
  const cancelMediaUpload = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaCaption('');
    setShowMediaUpload(false);
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
  
  const handleMobileBack = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
    setChatThread(null);
  };
  
  // Toggle conversation selection
  const toggleConversationSelection = (phone) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phone)) {
        newSet.delete(phone);
      } else {
        newSet.add(phone);
      }
      return newSet;
    });
  };
  
  // Select/Deselect all conversations
  const toggleAllConversations = () => {
    if (selectedConversations.size === filteredConversations.length) {
      setSelectedConversations(new Set());
    } else {
      setSelectedConversations(new Set(filteredConversations.map(c => c.phone)));
    }
  };
  
  // Bulk delete selected conversations
  const bulkDeleteConversations = async () => {
    if (selectedConversations.size === 0) return;
    
    setDeletingConversations(true);
    try {
      const res = await axios.post(`${API}/api/whatsapp/conversations/bulk-delete`, {
        phone_numbers: Array.from(selectedConversations)
      });
      
      if (res.data.success) {
        setSelectedConversations(new Set());
        setConversationSelectionMode(false);
        await fetchConversations();
      }
    } catch (err) {
      console.error('Error deleting conversations:', err);
      setError('Failed to delete conversations');
    } finally {
      setDeletingConversations(false);
    }
  };
  
  const handleMobileSelectConversation = (conv) => {
    handleSelectConversation(conv);
    setShowMobileChat(true);
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 160px)', minHeight: '450px', maxHeight: '800px' }}>
      <div className="flex h-full">
        {/* Conversation List - Full width on mobile, hidden when chat open */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Header - WhatsApp style */}
          <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-bold text-white">WhatsApp</h2>
                  {staffMode && <span className="text-xs text-green-100">Your leads only</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <span className="bg-white text-green-600 text-xs font-bold rounded-full px-2 py-1 min-w-[24px] text-center">
                    {unreadCount}
                  </span>
                )}
                {/* Bulk Delete Toggle */}
                <button
                  onClick={() => {
                    setConversationSelectionMode(!conversationSelectionMode);
                    setSelectedConversations(new Set());
                  }}
                  className={`p-2 rounded-full transition ${conversationSelectionMode ? 'bg-white text-green-600' : 'text-white hover:bg-white/20'}`}
                  title={conversationSelectionMode ? "Cancel Selection" : "Select Chats to Delete"}
                >
                  {conversationSelectionMode ? <X className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={fetchConversations}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {/* Bulk Selection Controls */}
            {conversationSelectionMode && (
              <div className="mt-3 flex items-center justify-between bg-white/20 rounded-lg p-2">
                <button
                  onClick={toggleAllConversations}
                  className="flex items-center gap-2 text-white text-sm"
                >
                  {selectedConversations.size === filteredConversations.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>Select All ({selectedConversations.size}/{filteredConversations.length})</span>
                </button>
                {selectedConversations.size > 0 && (
                  <button
                    onClick={bulkDeleteConversations}
                    disabled={deletingConversations}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1"
                  >
                    {deletingConversations ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete ({selectedConversations.size})
                  </button>
                )}
              </div>
            )}
            
            {/* Search - Compact for mobile */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-200" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/20 text-white placeholder-green-100 rounded-full text-sm focus:bg-white/30 focus:outline-none transition"
              />
            </div>
          </div>
          
          {/* New Messages Banner - Animated */}
          {hasNewMessages && (
            <div 
              className="bg-green-500 text-white px-3 py-2 flex items-center justify-center gap-2 cursor-pointer animate-pulse"
              onClick={() => {
                fetchConversations();
                setHasNewMessages(false);
                if (newMessagePhone) {
                  const conv = conversations.find(c => c.phone === newMessagePhone);
                  if (conv) handleMobileSelectConversation(conv);
                }
              }}
            >
              <Bell className="w-4 h-4" />
              <span className="text-sm font-medium">New message received! Tap to view</span>
            </div>
          )}
          
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
                  selectionMode={conversationSelectionMode}
                  isSelected={selectedConversations.has(conv.phone)}
                  onToggleSelect={toggleConversationSelection}
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
                  
                  {/* Avatar - Smaller on mobile */}
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    chatThread?.lead ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'
                  }`}>
                    <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  
                  {/* Info - Compact for mobile */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">
                      {chatThread?.lead?.name || selectedConversation}
                    </h3>
                    <div className="flex items-center gap-1 md:gap-2 text-xs text-gray-500 truncate">
                      <span className="hidden md:inline-flex items-center gap-1"><Phone className="w-3 h-3" />{selectedConversation}</span>
                      <span className="md:hidden">{selectedConversation.slice(-10)}</span>
                      {chatThread?.lead?.stage && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">{chatThread.lead.stage}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* 24h Window - Icon only on mobile */}
                  <div className={`flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs font-medium ${
                    chatThread?.within_24h_window 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Clock className="w-3 h-3" />
                    <span className="hidden md:inline">{chatThread?.within_24h_window ? '24h Active' : 'Template Only'}</span>
                  </div>
                  
                  {/* Delete Controls - Compact */}
                  <div className="flex items-center gap-1 md:gap-2">
                    {selectionMode ? (
                      <>
                        <span className="text-xs text-gray-500 hidden md:inline">{selectedMessages.size}</span>
                        <button
                          onClick={handleBulkDelete}
                          disabled={selectedMessages.size === 0 || deleting}
                          className="p-1.5 md:p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                          title="Delete selected"
                        >
                          {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }}
                          className="p-1.5 md:p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectionMode(true)}
                          className="p-1.5 md:p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition"
                          title="Select messages to delete"
                          data-testid="select-messages-btn"
                        >
                          <CheckSquare className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="p-1.5 md:p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Clear entire conversation"
                          data-testid="clear-conversation-btn"
                        >
                          <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Clear Conversation Confirmation */}
                {showClearConfirm && (
                  <div className="mt-2 p-2 md:p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                    <span className="text-red-700 text-xs md:text-sm">Delete all messages?</span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearConversation}
                        disabled={deleting}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs md:text-sm hover:bg-red-600 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs md:text-sm hover:bg-gray-300"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Chat Messages - WhatsApp style background with proper mobile scrolling */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 md:p-4 bg-[#e5ddd5]"
                style={{ 
                  backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAABF0lEQVR4nO3YMUrDUBjA8f9rXcQT6BnE0aFbZ8EL6OIp3N1cPI3DwUXBU+gNHFwVHBzaJTi4JL4kJNBq2kLNn8D/7OB9/B5JfjwAAAAAAAAAw/O2+6C9vQ8/O3UVGvh6Nb8J6+0/efr6JqnN/ZmJsNxbCI3r/0kkrDePwp6YDZvr5+HV/knY1/Nhcv1yeLH3JN6+ycIrxyAq8RMAAAAASUVORK5CYII=")',
                  backgroundRepeat: 'repeat',
                  WebkitOverflowScrolling: 'touch',
                  minHeight: '200px'
                }}
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
                    <ChatBubble 
                      key={msg.id || idx} 
                      message={msg}
                      selectionMode={selectionMode}
                      isSelected={selectedMessages.has(msg.id)}
                      onToggleSelect={toggleMessageSelection}
                      onDelete={handleDeleteMessage}
                    />
                  ))
                )}
              </div>
              
              {/* Reply Box - Mobile Optimized */}
              <div className="border-t border-gray-200 bg-white p-2 sm:p-3 md:p-4 sticky bottom-0">
                {/* Error message */}
                {error && (
                  <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-red-50 text-red-600 rounded-xl text-xs sm:text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* 24h Warning */}
                {!chatThread?.within_24h_window && replyMode === 'text' && (
                  <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-amber-50 text-amber-700 rounded-xl text-xs sm:text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Outside 24h window. Use template.</span>
                  </div>
                )}
                
                {/* Quick Reply Buttons */}
                {chatThread?.within_24h_window && (
                  <div className="mb-2 sm:mb-3">
                    <button
                      onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className="text-xs sm:text-sm text-gray-600 flex items-center gap-1 mb-2 hover:text-green-600 transition"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${showQuickReplies ? 'rotate-180' : ''}`} />
                      Quick Replies
                    </button>
                    {showQuickReplies && (
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {quickReplies.map((reply, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setTextMessage(reply.text);
                              setReplyMode('text');
                              setShowQuickReplies(false);
                            }}
                            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-700 rounded-full text-[10px] sm:text-xs font-medium transition"
                          >
                            {reply.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Mode Tabs - Compact for mobile */}
                <div className="flex gap-1 sm:gap-2 mb-2 sm:mb-3">
                  <button
                    onClick={() => setReplyMode('template')}
                    className={`flex-1 py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition ${
                      replyMode === 'template'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline mr-1" />
                    <span className="hidden sm:inline">Template</span>
                  </button>
                  <button
                    onClick={() => setReplyMode('text')}
                    disabled={!chatThread?.within_24h_window}
                    className={`flex-1 py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition ${
                      replyMode === 'text'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } ${!chatThread?.within_24h_window ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    <span className="hidden sm:inline">Text</span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!chatThread?.within_24h_window}
                    className={`py-2 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition ${
                      chatThread?.within_24h_window
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={chatThread?.within_24h_window ? 'Attach file' : 'Media only within 24h window'}
                    data-testid="attach-media-btn"
                  >
                    <Paperclip className="w-4 h-4 inline mr-1" />
                    Media
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*,video/mp4,video/quicktime,application/pdf,.doc,.docx"
                    className="hidden"
                  />
                </div>
                
                {/* Media Upload Preview */}
                {showMediaUpload && mediaFile && (
                  <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      {/* Preview */}
                      <div className="flex-shrink-0">
                        {mediaPreview ? (
                          <img src={mediaPreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            {mediaFile.type.startsWith('video') ? (
                              <Video className="w-8 h-8 text-gray-500" />
                            ) : (
                              <File className="w-8 h-8 text-gray-500" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* File Info & Caption */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{mediaFile.name}</span>
                          <button onClick={cancelMediaUpload} className="text-gray-500 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <span className="text-xs text-gray-500 block mb-2">
                          {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                        <input
                          type="text"
                          value={mediaCaption}
                          onChange={(e) => setMediaCaption(e.target.value)}
                          placeholder="Add a caption (optional)..."
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    {/* Send Media Button */}
                    <button
                      onClick={handleSendMedia}
                      disabled={uploadingMedia}
                      className="mt-3 w-full py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                      data-testid="send-media-btn"
                    >
                      {uploadingMedia ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Uploading & Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Media
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* Template Selector */}
                {replyMode === 'template' && !showMediaUpload && (
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
                {replyMode === 'text' && chatThread?.within_24h_window && !showMediaUpload && (
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
                {!showMediaUpload && (
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
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppInbox;

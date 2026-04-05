import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Send, Phone, User, Clock, CheckCircle, 
  CheckCheck, XCircle, AlertTriangle, ArrowLeft, Search,
  RefreshCw, FileText, ChevronDown, X, Inbox, MessageCircle,
  Trash2, Paperclip, Image, File, Video, Upload, CheckSquare, Square
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
const ChatBubble = ({ message, selectionMode, isSelected, onToggleSelect, onDelete }) => {
  const isIncoming = message.direction === 'incoming';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleDelete = () => {
    onDelete(message.id);
    setShowDeleteConfirm(false);
  };
  
  return (
    <div className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} mb-3 group`}>
      {/* Selection checkbox */}
      {selectionMode && (
        <button 
          onClick={() => onToggleSelect(message.id)}
          className={`mr-2 flex-shrink-0 self-center p-1 rounded ${isSelected ? 'text-green-500' : 'text-gray-400'}`}
        >
          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
        </button>
      )}
      
      <div className={`relative max-w-[75%] rounded-2xl px-4 py-3 ${
        isIncoming 
          ? 'bg-white border border-gray-200 rounded-tl-md' 
          : 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-tr-md'
      }`}>
        {/* Delete button (hover) */}
        {!selectionMode && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className={`absolute -top-2 ${isIncoming ? '-right-2' : '-left-2'} opacity-0 group-hover:opacity-100 transition p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600`}
            title="Delete message"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        
        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="absolute -top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-10 flex items-center gap-2">
            <span className="text-xs text-gray-600">Delete?</span>
            <button onClick={handleDelete} className="text-xs bg-red-500 text-white px-2 py-1 rounded">Yes</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">No</button>
          </div>
        )}
        
        {/* Template indicator */}
        {message.template_name && (
          <div className={`flex items-center gap-1 text-xs mb-1 ${isIncoming ? 'text-purple-600' : 'text-green-100'}`}>
            <FileText className="w-3 h-3" />
            <span>Template: {message.template_name}</span>
          </div>
        )}
        
        {/* Media indicator */}
        {message.type && message.type !== 'text' && message.media_url && (
          <div className={`mb-2 ${isIncoming ? '' : ''}`}>
            {message.type === 'image' && (
              <img src={message.media_url} alt="Shared image" className="max-w-full rounded-lg max-h-48 object-cover" />
            )}
            {message.type === 'video' && (
              <video src={message.media_url} controls className="max-w-full rounded-lg max-h-48" />
            )}
            {message.type === 'document' && (
              <a href={message.media_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 ${isIncoming ? 'text-blue-600' : 'text-green-100'}`}>
                <File className="w-4 h-4" />
                <span className="text-sm underline">{message.filename || 'Document'}</span>
              </a>
            )}
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
  const [replyMode, setReplyMode] = useState('template'); // 'template', 'text', or 'media'
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateVariables, setTemplateVariables] = useState([]);
  const [textMessage, setTextMessage] = useState('');
  
  // Delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Media upload state
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
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
                  
                  {/* Delete Controls */}
                  <div className="flex items-center gap-2">
                    {selectionMode ? (
                      <>
                        <span className="text-xs text-gray-500">{selectedMessages.size} selected</span>
                        <button
                          onClick={handleBulkDelete}
                          disabled={selectedMessages.size === 0 || deleting}
                          className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                          title="Delete selected"
                        >
                          {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }}
                          className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectionMode(true)}
                          className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition"
                          title="Select messages to delete"
                          data-testid="select-messages-btn"
                        >
                          <CheckSquare className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Clear entire conversation"
                          data-testid="clear-conversation-btn"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Clear Conversation Confirmation */}
                {showClearConfirm && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                    <span className="text-red-700 text-sm">Delete all messages in this chat?</span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearConversation}
                        disabled={deleting}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Yes, Clear'}
                      </button>
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1 bg-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
                    Template
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
                    Text
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!chatThread?.within_24h_window}
                    className={`py-2 px-4 rounded-xl text-sm font-medium transition ${
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

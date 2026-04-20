import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  MessageSquare, Send, Users, Settings, BarChart3, RefreshCw, 
  CheckCircle, XCircle, Clock, Eye, AlertTriangle, Filter, Search,
  ChevronLeft, ChevronRight, Phone, FileText, Zap, X, Plus, Inbox,
  Bot, ShieldCheck, BrainCircuit, Wifi, WifiOff, Flame, MailWarning,
  MailCheck, RadioTower
} from 'lucide-react';
import { WhatsAppInbox } from './WhatsAppInbox';

const API = process.env.REACT_APP_BACKEND_URL || '';

// WhatsApp Dashboard Stats Component
const WhatsAppStats = ({ stats }) => {
  if (!stats) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm">Sent Today</p>
            <p className="text-3xl font-bold">{stats.today?.sent || 0}</p>
          </div>
          <Send className="w-8 h-8 text-green-200" />
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Delivered</p>
            <p className="text-3xl font-bold">{stats.today?.delivered || 0}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-blue-200" />
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cyan-100 text-sm">Read</p>
            <p className="text-3xl font-bold">{stats.today?.read || 0}</p>
          </div>
          <Eye className="w-8 h-8 text-cyan-200" />
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-100 text-sm">Replies</p>
            <p className="text-3xl font-bold">{stats.today?.replies || 0}</p>
          </div>
          <MessageSquare className="w-8 h-8 text-amber-200" />
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100 text-sm">Failed</p>
            <p className="text-3xl font-bold">{stats.today?.failed || 0}</p>
          </div>
          <XCircle className="w-8 h-8 text-red-200" />
        </div>
      </div>
    </div>
  );
};

// Send WhatsApp Modal
export const SendWhatsAppModal = ({ isOpen, onClose, lead, onSent }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [variables, setVariables] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [syncing, setSyncing] = useState(false);
  
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/whatsapp/templates`);
      setTemplates(res.data || []);
      if (res.data.length > 0) {
        setSelectedTemplate(res.data[0].template_name);
        initVariables(res.data[0]);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  }, [API]);
  
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setError('');
      setSuccess('');
    }
  }, [isOpen, fetchTemplates]);
  
  const syncTemplates = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API}/api/whatsapp/templates/sync`);
      await fetchTemplates();
      setError('');
    } catch (err) {
      setError('Failed to sync templates');
    }
    setSyncing(false);
  };
  
  const initVariables = (template) => {
    // Only initialize variables if template actually needs them
    const varCount = template.variable_count || 0;
    const hasVars = template.has_variables === true;
    
    if (hasVars && varCount > 0) {
      const vars = [];
      for (let i = 0; i < varCount; i++) {
        // Pre-fill first variable with lead name
        vars.push(i === 0 && lead?.name ? lead.name : '');
      }
      setVariables(vars);
    } else {
      // Template doesn't need variables - set empty array
      setVariables([]);
    }
  };
  
  const handleTemplateChange = (templateName) => {
    setSelectedTemplate(templateName);
    setError(''); // Clear previous errors
    const template = templates.find(t => t.template_name === templateName);
    if (template) {
      initVariables(template);
    }
  };
  
  const addVariable = () => {
    setVariables([...variables, '']);
  };
  
  const removeVariable = (index) => {
    if (variables.length > 1) {
      const newVars = variables.filter((_, i) => i !== index);
      setVariables(newVars);
    }
  };
  
  const handleSend = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    
    setSending(true);
    setError('');
    
    try {
      // Only send variables if the template actually needs them
      const templateNeedsVariables = selectedTpl?.has_variables && selectedTpl?.variable_count > 0;
      const filledVariables = variables.filter(v => v && v.trim() !== '');
      
      const payload = {
        template_name: selectedTemplate,
        // Only include variables if template needs them AND we have filled values
        variables: templateNeedsVariables ? 
          (filledVariables.length > 0 ? filledVariables : [lead?.name || 'Customer']) : 
          []
      };
      
      const res = await axios.post(`${API}/api/whatsapp/send-to-lead/${lead.id}`, payload);
      
      if (res.data.success) {
        setSuccess('WhatsApp message sent successfully!');
        setTimeout(() => {
          onSent && onSent();
          onClose();
        }, 1500);
      } else {
        // Parse Meta API error
        const errorMsg = res.data.error || 'Failed to send message';
        if (errorMsg.includes('132000') || errorMsg.includes('parameters')) {
          setError('Template parameter mismatch. Try clicking "Sync Templates" to update template info.');
        } else {
          setError(errorMsg);
        }
      }
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.response?.data?.error || 'Failed to send message';
      if (errorDetail.includes('132000') || errorDetail.includes('parameters')) {
        setError('Template parameter mismatch. Try clicking "Sync Templates" to update template info.');
      } else {
        setError(errorDetail);
      }
    }
    
    setSending(false);
  };
  
  if (!isOpen) return null;
  
  const selectedTpl = templates.find(t => t.template_name === selectedTemplate);
  const showVariableInputs = selectedTpl?.has_variables || selectedTpl?.variable_count > 0 || variables.length > 0;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-500" />
            Send WhatsApp
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Lead Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="font-medium text-gray-800">{lead?.name || 'Unknown'}</p>
          <p className="text-gray-600 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {lead?.phone || 'No phone'}
          </p>
        </div>
        
        {/* Template Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Select Template</label>
            <button
              onClick={syncTemplates}
              disabled={syncing}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Templates'}
            </button>
          </div>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {templates.map((t) => (
              <option key={t.template_name} value={t.template_name}>
                {t.display_name || t.template_name} {t.variable_count > 0 ? `(${t.variable_count} vars)` : ''}
              </option>
            ))}
          </select>
          {selectedTpl?.description && (
            <p className="text-sm text-gray-500 mt-1">{selectedTpl.description}</p>
          )}
        </div>
        
        {/* Variables - Only show if template needs them */}
        {selectedTpl?.has_variables && selectedTpl?.variable_count > 0 && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Template Variables <span className="text-red-500">*</span>
              </label>
              <button
                onClick={addVariable}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Variable
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Fill in values to replace {'{{1}}'}, {'{{2}}'}, etc. in the template.
            </p>
            {variables.map((val, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => {
                    const newVars = [...variables];
                    newVars[i] = e.target.value;
                    setVariables(newVars);
                  }}
                  placeholder={i === 0 ? 'Customer Name' : `Variable ${i + 1}`}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {variables.length > 1 && (
                  <button
                    onClick={() => removeVariable(i)}
                    className="px-2 text-red-500 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Info message for templates without variables */}
        {(!selectedTpl?.has_variables || selectedTpl?.variable_count === 0) && (
          <div className="mb-4 bg-blue-50 text-blue-600 px-4 py-3 rounded-xl text-sm">
            <p>This template doesn't require any variables. Click Send to deliver the message.</p>
          </div>
        )}
        
        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !selectedTemplate}
            className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Bulk Campaign Modal
export const BulkCampaignModal = ({ isOpen, onClose, selectedLeads, onCampaignStarted }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [batchSize, setBatchSize] = useState(30);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setCampaignName(`Campaign_${new Date().toISOString().slice(0, 10)}`);
      setError('');
      setSuccess('');
    }
  }, [isOpen]);
  
  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/api/whatsapp/templates`);
      setTemplates(res.data || []);
      if (res.data.length > 0) {
        setSelectedTemplate(res.data[0].template_name);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };
  
  const handleStartCampaign = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }
    
    if (!selectedLeads || selectedLeads.length === 0) {
      setError('No leads selected');
      return;
    }
    
    setSending(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/api/whatsapp/campaigns`, {
        campaign_name: campaignName,
        template_name: selectedTemplate,
        lead_ids: selectedLeads,
        batch_size: batchSize
      });
      
      if (res.data.success) {
        setSuccess(`Campaign started! ${res.data.total_recipients} messages queued.`);
        setTimeout(() => {
          onCampaignStarted && onCampaignStarted(res.data);
          onClose();
        }, 2000);
      } else {
        setError(res.data.error || 'Failed to start campaign');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start campaign');
    }
    
    setSending(false);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-green-500" />
            Bulk WhatsApp Campaign
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Selected Leads Count */}
        <div className="bg-gradient-to-r from-green-50 to-cyan-50 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Selected Leads</p>
            <p className="text-2xl font-bold text-green-600">{selectedLeads?.length || 0}</p>
          </div>
          <Users className="w-10 h-10 text-green-400" />
        </div>
        
        {/* Campaign Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        
        {/* Template Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {templates.map((t) => (
              <option key={t.template_name} value={t.template_name}>
                {t.display_name || t.template_name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Batch Settings */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Batch Size (messages per batch)
          </label>
          <select
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value={20}>20 messages/batch (slower, safer)</option>
            <option value={30}>30 messages/batch (recommended)</option>
            <option value={50}>50 messages/batch (faster)</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Batches are sent with a 2-second delay to prevent rate limiting.
          </p>
        </div>
        
        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-amber-800 font-medium">Confirm Campaign</p>
              <p className="text-amber-700 text-sm">
                You are about to send <strong>{selectedLeads?.length || 0}</strong> WhatsApp messages. 
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        
        {/* Error/Success */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            {success}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleStartCampaign}
            disabled={sending || !selectedTemplate || !selectedLeads?.length}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            {sending ? 'Starting...' : 'Start Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ========================= CRM INBOX VIEW =========================
const CRMInboxView = () => {
  const [activeFilter, setActiveFilter] = useState('replies');
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ replies: 0, failed: 0, follow_up: 0, bulk_sent: 0, opted_out: 0 });

  const filters = [
    { id: 'replies',    label: 'Replies',    icon: Flame,       color: 'green',  desc: 'Customers who replied' },
    { id: 'failed',     label: 'Failed',     icon: XCircle,     color: 'red',    desc: 'Template delivery failed' },
    { id: 'follow_up',  label: 'Follow-up',  icon: Clock,       color: 'yellow', desc: 'Delivered but not read' },
    { id: 'bulk_sent',  label: 'Bulk Sent',  icon: RadioTower,  color: 'blue',   desc: 'All campaign recipients' },
    { id: 'opted_out',  label: 'Opted Out',  icon: XCircle,     color: 'gray',   desc: 'Sent STOP — do not message' },
  ];

  const colorMap = {
    green:  { tab: 'bg-green-500 text-white',  badge: 'bg-green-100 text-green-700',  border: 'border-green-300',  dot: 'bg-green-400', pill: 'bg-green-50' },
    red:    { tab: 'bg-red-500 text-white',    badge: 'bg-red-100 text-red-700',      border: 'border-red-300',    dot: 'bg-red-400',   pill: 'bg-red-50' },
    yellow: { tab: 'bg-yellow-500 text-white', badge: 'bg-yellow-100 text-yellow-700',border: 'border-yellow-300', dot: 'bg-yellow-400',pill: 'bg-yellow-50' },
    blue:   { tab: 'bg-blue-500 text-white',   badge: 'bg-blue-100 text-blue-700',    border: 'border-blue-300',   dot: 'bg-blue-400',  pill: 'bg-blue-50' },
    gray:   { tab: 'bg-gray-500 text-white',   badge: 'bg-gray-100 text-gray-700',    border: 'border-gray-300',   dot: 'bg-gray-400',  pill: 'bg-gray-50' },
  };

  const fetchLeads = useCallback(async (filter, pg) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/whatsapp/crm-inbox?filter=${filter}&page=${pg}&limit=50`);
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error('CRM Inbox error:', e);
    }
    setLoading(false);
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const results = await Promise.allSettled(
        ['replies', 'failed', 'follow_up', 'bulk_sent', 'opted_out'].map(f =>
          axios.get(`${API}/api/whatsapp/crm-inbox?filter=${f}&page=1&limit=1`)
        )
      );
      const [r, f, fu, bs, oo] = results.map(r => r.status === 'fulfilled' ? r.value.data.total : 0);
      setCounts({ replies: r, failed: f, follow_up: fu, bulk_sent: bs, opted_out: oo });
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => { fetchLeads(activeFilter, 1); setPage(1); }, [activeFilter, fetchLeads]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const currentFilter = filters.find(f => f.id === activeFilter);
  const c = colorMap[currentFilter?.color || 'green'];
  const totalPages = Math.ceil(total / 50);

  const handlePageChange = (newPage) => { setPage(newPage); fetchLeads(activeFilter, newPage); };

  const getStatusBadges = (lead) => {
    const badges = [];
    if (lead.wa_opted_out) badges.push({ label: '🚫 Opted Out', cls: 'bg-gray-200 text-gray-700 font-bold' });
    if (lead.wa_reply_received) badges.push({ label: '💬 Replied', cls: 'bg-green-100 text-green-700' });
    if (lead.wa_read)      badges.push({ label: '👁 Read',    cls: 'bg-blue-100 text-blue-700' });
    if (lead.wa_delivered) badges.push({ label: '✓ Delivered', cls: 'bg-gray-100 text-gray-700' });
    if (lead.wa_failed)    badges.push({ label: '✗ Failed',   cls: 'bg-red-100 text-red-700' });
    if (lead.templateSent && !lead.wa_delivered && !lead.wa_failed)
                           badges.push({ label: '📤 Sent',    cls: 'bg-sky-100 text-sky-700' });
    return badges;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-green-500" />
              WhatsApp CRM Inbox
            </h2>
            <p className="text-xs text-gray-500">Track bulk campaigns — replies, failures & follow-ups</p>
          </div>
          <button
            onClick={() => { fetchLeads(activeFilter, page); fetchCounts(); }}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filters.map(f => {
            const cnt = counts[f.id] || 0;
            const active = activeFilter === f.id;
            const fc = colorMap[f.color];
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition border ${
                  active
                    ? `${fc.tab} border-transparent shadow-md`
                    : `bg-white ${fc.border} text-gray-600 hover:${fc.pill}`
                }`}
              >
                <f.icon className="w-4 h-4" />
                {f.label}
                {cnt > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20 text-white' : fc.badge}`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lead List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className={`px-4 py-3 border-b flex items-center justify-between ${c.pill}`}>
          <div className="flex items-center gap-2">
            {currentFilter && <currentFilter.icon className="w-4 h-4" />}
            <span className="font-semibold text-gray-800">{currentFilter?.label}</span>
            <span className="text-xs text-gray-500">— {currentFilter?.desc}</span>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.badge}`}>{total} leads</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No leads in this filter</p>
            <p className="text-sm">Send a bulk campaign to start tracking</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {leads.map(lead => {
              const badges = getStatusBadges(lead);
              const isReply = lead.wa_reply_received;
              const isFailed = lead.wa_failed;
              return (
                <div
                  key={lead.id}
                  className={`px-4 py-3 hover:bg-gray-50 transition border-l-4 ${
                    lead.wa_opted_out ? 'border-l-gray-400 bg-gray-50/60 opacity-75' :
                    isReply  ? 'border-l-green-400' :
                    isFailed ? 'border-l-red-400' :
                    lead.wa_read ? 'border-l-blue-400' :
                    lead.wa_delivered ? 'border-l-yellow-400' :
                    'border-l-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Lead info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                        lead.wa_opted_out ? 'bg-gray-400' :
                        isReply  ? 'bg-green-500' :
                        isFailed ? 'bg-red-500' :
                        'bg-gray-400'
                      }`}>
                        {(lead.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{lead.name || 'Unknown'}</p>
                          {isReply && <span className="text-xs text-green-600 font-bold">🔥 HIGH PRIORITY</span>}
                        </div>
                        <p className="text-xs text-gray-500">{lead.phone}</p>
                        {lead.templateName && (
                          <p className="text-xs text-gray-400 mt-0.5">Template: <span className="font-mono">{lead.templateName}</span></p>
                        )}
                        {lead.wa_last_message && (
                          <p className="text-xs text-gray-600 mt-1 italic truncate max-w-xs">
                            💬 "{lead.wa_last_message}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status badges + time */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {badges.map((b, i) => (
                          <span key={i} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span>
                        ))}
                      </div>
                      {(lead.wa_last_message_time || lead.templateSentAt) && (
                        <p className="text-xs text-gray-400">
                          {new Date(lead.wa_last_message_time || lead.templateSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      <div className="flex gap-1">
                        {lead.district && <span className="text-xs text-gray-400">{lead.district}</span>}
                        {lead.stage && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{lead.stage}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main WhatsApp CRM Module
export const WhatsAppModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [automation, setAutomation] = useState(null);
  const [botStatus, setBotStatus] = useState(null);
  const [savingBot, setSavingBot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    access_token: '',
    phone_number_id: '',
    waba_id: '',
    verify_token: 'asr_whatsapp_verify_2024',
    default_country_code: '91'
  });
  const [testingApi, setTestingApi] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  useEffect(() => {
    fetchData();
  }, [activeTab]);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await axios.get(`${API}/api/whatsapp/dashboard/stats`);
        setStats(res.data);
      } else if (activeTab === 'campaigns') {
        const res = await axios.get(`${API}/api/whatsapp/campaigns`);
        setCampaigns(res.data.campaigns || []);
      } else if (activeTab === 'messages') {
        const res = await axios.get(`${API}/api/whatsapp/messages?limit=100`);
        setMessages(res.data.messages || []);
      } else if (activeTab === 'templates') {
        const res = await axios.get(`${API}/api/whatsapp/templates`);
        setTemplates(res.data || []);
      } else if (activeTab === 'settings') {
        const [settingsRes, automationRes, botStatusRes] = await Promise.all([
          axios.get(`${API}/api/whatsapp/settings`),
          axios.get(`${API}/api/whatsapp/automation/settings`),
          axios.get(`${API}/api/whatsapp/automation/bot/status`).catch(() => ({ data: null }))
        ]);
        setSettings(settingsRes.data);
        setAutomation(automationRes.data);
        setBotStatus(botStatusRes.data);
        if (settingsRes.data.configured) {
          setSettingsForm({
            access_token: '',  // Keep empty for security
            phone_number_id: settingsRes.data.phone_number_id || '',
            waba_id: settingsRes.data.waba_id || '',
            verify_token: settingsRes.data.verify_token || 'asr_whatsapp_verify_2024',
            default_country_code: settingsRes.data.default_country_code || '91'
          });
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  };
  
  const handleTestConnection = async () => {
    setTestingApi(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/api/whatsapp/settings/test`);
      if (res.data.success) {
        alert(`API Connection Successful!\n\nPhone: ${res.data.phone_number}\nVerified Name: ${res.data.verified_name}\nQuality: ${res.data.quality_rating}`);
      } else {
        setError(res.data.error || 'Connection test failed');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Connection test failed');
    }
    
    setTestingApi(false);
  };
  
  const handleSaveSettings = async () => {
    if (!settingsForm.access_token || !settingsForm.phone_number_id) {
      setError('Access Token and Phone Number ID are required');
      return;
    }
    
    setSavingSettings(true);
    setError('');
    
    try {
      const res = await axios.post(`${API}/api/whatsapp/settings`, settingsForm);
      if (res.data.success) {
        alert('Settings saved successfully!');
        fetchData();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save settings');
    }
    
    setSavingSettings(false);
  };
  
  const handleSyncTemplates = async () => {
    try {
      const res = await axios.post(`${API}/api/whatsapp/templates/sync`);
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert('Failed to sync templates');
    }
  };
  
  const handleSaveAutomation = async () => {
    try {
      const res = await axios.post(`${API}/api/whatsapp/automation/settings`, automation);
      alert(res.data.message);
    } catch (err) {
      alert('Failed to save automation settings');
    }
  };

  const handleSaveBotSettings = async (updatedFields) => {
    setSavingBot(true);
    try {
      const res = await axios.post(`${API}/api/whatsapp/automation/bot/settings`, updatedFields);
      if (res.data) {
        setBotStatus(prev => prev ? { ...prev, ...updatedFields } : updatedFields);
      }
    } catch (err) {
      alert('Failed to save bot settings');
    } finally {
      setSavingBot(false);
    }
  };

  const toggleBotFlag = async (field, currentValue) => {
    const updated = { [field]: !currentValue };
    await handleSaveBotSettings(updated);
  };
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'crm_inbox', label: 'CRM Inbox', icon: Flame },
    { id: 'campaigns', label: 'Campaigns', icon: Users },
    { id: 'messages', label: 'History', icon: MessageSquare },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ].filter(t => {
    // Admin-department managers (e.g. Anamika ASR1002) cannot access WhatsApp Settings
    const role = (localStorage.getItem("asrAdminRole") || "").toLowerCase();
    const dept = (localStorage.getItem("asrAdminDepartment") || "").toLowerCase();
    const isAdminManager = role === "manager" && dept === "admin";
    return !(isAdminManager && t.id === 'settings');
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0a355e] flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-green-500" />
            WhatsApp CRM
          </h1>
          <p className="text-gray-500">Manage WhatsApp campaigns and messages</p>
        </div>
        
        <button
          onClick={fetchData}
          className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-200 transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div>
          <WhatsAppStats stats={stats} />
          
          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('campaigns')}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl flex items-center gap-3 hover:shadow-lg transition"
              >
                <Users className="w-8 h-8" />
                <div className="text-left">
                  <p className="font-bold">New Campaign</p>
                  <p className="text-green-100 text-sm">Send bulk messages</p>
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('templates')}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl flex items-center gap-3 hover:shadow-lg transition"
              >
                <FileText className="w-8 h-8" />
                <div className="text-left">
                  <p className="font-bold">Templates</p>
                  <p className="text-blue-100 text-sm">Manage templates</p>
                </div>
              </button>
              
              {tabs.some(t => t.id === 'settings') && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl flex items-center gap-3 hover:shadow-lg transition"
                >
                  <Settings className="w-8 h-8" />
                  <div className="text-left">
                    <p className="font-bold">Settings</p>
                    <p className="text-purple-100 text-sm">API configuration</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Inbox Tab - Primary WhatsApp Chat Interface */}
      {activeTab === 'inbox' && (
        <WhatsAppInbox />
      )}

      {/* CRM Inbox Tab - Filtered bulk tracking */}
      {activeTab === 'crm_inbox' && (
        <CRMInboxView />
      )}
      
      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Campaign History</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Campaign</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Template</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Recipients</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{campaign.campaign_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">
                        {campaign.template_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <span className="text-green-600">{campaign.total_sent}</span> / {campaign.total_selected}
                        {campaign.total_failed > 0 && (
                          <span className="text-red-500 ml-2">({campaign.total_failed} failed)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        campaign.status === 'completed' ? 'bg-green-100 text-green-700' :
                        campaign.status === 'running' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No campaigns yet. Create your first campaign from the Leads page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Message History</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Content</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => (
                  <tr key={msg.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{msg.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        msg.direction === 'incoming' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {msg.direction === 'incoming' ? 'Received' : 'Sent'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {msg.content || msg.template_name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        msg.status === 'read' ? 'bg-cyan-100 text-cyan-700' :
                        msg.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                        msg.status === 'sent' ? 'bg-green-100 text-green-700' :
                        msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(msg.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No messages yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">WhatsApp Templates</h3>
            <button
              onClick={handleSyncTemplates}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-600"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Templates
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {templates.map((template) => (
              <div key={template.template_name} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-gray-800">{template.display_name}</h4>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                    {template.category || 'MARKETING'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description || 'No description'}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <code className="bg-gray-100 px-2 py-1 rounded">{template.template_name}</code>
                  {template.has_variables && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {template.variable_count} vars
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* API Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-500" />
              WhatsApp API Settings
            </h3>
            
            {settings?.configured && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-green-700 font-medium flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  API is configured
                </p>
                <p className="text-green-600 text-sm">Phone Number ID: {settings.phone_number_id}</p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permanent Access Token
                </label>
                <input
                  type="password"
                  value={settingsForm.access_token}
                  onChange={(e) => setSettingsForm({...settingsForm, access_token: e.target.value})}
                  placeholder="EAAxxxxxxxxxxxxxxx..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get this from Meta Business Manager → WhatsApp → API Setup
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={settingsForm.phone_number_id}
                    onChange={(e) => setSettingsForm({...settingsForm, phone_number_id: e.target.value})}
                    placeholder="123456789012345"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp Business Account ID
                  </label>
                  <input
                    type="text"
                    value={settingsForm.waba_id}
                    onChange={(e) => setSettingsForm({...settingsForm, waba_id: e.target.value})}
                    placeholder="123456789012345"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Verify Token
                  </label>
                  <input
                    type="text"
                    value={settingsForm.verify_token}
                    onChange={(e) => setSettingsForm({...settingsForm, verify_token: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Country Code
                  </label>
                  <input
                    type="text"
                    value={settingsForm.default_country_code}
                    onChange={(e) => setSettingsForm({...settingsForm, default_country_code: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              
              {/* Webhook URL Display */}
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook URL (Add this to Meta WhatsApp API Settings)
                </label>
                <code className="block bg-white border border-gray-200 rounded-lg p-3 text-sm break-all">
                  https://www.asrenterprises.in/api/whatsapp/webhook
                </code>
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {error}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testingApi}
                  className="px-4 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {testingApi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Test Connection
                </button>
                
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="px-4 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Save Settings
                </button>
              </div>
            </div>
          </div>
          
          {/* Automation Settings */}
          {automation && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Automation Settings
              </h3>
              
              <div className="space-y-4">
                {/* Auto Welcome */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-800">Auto Welcome Message</p>
                    <p className="text-sm text-gray-500">Send welcome when new lead is created</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={automation.auto_welcome}
                      onChange={(e) => setAutomation({...automation, auto_welcome: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                
                {/* Auto on Stage Changes */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-800">Auto Site Visit Reminder</p>
                    <p className="text-sm text-gray-500">Send when stage changes to Site Visit</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={automation.auto_site_visit}
                      onChange={(e) => setAutomation({...automation, auto_site_visit: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-800">Auto Quotation Follow-up</p>
                    <p className="text-sm text-gray-500">Send when stage changes to Quotation</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={automation.auto_quotation}
                      onChange={(e) => setAutomation({...automation, auto_quotation: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                
                <button
                  onClick={handleSaveAutomation}
                  className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save Automation Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Bot Settings Panel */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            AI Bot Settings
          </h3>

          {/* AI Provider Status */}
          {botStatus?.ai_providers && (
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${botStatus.ai_providers.openai ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                {botStatus.ai_providers.openai
                  ? <Wifi className="w-4 h-4 text-green-500" />
                  : <WifiOff className="w-4 h-4 text-gray-400" />}
                <div>
                  <p className="text-sm font-semibold text-gray-700">OpenAI GPT-4o-mini</p>
                  <p className={`text-xs ${botStatus.ai_providers.openai ? 'text-green-600' : 'text-gray-400'}`}>
                    {botStatus.ai_providers.openai ? 'API key configured' : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${botStatus.ai_providers.gemini ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                {botStatus.ai_providers.gemini
                  ? <Wifi className="w-4 h-4 text-blue-500" />
                  : <WifiOff className="w-4 h-4 text-gray-400" />}
                <div>
                  <p className="text-sm font-semibold text-gray-700">Google Gemini Flash</p>
                  <p className={`text-xs ${botStatus.ai_providers.gemini ? 'text-blue-600' : 'text-gray-400'}`}>
                    {botStatus.ai_providers.gemini ? 'API key configured' : 'Not configured'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {botStatus && !botStatus.ai_providers?.any_configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-800 font-medium text-sm">No AI provider configured</p>
                <p className="text-amber-700 text-xs mt-1">
                  Add <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> or <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> as environment secrets to enable AI replies.
                  The bot will still send keyword-matched menu replies without an AI provider.
                </p>
              </div>
            </div>
          )}

          {/* Today's AI stats */}
          {botStatus?.today_stats && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-sm font-medium text-purple-700 mb-2">Today's Bot Activity</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-purple-800">{botStatus.today_stats.welcome_sent || 0}</p>
                  <p className="text-xs text-purple-600">Welcome</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-800">{botStatus.today_stats.quick_replies_sent || 0}</p>
                  <p className="text-xs text-purple-600">Menu</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700">{botStatus.today_stats.intent_replies_sent || 0}</p>
                  <p className="text-xs text-orange-600">Intent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-800">{botStatus.today_stats.ai_replies_sent || 0}</p>
                  <p className="text-xs text-purple-600">AI</p>
                </div>
              </div>
              <p className="text-xs text-purple-500 mt-2 text-center">{botStatus.current_time_ist}</p>
            </div>
          )}

          {/* Toggle Controls */}
          <div className="space-y-3">
            {[
              {
                field: 'bot_enabled',
                label: 'Master Bot Switch',
                desc: 'Turn off to completely stop all automatic replies',
                icon: <Bot className="w-4 h-4 text-purple-500" />,
                value: botStatus?.bot_enabled,
                color: 'purple'
              },
              {
                field: 'ai_fallback_enabled',
                label: 'AI Fallback Replies',
                desc: 'When no menu option matches, use AI to generate a Hinglish reply',
                icon: <BrainCircuit className="w-4 h-4 text-blue-500" />,
                value: botStatus?.ai_fallback_enabled,
                color: 'blue'
              },
              {
                field: 'spam_filter_enabled',
                label: 'Spam / Noise Filter',
                desc: 'Ignore one-word replies like "ok", "👍", "ji" — no wasted AI calls',
                icon: <ShieldCheck className="w-4 h-4 text-green-500" />,
                value: botStatus?.spam_filter_enabled,
                color: 'green'
              },
              {
                field: 'pause_bot_on_human_handover',
                label: 'Pause Bot on Human Handover',
                desc: 'Bot stops replying when a team member takes over the conversation',
                icon: <ShieldCheck className="w-4 h-4 text-amber-500" />,
                value: botStatus?.pause_bot_on_human_handover,
                color: 'amber'
              },
            ].map(({ field, label, desc, icon, value, color }) => (
              <div key={field} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 bg-${color}-100 rounded-lg`}>{icon}</div>
                  <div>
                    <p className="font-medium text-gray-800">{label}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={() => toggleBotFlag(field, value)}
                    className="sr-only peer"
                    disabled={savingBot}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 disabled:opacity-50"></div>
                </label>
              </div>
            ))}
          </div>

          {savingBot && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
            </p>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">How the AI Bot works</p>
            <p>1. New message arrives → Keyword matching first (options 1–7)</p>
            <p>2. No keyword match + welcome already sent → AI generates Hinglish reply</p>
            <p>3. Human takes over → Bot automatically pauses for that contact</p>
            <p>4. AI uses conversation history for context (last 8 messages)</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppModule;

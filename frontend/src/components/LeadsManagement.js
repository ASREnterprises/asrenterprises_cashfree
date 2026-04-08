import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Phone, Mail, MapPin, Star, Trash2, Edit, X, Save, Plus, Upload, RefreshCw, UserPlus, FileSpreadsheet, FileText, Image, CheckCircle, AlertCircle, Loader2, Eye } from "lucide-react";
import axios from "axios";
import { useAutoLogout } from "@/hooks/useAutoLogout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BIHAR_DISTRICTS = [
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
  "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
  "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
  "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
  "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
  "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
];

export const LeadsManagement = () => {
  const navigate = useNavigate();
  
  // Auto-logout after 15 minutes of inactivity
  const isAuthenticated = localStorage.getItem("asrAdminAuth") === "true";
  useAutoLogout(isAuthenticated, () => {
    localStorage.removeItem("asrAdminAuth");
    localStorage.removeItem("asrAdminEmail");
    localStorage.removeItem("asrAdminRole");
  }, 'admin');

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingLead, setEditingLead] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [smartImportStep, setSmartImportStep] = useState('upload'); // upload, preview, importing
  const [extractedLeads, setExtractedLeads] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [leadType, setLeadType] = useState('auto'); // 'auto', 'pm_surya_ghar', 'commercial'
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const smartFileInputRef = useRef(null);
  const [addingLead, setAddingLead] = useState(false);
  const fileInputRef = useRef(null);
  const [newLead, setNewLead] = useState({
    name: "", phone: "", email: "", district: "Patna", address: "",
    property_type: "residential", roof_type: "rcc", monthly_bill: "", notes: "", source: "manual"
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/crm/leads?limit=100`);
      // Handle both old format (array) and new format (object with leads array)
      const leadsData = Array.isArray(res.data) ? res.data : (res.data.leads || []);
      setLeads(leadsData);
    } catch (err) {
      console.error("Error fetching leads:", err);
      // Fallback to admin leads endpoint
      try {
        const res = await axios.get(`${API}/leads`);
        const leadsData = Array.isArray(res.data) ? res.data : (res.data.leads || []);
        setLeads(leadsData);
      } catch (e) {
        console.error("Fallback error:", e);
        setLeads([]);
      }
    }
    setLoading(false);
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    if (!newLead.name || !newLead.phone) {
      alert("Name and Phone are required");
      return;
    }
    setAddingLead(true);
    try {
      await axios.post(`${API}/crm/leads`, newLead);
      setNewLead({ name: "", phone: "", email: "", district: "Patna", address: "",
        property_type: "residential", roof_type: "rcc", monthly_bill: "", notes: "", source: "manual" });
      setShowAddModal(false);
      fetchLeads();
      alert("Lead added successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Error adding lead");
    }
    setAddingLead(false);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await axios.post(`${API}/crm/leads/bulk-import`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert(`Successfully imported ${res.data.imported} leads`);
      setShowCSVModal(false);
      fetchLeads();
    } catch (err) {
      alert(err.response?.data?.detail || "Error importing CSV");
    }
  };

  // Smart Import Handlers
  const handleSmartFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    setExtracting(true);
    setExtractedLeads([]);
    setImportResult(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await axios.post(`${API}/crm/leads/smart-import`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      if (res.data.success && res.data.preview_data?.length > 0) {
        setExtractedLeads(res.data.preview_data.map((lead, idx) => ({
          ...lead,
          _selected: true,
          _index: idx
        })));
        setSmartImportStep('preview');
      } else {
        alert("No leads found in the file. Please check the file format.");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Error extracting data from file");
    }
    setExtracting(false);
  };

  const handleToggleLeadSelection = (index) => {
    setExtractedLeads(prev => prev.map((lead, idx) => 
      idx === index ? { ...lead, _selected: !lead._selected } : lead
    ));
  };

  const handleEditExtractedLead = (index, field, value) => {
    setExtractedLeads(prev => prev.map((lead, idx) => 
      idx === index ? { ...lead, [field]: value } : lead
    ));
  };

  const handleConfirmImport = async () => {
    const selectedLeads = extractedLeads.filter(l => l._selected);
    if (selectedLeads.length === 0) {
      alert("Please select at least one lead to import");
      return;
    }
    
    setImporting(true);
    try {
      const res = await axios.post(`${API}/crm/leads/confirm-import`, {
        leads: selectedLeads.map(({ _selected, _index, ...lead }) => lead),
        lead_type: leadType
      });
      
      setImportResult(res.data);
      setSmartImportStep('result');
      fetchLeads();
    } catch (err) {
      alert(err.response?.data?.detail || "Error importing leads");
    }
    setImporting(false);
  };

  const resetSmartImport = () => {
    setSmartImportStep('upload');
    setExtractedLeads([]);
    setImportResult(null);
    setSelectedFile(null);
    setLeadType('auto');
    if (smartFileInputRef.current) smartFileInputRef.current.value = '';
  };

  const closeSmartImport = () => {
    resetSmartImport();
    setShowSmartImportModal(false);
  };

  // Bulk delete handlers
  const handleToggleLeadSelect = (leadId) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAllLeads = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) {
      alert("Please select leads to delete");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete ${selectedLeadIds.length} leads? This action cannot be undone.`)) {
      return;
    }
    
    setBulkDeleting(true);
    try {
      const res = await axios.post(`${API}/crm/leads/bulk-delete`, {
        lead_ids: selectedLeadIds
      });
      
      alert(res.data.message);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err) {
      alert(err.response?.data?.detail || "Error deleting leads");
    }
    setBulkDeleting(false);
  };

  const handleStatusChange = async (leadId, status) => {
    try {
      await axios.put(`${API}/leads/${leadId}/status`, { status });
      // Also update in admin leads for sync
      await axios.put(`${API}/admin/leads/${leadId}`, { status });
      fetchLeads();
    } catch (err) {
      alert("Error updating status");
    }
  };

  const handleDelete = async (leadId) => {
    if (window.confirm("Delete this lead? This will also remove it from CRM.")) {
      try {
        await axios.delete(`${API}/admin/leads/${leadId}`);
        fetchLeads();
      } catch (err) {
        alert("Error deleting lead");
      }
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead.id);
    setEditForm({
      name: lead.name || "",
      phone: lead.phone || "",
      email: lead.email || "",
      district: lead.district || "",
      address: lead.address || "",
      property_type: lead.property_type || "residential",
      roof_type: lead.roof_type || "rcc",
      monthly_bill: lead.monthly_bill || "",
      status: lead.status || "new",
      notes: lead.notes || ""
    });
  };

  const handleSaveEdit = async (leadId) => {
    try {
      await axios.put(`${API}/admin/leads/${leadId}`, editForm);
      setEditingLead(null);
      setEditForm({});
      fetchLeads();
      alert("Lead updated successfully!");
    } catch (err) {
      alert("Error updating lead");
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone?.includes(searchTerm) ||
                         lead.district?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "new": return "bg-blue-600";
      case "contacted": return "bg-yellow-600";
      case "qualified": return "bg-green-600";
      case "converted": return "bg-purple-600";
      case "lost": return "bg-red-600";
      default: return "bg-gray-600";
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0a355e]">Leads Management</h1>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {leads.length} Total
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-green-600 hover:to-green-700 shadow-lg"
              data-testid="add-lead-btn"
            >
              <Plus className="w-5 h-5" />
              <span>Add Lead</span>
            </button>
            <button
              onClick={() => setShowSmartImportModal(true)}
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-purple-600 hover:to-purple-700 shadow-lg"
              data-testid="smart-import-btn"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Smart Import</span>
            </button>
            <button
              onClick={() => setShowCSVModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:from-blue-600 hover:to-blue-700 shadow-lg"
              data-testid="csv-import-btn"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={fetchLeads}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-200"
              data-testid="refresh-leads-btn"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Add Lead Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#0a355e]">Add New Lead</h2>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Full Name *"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                    className="col-span-2 bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                    className="bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                    className="bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  />
                  <select
                    value={newLead.district}
                    onChange={(e) => setNewLead({...newLead, district: e.target.value})}
                    className="bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  >
                    {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select
                    value={newLead.property_type}
                    onChange={(e) => setNewLead({...newLead, property_type: e.target.value})}
                    className="bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Monthly Bill (₹)"
                    value={newLead.monthly_bill}
                    onChange={(e) => setNewLead({...newLead, monthly_bill: e.target.value})}
                    className="bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  />
                  <select
                    value={newLead.roof_type}
                    onChange={(e) => setNewLead({...newLead, roof_type: e.target.value})}
                    className="bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  >
                    <option value="rcc">RCC</option>
                    <option value="metal_sheet">Metal Sheet</option>
                    <option value="asbestos">Asbestos</option>
                    <option value="tiles">Tiles</option>
                  </select>
                </div>
                <textarea
                  placeholder="Address"
                  value={newLead.address}
                  onChange={(e) => setNewLead({...newLead, address: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  rows={2}
                />
                <textarea
                  placeholder="Notes"
                  value={newLead.notes}
                  onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                  className="w-full bg-gray-50 border border-gray-300 px-4 py-3 rounded-lg"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={addingLead}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
                >
                  {addingLead ? "Adding..." : "Add Lead"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCSVModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#0a355e]">Import Leads from CSV</h2>
                <button onClick={() => setShowCSVModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                Upload a CSV file with columns: name, phone, email, district, property_type, monthly_bill
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <span className="text-gray-600">Click to select CSV file</span>
              </button>
            </div>
          </div>
        )}

        {/* Smart Import Modal */}
        {showSmartImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#0a355e]">Smart Import Leads</h2>
                  <p className="text-gray-500 text-sm">AI-powered import from multiple file formats</p>
                </div>
                <button onClick={closeSmartImport} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Step: Upload */}
              {smartImportStep === 'upload' && (
                <div className="flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <FileSpreadsheet className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <span className="text-green-700 text-sm font-medium">CSV / Excel</span>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <FileText className="w-8 h-8 text-red-600 mx-auto mb-2" />
                      <span className="text-red-700 text-sm font-medium">PDF</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <Image className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <span className="text-blue-700 text-sm font-medium">Images</span>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <span className="text-purple-700 text-sm font-medium">AI Extract</span>
                    </div>
                  </div>

                  <input
                    ref={smartFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp"
                    onChange={handleSmartFileSelect}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => smartFileInputRef.current?.click()}
                    disabled={extracting}
                    className="w-full border-2 border-dashed border-purple-300 rounded-xl p-12 text-center hover:border-purple-500 hover:bg-purple-50 transition disabled:opacity-50"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-spin" />
                        <span className="text-purple-700 font-medium text-lg">Extracting data with AI...</span>
                        <p className="text-gray-500 text-sm mt-2">This may take a few seconds</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                        <span className="text-gray-700 font-medium text-lg">Click to select file</span>
                        <p className="text-gray-500 text-sm mt-2">
                          Supports: CSV, Excel (.xlsx), PDF, Images (JPG, PNG)
                        </p>
                      </>
                    )}
                  </button>

                  <div className="mt-6 bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Supported Data Fields:</h3>
                    <div className="flex flex-wrap gap-2">
                      {['Name', 'Phone', 'Email', 'District', 'Address', 'Property Type', 'Business Type', 'Monthly Bill', 'Notes'].map(field => (
                        <span key={field} className="bg-white px-3 py-1 rounded-full text-sm text-gray-600 border">{field}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Preview */}
              {smartImportStep === 'preview' && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600">
                        {selectedFile?.name} - <strong>{extractedLeads.length}</strong> leads found
                      </span>
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                        {extractedLeads.filter(l => l._selected).length} selected
                      </span>
                    </div>
                    <button
                      onClick={resetSmartImport}
                      className="text-gray-500 hover:text-gray-700 text-sm flex items-center space-x-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Upload different file</span>
                    </button>
                  </div>

                  {/* Lead Type Selection */}
                  <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-green-50 rounded-xl border border-orange-200">
                    <h4 className="font-semibold text-gray-700 mb-3">Select Lead Destination:</h4>
                    <div className="flex flex-wrap gap-3">
                      <label className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${leadType === 'auto' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="leadType"
                          value="auto"
                          checked={leadType === 'auto'}
                          onChange={(e) => setLeadType(e.target.value)}
                          className="text-purple-600"
                        />
                        <div>
                          <span className="font-medium text-gray-700">Auto Detect</span>
                          <p className="text-xs text-gray-500">AI classifies based on data</p>
                        </div>
                      </label>
                      <label className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${leadType === 'residential' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="leadType"
                          value="residential"
                          checked={leadType === 'residential'}
                          onChange={(e) => setLeadType(e.target.value)}
                          className="text-orange-600"
                        />
                        <div>
                          <span className="font-medium text-orange-700">Residential Solar Customer</span>
                          <p className="text-xs text-gray-500">Home / Household customers</p>
                        </div>
                      </label>
                      <label className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition ${leadType === 'commercial' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="radio"
                          name="leadType"
                          value="commercial"
                          checked={leadType === 'commercial'}
                          onChange={(e) => setLeadType(e.target.value)}
                          className="text-green-600"
                        />
                        <div>
                          <span className="font-medium text-green-700">Commercial Solar Customer</span>
                          <p className="text-xs text-gray-500">Business / Industrial customers</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto border rounded-xl">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600">
                            <input
                              type="checkbox"
                              checked={extractedLeads.every(l => l._selected)}
                              onChange={(e) => setExtractedLeads(prev => prev.map(l => ({ ...l, _selected: e.target.checked })))}
                              className="rounded"
                            />
                          </th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600">Name</th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600">Phone</th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600">District</th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600">Property</th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600">Bill</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedLeads.map((lead, idx) => (
                          <tr key={idx} className={`border-t ${!lead._selected ? 'opacity-50 bg-gray-50' : ''}`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={lead._selected}
                                onChange={() => handleToggleLeadSelection(idx)}
                                className="rounded"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={lead.name || ''}
                                onChange={(e) => handleEditExtractedLead(idx, 'name', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                                placeholder="Name"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={lead.phone || ''}
                                onChange={(e) => handleEditExtractedLead(idx, 'phone', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                                placeholder="Phone"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={lead.district || ''}
                                onChange={(e) => handleEditExtractedLead(idx, 'district', e.target.value)}
                                className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                                placeholder="District"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                value={lead.property_type || 'residential'}
                                onChange={(e) => handleEditExtractedLead(idx, 'property_type', e.target.value)}
                                className="bg-transparent text-sm"
                              >
                                <option value="residential">Residential</option>
                                <option value="commercial">Commercial</option>
                                <option value="industrial">Industrial</option>
                                <option value="agricultural">Agricultural</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={lead.monthly_bill || ''}
                                onChange={(e) => handleEditExtractedLead(idx, 'monthly_bill', e.target.value)}
                                className="w-20 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:outline-none px-1 py-0.5"
                                placeholder="₹"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      onClick={resetSmartImport}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importing || extractedLeads.filter(l => l._selected).length === 0}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center space-x-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>Import {extractedLeads.filter(l => l._selected).length} Leads</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Result */}
              {smartImportStep === 'result' && importResult && (
                <div className="flex-1 flex flex-col items-center justify-center py-8">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${importResult.imported_count > 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {importResult.imported_count > 0 ? (
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    ) : (
                      <AlertCircle className="w-10 h-10 text-yellow-600" />
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    {importResult.imported_count > 0 ? 'Import Successful!' : 'No Leads Imported'}
                  </h3>
                  
                  <p className="text-gray-600 mb-6">{importResult.message}</p>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{importResult.imported_count}</div>
                      <div className="text-green-700 text-sm">Imported</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{importResult.duplicate_count}</div>
                      <div className="text-yellow-700 text-sm">Duplicates</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{importResult.error_count}</div>
                      <div className="text-red-700 text-sm">Errors</div>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {(importResult.residential_count > 0 || importResult.commercial_count > 0) && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{importResult.residential_count || 0}</div>
                        <div className="text-orange-700 text-sm">Residential Solar</div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{importResult.commercial_count || 0}</div>
                        <div className="text-green-700 text-sm">Commercial Solar</div>
                      </div>
                    </div>
                  )}

                  {importResult.duplicates?.length > 0 && (
                    <div className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                      <h4 className="font-semibold text-yellow-800 mb-2">Skipped Duplicates:</h4>
                      <div className="text-sm text-yellow-700 max-h-24 overflow-y-auto">
                        {importResult.duplicates.map((d, i) => (
                          <div key={i}>{d.name || d.phone} - already exists</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={closeSmartImport}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, phone, or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] pl-10 pr-4 py-3 rounded-lg"
              data-testid="leads-search-input"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-[#0a355e] px-4 py-3 rounded-lg"
            data-testid="leads-filter-status"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white text-center shadow-lg">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "new").length}</div>
            <div className="text-blue-100 text-sm">New</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white text-center shadow-lg">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "contacted").length}</div>
            <div className="text-yellow-100 text-sm">Contacted</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white text-center shadow-lg">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "qualified").length}</div>
            <div className="text-green-100 text-sm">Qualified</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white text-center shadow-lg">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "converted").length}</div>
            <div className="text-purple-100 text-sm">Converted</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white text-center shadow-lg">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "lost").length}</div>
            <div className="text-red-100 text-sm">Lost</div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="bg-white shadow-lg border border-sky-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedLeadIds.length > 0 && selectedLeadIds.length === filteredLeads.length}
                onChange={handleSelectAllLeads}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-600 text-sm">
                {selectedLeadIds.length > 0 
                  ? `${selectedLeadIds.length} selected` 
                  : 'Select All'}
              </span>
            </label>
          </div>
          {selectedLeadIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              data-testid="bulk-delete-btn"
            >
              {bulkDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Delete {selectedLeadIds.length} Leads</span>
            </button>
          )}
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading leads...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-white shadow-lg border border-sky-200 rounded-xl p-6" data-testid={`lead-card-${lead.id}`}>
                {editingLead === lead.id ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-[#0a355e]">Edit Lead</h3>
                      <button onClick={() => setEditingLead(null)} className="text-gray-500 hover:text-[#0a355e]">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-gray-500 text-sm">Name *</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">Phone *</label>
                        <input
                          type="text"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">District</label>
                        <select
                          value={editForm.district}
                          onChange={(e) => setEditForm({...editForm, district: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        >
                          <option value="">Select District</option>
                          {BIHAR_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">Property Type</label>
                        <select
                          value={editForm.property_type}
                          onChange={(e) => setEditForm({...editForm, property_type: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        >
                          <option value="residential">Residential</option>
                          <option value="commercial">Commercial</option>
                          <option value="industrial">Industrial</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">Roof Type</label>
                        <select
                          value={editForm.roof_type}
                          onChange={(e) => setEditForm({...editForm, roof_type: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        >
                          <option value="rcc">RCC</option>
                          <option value="tin_shed">Tin Shed</option>
                          <option value="asbestos">Asbestos</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">Monthly Bill (₹)</label>
                        <input
                          type="number"
                          value={editForm.monthly_bill}
                          onChange={(e) => setEditForm({...editForm, monthly_bill: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 text-sm">Status</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="converted">Converted</option>
                          <option value="lost">Lost</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-gray-500 text-sm">Address</label>
                        <input
                          type="text"
                          value={editForm.address}
                          onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-gray-500 text-sm">Notes</label>
                        <textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg mt-1 h-20"
                        />
                      </div>
                    </div>
                    <div className="flex space-x-3 mt-4">
                      <button
                        onClick={() => handleSaveEdit(lead.id)}
                        className="flex-1 bg-green-600 text-[#0a355e] py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-green-700"
                      >
                        <Save className="w-4 h-4" /><span>Save Changes</span>
                      </button>
                      <button
                        onClick={() => setEditingLead(null)}
                        className="px-6 bg-gray-600 text-[#0a355e] py-2 rounded-lg hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => handleToggleLeadSelect(lead.id)}
                        className="mt-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-[#0a355e]">{lead.name}</h3>
                          <span className={`${getStatusColor(lead.status)} text-[#0a355e] text-xs px-2 py-1 rounded capitalize`}>
                            {lead.status || "new"}
                          </span>
                          {lead.lead_category && (
                            <span className={`text-xs px-2 py-1 rounded ${lead.lead_category === 'residential_solar' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              {lead.lead_category === 'residential_solar' ? 'Residential Solar' : 'Commercial Solar'}
                            </span>
                          )}
                          {lead.lead_score && (
                            <span className={`${getScoreColor(lead.lead_score)} font-bold flex items-center`}>
                              <Star className="w-4 h-4 mr-1" />
                              {lead.lead_score}%
                            </span>
                          )}
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 mr-2" />
                            <a href={`tel:${lead.phone}`} className="hover:text-[#0a355e]">{lead.phone}</a>
                          </div>
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2" />
                            <a href={`mailto:${lead.email}`} className="hover:text-[#0a355e] truncate">{lead.email || "N/A"}</a>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2" />
                            {lead.district || "N/A"}, Bihar
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="bg-gray-50 border border-gray-300 px-2 py-1 rounded text-gray-600">{lead.property_type}</span>
                          <span className="bg-gray-50 border border-gray-300 px-2 py-1 rounded text-gray-600">{lead.roof_type} roof</span>
                          {lead.monthly_bill && <span className="bg-green-700 px-2 py-1 rounded text-green-300">₹{lead.monthly_bill}/month</span>}
                          {lead.recommended_system && <span className="bg-blue-700 px-2 py-1 rounded text-blue-300">{lead.recommended_system}</span>}
                        </div>

                        {lead.ai_analysis && (
                          <div className="mt-3 bg-purple-600 bg-opacity-20 border border-purple-600 rounded-lg p-3">
                            <span className="text-purple-400 text-xs font-semibold">AI Analysis: </span>
                            <span className="text-gray-600 text-xs">{lead.ai_analysis}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <select
                        value={lead.status || "new"}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-[#0a355e] px-3 py-2 rounded-lg text-sm"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                      <div className="flex space-x-2">
                        <a
                          href={`https://wa.me/91${lead.phone}?text=Hi ${lead.name}, Thank you for your interest in solar installation. I'm from ASR Enterprises, Patna.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-green-600 text-[#0a355e] py-2 rounded-lg text-sm font-medium hover:bg-green-700 text-center"
                        >
                          WhatsApp
                        </a>
                        <button
                          onClick={() => handleEdit(lead)}
                          className="bg-blue-600 text-[#0a355e] p-2 rounded-lg hover:bg-blue-700"
                          data-testid={`edit-lead-${lead.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="bg-red-600 text-[#0a355e] p-2 rounded-lg hover:bg-red-700"
                          data-testid={`delete-lead-${lead.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && filteredLeads.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500">No leads found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

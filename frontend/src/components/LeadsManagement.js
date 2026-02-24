import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Phone, Mail, MapPin, Star, Trash2, Edit, X, Save, Plus, Upload, RefreshCw, UserPlus } from "lucide-react";
import axios from "axios";

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
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingLead, setEditingLead] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
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
      const res = await axios.get(`${API}/crm/leads`);
      setLeads(res.data);
    } catch (err) {
      console.error("Error fetching leads:", err);
      // Fallback to admin leads endpoint
      try {
        const res = await axios.get(`${API}/leads`);
        setLeads(res.data);
      } catch (e) {
        console.error("Fallback error:", e);
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
    <div className="min-h-screen bg-white shadow-lg py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-[#0a355e]">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold text-[#0a355e]">Leads Management</h1>
          </div>
          <div className="text-gray-500">
            Total: <span className="text-[#0a355e] font-bold">{leads.length}</span> leads
          </div>
        </div>

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
          <div className="bg-blue-600 rounded-xl p-4 text-[#0a355e] text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "new").length}</div>
            <div className="text-blue-200 text-sm">New</div>
          </div>
          <div className="bg-yellow-600 rounded-xl p-4 text-[#0a355e] text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "contacted").length}</div>
            <div className="text-yellow-200 text-sm">Contacted</div>
          </div>
          <div className="bg-green-600 rounded-xl p-4 text-[#0a355e] text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "qualified").length}</div>
            <div className="text-green-200 text-sm">Qualified</div>
          </div>
          <div className="bg-purple-600 rounded-xl p-4 text-[#0a355e] text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "converted").length}</div>
            <div className="text-purple-200 text-sm">Converted</div>
          </div>
          <div className="bg-red-600 rounded-xl p-4 text-[#0a355e] text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "lost").length}</div>
            <div className="text-red-200 text-sm">Lost</div>
          </div>
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
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-[#0a355e]">{lead.name}</h3>
                        <span className={`${getStatusColor(lead.status)} text-[#0a355e] text-xs px-2 py-1 rounded capitalize`}>
                          {lead.status || "new"}
                        </span>
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

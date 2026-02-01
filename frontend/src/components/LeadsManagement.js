import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Filter, Phone, Mail, MapPin, Calendar, Star, Trash2, CheckCircle, Clock, XCircle } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const LeadsManagement = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const res = await axios.get(`${API}/leads`);
      setLeads(res.data);
    } catch (err) {
      console.error("Error fetching leads:", err);
    }
    setLoading(false);
  };

  const handleStatusChange = async (leadId, status) => {
    try {
      await axios.put(`${API}/leads/${leadId}/status`, { status });
      fetchLeads();
    } catch (err) {
      alert("Error updating status");
    }
  };

  const handleDelete = async (leadId) => {
    if (window.confirm("Delete this lead?")) {
      try {
        await axios.delete(`${API}/leads/${leadId}`);
        fetchLeads();
      } catch (err) {
        alert("Error deleting lead");
      }
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
    <div className="min-h-screen bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link to="/admin/dashboard" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl font-bold text-white">Leads Management</h1>
          </div>
          <div className="text-gray-400">
            Total: <span className="text-white font-bold">{leads.length}</span> leads
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl p-4 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, phone, or district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-700 text-white pl-10 pr-4 py-3 rounded-lg"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-700 text-white px-4 py-3 rounded-lg"
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
          <div className="bg-blue-600 rounded-xl p-4 text-white text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "new").length}</div>
            <div className="text-blue-200 text-sm">New</div>
          </div>
          <div className="bg-yellow-600 rounded-xl p-4 text-white text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "contacted").length}</div>
            <div className="text-yellow-200 text-sm">Contacted</div>
          </div>
          <div className="bg-green-600 rounded-xl p-4 text-white text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "qualified").length}</div>
            <div className="text-green-200 text-sm">Qualified</div>
          </div>
          <div className="bg-purple-600 rounded-xl p-4 text-white text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "converted").length}</div>
            <div className="text-purple-200 text-sm">Converted</div>
          </div>
          <div className="bg-red-600 rounded-xl p-4 text-white text-center">
            <div className="text-2xl font-bold">{leads.filter(l => l.status === "lost").length}</div>
            <div className="text-red-200 text-sm">Lost</div>
          </div>
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading leads...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-gray-800 rounded-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{lead.name}</h3>
                      <span className={`${getStatusColor(lead.status)} text-white text-xs px-2 py-1 rounded capitalize`}>
                        {lead.status || "new"}
                      </span>
                      {lead.lead_score && (
                        <span className={`${getScoreColor(lead.lead_score)} font-bold flex items-center`}>
                          <Star className="w-4 h-4 mr-1" />
                          {lead.lead_score}%
                        </span>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-400">
                      <div className="flex items-center">
                        <Phone className="w-4 h-4 mr-2" />
                        <a href={`tel:${lead.phone}`} className="hover:text-white">{lead.phone}</a>
                      </div>
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        <a href={`mailto:${lead.email}`} className="hover:text-white truncate">{lead.email}</a>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        {lead.district}, Bihar
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-700 px-2 py-1 rounded text-gray-300">{lead.property_type}</span>
                      <span className="bg-gray-700 px-2 py-1 rounded text-gray-300">{lead.roof_type} roof</span>
                      {lead.monthly_bill && <span className="bg-green-700 px-2 py-1 rounded text-green-300">₹{lead.monthly_bill}/month</span>}
                      {lead.recommended_system && <span className="bg-blue-700 px-2 py-1 rounded text-blue-300">{lead.recommended_system}</span>}
                    </div>

                    {lead.ai_analysis && (
                      <div className="mt-3 bg-purple-600 bg-opacity-20 border border-purple-600 rounded-lg p-3">
                        <span className="text-purple-400 text-xs font-semibold">AI Analysis: </span>
                        <span className="text-gray-300 text-xs">{lead.ai_analysis}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-2">
                    <select
                      value={lead.status || "new"}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
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
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 text-center"
                      >
                        WhatsApp
                      </a>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredLeads.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400">No leads found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};

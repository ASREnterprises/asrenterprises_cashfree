import { useState, useEffect } from "react";
import axios from "axios";
import { FileText, Plus, Download, Eye, ChevronRight, Calculator, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SOLAR_BRANDS = [
  {
    name: "TATA Power Solar",
    panels: ["330W Poly", "340W Poly", "380W Mono PERC", "540W Mono PERC"],
    pricePerWatt: 68,
    warranty: "25 years performance, 10 years product",
    efficiency: "17-21%"
  },
  {
    name: "Adani Solar",
    panels: ["335W Poly", "390W Mono PERC", "440W Mono PERC", "540W Bifacial"],
    pricePerWatt: 66,
    warranty: "25 years performance, 12 years product",
    efficiency: "18-21.5%"
  },
  {
    name: "Loom Solar",
    panels: ["375W Mono PERC", "440W Mono PERC", "550W Bifacial"],
    pricePerWatt: 64,
    warranty: "25 years performance, 10 years product",
    efficiency: "19-22%"
  },
  {
    name: "Luminous Solar",
    panels: ["335W Poly", "375W Mono", "440W Mono PERC", "500W Mono"],
    pricePerWatt: 66,
    warranty: "25 years performance, 10 years product",
    efficiency: "17-20%"
  },
  {
    name: "Waaree Solar",
    panels: ["340W Poly", "375W Mono", "440W Mono PERC", "550W Bifacial"],
    pricePerWatt: 65,
    warranty: "25 years performance, 12 years product",
    efficiency: "18-21%"
  },
  {
    name: "Vikram Solar",
    panels: ["340W Poly", "400W Mono PERC", "450W Mono PERC", "550W Bifacial"],
    pricePerWatt: 67,
    warranty: "25 years performance, 10 years product",
    efficiency: "18-21.5%"
  }
];

export const QuotationSystem = () => {
  const [quotations, setQuotations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    location: "",
    systemSize: "",
    brand: "TATA Power Solar",
    panelType: "",
    installationType: "residential",
    includeSubsidy: true,
    additionalNotes: ""
  });
  const [calculation, setCalculation] = useState(null);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const response = await axios.get(`${API}/admin/quotations`);
      setQuotations(response.data);
    } catch (error) {
      console.error("Error fetching quotations:", error);
    }
  };

  const calculateQuote = () => {
    const selectedBrand = SOLAR_BRANDS.find(b => b.name === formData.brand);
    const systemSizeKw = parseFloat(formData.systemSize);
    
    const baseCost = systemSizeKw * selectedBrand.pricePerWatt * 1000;
    const installationCost = baseCost * 0.15;
    const structureCost = systemSizeKw * 2000;
    const inverterCost = systemSizeKw * 8000;
    
    let subsidy = 0;
    if (formData.includeSubsidy && formData.installationType === "residential") {
      if (systemSizeKw <= 2) {
        subsidy = systemSizeKw * 30000;
      } else if (systemSizeKw <= 3) {
        subsidy = 60000 + ((systemSizeKw - 2) * 18000);
      } else {
        subsidy = 78000;
      }
    }
    
    const totalCost = baseCost + installationCost + structureCost + inverterCost;
    const finalCost = totalCost - subsidy;
    
    setCalculation({
      baseCost,
      installationCost,
      structureCost,
      inverterCost,
      totalCost,
      subsidy,
      finalCost,
      monthlyProduction: systemSizeKw * 120,
      yearlyProduction: systemSizeKw * 1440
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const quotationData = {
        ...formData,
        calculation,
        date: new Date().toISOString()
      };
      await axios.post(`${API}/admin/quotations`, quotationData);
      fetchQuotations();
      resetForm();
      alert("Quotation created successfully!");
    } catch (error) {
      console.error("Error creating quotation:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      location: "",
      systemSize: "",
      brand: "TATA Power Solar",
      panelType: "",
      installationType: "residential",
      includeSubsidy: true,
      additionalNotes: ""
    });
    setCalculation(null);
    setShowForm(false);
  };

  const selectedBrand = SOLAR_BRANDS.find(b => b.name === formData.brand);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <Link to="/admin/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ChevronRight className="w-5 h-5 rotate-180" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Solar Quotation System</h1>
            <p className="text-gray-600">Generate professional quotes for customers</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-yellow-600 text-[#0a355e] px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition flex items-center space-x-2"
            data-testid="create-quote-btn"
          >
            <Plus className="w-5 h-5" />
            <span>New Quotation</span>
          </button>
        </div>

        {/* Brands We Offer */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Solar Brands We Offer</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-6">
            {SOLAR_BRANDS.map((brand) => (
              <div key={brand.name} className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 text-center hover:shadow-lg transition">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">{brand.name}</h3>
                <p className="text-xs text-gray-600">₹{brand.pricePerWatt}/W</p>
                <p className="text-xs text-green-600 mt-1">{brand.efficiency}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quotation Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Quotation</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter customer name"
                    data-testid="quote-customer-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="+91XXXXXXXXXX"
                    data-testid="quote-phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="customer@email.com"
                    data-testid="quote-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location *</label>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="City, Bihar"
                    data-testid="quote-location"
                  />
                </div>
              </div>

              {/* System Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">System Size (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.systemSize}
                    onChange={(e) => setFormData({ ...formData, systemSize: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    placeholder="e.g., 3.5"
                    data-testid="quote-size"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Brand *</label>
                  <select
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value, panelType: "" })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    data-testid="quote-brand"
                  >
                    {SOLAR_BRANDS.map((brand) => (
                      <option key={brand.name} value={brand.name}>
                        {brand.name} - ₹{brand.pricePerWatt}/W
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Panel Type *</label>
                  <select
                    required
                    value={formData.panelType}
                    onChange={(e) => setFormData({ ...formData, panelType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    data-testid="quote-panel-type"
                  >
                    <option value="">Select Panel Type</option>
                    {selectedBrand?.panels.map((panel) => (
                      <option key={panel} value={panel}>{panel}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Installation Type *</label>
                  <select
                    required
                    value={formData.installationType}
                    onChange={(e) => setFormData({ ...formData, installationType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    data-testid="quote-installation-type"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.includeSubsidy}
                  onChange={(e) => setFormData({ ...formData, includeSubsidy: e.target.checked })}
                  className="w-5 h-5 text-yellow-600"
                  data-testid="quote-subsidy-checkbox"
                />
                <label className="text-sm font-semibold text-gray-700">
                  Include Government Subsidy (PM Surya Ghar - Max ₹78,000)
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  placeholder="Any special requirements or notes"
                  data-testid="quote-notes"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={calculateQuote}
                  className="flex-1 bg-blue-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center space-x-2"
                  data-testid="calculate-quote-btn"
                >
                  <Calculator className="w-5 h-5" />
                  <span>Calculate Quote</span>
                </button>
              </div>

              {/* Calculation Results */}
              {calculation && (
                <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Quotation Summary</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-gray-600">Panel Cost</p>
                      <p className="text-2xl font-bold text-gray-900">₹{calculation.baseCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-gray-600">Installation</p>
                      <p className="text-2xl font-bold text-gray-900">₹{calculation.installationCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-gray-600">Structure</p>
                      <p className="text-2xl font-bold text-gray-900">₹{calculation.structureCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-gray-600">Inverter</p>
                      <p className="text-2xl font-bold text-gray-900">₹{calculation.inverterCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-gray-600">Total Cost</p>
                      <p className="text-2xl font-bold text-gray-900">₹{calculation.totalCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-green-100 p-4 rounded-lg">
                      <p className="text-green-700">Subsidy</p>
                      <p className="text-2xl font-bold text-green-600">-₹{calculation.subsidy.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-4 rounded-lg md:col-span-2">
                      <p className="text-[#0a355e]">Final Cost to Customer</p>
                      <p className="text-3xl font-bold text-[#0a355e]">₹{calculation.finalCost.toLocaleString()}</p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-yellow-600 text-[#0a355e] py-3 rounded-lg font-semibold hover:bg-yellow-700 transition mt-6"
                    data-testid="save-quote-btn"
                  >
                    Save Quotation
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={resetForm}
                className="w-full border-2 border-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Quotations List */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quotations.map((quote) => (
            <div key={quote.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition" data-testid="quote-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{quote.customerName}</h3>
                  <p className="text-sm text-gray-600">{quote.location}</p>
                </div>
                <FileText className="w-8 h-8 text-yellow-600" />
              </div>

              <div className="space-y-2 text-sm mb-4">
                <p><strong>System:</strong> {quote.systemSize} kW</p>
                <p><strong>Brand:</strong> {quote.brand}</p>
                <p><strong>Type:</strong> {quote.installationType}</p>
                <p className="text-2xl font-bold text-yellow-600">₹{quote.calculation.finalCost.toLocaleString()}</p>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 bg-yellow-50 text-yellow-600 py-2 rounded-lg font-semibold hover:bg-yellow-100 transition flex items-center justify-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>View</span>
                </button>
                <button className="flex-1 bg-green-50 text-green-600 py-2 rounded-lg font-semibold hover:bg-green-100 transition flex items-center justify-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {quotations.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <FileText className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Quotations Yet</h3>
            <p className="text-gray-600 mb-6">Create your first solar quotation</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-yellow-600 text-[#0a355e] px-8 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition"
            >
              Create First Quotation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
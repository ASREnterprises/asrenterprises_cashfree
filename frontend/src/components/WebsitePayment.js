import { useState } from "react";
import axios from "axios";
import { CreditCard, Phone, Mail, User, MapPin, CheckCircle, Loader2, AlertCircle, ExternalLink } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BIHAR_DISTRICTS = [
  "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
  "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chhapra", 
  "Saharsa", "Sasaram", "Hajipur", "Dehri", "Siwan", "Motihari", 
  "Nawada", "Bagaha", "Buxar", "Kishanganj", "Sitamarhi", "Jamalpur", 
  "Jehanabad", "Aurangabad", "Samastipur", "Madhubani", "Vaishali",
  "Nalanda", "Rohtas", "Saran", "East Champaran", "West Champaran"
];

const SERVICE_TYPES = [
  { id: "solar_consultation", label: "Solar Consultation", price: 500 },
  { id: "site_visit", label: "Site Visit Booking", price: 1000 },
  { id: "registration_fee", label: "Registration Fee", price: 1500 },
  { id: "advance_payment", label: "Advance Payment", price: 0 }
];

export const WebsitePayment = ({ preSelectedService = null, prefilledAmount = null }) => {
  const [step, setStep] = useState(1); // 1: Form, 2: Processing, 3: Success/Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentResult, setPaymentResult] = useState(null);
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    address: "",
    district: "",
    service_type: preSelectedService || "solar_consultation",
    amount: prefilledAmount || 500,
    notes: ""
  });

  const selectedService = SERVICE_TYPES.find(s => s.id === formData.service_type);

  const handleServiceChange = (serviceId) => {
    const service = SERVICE_TYPES.find(s => s.id === serviceId);
    setFormData({
      ...formData,
      service_type: serviceId,
      amount: service?.price || formData.amount
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer_name || !formData.customer_phone || !formData.amount) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.customer_phone.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    setStep(2);
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/payments/website/initiate`, {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        address: formData.address,
        district: formData.district,
        service_type: formData.service_type,
        amount: parseFloat(formData.amount),
        notes: formData.notes
      });

      if (response.data.success) {
        setPaymentResult(response.data);
        setStep(3);
        
        // Auto-redirect to payment page after 2 seconds
        setTimeout(() => {
          if (response.data.payment_link) {
            window.open(response.data.payment_link, "_blank");
          }
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to initiate payment. Please try again.");
      setStep(1);
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setStep(1);
    setPaymentResult(null);
    setError("");
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      address: "",
      district: "",
      service_type: "solar_consultation",
      amount: 500,
      notes: ""
    });
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden" data-testid="website-payment-form">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">ASR Enterprises</h2>
            <p className="text-green-100 text-sm">Secure Online Payment</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Step 1: Form */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Service Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Service</label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_TYPES.map(service => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleServiceChange(service.id)}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      formData.service_type === service.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium text-gray-800 text-sm">{service.label}</p>
                    {service.price > 0 && (
                      <p className="text-green-600 text-xs">₹{service.price}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter your full name"
                  required
                  data-testid="payment-customer-name"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({...formData, customer_phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="10-digit mobile number"
                  required
                  data-testid="payment-customer-phone"
                />
              </div>
            </div>

            {/* Email (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({...formData, customer_email: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="your@email.com"
                  data-testid="payment-customer-email"
                />
              </div>
            </div>

            {/* District */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={formData.district}
                  onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
                  data-testid="payment-district"
                >
                  <option value="">Select District</option>
                  {BIHAR_DISTRICTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (INR) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-semibold"
                  placeholder="0"
                  min="1"
                  required
                  readOnly={selectedService?.price > 0}
                  data-testid="payment-amount"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="payment-submit-btn"
            >
              <CreditCard className="w-5 h-5" />
              Pay ₹{formData.amount}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Secure payment powered by Cashfree
            </p>
          </form>
        )}

        {/* Step 2: Processing */}
        {step === 2 && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Initiating Payment...</h3>
            <p className="text-gray-500 text-sm">Please wait while we create your payment link</p>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && paymentResult && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-800 mb-2">Payment Link Ready!</h3>
            <p className="text-gray-500 text-sm mb-4">
              Amount: <span className="font-bold text-green-600">₹{formData.amount}</span>
            </p>

            {paymentResult.payment_link && (
              <a
                href={paymentResult.payment_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition mb-4"
                data-testid="payment-link-btn"
              >
                <ExternalLink className="w-5 h-5" />
                Proceed to Payment
              </a>
            )}

            <div className="bg-gray-50 rounded-lg p-4 text-left mt-4">
              <p className="text-xs text-gray-500 mb-1">Order ID</p>
              <p className="font-mono text-sm text-gray-700">{paymentResult.order_id}</p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">Need help?</p>
              <p className="text-sm">
                <a href="tel:8877896889" className="text-green-600 font-medium">
                  Call: 8877896889
                </a>
                {" | "}
                <a href="mailto:support@asrenterprises.in" className="text-green-600 font-medium">
                  Email Support
                </a>
              </p>
            </div>

            <button
              onClick={resetForm}
              className="mt-4 text-blue-600 text-sm font-medium hover:underline"
            >
              Make Another Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsitePayment;

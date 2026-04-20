import React, { useState, useCallback, useEffect, useRef } from "react";
import { 
  GraduationCap, BookOpen, MessageSquare, Send, Loader2, CheckCircle, 
  Play, Award, Target, Lightbulb, TrendingUp, Users, Phone, 
  Sun, Zap, IndianRupee, Home, FileText, ChevronRight, Star,
  Clock, RefreshCw, Bot, User, Volume2, Copy, ThumbsUp
} from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Training modules data
const TRAINING_MODULES = [
  {
    id: "asr_company",
    title: "About ASR Enterprises",
    icon: <Sun className="w-6 h-6" />,
    color: "from-blue-600 to-cyan-500",
    description: "Know your company - history, values, and services",
    duration: "20 mins",
    topics: [
      "Company Overview & History",
      "Our Mission & Vision",
      "Services We Offer",
      "Our USP & Competitive Advantage",
      "Success Stories (500+ Installations)",
      "Team Structure & Hierarchy"
    ],
    content: {
      "Company Overview & History": `ASR Enterprises (आसर एंटरप्राइजेज) is a leading solar energy company based in Patna, Bihar. We specialize in rooftop solar installations under the PM Surya Ghar Yojana.

• Founded with a vision to make Bihar solar-powered
• 500+ successful installations across Bihar
• Authorized vendor under PM Surya Ghar scheme
• End-to-end solar solutions provider`,
      "Our Mission & Vision": `MISSION: To make clean, affordable solar energy accessible to every household in Bihar.

VISION: To be Bihar's most trusted solar installation company, leading the state's transition to renewable energy.

VALUES:
• Customer First - हमारे लिए ग्राहक संतुष्टि सबसे जरूरी है
• Quality - No compromise on panel and installation quality
• Transparency - Clear pricing, no hidden charges
• Support - Lifetime support for our customers`,
      "Services We Offer": `1. RESIDENTIAL SOLAR
   • 1kW to 10kW rooftop systems
   • On-grid (net metering) systems
   • Complete installation with warranty

2. COMMERCIAL SOLAR
   • Larger capacity systems
   • Industrial rooftop installations

3. END-TO-END SERVICE
   • Free site survey
   • System design & quotation
   • Government subsidy processing
   • Installation (7-10 days)
   • Net meter coordination with DISCOM
   • After-sales maintenance`,
      "Our USP & Competitive Advantage": `Why customers choose ASR Enterprises:

✓ TRUSTED BRAND - 500+ happy customers
✓ COMPLETE SERVICE - From survey to subsidy, we handle everything
✓ QUALITY PRODUCTS - Tier-1 panels with 25-year warranty
✓ TRANSPARENT PRICING - ₹70,000/kW all-inclusive
✓ FAST INSTALLATION - 7-10 days completion
✓ LOCAL PRESENCE - Based in Patna, we understand Bihar
✓ FREE MAINTENANCE - First year maintenance included
✓ AFTER-SALES SUPPORT - Lifetime technical support`,
      "Success Stories (500+ Installations)": `Our installations across Bihar:

📍 PATNA - 200+ installations
📍 GAYA - 50+ installations  
📍 MUZAFFARPUR - 40+ installations
📍 BHAGALPUR - 35+ installations
📍 DARBHANGA - 30+ installations
📍 Other districts - 145+ installations

Customer Testimonials:
"ASR ने हमारा पूरा काम संभाला, सब्सिडी भी समय पर मिली" - Rajesh Kumar, Patna

"बहुत professional work, अब बिजली बिल लगभग zero आता है" - Sunita Devi, Gaya`,
      "Team Structure & Hierarchy": `ASR ENTERPRISES TEAM:

MANAGEMENT
• Owner/Director - Overall business decisions

SALES TEAM
• Sales Manager - Team management, targets
• Sales Executives - Site visits, quotations
• Telecallers - Lead calling, follow-ups

TECHNICAL TEAM
• Technical Head - Installation supervision
• Technicians - Panel & inverter installation

SUPPORT TEAM  
• Customer Support - Query handling
• Documentation - Subsidy paperwork

YOUR ROLE IS IMPORTANT:
Every team member contributes to customer satisfaction!`
    }
  },
  {
    id: "pm_surya_ghar",
    title: "PM Surya Ghar Yojana",
    icon: <Home className="w-6 h-6" />,
    color: "from-amber-500 to-orange-500",
    description: "Complete guide to PM Surya Ghar scheme for rooftop solar",
    duration: "45 mins",
    topics: [
      "Scheme Overview & Eligibility",
      "Subsidy Structure (₹30,000-78,000)",
      "Application Process via National Portal",
      "Documentation Requirements",
      "Installation & Net Metering",
      "Common Customer Questions"
    ]
  },
  {
    id: "sales_calling",
    title: "Sales & Calling Skills",
    icon: <Phone className="w-6 h-6" />,
    color: "from-blue-500 to-cyan-500",
    description: "Master telecalling and lead conversion techniques",
    duration: "30 mins",
    topics: [
      "Opening Scripts & Introduction",
      "Handling Objections",
      "Building Trust & Rapport",
      "Closing Techniques",
      "Follow-up Strategies",
      "Do's and Don'ts"
    ]
  },
  {
    id: "technical_knowledge",
    title: "Solar Technical Knowledge",
    icon: <Zap className="w-6 h-6" />,
    color: "from-green-500 to-emerald-500",
    description: "Technical aspects of solar installation",
    duration: "60 mins",
    topics: [
      "Solar Panel Types & Efficiency",
      "System Sizing Based on Bill",
      "Inverter Selection",
      "Mounting & Orientation",
      "Net Metering Process",
      "Maintenance & Warranty"
    ]
  },
  {
    id: "customer_handling",
    title: "Customer Handling",
    icon: <Users className="w-6 h-6" />,
    color: "from-purple-500 to-pink-500",
    description: "Professional customer service techniques",
    duration: "25 mins",
    topics: [
      "First Impression Matters",
      "Active Listening Skills",
      "Addressing Concerns",
      "Site Visit Etiquette",
      "After-Sales Support",
      "Building Long-term Relations"
    ]
  },
  {
    id: "roi_calculator",
    title: "ROI & Financial Benefits",
    icon: <IndianRupee className="w-6 h-6" />,
    color: "from-teal-500 to-cyan-500",
    description: "Help customers understand savings & returns",
    duration: "20 mins",
    topics: [
      "Monthly Savings Calculation",
      "Payback Period Explanation",
      "25-Year Savings Projection",
      "EMI & Financing Options",
      "Tax Benefits (Section 80EE)",
      "Property Value Increase"
    ]
  }
];

// Quick reference cards
const QUICK_REFERENCES = [
  {
    title: "PM Surya Ghar Subsidy",
    items: [
      { label: "1-2 kW", value: "₹30,000/kW (Max ₹60,000)" },
      { label: "2-3 kW", value: "₹18,000/kW (₹60K + ₹18K)" },
      { label: "3+ kW", value: "Fixed ₹78,000 total" }
    ]
  },
  {
    title: "System Sizing Guide",
    items: [
      { label: "₹1,000-2,000 bill", value: "1-2 kW system" },
      { label: "₹2,000-4,000 bill", value: "2-3 kW system" },
      { label: "₹4,000-6,000 bill", value: "3-4 kW system" },
      { label: "₹6,000+ bill", value: "5+ kW system" }
    ]
  },
  {
    title: "Key Selling Points",
    items: [
      { label: "Zero Bill", value: "Reduce electricity bill to zero" },
      { label: "Govt Subsidy", value: "Up to ₹78,000 subsidy" },
      { label: "25 Year Life", value: "Panels last 25+ years" },
      { label: "Free Electricity", value: "Generate your own power" }
    ]
  }
];

// Sample scripts for telecallers
const SAMPLE_SCRIPTS = [
  {
    title: "Initial Call Opening",
    script: `नमस्ते [Customer Name] जी, मैं [Your Name] ASR Enterprises से बोल रहा/रही हूं। 

क्या आपको पता है कि अब आप PM Surya Ghar योजना के तहत अपने घर पर सोलर पैनल लगवाकर ₹78,000 तक की सरकारी सब्सिडी पा सकते हैं?

इससे आपका बिजली का बिल लगभग शून्य हो जाएगा और 25 साल तक मुफ्त बिजली मिलेगी।

क्या आप 5 मिनट में जानना चाहेंगे कि आप कितनी बचत कर सकते हैं?`
  },
  {
    title: "Handling Price Objection",
    script: `जी, मैं समझता/समझती हूं कि यह एक बड़ा निवेश लगता है।

लेकिन देखिए:
• सरकार ₹78,000 तक सब्सिडी दे रही है
• बाकी राशि के लिए आसान EMI उपलब्ध है
• आपका मासिक बिल ₹[X] है, सोलर लगने के बाद लगभग ₹0 होगा
• 3-4 साल में आपका पूरा पैसा वापस आ जाएगा
• उसके बाद 20+ साल मुफ्त बिजली

यानी यह खर्च नहीं, एक शानदार निवेश है!`
  },
  {
    title: "Site Visit Scheduling",
    script: `[Customer Name] जी, आपकी रुचि के लिए धन्यवाद!

अगला कदम है हमारी टीम का आपके घर पर फ्री साइट विज़िट। इसमें हम:
• आपकी छत का सर्वे करेंगे
• सही सिस्टम साइज़ बताएंगे
• सटीक कोटेशन देंगे
• सब्सिडी की पूरी जानकारी देंगे

कल या परसों कौन सा दिन सुविधाजनक रहेगा?`
  },
  {
    title: "Closing the Deal",
    script: `[Customer Name] जी, आपने सही फैसला किया है!

आज बुकिंग करने पर:
• ₹[Advance] एडवांस में बुकिंग कन्फर्म
• 7-10 दिन में इंस्टॉलेशन
• सब्सिडी के लिए हम खुद अप्लाई करेंगे
• 5 साल की वारंटी
• लाइफटाइम सपोर्ट

पेमेंट के लिए UPI, कार्ड, या बैंक ट्रांसफर कर सकते हैं। कैसे करना चाहेंगे?`
  }
];

const StaffTraining = ({ staffId, staffName, staffRole }) => {
  const [activeSection, setActiveSection] = useState("modules");
  const [selectedModule, setSelectedModule] = useState(null);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [completedTopics, setCompletedTopics] = useState({});
  const [trainingProgress, setTrainingProgress] = useState(0);
  const chatEndRef = useRef(null);

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`training_progress_${staffId}`);
    if (saved) {
      const data = JSON.parse(saved);
      setCompletedTopics(data.completedTopics || {});
      setTrainingProgress(data.progress || 0);
    }
  }, [staffId]);

  // Save progress
  const saveProgress = useCallback((topics, progress) => {
    localStorage.setItem(`training_progress_${staffId}`, JSON.stringify({
      completedTopics: topics,
      progress,
      lastUpdated: new Date().toISOString()
    }));
  }, [staffId]);

  // Mark topic as complete
  const markTopicComplete = (moduleId, topicIndex) => {
    const key = `${moduleId}_${topicIndex}`;
    const newCompleted = { ...completedTopics, [key]: true };
    setCompletedTopics(newCompleted);
    
    // Calculate progress
    const totalTopics = TRAINING_MODULES.reduce((sum, m) => sum + m.topics.length, 0);
    const completedCount = Object.keys(newCompleted).length;
    const newProgress = Math.round((completedCount / totalTopics) * 100);
    setTrainingProgress(newProgress);
    
    saveProgress(newCompleted, newProgress);
  };

  // AI Training Assistant
  const sendToAI = async () => {
    if (!aiInput.trim() || aiLoading) return;

    const userMessage = aiInput.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setAiLoading(true);

    try {
      // Use the training-specific AI endpoint
      const response = await axios.post(`${API}/ai/training-assistant`, {
        message: userMessage,
        staff_role: staffRole || "sales",
        context: selectedModule?.id || "general"
      });

      setAiMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.response || response.data.message 
      }]);
    } catch (error) {
      // Fallback to public chat if training endpoint doesn't exist
      try {
        const fallbackResponse = await axios.post(`${API}/ai/chat/public`, {
          message: `As a solar sales training assistant for ASR Enterprises, help with: ${userMessage}. 
          Focus on PM Surya Ghar scheme, solar installation benefits, and sales techniques.
          Provide practical tips for telecallers and sales staff.`,
          context: "staff_training"
        });
        
        setAiMessages(prev => [...prev, { 
          role: "assistant", 
          content: fallbackResponse.data.response || fallbackResponse.data.message 
        }]);
      } catch (fallbackError) {
        setAiMessages(prev => [...prev, { 
          role: "assistant", 
          content: "माफ़ कीजिए, अभी AI सेवा उपलब्ध नहीं है। कृपया बाद में प्रयास करें।" 
        }]);
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Copy script to clipboard
  const copyScript = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Suggested questions for AI
  const suggestedQuestions = [
    "PM Surya Ghar में कितनी सब्सिडी मिलती है?",
    "Customer ने कहा बहुत महंगा है, क्या बोलूं?",
    "3kW सिस्टम के लिए कितनी जगह चाहिए?",
    "Net metering क्या है? कैसे समझाऊं?",
    "Site visit में क्या-क्या चेक करना है?",
    "EMI option कैसे explain करूं?"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-6 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <GraduationCap className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">Staff Training Portal</h1>
                <p className="text-amber-100 text-sm">Welcome, {staffName || "Team Member"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-amber-100">Training Progress</p>
                <p className="text-lg font-bold">{trainingProgress}%</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 transform -rotate-90">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                    <circle 
                      cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="4"
                      strokeDasharray={`${trainingProgress * 1.5} 150`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <Award className="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex overflow-x-auto">
            {[
              { id: "modules", label: "Training Modules", icon: <BookOpen className="w-4 h-4" /> },
              { id: "scripts", label: "Call Scripts", icon: <FileText className="w-4 h-4" /> },
              { id: "quick_ref", label: "Quick Reference", icon: <Lightbulb className="w-4 h-4" /> },
              { id: "ai_assistant", label: "AI Assistant", icon: <Bot className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`px-5 py-4 flex items-center space-x-2 border-b-2 transition whitespace-nowrap ${
                  activeSection === tab.id
                    ? "border-amber-500 text-amber-600 bg-amber-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                data-testid={`training-tab-${tab.id}`}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Training Modules Section */}
        {activeSection === "modules" && (
          <div className="space-y-6">
            {!selectedModule ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800">Choose a Training Module</h2>
                  <p className="text-gray-500">Complete all modules to become a certified solar sales expert</p>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {TRAINING_MODULES.map(module => {
                    const completedInModule = module.topics.filter((_, i) => 
                      completedTopics[`${module.id}_${i}`]
                    ).length;
                    const moduleProgress = Math.round((completedInModule / module.topics.length) * 100);
                    
                    return (
                      <div 
                        key={module.id}
                        onClick={() => setSelectedModule(module)}
                        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl transition group"
                        data-testid={`module-${module.id}`}
                      >
                        <div className={`bg-gradient-to-r ${module.color} p-6 text-white`}>
                          <div className="flex items-center justify-between">
                            <div className="p-3 bg-white/20 rounded-xl">
                              {module.icon}
                            </div>
                            <div className="text-right">
                              <p className="text-xs opacity-80">Progress</p>
                              <p className="text-xl font-bold">{moduleProgress}%</p>
                            </div>
                          </div>
                          <h3 className="text-lg font-bold mt-4">{module.title}</h3>
                          <p className="text-sm opacity-90 mt-1">{module.description}</p>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                            <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{module.duration}</span>
                            <span>{module.topics.length} topics</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`bg-gradient-to-r ${module.color} h-2 rounded-full transition-all`}
                              style={{ width: `${moduleProgress}%` }}
                            />
                          </div>
                          <button className="w-full mt-4 py-2 text-center text-amber-600 font-medium group-hover:bg-amber-50 rounded-lg transition flex items-center justify-center">
                            {moduleProgress === 100 ? "Review Module" : "Continue Learning"}
                            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              // Module Detail View
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className={`bg-gradient-to-r ${selectedModule.color} p-6 text-white`}>
                  <button 
                    onClick={() => setSelectedModule(null)}
                    className="text-white/80 hover:text-white mb-4 flex items-center"
                  >
                    ← Back to Modules
                  </button>
                  <div className="flex items-center space-x-4">
                    <div className="p-4 bg-white/20 rounded-xl">
                      {selectedModule.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{selectedModule.title}</h2>
                      <p className="text-white/90">{selectedModule.description}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-800 mb-4">Topics to Cover:</h3>
                  <div className="space-y-3">
                    {selectedModule.topics.map((topic, index) => {
                      const isCompleted = completedTopics[`${selectedModule.id}_${index}`];
                      return (
                        <div 
                          key={index}
                          className={`p-4 rounded-xl border-2 transition ${
                            isCompleted 
                              ? "bg-green-50 border-green-200" 
                              : "bg-gray-50 border-gray-200 hover:border-amber-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                isCompleted ? "bg-green-500 text-white" : "bg-gray-300 text-white"
                              }`}>
                                {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                              </div>
                              <span className={`font-medium ${isCompleted ? "text-green-700" : "text-gray-700"}`}>
                                {topic}
                              </span>
                            </div>
                            {!isCompleted && (
                              <button
                                onClick={() => markTopicComplete(selectedModule.id, index)}
                                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition"
                              >
                                Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* AI Help for Module */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <div className="flex items-center space-x-2 text-purple-700 mb-2">
                      <Bot className="w-5 h-5" />
                      <span className="font-medium">Need help with this module?</span>
                    </div>
                    <p className="text-sm text-purple-600 mb-3">
                      Ask our AI assistant any questions about {selectedModule.title}
                    </p>
                    <button
                      onClick={() => {
                        setActiveSection("ai_assistant");
                        setAiInput(`Explain ${selectedModule.title} in detail for a new sales staff`);
                      }}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition"
                    >
                      Ask AI Assistant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Call Scripts Section */}
        {activeSection === "scripts" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Ready-to-Use Call Scripts</h2>
              <p className="text-gray-500">Copy and customize these scripts for your calls</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {SAMPLE_SCRIPTS.map((script, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 text-white">
                    <h3 className="font-bold flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      {script.title}
                    </h3>
                  </div>
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl font-sans leading-relaxed">
                      {script.script}
                    </pre>
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => copyScript(script.script)}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center justify-center"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Script
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection("ai_assistant");
                          setAiInput(`Improve this script: ${script.title}`);
                        }}
                        className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition flex items-center justify-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Get Variations
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reference Section */}
        {activeSection === "quick_ref" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800">Quick Reference Cards</h2>
              <p className="text-gray-500">Essential information at your fingertips</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {QUICK_REFERENCES.map((card, index) => (
                <div key={card.title || index} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
                    <h3 className="font-bold">{card.title}</h3>
                  </div>
                  <div className="p-4">
                    {card.items.map((item, idx) => (
                      <div key={item.label || idx} className="flex justify-between py-3 border-b border-gray-100 last:border-0">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-semibold text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* PM Surya Ghar Latest Updates */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center space-x-3 mb-4">
                <Sun className="w-8 h-8" />
                <h3 className="text-xl font-bold">PM Surya Ghar - Latest Updates 2025</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/20 rounded-xl p-4">
                  <h4 className="font-bold mb-2">✓ Key Benefits</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Up to ₹78,000 central government subsidy</li>
                    <li>• 300 units free electricity per month</li>
                    <li>• 25-year panel warranty</li>
                    <li>• Net metering - sell excess power</li>
                  </ul>
                </div>
                <div className="bg-white/20 rounded-xl p-4">
                  <h4 className="font-bold mb-2">✓ Eligibility</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Residential properties only</li>
                    <li>• Valid electricity connection</li>
                    <li>• Adequate roof space</li>
                    <li>• Apply via pmsuryaghar.gov.in</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Assistant Section */}
        {activeSection === "ai_assistant" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chat Area */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col" style={{ height: "600px" }}>
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white">
                <div className="flex items-center space-x-3">
                  <Bot className="w-6 h-6" />
                  <div>
                    <h3 className="font-bold">AI Training Assistant</h3>
                    <p className="text-sm text-purple-100">Ask anything about solar sales & PM Surya Ghar</p>
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {aiMessages.length === 0 && (
                  <div className="text-center py-8">
                    <Bot className="w-16 h-16 mx-auto text-purple-300 mb-4" />
                    <h4 className="text-lg font-medium text-gray-700">Hello! I'm your AI Training Assistant</h4>
                    <p className="text-gray-500 mb-4">Ask me anything about:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">PM Surya Ghar</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">Sales Techniques</span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Technical Knowledge</span>
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">Customer Handling</span>
                    </div>
                  </div>
                )}
                
                {aiMessages.map((msg, index) => (
                  <div 
                    key={index}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] p-4 rounded-2xl ${
                      msg.role === "user" 
                        ? "bg-purple-500 text-white rounded-br-md" 
                        : "bg-white shadow-md rounded-bl-md"
                    }`}>
                      <div className="flex items-start space-x-2">
                        {msg.role === "assistant" && <Bot className="w-5 h-5 text-purple-500 mt-1" />}
                        <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                        {msg.role === "user" && <User className="w-5 h-5 mt-1" />}
                      </div>
                    </div>
                  </div>
                ))}
                
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white shadow-md p-4 rounded-2xl rounded-bl-md">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-5 h-5 text-purple-500" />
                        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                        <span className="text-gray-500 text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="p-4 border-t bg-white">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendToAI()}
                    placeholder="Ask a question about solar sales..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    data-testid="ai-training-input"
                  />
                  <button
                    onClick={sendToAI}
                    disabled={aiLoading || !aiInput.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50"
                    data-testid="ai-training-send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Suggested Questions */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <Lightbulb className="w-5 h-5 text-amber-500 mr-2" />
                  Suggested Questions
                </h4>
                <div className="space-y-2">
                  {suggestedQuestions.map((q, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setAiInput(q);
                        sendToAI();
                      }}
                      className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-purple-50 rounded-xl transition text-gray-700 hover:text-purple-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl p-4 border border-amber-200">
                <h4 className="font-bold text-amber-800 mb-2 flex items-center">
                  <Star className="w-5 h-5 mr-2" />
                  Pro Tips
                </h4>
                <ul className="text-sm text-amber-700 space-y-2">
                  <li>• Always listen to customer's concerns first</li>
                  <li>• Focus on savings, not just cost</li>
                  <li>• Use local success stories</li>
                  <li>• Offer site visit for serious leads</li>
                  <li>• Follow up within 24 hours</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffTraining;

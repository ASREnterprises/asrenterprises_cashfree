import { Star, Quote } from "lucide-react";

export const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Rubi Devi",
      location: "Hajipur, Bihar",
      rating: 5,
      text: "ASR Enterprises installed a 3.5kW solar system at my home in Hajipur. The team was very professional and completed the work on time. My electricity bill has reduced significantly and I'm very happy with the quality of the installation.",
      system: "3.5 kW Solar System",
      savings: "₹4,200/month"
    },
    {
      name: "Sikandar Yadav",
      location: "Khagaul, Patna",
      rating: 5,
      text: "Excellent service by ASR Enterprises! They installed a 5.6kW solar system at my property in Khagaul. The subsidy process was handled smoothly and the panels are working perfectly. Highly recommend them for solar installation.",
      system: "5.6 kW Solar System",
      savings: "₹6,800/month"
    },
    {
      name: "Bansi Kumar",
      location: "Danapur, Patna",
      rating: 5,
      text: "Very satisfied with ASR Enterprises! They installed a 4.6kW solar system at my home in Danapur. The quality of panels is excellent and they provided complete guidance on PM Surya Ghar subsidy. Great after-sales support!",
      system: "4.6 kW Solar System",
      savings: "₹5,500/month"
    },
    {
      name: "Gracy Martin",
      location: "Jagdevpath, Patna",
      rating: 5,
      text: "Best solar company in Patna! ASR Enterprises installed a 4.6kW system at my home in Jagdevpath. From site survey to final installation, everything was professional. My electricity bills have reduced drastically. Thank you ASR Enterprises!",
      system: "4.6 kW Solar System",
      savings: "₹5,600/month"
    }
  ];

  return (
    <div className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
          <p className="text-xl text-gray-600">Trusted by 25+ happy customers across Bihar</p>
          <div className="flex justify-center items-center space-x-2 mt-4">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <span className="text-2xl font-bold text-gray-900">5.0/5.0</span>
            <span className="text-gray-600">(25+ reviews)</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6 shadow-lg hover:shadow-2xl transition relative"
            >
              <Quote className="w-10 h-10 text-blue-400 opacity-50 absolute top-4 right-4" />
              
              <div className="flex mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>

              <p className="text-gray-700 mb-4 leading-relaxed text-sm">
                "{testimonial.text}"
              </p>

              <div className="border-t border-gray-300 pt-4 mt-4">
                <div className="font-bold text-gray-900">{testimonial.name}</div>
                <div className="text-xs text-gray-600 mb-2">{testimonial.location}</div>
                <div className="flex justify-between text-xs">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{testimonial.system}</span>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">{testimonial.savings}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 mb-6">Join our growing family of satisfied solar customers!</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://search.google.com/local/writereview?placeid=ChIJAR33l2BX7TkRJ4CYdw8Hkps"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center space-x-2"
              data-testid="google-review-btn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Review Us on Google</span>
            </a>
            <a
              href="tel:8877896889"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Call for Free Consultation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

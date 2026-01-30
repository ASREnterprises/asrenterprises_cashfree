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
          <p className="text-xl text-gray-600">Trusted by 200+ happy customers across Bihar</p>
          <div className="flex justify-center items-center space-x-2 mt-4">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <span className="text-2xl font-bold text-gray-900">4.9/5.0</span>
            <span className="text-gray-600">(200+ reviews)</span>
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
              href="https://wa.me/918877896889?text=I%20want%20to%20share%20my%20solar%20experience"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Share Your Experience
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

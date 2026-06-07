import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm, { type ContactFormLabels } from "@/components/ContactForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact & Support",
  description:
    "Get in touch with Sienovo for sales, technical support, and partnership inquiries about INT-AIBOX edge AI computing and industrial video analytics. Email, WhatsApp, and offices in Shenzhen and San Francisco.",
  alternates: {
    canonical: "/contact",
    languages: { en: "/contact", "x-default": "/contact", zh: "/zh/contact" },
  },
  openGraph: {
    title: "Contact & Support | Sienovo",
    description: "Reach Sienovo for sales, support, and partnerships.",
    url: `${SITE_URL}/contact`,
    type: "website",
  },
};

const EMAIL = "collin.liu@sienovo.cn";
const WHATSAPP = "+86 187 1869 9276";
const WHATSAPP_URL = "https://wa.me/8618718699276";

const labels: ContactFormLabels = {
  name: "Name",
  email: "Email",
  company: "Company",
  phone: "Phone",
  message: "Message",
  send: "Send message",
  sending: "Sending…",
  success: "Thanks — your message has been sent. We'll get back to you shortly.",
  error: "Something went wrong. Please try again or email us directly.",
  optional: "optional",
};

export default function ContactPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Sienovo",
    url: `${SITE_URL}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: "Sienovo",
      email: EMAIL,
      url: SITE_URL,
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Contact &amp; Support</h1>
          <p className="mt-4 text-lg text-gray-600">
            Questions about INT-AIBOX edge AI, a deployment, pricing, or a partnership? Send us a
            message and our team will respond within one business day.
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          {/* Contact methods */}
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Email</h2>
              <a href={`mailto:${EMAIL}`} className="mt-1 block text-lg text-accent hover:underline">
                {EMAIL}
              </a>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">WhatsApp</h2>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-lg text-accent hover:underline"
              >
                {WHATSAPP}
              </a>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Offices</h2>
              <p className="mt-1 text-gray-700">Headquarters — Shenzhen, China</p>
              <p className="text-gray-700">600 California St, San Francisco, CA 94108</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Support hours</h2>
              <p className="mt-1 text-gray-700">Monday – Friday, 9:00 – 18:00 (GMT+8)</p>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
            <ContactForm t={labels} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

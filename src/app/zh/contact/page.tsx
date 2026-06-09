import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm, { type ContactFormLabels } from "@/components/ContactForm";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "联系我们与技术支持",
  description:
    "联系深圳信迈 Sienovo,咨询 INT-AIBOX 边缘 AI 计算盒与工业视频分析的销售、技术支持与合作。邮箱、WhatsApp,深圳与旧金山办公室。",
  alternates: {
    canonical: "/zh/contact",
    languages: { en: "/contact", "x-default": "/contact", zh: "/zh/contact" },
  },
  openGraph: {
    title: "联系我们 | Sienovo 深圳信迈",
    description: "联系 Sienovo 咨询销售、技术支持与合作。",
    url: `${SITE_URL}/zh/contact`,
    type: "website",
  },
};

const EMAIL = "collin.liu@sienovo.cn";
const WHATSAPP = "+86 187 1869 9276";
const WHATSAPP_URL = "https://wa.me/8618718699276";

const labels: ContactFormLabels = {
  name: "姓名",
  email: "邮箱",
  company: "公司",
  phone: "电话",
  message: "留言",
  send: "发送",
  sending: "发送中…",
  success: "已收到您的留言,我们会尽快与您联系。感谢!",
  error: "发送失败,请重试或直接邮件联系我们。",
  optional: "选填",
};

export default function ContactPageZh() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "联系 Sienovo 深圳信迈",
    url: `${SITE_URL}/zh/contact`,
    mainEntity: {
      "@type": "Organization",
      name: "Sienovo",
      alternateName: "深圳信迈",
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
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">联系我们与技术支持</h1>
          <p className="mt-4 text-lg text-gray-600">
            对 INT-AIBOX 边缘 AI、部署方案、报价或合作有任何问题?给我们留言,团队将在一个工作日内回复。
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-2">
          {/* 联系方式 */}
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">邮箱</h2>
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">办公室</h2>
              <p className="mt-1 text-gray-700">总部 — 中国深圳</p>
              <p className="text-gray-700">600 California St, San Francisco, CA 94108</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">支持时间</h2>
              <p className="mt-1 text-gray-700">周一至周五 9:00 – 18:00(GMT+8)</p>
            </div>
          </div>

          {/* 表单 */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
            <ContactForm t={labels} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

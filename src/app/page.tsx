import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Products from "@/components/Products";
import Features from "@/components/Features";
import LatestInsights from "@/components/LatestInsights";
import Footer from "@/components/Footer";

// Below-the-fold sections — server-rendered (SSR=true so SEO/LCP unaffected)
// but split into separate JS chunks. This shrinks the initial hydration
// payload by keeping these out of the main page chunk.
const ProductGallery = dynamic(() => import("@/components/ProductGallery"));
const Specs = dynamic(() => import("@/components/Specs"));
const Scenarios = dynamic(() => import("@/components/Scenarios"));
const Cases = dynamic(() => import("@/components/Cases"));
const Platform = dynamic(() => import("@/components/Platform"));
const CTA = dynamic(() => import("@/components/CTA"));

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Products />
        <Features />
        <ProductGallery />
        <Scenarios />
        <Cases />
        <Specs />
        <Platform />
        <LatestInsights locale="en" />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

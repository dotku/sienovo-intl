import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import ProductGallery from "@/components/ProductGallery";
import Specs from "@/components/Specs";
import Scenarios from "@/components/Scenarios";
import Cases from "@/components/Cases";
import Platform from "@/components/Platform";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <ProductGallery />
        <Scenarios />
        <Cases />
        <Specs />
        <Platform />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

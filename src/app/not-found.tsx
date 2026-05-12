import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Page Not Found",
  description: "The page you are looking for does not exist.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-sm font-mono text-gray-400">404</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-gray-500">
          The page you are looking for has been moved, removed, or never
          existed. Try one of the links below.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="bg-accent hover:bg-red-700 text-white px-6 py-2.5 rounded font-medium transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/blog"
            className="border border-gray-300 hover:border-gray-500 text-gray-900 px-6 py-2.5 rounded font-medium transition-colors"
          >
            Read the blog
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

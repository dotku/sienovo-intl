import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogList from "@/components/BlogList";

export const metadata = {
  title: "Technical Blog - Embedded Systems, Edge AI & Industrial Computing",
  description:
    "Technical articles on embedded systems, edge AI, FPGA, ARM platforms, and industrial computing solutions from Sienovo.",
};

export default async function EnBlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <BlogList locale="en" page={page} />
      </main>
      <Footer />
    </>
  );
}

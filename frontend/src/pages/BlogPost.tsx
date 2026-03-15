import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { posts } from "../blog/index";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

// Vite raw imports for markdown
const markdownFiles: Record<string, () => Promise<{ default: string }>> = {
  "how-we-match-attorneys": () => import("../blog/how-we-match-attorneys.md?raw") as Promise<{ default: string }>,
  "understanding-venue": () => import("../blog/understanding-venue.md?raw") as Promise<{ default: string }>,
  "what-to-look-for-in-attorney": () => import("../blog/what-to-look-for-in-attorney.md?raw") as Promise<{ default: string }>,
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState("");
  const meta = posts.find((p) => p.slug === slug);

  useEffect(() => {
    if (slug && markdownFiles[slug]) {
      markdownFiles[slug]().then((m) => {
        // Strip frontmatter
        const body = m.default.replace(/^---[\s\S]*?---\n/, "");
        setContent(body);
      });
    }
  }, [slug]);

  if (!meta) return <div className="p-10 text-[#191918]">Post not found.</div>;

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <Link to="/blog" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] mb-8 inline-block">
          Back to Blog
        </Link>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{meta.date}</span>
          <span className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.3)]">·</span>
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{meta.readTime}</span>
        </div>
        <article className="prose prose-neutral max-w-none text-[#191918]">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
        <div className="mt-16 pt-8 border-t border-[rgba(25,25,24,0.12)] text-center">
          <p className="text-[rgba(25,25,24,0.6)] mb-4">Ready to find the right attorney?</p>
          <Link to="/app" className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px] inline-flex items-center">
            Get Matched →
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import { posts } from "../blog/index";
import JsonLd from "../components/JsonLd";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

const SITE = "https://attorney-matchmaker.onrender.com";

// Vite raw imports for markdown files
const markdownFiles: Record<string, () => Promise<{ default: string }>> = {
  "how-we-match-attorneys": () => import("../blog/how-we-match-attorneys.md?raw") as Promise<{ default: string }>,
  "understanding-venue": () => import("../blog/understanding-venue.md?raw") as Promise<{ default: string }>,
  "what-to-look-for-in-attorney": () => import("../blog/what-to-look-for-in-attorney.md?raw") as Promise<{ default: string }>,
  "how-to-find-attorney-free-consultation": () => import("../blog/how-to-find-attorney-free-consultation.md?raw") as Promise<{ default: string }>,
  "ai-attorney-matching-explained": () => import("../blog/ai-attorney-matching-explained.md?raw") as Promise<{ default: string }>,
  "federal-vs-state-court": () => import("../blog/federal-vs-state-court.md?raw") as Promise<{ default: string }>,
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState("");
  const meta = posts.find((p) => p.slug === slug);

  useEffect(() => {
    if (slug && markdownFiles[slug]) {
      markdownFiles[slug]().then((m) => {
        const body = m.default.replace(/^---[\s\S]*?---\n/, "");
        setContent(body);
      });
    }
  }, [slug]);

  if (!meta) return <div className="p-10 text-[#191918]">Post not found.</div>;

  const url = `${SITE}/blog/${meta.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.excerpt,
    datePublished: meta.date,
    url,
    author: { "@type": "Organization", name: "Attorney Matchmaker" },
    publisher: {
      "@type": "Organization",
      name: "Attorney Matchmaker",
      url: SITE,
    },
  };

  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>{meta.title} — Attorney Matchmaker</title>
        <meta name="description" content={meta.excerpt} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.excerpt} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={meta.date} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.excerpt} />
      </Helmet>
      <JsonLd data={jsonLd} />

      <LandingNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <Link
          to="/blog"
          className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] mb-8 inline-block"
        >
          ← The Brief
        </Link>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{meta.date}</span>
          <span className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.3)]">·</span>
          <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{meta.readTime}</span>
          {meta.category && (
            <>
              <span className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.3)]">·</span>
              <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[#FCAA2D]">{meta.category}</span>
            </>
          )}
        </div>
        <h1 className="text-3xl font-bold text-[#191918] mb-8 leading-tight">{meta.title}</h1>
        <article className="prose prose-neutral max-w-none text-[#191918]
          prose-headings:text-[#191918] prose-headings:font-semibold
          prose-a:text-[#FCAA2D] prose-a:no-underline hover:prose-a:underline
          prose-strong:text-[#191918]
          prose-li:text-[rgba(25,25,24,0.8)]
          prose-p:text-[rgba(25,25,24,0.8)] prose-p:leading-relaxed">
          <ReactMarkdown>{content}</ReactMarkdown>
        </article>
        <div className="mt-16 pt-8 border-t border-[rgba(25,25,24,0.12)] text-center">
          <p className="text-[rgba(25,25,24,0.6)] mb-4">Ready to find the right attorney?</p>
          <Link
            to="/app"
            className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide px-6 min-h-[44px] inline-flex items-center"
          >
            Get Matched →
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

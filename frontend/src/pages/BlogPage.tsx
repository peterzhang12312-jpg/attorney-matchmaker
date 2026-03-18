import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { posts } from "../blog/index";
import LandingNav from "../components/landing/LandingNav";
import LandingFooter from "../components/landing/LandingFooter";

const SITE = "https://attorney-matchmaker.onrender.com";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <Helmet>
        <title>The Brief — Attorney Matchmaker Blog</title>
        <meta name="description" content="Practical guides on finding the right attorney, understanding federal court venue, and how AI matching works. Written for people navigating the legal system." />
        <link rel="canonical" href={`${SITE}/blog`} />
        <meta property="og:title" content="The Brief — Attorney Matchmaker Blog" />
        <meta property="og:description" content="Practical guides on finding the right attorney, understanding federal court venue, and how AI matching works." />
        <meta property="og:url" content={`${SITE}/blog`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <LandingNav />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">
          The Brief
        </p>
        <h1 className="text-4xl font-bold text-[#191918] mb-4">Blog</h1>
        <p className="text-[rgba(25,25,24,0.6)] mb-12 max-w-xl">
          Practical guides on finding the right attorney, navigating federal courts, and how data-driven matching works.
        </p>
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-6 hover:border-[#FCAA2D] transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{post.date}</span>
                <span className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.3)]">·</span>
                <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">{post.readTime}</span>
                {post.category && (
                  <>
                    <span className="font-mono text-[0.68rem] text-[rgba(25,25,24,0.3)]">·</span>
                    <span className="font-mono text-[0.68rem] uppercase tracking-widest text-[#FCAA2D]">{post.category}</span>
                  </>
                )}
              </div>
              <h2 className="text-xl font-semibold text-[#191918] mb-2 group-hover:text-[#FCAA2D] transition-colors">{post.title}</h2>
              <p className="text-[rgba(25,25,24,0.6)] text-sm leading-relaxed">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

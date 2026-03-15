import { Link } from "react-router-dom";
import { posts } from "../../blog/index";

export default function BlogPreview() {
  const featured = posts.slice(0, 3);
  return (
    <section className="bg-white border-y border-[rgba(25,25,24,0.12)] px-4 sm:px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-2">The Brief</p>
            <h2 className="text-3xl font-bold text-[#191918]">From the blog</h2>
          </div>
          <Link to="/blog" className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] hover:text-[#191918] transition-colors">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {featured.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`} className="bg-[#FFFEF2] border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 hover:border-[#FCAA2D] transition-colors group">
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-3">{p.date} · {p.readTime}</p>
              <h3 className="font-semibold text-[#191918] mb-2 group-hover:text-[#FCAA2D] transition-colors leading-snug">{p.title}</h3>
              <p className="text-sm text-[rgba(25,25,24,0.6)] leading-relaxed line-clamp-2">{p.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

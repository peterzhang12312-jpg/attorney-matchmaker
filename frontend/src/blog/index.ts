export interface BlogMeta {
  title: string;
  slug: string;
  date: string;
  readTime: string;
  excerpt: string;
  category?: string;
}

export const posts: BlogMeta[] = [
  {
    title: "How We Match Attorneys Using Real Court Data, Not Rankings",
    slug: "how-we-match-attorneys",
    date: "2026-03-15",
    readTime: "4 min read",
    category: "How It Works",
    excerpt: "Most attorney directories charge attorneys for placement. We built something different — matching from actual federal docket records.",
  },
  {
    title: "How to Find an Attorney Who Offers Free Consultations",
    slug: "how-to-find-attorney-free-consultation",
    date: "2026-03-16",
    readTime: "4 min read",
    category: "Guide",
    excerpt: "Free consultations are standard practice — but finding the right attorney to consult is the hard part. Here's how to do it without wasting your time.",
  },
  {
    title: "AI Attorney Matching Explained: What It Is and How It Works",
    slug: "ai-attorney-matching-explained",
    date: "2026-03-17",
    readTime: "5 min read",
    category: "How It Works",
    excerpt: "AI-powered legal matching is replacing keyword directories. We explain what that means, what data is actually used, and what it can't do.",
  },
  {
    title: "Federal Court vs. State Court: Which One Handles Your Case?",
    slug: "federal-vs-state-court",
    date: "2026-03-18",
    readTime: "5 min read",
    category: "Legal Basics",
    excerpt: "Most people don't know whether to file federally or in state court — and filing in the wrong one can get your case dismissed. Here's how to tell.",
  },
  {
    title: "Understanding Venue: Why Where You File Matters",
    slug: "understanding-venue",
    date: "2026-03-14",
    readTime: "3 min read",
    category: "Legal Basics",
    excerpt: "Filing in the wrong court can cost you the case before it starts. Here's how venue strategy works in NY and CA federal courts.",
  },
  {
    title: "What to Look for in a NY/CA Attorney for Your Case Type",
    slug: "what-to-look-for-in-attorney",
    date: "2026-03-13",
    readTime: "5 min read",
    category: "Guide",
    excerpt: "Not all attorneys are equal — even within the same practice area. Here's what separates a good match from a great one.",
  },
];

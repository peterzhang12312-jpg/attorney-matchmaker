export interface BlogMeta {
  title: string;
  slug: string;
  date: string;
  readTime: string;
  excerpt: string;
}

export const posts: BlogMeta[] = [
  {
    title: "How We Match Attorneys Using Real Court Data, Not Rankings",
    slug: "how-we-match-attorneys",
    date: "2026-03-15",
    readTime: "4 min read",
    excerpt: "Most attorney directories charge attorneys for placement. We built something different — matching from actual federal docket records.",
  },
  {
    title: "Understanding Venue: Why Where You File Matters",
    slug: "understanding-venue",
    date: "2026-03-14",
    readTime: "3 min read",
    excerpt: "Filing in the wrong court can cost you the case before it starts. Here's how venue strategy works in NY and CA federal courts.",
  },
  {
    title: "What to Look for in a NY/CA Attorney for Your Case Type",
    slug: "what-to-look-for-in-attorney",
    date: "2026-03-13",
    readTime: "5 min read",
    excerpt: "Not all attorneys are equal — even within the same practice area. Here's what separates a good match from a great one.",
  },
];

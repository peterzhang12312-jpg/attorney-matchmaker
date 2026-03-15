---
title: "How We Match Attorneys Using Real Court Data, Not Rankings"
slug: how-we-match-attorneys
date: 2026-03-15
readTime: 4 min read
excerpt: "Most attorney directories charge attorneys for placement. We built something different — matching from actual federal docket records."
---

# How We Match Attorneys Using Real Court Data, Not Rankings

Most attorney directories work on a simple model: attorneys pay to appear higher in results. The incentive is misaligned from day one. We built the Attorney Matchmaker to flip that.

## The Problem With Pay-to-Play Rankings

When you search for an attorney on a major directory, you're often seeing a ranked list based on advertising spend, not performance. An attorney who has never set foot in federal court can appear above someone with 200 SDNY docket entries — simply by paying more.

## Our Approach: CourtListener Docket Data

We query the CourtListener API, which indexes millions of federal court docket entries, to find attorneys who have actually filed motions, argued cases, and appeared before judges in courts relevant to your case.

When you describe your case, our AI (Gemini 2.5 Flash) extracts the case type and keywords, and we search for attorneys with matching docket history. Claude Opus then audits the top matches for relevance.

## The Scoring Model

Each attorney gets a composite score based on:
- **Budget alignment** — does their hourly rate fit your ceiling?
- **Practice area match** — do their docket entries match your case type?
- **Case volume** — how many relevant cases have they handled?
- **Docket intelligence** — have they filed motions relevant to your facts (TROs, MSJs, OSCs)?

## What This Means for You

You get a ranked list of attorneys who have actually done the work your case requires. Not the ones who paid the most to be at the top.

[Try the matchmaker →](/app)

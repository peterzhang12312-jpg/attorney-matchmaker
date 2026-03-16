import LandingNav from "../components/landing/LandingNav";
import HeroBlock from "../components/landing/HeroBlock";
import StatsBand from "../components/landing/StatsBand";
import Testimonials from "../components/landing/Testimonials";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturesGrid from "../components/landing/FeaturesGrid";
import ForAttorneys from "../components/landing/ForAttorneys";
import GithubBand from "../components/landing/GithubBand";
import BlogPreview from "../components/landing/BlogPreview";
import LandingFooter from "../components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFFEF2]">
      <LandingNav />
      <main>
        <HeroBlock />
        <StatsBand />
        <Testimonials />
        <HowItWorks />
        <FeaturesGrid />
        <ForAttorneys />
        <BlogPreview />
        <GithubBand />
      </main>
      <LandingFooter />
    </div>
  );
}

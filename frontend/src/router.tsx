import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import BlogPage from "./pages/BlogPage";
import BlogPost from "./pages/BlogPost";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EULA from "./pages/EULA";
import CookiePolicy from "./pages/CookiePolicy";
import CaseLookupPage from "./pages/CaseLookupPage";
import CoveragePage from "./pages/CoveragePage";
import DashboardPage from "./pages/DashboardPage";
import BusinessIntakePage from "./pages/BusinessIntakePage";
import FindAttorneyPage from "./pages/FindAttorneyPage";
import GetHelpPage from "./pages/GetHelpPage";
import WidgetIntakePage from "./pages/WidgetIntakePage";
import ForAttorneysPage from "./pages/ForAttorneysPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/app", element: <App /> },
  { path: "/blog", element: <BlogPage /> },
  { path: "/blog/:slug", element: <BlogPost /> },
  { path: "/privacy", element: <PrivacyPolicy /> },
  { path: "/eula", element: <EULA /> },
  { path: "/cookie-policy", element: <CookiePolicy /> },
  { path: "/case-lookup", element: <CaseLookupPage /> },
  { path: "/coverage", element: <CoveragePage /> },
  { path: "/dashboard", element: <DashboardPage /> },
  { path: "/business/intake", element: <BusinessIntakePage /> },
  { path: "/find-attorney/:practiceArea/:city", element: <FindAttorneyPage /> },
  { path: "/get-help", element: <GetHelpPage /> },
  { path: "/widget/intake", element: <WidgetIntakePage /> },
  { path: "/for-attorneys", element: <ForAttorneysPage /> },
]);

import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import BlogPage from "./pages/BlogPage";
import BlogPost from "./pages/BlogPost";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EULA from "./pages/EULA";
import CookiePolicy from "./pages/CookiePolicy";
import CaseLookupPage from "./pages/CaseLookupPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/app", element: <App /> },
  { path: "/blog", element: <BlogPage /> },
  { path: "/blog/:slug", element: <BlogPost /> },
  { path: "/privacy", element: <PrivacyPolicy /> },
  { path: "/eula", element: <EULA /> },
  { path: "/cookie-policy", element: <CookiePolicy /> },
  { path: "/case-lookup", element: <CaseLookupPage /> },
]);

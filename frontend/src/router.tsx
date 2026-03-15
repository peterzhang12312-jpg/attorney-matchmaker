import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LandingPage from "./pages/LandingPage";
import BlogPage from "./pages/BlogPage";
import BlogPost from "./pages/BlogPost";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/app", element: <App /> },
  { path: "/blog", element: <BlogPage /> },
  { path: "/blog/:slug", element: <BlogPost /> },
]);

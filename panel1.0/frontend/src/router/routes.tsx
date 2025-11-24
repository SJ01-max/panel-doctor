import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Dashboard from "../pages/dashboard/page";
import Search from "../pages/search/page";
import Settings from "../pages/settings/page";
import TargetGroups from "../pages/target-groups/page";
import DataSource from "../pages/data-source/page";
import ExportHistory from "../pages/export-history/page";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/search",
    element: <Search />,
  },
  {
    path: "/target-groups",
    element: <TargetGroups />,
  },
  {
    path: "/settings",
    element: <Settings />,
  },
  {
    path: "/data-sources",
    element: <DataSource />,
  },
  {
    path: "/export-history",
    element: <ExportHistory />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

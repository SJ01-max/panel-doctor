import { useRoutes } from "react-router-dom";
import { routes } from "./routes";

export function AppRoutes() {
  const element = useRoutes(routes);
  return element;
}

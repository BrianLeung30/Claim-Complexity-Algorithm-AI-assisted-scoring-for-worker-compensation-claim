import { useEffect, useState } from "react";

// Minimal hash routing: no router dependency, works with the static build.
export type Route =
  | { page: "scorer" }
  | { page: "claim"; claimNumber: string }
  | { page: "workload" }
  | { page: "insights" }
  | { page: "settings" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  const claim = path.match(/^\/claims\/(.+)$/);
  if (claim?.[1]) return { page: "claim", claimNumber: decodeURIComponent(claim[1]) };
  if (path === "/workload") return { page: "workload" };
  if (path === "/insights") return { page: "insights" };
  if (path === "/settings") return { page: "settings" };
  return { page: "scorer" };
}

export const hrefFor = {
  scorer: "#/",
  workload: "#/workload",
  insights: "#/insights",
  settings: "#/settings",
  claim: (claimNumber: string) => `#/claims/${encodeURIComponent(claimNumber)}`,
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

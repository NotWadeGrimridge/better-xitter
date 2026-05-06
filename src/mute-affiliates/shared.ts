export type AffiliatesUser = {
  rest_id: string;
  screen_name: string;
  name?: string;
  avatar_url?: string;
  affiliate_label_url?: string;
};

export function isAffiliatesPathname(pathname: string): boolean {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  const segments = path.split("/").filter(Boolean);
  return segments.length === 2 && segments[1] === "affiliates";
}

export type AffiliatesUser = {
  rest_id: string;
  screen_name: string;
  name?: string;
  avatar_url?: string;
  affiliate_label_url?: string;
};

export function isAffiliatesPathname(pathname: string): boolean {
  let path = pathname;
  while (path.startsWith("/")) path = path.slice(1);
  while (path.endsWith("/")) path = path.slice(0, -1);
  const segments = path.split("/").filter(Boolean);
  return segments.length === 2 && segments[1] === "affiliates";
}

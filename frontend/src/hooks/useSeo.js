import { useEffect } from "react";

export const DEFAULT_OG_IMAGE = "https://images.unsplash.com/photo-1543269865-cbf427effbad?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

function upsert(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

export default function useSeo({ title, description, image = DEFAULT_OG_IMAGE, type = "website" }) {
  useEffect(() => {
    const url = window.location.href;
    if (title) document.title = title;
    setCanonical(url);
    upsert("name", "description", description);
    upsert("property", "og:title", title);
    upsert("property", "og:description", description);
    upsert("property", "og:type", type);
    upsert("property", "og:url", url);
    upsert("property", "og:image", image);
    upsert("property", "og:site_name", "CendekiaLMS");
    upsert("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsert("name", "twitter:title", title);
    upsert("name", "twitter:description", description);
    upsert("name", "twitter:image", image);
  }, [title, description, image, type]);
}

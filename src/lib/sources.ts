import type { Source } from "./types";

export const sources: Source[] = [
  { id: "nasa-breaking", name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", kind: "rss", enabled: true },
  { id: "usgs-all-hour", name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom", kind: "atom", enabled: true },
  { id: "github-blog", name: "GitHub Blog", url: "https://github.blog/feed/", kind: "rss", enabled: true }
];

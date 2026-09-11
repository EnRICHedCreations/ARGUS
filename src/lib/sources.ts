import type { Source } from "./types";

// Deliberately diverse, public, unauthenticated feeds. These are observation inputs,
// not truth authorities: every collected item retains its source provenance.
export const sources: Source[] = [
  { id: "nasa-breaking", name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", kind: "rss", enabled: true },
  { id: "usgs-all-hour", name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom", kind: "atom", enabled: true },
  { id: "github-blog", name: "GitHub Blog", url: "https://github.blog/feed/", kind: "rss", enabled: true },

  // Weather / hazards. NHC publishes these basin-wide feeds specifically for syndication.
  { id: "nhc-atlantic", name: "NHC Atlantic Tropical Cyclones", url: "https://www.nhc.noaa.gov/index-at.xml", kind: "rss", enabled: true },
  { id: "nhc-east-pacific", name: "NHC Eastern Pacific Tropical Cyclones", url: "https://www.nhc.noaa.gov/index-ep.xml", kind: "rss", enabled: true },

  // Public-sector technology / cybersecurity activity.
  { id: "cisa-news", name: "CISA News", url: "https://www.cisa.gov/news.xml", kind: "rss", enabled: true },

  // Economics / monetary-policy information environment.
  { id: "fed-press", name: "Federal Reserve Press Releases", url: "https://www.federalreserve.gov/feeds/press_all.xml", kind: "rss", enabled: true },

  // Science / environmental activity, independent from NASA.
  { id: "noaa-news", name: "NOAA National Ocean Service News", url: "https://oceanservice.noaa.gov/rss/nosnews.xml", kind: "rss", enabled: true }
];

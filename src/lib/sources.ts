import type { Source } from "./types";

// Deliberately diverse, public, unauthenticated sources. These are observation inputs,
// not truth authorities: every collected item retains its source provenance.
export const sources: Source[] = [
  { id: "nasa-breaking", name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", kind: "rss", enabled: true },
  { id: "usgs-all-hour", name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom", kind: "atom", enabled: true },
  { id: "github-blog", name: "GitHub Blog", url: "https://github.blog/feed/", kind: "rss", enabled: true },
  { id: "nhc-atlantic", name: "NHC Atlantic Tropical Cyclones", url: "https://www.nhc.noaa.gov/index-at.xml", kind: "rss", enabled: true },
  { id: "nhc-east-pacific", name: "NHC Eastern Pacific Tropical Cyclones", url: "https://www.nhc.noaa.gov/index-ep.xml", kind: "rss", enabled: true },
  { id: "cisa-news", name: "CISA News", url: "https://www.cisa.gov/news.xml", kind: "rss", enabled: true },
  { id: "fed-press", name: "Federal Reserve Press Releases", url: "https://www.federalreserve.gov/feeds/press_all.xml", kind: "rss", enabled: true },

  // Structured nationwide weather/hazard observations with severity, urgency,
  // certainty, affected area and issuing authority preserved in normalized summaries.
  { id: "nws-active-alerts", name: "NWS Active Alerts", url: "https://api.weather.gov/alerts/active", kind: "nws_alerts_json", enabled: true }
];

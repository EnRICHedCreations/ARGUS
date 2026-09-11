import type { Source } from "./types";

// Diverse public, unauthenticated observation inputs. Sources are evidence, not truth authorities.
export const sources: Source[] = [
  { id: "nasa-breaking", name: "NASA Breaking News", url: "https://www.nasa.gov/news-release/feed/", kind: "rss", enabled: true },
  { id: "usgs-all-hour", name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom", kind: "atom", enabled: true },
  { id: "github-blog", name: "GitHub Blog", url: "https://github.blog/feed/", kind: "rss", enabled: true },
  { id: "nhc-atlantic", name: "NHC Atlantic Tropical Cyclones", url: "https://www.nhc.noaa.gov/index-at.xml", kind: "rss", enabled: true },
  { id: "nhc-east-pacific", name: "NHC Eastern Pacific Tropical Cyclones", url: "https://www.nhc.noaa.gov/index-ep.xml", kind: "rss", enabled: true },
  { id: "cisa-news", name: "CISA News", url: "https://www.cisa.gov/news.xml", kind: "rss", enabled: true },
  { id: "fed-press", name: "Federal Reserve Press Releases", url: "https://www.federalreserve.gov/feeds/press_all.xml", kind: "rss", enabled: true },
  { id: "nws-active-alerts", name: "NWS Active Alerts", url: "https://api.weather.gov/alerts/active", kind: "nws_alerts_json", enabled: true },

  // Wider intelligence surface: corporate/regulatory, research, government, technology attention and energy.
  { id: "sec-press", name: "SEC Press Releases", url: "https://www.sec.gov/news/pressreleases.rss", kind: "rss", enabled: true },
  { id: "sec-litigation", name: "SEC Litigation Releases", url: "https://www.sec.gov/litigation/litreleases.rss", kind: "rss", enabled: true },
  { id: "arxiv-ai", name: "arXiv Artificial Intelligence", url: "https://rss.arxiv.org/rss/cs.AI", kind: "rss", enabled: true },
  { id: "arxiv-crypto", name: "arXiv Cryptography and Security", url: "https://rss.arxiv.org/rss/cs.CR", kind: "rss", enabled: true },
  { id: "whitehouse-briefing", name: "White House Briefing Room", url: "https://www.whitehouse.gov/briefing-room/feed/", kind: "rss", enabled: true },
  { id: "doj-news", name: "US Department of Justice News", url: "https://www.justice.gov/news/rss", kind: "rss", enabled: true },
  { id: "eia-today-energy", name: "EIA Today in Energy", url: "https://www.eia.gov/rss/todayinenergy.xml", kind: "rss", enabled: true },
  { id: "hackernews-top", name: "Hacker News Top Stories", url: "https://hacker-news.firebaseio.com/v0/topstories.json", kind: "hackernews_json", enabled: true }
];

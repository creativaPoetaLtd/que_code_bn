import axios from "axios";

// URL is a global in Node.js 10+; no import needed.

export interface LinkPreviewData {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    domain: string;
    favicon: string | null;
    fallback?: boolean;
}

interface CacheEntry {
    data: LinkPreviewData | null;
    expiresAt: number;
}

// ── In-memory TTL cache ────────────────────────────────────────────────────────
const previewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS       = 60 * 60 * 1000;  // 1 h  – successful fetches
const FAILURE_TTL_MS     =  5 * 60 * 1000;  // 5 min – failed fetches
const MAX_CACHE_SIZE     = 500;
const FETCH_TIMEOUT_MS   = 6_000;
const MAX_CONTENT_BYTES  = 512 * 1024;       // 512 KB is enough for <head>

// Cycle through a few real-browser UAs to improve hit rate against bot-blockers
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
];
let uaIndex = 0;
const nextUA = () => USER_AGENTS[uaIndex++ % USER_AGENTS.length];

// ── SSRF protection: block private/loopback ranges ────────────────────────────
const BLOCKED_HOSTNAME = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
    /^0\.0\.0\.0$/,
    /\.internal$/i,
    /\.local$/i,
];

function isBlockedHost(hostname: string): boolean {
    return BLOCKED_HOSTNAME.some((re) => re.test(hostname));
}

// ── HTML meta-tag parser (pure regex, zero DOM deps) ─────────────────────────
function parseMetaTags(html: string): Record<string, string> {
    const meta: Record<string, string> = {};

    // <meta property="og:X" content="Y" />  and  <meta name="X" content="Y" />
    // Also handles reversed attribute order
    const patterns = [
        /<meta\s+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*?)["'][^>]*\/?>/gi,
        /<meta\s+content=["']([^"']*?)["'][^>]+(?:property|name)=["']([^"']+)["'][^>]*\/?>/gi,
    ];

    for (const re of patterns) {
        let m: RegExpExecArray | null;
        const reversed = re.source.startsWith("<meta\\s+content");
        while ((m = re.exec(html)) !== null) {
            const key   = reversed ? m[2] : m[1];
            const value = reversed ? m[1] : m[2];
            // Only store the first occurrence of each key
            if (!meta[key.toLowerCase()]) {
                meta[key.toLowerCase()] = decodeHtmlEntities(value);
            }
        }
    }

    // <title> fallback
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    if (titleMatch && !meta["og:title"] && !meta["twitter:title"]) {
        meta["_title"] = decodeHtmlEntities(titleMatch[1].trim());
    }

    return meta;
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g,  "&")
        .replace(/&lt;/g,   "<")
        .replace(/&gt;/g,   ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g,  "'")
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        );
}

function extractDomain(rawUrl: string): string {
    try {
        return new URL(rawUrl).hostname.replace(/^www\./, "");
    } catch {
        return rawUrl;
    }
}

function resolveUrl(base: string, href: string): string | null {
    if (!href) return null;
    try {
        if (/^https?:\/\//i.test(href)) return href;
        const b = new URL(base);
        if (href.startsWith("//"))  return `${b.protocol}${href}`;
        if (href.startsWith("/"))   return `${b.origin}${href}`;
        return `${b.origin}/${href}`;
    } catch {
        return null;
    }
}

function extractFavicon(pageUrl: string, html: string): string | null {
    const faviconRe = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i;
    const m = faviconRe.exec(html);
    if (m) return resolveUrl(pageUrl, m[1]);
    try {
        return `${new URL(pageUrl).origin}/favicon.ico`;
    } catch {
        return null;
    }
}

// ── Main export ────────────────────────────────────────────────────────────────
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
    // Evict stale entries when cache grows large
    if (previewCache.size >= MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [k, v] of previewCache) {
            if (v.expiresAt < now) previewCache.delete(k);
        }
    }

    const cached = previewCache.get(rawUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
        const parsed = new URL(rawUrl);

        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Invalid protocol");
        }
        if (isBlockedHost(parsed.hostname)) {
            throw new Error("Blocked host");
        }

        const response = await axios.get<string>(rawUrl, {
            timeout:           FETCH_TIMEOUT_MS,
            maxContentLength:  MAX_CONTENT_BYTES,
            maxRedirects:      3,
            responseType:      "text",
            decompress:        true,     // handle gzip / brotli automatically
            headers: {
                "User-Agent":      nextUA(),
                "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control":   "no-cache",
            },
            // Validate response: only parse HTML/XHTML to avoid parsing binary files
            validateStatus: (status) => status >= 200 && status < 400,
        });

        // Some sites return non-HTML content types (PDF, etc.) — skip them
        const ct = String(response.headers["content-type"] || "");
        if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
            previewCache.set(rawUrl, { data: null, expiresAt: Date.now() + FAILURE_TTL_MS });
            return null;
        }

        const html = typeof response.data === "string" ? response.data : "";
        // Only parse the first ~25 KB — the <head> is always near the top
        const head = html.slice(0, Math.min(html.length, 25_000));
        const meta = parseMetaTags(head);

        const title       = meta["og:title"]       || meta["twitter:title"]       || meta["_title"]      || null;
        const description = meta["og:description"] || meta["twitter:description"] || meta["description"] || null;
        const rawImage    = meta["og:image"]        || meta["twitter:image"]       || null;
        const image       = rawImage ? resolveUrl(rawUrl, rawImage) : null;

        const data: LinkPreviewData = {
            url:         rawUrl,
            title:       title       ? title.slice(0, 200)       : null,
            description: description ? description.slice(0, 500) : null,
            image,
            domain:      extractDomain(rawUrl),
            favicon:     extractFavicon(rawUrl, head),
        };

        previewCache.set(rawUrl, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;

    } catch {
        // Cache failures briefly to avoid hammering unreachable/blocking URLs
        previewCache.set(rawUrl, { data: null, expiresAt: Date.now() + FAILURE_TTL_MS });
        return null;
    }
}

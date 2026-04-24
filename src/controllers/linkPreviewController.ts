import { Request, Response, NextFunction } from "express";
import { fetchLinkPreview } from "../services/linkPreviewService";

// URL is a global in Node.js 10+; no import needed.

function sanitizeUrl(raw: string): string | null {
    try {
        // Express already URL-decodes req.query values, but apply once more
        // defensively in case of double-encoding edge cases.
        const decoded = decodeURIComponent(raw.trim());
        const parsed  = new URL(decoded);
        // Only allow http / https — block javascript:, data:, ftp:, etc.
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        // Re-serialize to strip any injected characters
        return parsed.toString();
    } catch {
        return null;
    }
}

export const getLinkPreview = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const rawUrl = req.query.url;

        if (!rawUrl || typeof rawUrl !== "string") {
            res.status(400).json({ message: "url query parameter is required" });
            return;
        }

        const cleanUrl = sanitizeUrl(rawUrl);
        if (!cleanUrl) {
            res.status(400).json({ message: "Invalid or unsupported URL" });
            return;
        }

        const preview = await fetchLinkPreview(cleanUrl);

        if (!preview) {
            // Return a minimal fallback so the client can still render a plain link chip
            res.status(200).json({
                url:         cleanUrl,
                title:       null,
                description: null,
                image:       null,
                domain:      new URL(cleanUrl).hostname.replace(/^www\./, ""),
                favicon:     null,
                fallback:    true,
            });
            return;
        }

        res.status(200).json(preview);
    } catch (error) {
        next(error);
    }
};

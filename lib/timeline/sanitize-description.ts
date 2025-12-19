/**
 * Sanitizes and formats meeting descriptions
 * - Decodes HTML entities
 * - Extracts URLs and formats them as clickable links
 * - Returns plain text with URL extraction for safe rendering
 */

export interface ParsedDescription {
  text: string;
  links: Array<{ url: string; hostname: string; path: string }>;
}

/**
 * Decodes HTML entities in a string (works in both client and server contexts)
 */
function decodeHtmlEntities(text: string): string {
  // Common HTML entities mapping
  const entityMap: Record<string, string> = {
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };

  let decoded = text;
  // Replace common entities
  Object.entries(entityMap).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  });

  // Handle numeric entities like &#123;
  decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });

  // Handle hex entities like &#x1F;
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}

/**
 * Extracts URLs from text and returns them along with cleaned text
 */
export function parseDescription(description: string | null | undefined): ParsedDescription {
  if (!description) {
    return { text: "", links: [] };
  }

  // Decode HTML entities
  const cleaned = decodeHtmlEntities(description);

  // Extract URLs using a regex
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  const matches = cleaned.match(urlRegex) || [];
  
  // Extract unique URLs and parse them
  const uniqueUrls = Array.from(new Set(matches));
  const links = uniqueUrls.map((url) => {
    try {
      const urlObj = new URL(url);
      return {
        url,
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
      };
    } catch {
      return {
        url,
        hostname: url,
        path: "",
      };
    }
  });

  // Remove URLs from text (they'll be rendered separately)
  // But keep a placeholder so we can replace them with formatted links
  let textWithPlaceholders = cleaned;
  uniqueUrls.forEach((url, index) => {
    textWithPlaceholders = textWithPlaceholders.replace(url, `[LINK_${index}]`);
  });

  return {
    text: textWithPlaceholders,
    links,
  };
}

/**
 * Formats a URL path for display (truncates if too long)
 */
export function formatLinkPath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) return path;
  return path.substring(0, maxLength - 3) + "...";
}


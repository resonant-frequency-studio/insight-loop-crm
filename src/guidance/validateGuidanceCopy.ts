const FORBIDDEN_WORDS = [
  "CRM",
  "pipeline",
  "lead",
  "conversion",
  "automation",
  "step 1",
  "step 2",
  "step 3",
  "must",
  "should",
  "need to",
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate tour step copy against coach-voice style guide
 */
export function validateStepCopy(step: { title?: string; content: React.ReactNode }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract text from React node (simple string extraction)
  const extractText = (node: React.ReactNode): string => {
    if (typeof node === "string") return node;
    if (typeof node === "number") return String(node);
    if (Array.isArray(node)) {
      return node.map(extractText).join(" ");
    }
    if (node && typeof node === "object" && "props" in node) {
      const props = (node as { props?: { children?: React.ReactNode } }).props;
      if (props?.children) {
        return extractText(props.children);
      }
    }
    return "";
  };

  const title = step.title || "";
  const contentText = extractText(step.content);

  // Check title length
  if (title.length > 52) {
    errors.push(`Title exceeds 52 characters (${title.length})`);
  }

  // Check content length (approximate, since we're extracting from React node)
  if (contentText.length > 240) {
    warnings.push(`Content may exceed 240 characters (approximately ${contentText.length})`);
  }

  // Check for forbidden words
  const allText = `${title} ${contentText}`.toLowerCase();
  FORBIDDEN_WORDS.forEach((word) => {
    if (allText.includes(word.toLowerCase())) {
      errors.push(`Contains forbidden word: "${word}"`);
    }
  });

  // Check for step numbering
  if (/\bstep\s+\d+/i.test(allText)) {
    errors.push("Contains step numbering (e.g., 'Step 1')");
  }

  // Check bullet count (approximate)
  const bulletMatches = contentText.match(/[•\-\*]/g);
  if (bulletMatches && bulletMatches.length > 3) {
    warnings.push(`May have more than 3 bullets (found ${bulletMatches.length})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate inline nudge copy
 */
export function validateNudgeCopy(title: string, body: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (title.length > 52) {
    errors.push(`Title exceeds 52 characters (${title.length})`);
  }

  if (body.length > 240) {
    errors.push(`Body exceeds 240 characters (${body.length})`);
  }

  const allText = `${title} ${body}`.toLowerCase();
  FORBIDDEN_WORDS.forEach((word) => {
    if (allText.includes(word.toLowerCase())) {
      errors.push(`Contains forbidden word: "${word}"`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Warn in dev mode
if (process.env.NODE_ENV === "development") {
  // This will be called when steps are registered
  console.log("Guidance copy validation is active in development mode");
}


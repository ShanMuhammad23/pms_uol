import type { FormTemplateInput } from "@/types/forms";

const LOOKS_LIKE_HTML = /<[a-z][\s\S]*>/i;

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "br",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "sub",
  "sup",
  "h1",
  "h2",
  "h3",
  "h4",
  "font",
]);

const VOID_TAGS = new Set(["br"]);

const ALLOWED_STYLES = new Set([
  "color",
  "background-color",
  "background",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-decoration",
  "text-decoration-line",
  "text-decoration-color",
  "text-align",
  "line-height",
  "letter-spacing",
  "vertical-align",
]);

const FONT_SIZE_MAP: Record<string, string> = {
  "1": "10px",
  "2": "13px",
  "3": "16px",
  "4": "18px",
  "5": "24px",
  "6": "32px",
  "7": "48px",
};

export function htmlTitleLooksLikeHtml(value: string): boolean {
  return LOOKS_LIKE_HTML.test(value);
}

function unescapeHtmlEntitiesOnce(value: string): string {
  if (!/&lt;\/?[a-z]/i.test(value)) {
    return value;
  }
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function isSafeColor(value: string): boolean {
  const color = value.trim();
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ||
    /^(rgb|rgba|hsl|hsla)\(/i.test(color) ||
    /^[a-z]+$/i.test(color)
  );
}

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlTitlePlainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }

  return unescapeHtmlEntitiesOnce(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function isHtmlTitleEmpty(html: string | null | undefined): boolean {
  return htmlTitlePlainText(html).length === 0;
}

function sanitizeCssDeclarations(style: string): string {
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon <= 0) {
        return null;
      }
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!ALLOWED_STYLES.has(property)) {
        return null;
      }
      if (!value || /expression|url\s*\(|javascript:|@import/i.test(value)) {
        return null;
      }
      if (
        (property === "color" ||
          property === "background-color" ||
          property === "background" ||
          property === "text-decoration-color") &&
        !isSafeColor(value.split(" ")[0] ?? value) &&
        !/^(rgb|rgba|hsl|hsla|#)/i.test(value)
      ) {
        return null;
      }
      return `${property}: ${value}`;
    })
    .filter((value): value is string => Boolean(value))
    .join("; ");
}

function readAttribute(attrs: string, name: string): string | null {
  const match = attrs.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function sanitizeOpenTag(tag: string, attrs: string): string {
  if (VOID_TAGS.has(tag)) {
    return `<${tag}>`;
  }

  const styles: string[] = [];
  const existingStyle = readAttribute(attrs, "style");
  if (existingStyle) {
    const safe = sanitizeCssDeclarations(existingStyle);
    if (safe) {
      styles.push(safe);
    }
  }

  if (tag === "font") {
    const color = readAttribute(attrs, "color");
    if (color && isSafeColor(color)) {
      styles.push(`color: ${color}`);
    }
    const size = readAttribute(attrs, "size");
    if (size && FONT_SIZE_MAP[size]) {
      styles.push(`font-size: ${FONT_SIZE_MAP[size]}`);
    }
    const safe = styles.join("; ");
    return safe ? `<span style="${escapeHtmlText(safe)}">` : "<span>";
  }

  const align = readAttribute(attrs, "align");
  if (align && /^(left|center|right|justify)$/i.test(align)) {
    styles.push(`text-align: ${align.toLowerCase()}`);
  }

  const safe = styles.join("; ");
  return safe ? `<${tag} style="${escapeHtmlText(safe)}">` : `<${tag}>`;
}

export function sanitizeHtmlTitle(html: string | null | undefined): string {
  if (!html) {
    return "";
  }

  const source = unescapeHtmlEntitiesOnce(html);

  if (!htmlTitleLooksLikeHtml(source)) {
    return source;
  }

  let output = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<\/?(script|style|iframe|object|embed|link|meta|base|form|input|textarea|button|svg|math|video|audio)[^>]*>/gi,
      "",
    )
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href)\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, "");

  output = output.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }
    if (match.startsWith("</")) {
      return tag === "font" ? "</span>" : `</${tag}>`;
    }
    return sanitizeOpenTag(tag, attrs ?? "");
  });

  return output;
}

export function toSafeHtmlTitle(html: string | null | undefined): string {
  if (!html) {
    return "";
  }

  const source = unescapeHtmlEntitiesOnce(html);

  if (!htmlTitleLooksLikeHtml(source)) {
    return escapeHtmlText(source).replace(/\n/g, "<br>");
  }

  return sanitizeHtmlTitle(source);
}

export function valueToEditorHtml(value: string): string {
  if (!value) {
    return "";
  }
  const source = unescapeHtmlEntitiesOnce(value);
  if (htmlTitleLooksLikeHtml(source)) {
    return source;
  }
  return escapeHtmlText(source).replace(/\n/g, "<br>");
}

export function sanitizeFormTemplateHtmlTitles(
  input: FormTemplateInput,
): FormTemplateInput {
  return {
    ...input,
    sections: input.sections.map((section) => ({
      ...section,
      title: sanitizeHtmlTitle(section.title),
      subsections: section.subsections.map((subsection) => ({
        ...subsection,
        title: sanitizeHtmlTitle(subsection.title),
      })),
    })),
  };
}

/**
 * UnicodeHelper exposes direction checks and font-layer hints for multilingual UX.
 */
export const RTL_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
export const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

export const isRTL = (text: string): boolean => {
  return RTL_REGEX.test(text);
};

export const getDirection = (text: string): "rtl" | "ltr" => {
  if (!text) {
    return "ltr";
  }

  return isRTL(text) ? "rtl" : "ltr";
};

export const getPreferredFontFamily = (text: string): string => {
  if (CJK_REGEX.test(text)) {
    return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }

  if (isRTL(text)) {
    return 'Tahoma, "Noto Sans Arabic", "Segoe UI", sans-serif';
  }

  return 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
};

export const isRTLLanguage = (language: string): boolean => {
  return ["ar", "he", "fa", "ur"].includes(language.toLowerCase());
};

export const getDirectionForLanguage = (
  language?: string,
  text?: string,
): "rtl" | "ltr" => {
  if (language && isRTLLanguage(language)) {
    return "rtl";
  }

  return getDirection(text || "");
};

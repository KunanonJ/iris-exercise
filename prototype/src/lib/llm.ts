export const detectLang = (text: string): "th" | "en" => (/[\u0E00-\u0E7F]/.test(text) ? "th" : "en");

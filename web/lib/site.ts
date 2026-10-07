const configuredLegacyOrigin = process.env.NEXT_PUBLIC_LEGACY_ORIGIN?.replace(/\/+$/, "");

export const legacyOrigin = configuredLegacyOrigin || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8756" : undefined);
export const legacyListenUrl = legacyOrigin ? `${legacyOrigin}/listen.html` : undefined;

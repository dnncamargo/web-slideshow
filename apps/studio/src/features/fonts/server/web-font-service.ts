import {
  isWebFontProviderId,
  type ResolvedWebFontFamily,
  type WebFontProviderId,
  type WebFontSummary,
} from "../web-font-types";
import {
  WebFontProviderError,
  type WebFontProvider,
} from "./font-provider";
import { FontsourceProvider } from "./providers/fontsource-provider";
import { GoogleFontsProvider } from "./providers/google-fonts-provider";

export interface WebFontService {
  search(
    providerId: WebFontProviderId,
    query: string,
  ): Promise<WebFontSummary[]>;

  resolveFamily(
    providerId: WebFontProviderId,
    id: string,
  ): Promise<ResolvedWebFontFamily>;
}

export class DefaultWebFontService implements WebFontService {
  private readonly fontsourceProvider: WebFontProvider;
  private googleProvider: WebFontProvider | undefined;
  private googleApiKey: string | undefined;

  constructor(fontsourceProvider: WebFontProvider = new FontsourceProvider()) {
    this.fontsourceProvider = fontsourceProvider;
  }

  search(
    providerId: WebFontProviderId,
    query: string,
  ): Promise<WebFontSummary[]> {
    return this.getProvider(providerId).search(query);
  }

  resolveFamily(
    providerId: WebFontProviderId,
    id: string,
  ): Promise<ResolvedWebFontFamily> {
    return this.getProvider(providerId).resolveFamily(id);
  }

  private getProvider(providerId: WebFontProviderId): WebFontProvider {
    if (providerId === "fontsource") {
      return this.fontsourceProvider;
    }

    const currentApiKey = process.env.GOOGLE_FONTS_API_KEY?.trim() || undefined;

    if (!this.googleProvider || this.googleApiKey !== currentApiKey) {
      this.googleApiKey = currentApiKey;
      this.googleProvider = new GoogleFontsProvider({
        ...(currentApiKey ? { apiKey: currentApiKey } : {}),
      });
    }

    return this.googleProvider;
  }
}

export function parseWebFontProviderId(
  value: string | null,
): WebFontProviderId {
  if (!isWebFontProviderId(value)) {
    throw new WebFontProviderError("invalid_provider");
  }

  return value;
}

export const webFontService: WebFontService = new DefaultWebFontService();

export function isWebFontProviderConfigured(
  providerId: WebFontProviderId,
): boolean {
  return (
    providerId === "fontsource" ||
    Boolean(process.env.GOOGLE_FONTS_API_KEY?.trim())
  );
}

import type { CustomLibraryFontDraft, CustomLibraryFontRecord } from "./custom-library-font";

export interface CustomLibraryFontRepository {
  saveFont(font: CustomLibraryFontDraft): Promise<string>;
  updateFont(id: string, font: CustomLibraryFontDraft): Promise<void>;
  listFonts(): Promise<CustomLibraryFontRecord[]>;
  getFont(id: string): Promise<CustomLibraryFontRecord | null>;
  deleteFont(id: string): Promise<void>;
}

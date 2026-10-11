import type { CustomLibraryFontDraft, CustomLibraryFontRecord } from "./custom-library-font";
import type { StablePersistenceOptions } from "../persistence/firestore-idempotency";

export interface CustomLibraryFontRepository {
  saveFont(font: CustomLibraryFontDraft, options?: StablePersistenceOptions): Promise<string>;
  updateFont(id: string, font: CustomLibraryFontDraft): Promise<void>;
  listFonts(): Promise<CustomLibraryFontRecord[]>;
  getFont(id: string): Promise<CustomLibraryFontRecord | null>;
  deleteFont(id: string): Promise<void>;
}

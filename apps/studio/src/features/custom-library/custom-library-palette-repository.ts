import type { CustomLibraryPaletteDraft } from "./custom-library-palette";

export interface CustomLibraryPaletteRecord {
  id: string;
  palette: CustomLibraryPaletteDraft;
}

export interface CustomLibraryPaletteRepository {
  savePalette(palette: CustomLibraryPaletteDraft): Promise<string>;
  listPalettes(): Promise<CustomLibraryPaletteRecord[]>;
  getPalette(id: string): Promise<CustomLibraryPaletteRecord | null>;
  deletePalette(id: string): Promise<void>;
}

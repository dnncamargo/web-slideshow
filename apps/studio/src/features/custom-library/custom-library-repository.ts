import type { CustomLibraryItemDraft } from "./custom-library-item";

export interface CustomLibraryItemRecord {
  id: string;
  item: CustomLibraryItemDraft;
}

export interface CustomLibraryRepository {
  saveItem(item: CustomLibraryItemDraft): Promise<string>;
  listItems(): Promise<CustomLibraryItemRecord[]>;
  getItem(id: string): Promise<CustomLibraryItemRecord | null>;
  deleteItem(id: string): Promise<void>;
}

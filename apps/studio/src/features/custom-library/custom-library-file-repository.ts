import type {
  CustomLibraryFileDraft,
  CustomLibraryFileRecord,
} from "./custom-library-file";

export interface CustomLibraryFileRepository {
  saveFile(file: CustomLibraryFileDraft): Promise<string>;
  updateFile(id: string, file: CustomLibraryFileDraft): Promise<void>;
  listFiles(): Promise<CustomLibraryFileRecord[]>;
  getFile(id: string): Promise<CustomLibraryFileRecord | null>;
  deleteFile(id: string): Promise<void>;
}

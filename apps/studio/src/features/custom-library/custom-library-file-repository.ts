import type {
  CustomLibraryFileDraft,
  CustomLibraryFileRecord,
} from "./custom-library-file";
import type { StablePersistenceOptions } from "../persistence/firestore-idempotency";

export interface CustomLibraryFileRepository {
  saveFile(file: CustomLibraryFileDraft, options?: StablePersistenceOptions): Promise<string>;
  updateFile(id: string, file: CustomLibraryFileDraft): Promise<void>;
  listFiles(): Promise<CustomLibraryFileRecord[]>;
  getFile(id: string): Promise<CustomLibraryFileRecord | null>;
  deleteFile(id: string): Promise<void>;
}

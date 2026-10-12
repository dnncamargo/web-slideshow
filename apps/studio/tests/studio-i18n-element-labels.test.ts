import { describe, expect, it } from "vitest";

import {
  ELEMENT_TYPE_MESSAGE_KEYS,
  translateStudioMessage,
} from "../src/features/i18n/studio-i18n";

describe("canonical element type labels", () => {
  it("includes the Shape label in both Studio locales", () => {
    expect(ELEMENT_TYPE_MESSAGE_KEYS.shape).toBe("element.shape");
    expect(translateStudioMessage("en", "element.shape")).toBe("Shape");
    expect(translateStudioMessage("pt-BR", "element.shape")).toBe("Forma");
  });

  it("labels logical File removal clearly in both Studio locales", () => {
    expect(translateStudioMessage("en", "customLibrary.fileDetails.removeFromLibrary"))
      .toBe("Remove from Library");
    expect(translateStudioMessage("pt-BR", "customLibrary.fileDetails.removeFromLibrary"))
      .toBe("Remover da Biblioteca");
  });
});

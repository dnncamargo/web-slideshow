import {
  PresentationSchema,
} from "@powershow/document-schema";

export const playerTestPresentation =
  PresentationSchema.parse({
    schemaVersion: 1,

    id: "player-test",

    title: "Player Test",

    description: "",

    aspectRatio: "16:9",

    slides: [
      {
        id: "slide-1",

        elements: [
          {
            type: "text",
            id: "text-1",
            variant: "title",
            content: "Slide One",
          },
        ],
      },

      {
        id: "slide-2",

        elements: [
          {
            type: "text",
            id: "text-2",
            variant: "title",
            content: "Slide Two",
          },
        ],
      },

      {
        id: "slide-3",

        elements: [
          {
            type: "text",
            id: "text-3",
            variant: "title",
            content: "Slide Three",
          },
        ],
      },
    ],
  });
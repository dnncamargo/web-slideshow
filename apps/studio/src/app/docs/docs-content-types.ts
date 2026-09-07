export interface DocsCodeBlock {
  label?: string;
  language?: string;
  code: string;
}

export interface DocsTable {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

export interface DocsSection {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  code?: string;
  codeBlocks?: readonly DocsCodeBlock[];
  table?: DocsTable;
}

export interface DocsTopic {
  id: string;
  title: string;
  summary: string;
  sections: readonly DocsSection[];
}

export interface DocsGroup {
  title: string;
  topics: readonly DocsTopic[];
}

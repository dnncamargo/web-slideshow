import {
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { runScopeHandlers, type EditorView, type Panel, type ViewUpdate } from "@codemirror/view";

import type { StudioTranslate } from "@/features/i18n/studio-i18n";

const MATCH_LIMIT = 1000;
let replaceRowId = 0;

interface SearchQueryChanges {
  search?: string;
  replace?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regexp?: boolean;
}

function createQuery(current: SearchQuery, changes: SearchQueryChanges): SearchQuery {
  const config = {
    search: changes.search ?? current.search,
    replace: changes.replace ?? current.replace,
    caseSensitive: changes.caseSensitive ?? current.caseSensitive,
    wholeWord: changes.wholeWord ?? current.wholeWord,
    regexp: changes.regexp ?? current.regexp,
    literal: current.literal,
  };

  return current.test === undefined
    ? new SearchQuery(config)
    : new SearchQuery({ ...config, test: current.test });
}

function updateQuery(view: EditorView, changes: SearchQueryChanges): void {
  const current = getSearchQuery(view.state);
  const next = createQuery(current, changes);
  if (next.eq(current)) return;
  view.dispatch({ effects: setSearchQuery.of(next) });
}

function createButton(
  className: string,
  content: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = content;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", onClick);
  return button;
}

function collectMatches(query: SearchQuery, view: EditorView): Array<{ from: number; to: number }> {
  if (!query.valid || query.search.length === 0) return [];

  const matches: Array<{ from: number; to: number }> = [];
  const cursor = query.getCursor(view.state);
  let result = cursor.next();
  while (!result.done && matches.length < MATCH_LIMIT) {
    matches.push(result.value);
    result = cursor.next();
  }
  return matches;
}

function renderStatus(
  view: EditorView,
  query: SearchQuery,
  status: HTMLElement,
  noResultsLabel: string,
): void {
  if (!query.valid || query.search.length === 0) {
    status.textContent = "";
    status.removeAttribute("aria-label");
    return;
  }

  const matches = collectMatches(query, view);
  if (matches.length === 0) {
    status.textContent = noResultsLabel;
    status.setAttribute("aria-label", noResultsLabel);
    return;
  }

  const selection = view.state.selection.main;
  const currentIndex = matches.findIndex((match) => match.from === selection.from && match.to === selection.to);
  const value = `${currentIndex < 0 ? 0 : currentIndex + 1} / ${matches.length}`;
  status.textContent = value;
  status.setAttribute("aria-label", value);
}

function syncToggle(button: HTMLButtonElement, pressed: boolean): void {
  button.setAttribute("aria-pressed", String(pressed));
}

export function createStructuredTextSearchPanel(view: EditorView, t: StudioTranslate): Panel {
  const panel = document.createElement("div");
  panel.className = "cm-structuredSearch";
  panel.dataset.structuredSearchPanel = "";

  const findRow = document.createElement("div");
  findRow.className = "cm-structuredSearchRow cm-structuredSearchFindRow";

  const replaceRow = document.createElement("div");
  replaceRow.className = "cm-structuredSearchRow cm-structuredSearchReplaceRow";
  replaceRow.id = `cm-structured-search-replace-${replaceRowId += 1}`;

  let expanded = true;
  const disclosure = createButton(
    "cm-structuredSearchDisclosure",
    "▾",
    t("editor.textFileSearchHideReplace"),
    () => {
      expanded = !expanded;
      replaceRow.hidden = !expanded;
      disclosure.textContent = expanded ? "▾" : "▸";
      disclosure.setAttribute("aria-expanded", String(expanded));
      disclosure.setAttribute(
        "aria-label",
        expanded ? t("editor.textFileSearchHideReplace") : t("editor.textFileSearchShowReplace"),
      );
      disclosure.title = expanded ? t("editor.textFileSearchHideReplace") : t("editor.textFileSearchShowReplace");
    },
  );
  disclosure.setAttribute("aria-expanded", "true");
  disclosure.setAttribute("aria-controls", replaceRow.id);

  const searchInput = document.createElement("input");
  searchInput.className = "cm-structuredSearchInput";
  searchInput.type = "text";
  searchInput.name = "search";
  searchInput.placeholder = t("editor.textFileSearchFind");
  searchInput.setAttribute("aria-label", t("editor.textFileSearchFind"));
  searchInput.setAttribute("main-field", "true");
  searchInput.autocomplete = "off";

  const replaceInput = document.createElement("input");
  replaceInput.className = "cm-structuredSearchInput";
  replaceInput.type = "text";
  replaceInput.name = "replace";
  replaceInput.placeholder = t("editor.textFileSearchReplace");
  replaceInput.setAttribute("aria-label", t("editor.textFileSearchReplace"));
  replaceInput.autocomplete = "off";

  const field = document.createElement("div");
  field.className = "cm-structuredSearchField";
  field.append(searchInput);

  const createToggle = (content: string, label: string, changes: SearchQueryChanges): HTMLButtonElement => {
    const button = createButton("cm-structuredSearchToggle", content, label, () => {
      const query = getSearchQuery(view.state);
      const key = Object.keys(changes)[0] as keyof SearchQueryChanges;
      const currentValue = query[key] as boolean;
      updateQuery(view, { [key]: !currentValue });
    });
    button.dataset.searchToggle = content;
    return button;
  };

  const caseToggle = createToggle("Aa", t("editor.textFileSearchMatchCase"), { caseSensitive: false });
  const wordToggle = createToggle("ab", t("editor.textFileSearchWholeWord"), { wholeWord: false });
  const regexpToggle = createToggle(".*", t("editor.textFileSearchRegexp"), { regexp: false });
  field.append(caseToggle, wordToggle, regexpToggle);

  const status = document.createElement("span");
  status.className = "cm-structuredSearchStatus";
  status.setAttribute("aria-live", "polite");
  status.dataset.searchStatus = "";
  const replaceField = document.createElement("div");
  replaceField.className = "cm-structuredSearchField";
  replaceField.append(replaceInput);
  field.append(status);

  const previousButton = createButton(
    "cm-structuredSearchAction",
    "↑",
    t("editor.textFileSearchPrevious"),
    () => { findPrevious(view); },
  );
  previousButton.name = "prev";
  const nextButton = createButton(
    "cm-structuredSearchAction",
    "↓",
    t("editor.textFileSearchNext"),
    () => { findNext(view); },
  );
  nextButton.name = "next";
  const replaceSpacer = document.createElement("span");
  replaceSpacer.className = "cm-structuredSearchSpacer";
  replaceSpacer.setAttribute("aria-hidden", "true");

  const replaceNextButton = createButton(
    "cm-structuredSearchAction",
    "↪",
    t("editor.textFileSearchReplace"),
    () => { replaceNext(view); },
  );
  replaceNextButton.name = "replace";
  const replaceAllButton = createButton(
    "cm-structuredSearchAction cm-structuredSearchReplaceAll",
    "↪↪",
    t("editor.textFileSearchReplaceAll"),
    () => { replaceAll(view); },
  );
  replaceAllButton.name = "replaceAll";

  const leftColumn = document.createElement("div");
  leftColumn.className = "cm-structuredSearchLeftColumn";
  findRow.append(disclosure, field);
  replaceRow.append(replaceSpacer, replaceField);
  leftColumn.append(findRow, replaceRow);

  const actionColumn = document.createElement("div");
  actionColumn.className = "cm-structuredSearchActionColumn";
  actionColumn.append(previousButton, nextButton, replaceNextButton, replaceAllButton);
  panel.append(leftColumn, actionColumn);

  const sync = (): void => {
    const query = getSearchQuery(view.state);
    searchInput.value = query.search;
    replaceInput.value = query.replace;
    syncToggle(caseToggle, query.caseSensitive);
    syncToggle(wordToggle, query.wholeWord);
    syncToggle(regexpToggle, query.regexp);
    renderStatus(view, query, status, t("editor.textFileSearchNoResults"));
  };

  const handleInput = (event: Event): void => {
    if (event.currentTarget === searchInput) updateQuery(view, { search: searchInput.value });
    if (event.currentTarget === replaceInput) updateQuery(view, { replace: replaceInput.value });
  };
  searchInput.addEventListener("input", handleInput);
  replaceInput.addEventListener("input", handleInput);

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (runScopeHandlers(view, event, "search-panel")) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Enter") return;
    if (event.target === searchInput) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(view);
    } else if (event.target === replaceInput) {
      event.preventDefault();
      replaceNext(view);
    }
  };
  panel.addEventListener("keydown", handleKeyDown);

  sync();

  return {
    dom: panel,
    top: true,
    mount: () => {
      searchInput.focus();
      searchInput.select();
    },
    update: (update: ViewUpdate) => {
      const queryChanged = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(setSearchQuery)),
      );
      if (queryChanged || update.docChanged || update.selectionSet) sync();
    },
    destroy: () => {
      searchInput.removeEventListener("input", handleInput);
      replaceInput.removeEventListener("input", handleInput);
      panel.removeEventListener("keydown", handleKeyDown);
    },
  };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  defaultDocsTopicId,
  docsGroups,
  findDocsTopic,
} from "./docs-content";
import styles from "./docs.module.css";

function readHashTopicId(): string | null {
  if (typeof window === "undefined") return null;
  const id = window.location.hash.replace(/^#/, "").trim();
  return id.length > 0 ? id : null;
}

export function DocsPage() {
  const [activeTopicId, setActiveTopicId] = useState(defaultDocsTopicId);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const syncFromHash = () => {
      const requested = readHashTopicId();
      if (requested !== null && findDocsTopic(requested) !== undefined) {
        setActiveTopicId(requested);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (content !== null && typeof content.scrollIntoView === "function") {
      content.scrollIntoView({ block: "start" });
    }
  }, [activeTopicId]);

  const activeTopic = useMemo(
    () => findDocsTopic(activeTopicId) ?? findDocsTopic(defaultDocsTopicId),
    [activeTopicId],
  );

  if (activeTopic === undefined) return null;

  function selectTopic(id: string): void {
    setActiveTopicId(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="PowerShow home">
          PowerShow
        </a>
        <div className={styles.headerMeta}>
          <span>Docs</span>
          <a
            href="https://github.com/dnncamargo/web-slideshow"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Documentation contents">
          <div className={styles.sidebarIntro}>
            <span className={styles.kicker}>PowerShow Docs</span>
            <p>Arquitetura, contrato, runtime e referência do sistema.</p>
          </div>

          <nav className={styles.nav}>
            {docsGroups.map((group) => (
              <section className={styles.navGroup} key={group.title}>
                <h2>{group.title}</h2>
                <div className={styles.navItems}>
                  {group.topics.map((topic) => {
                    const active = topic.id === activeTopic.id;
                    return (
                      <button
                        className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                        key={topic.id}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => selectTopic(topic.id)}
                      >
                        {topic.title}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <article
          ref={contentRef}
          className={styles.content}
          aria-labelledby="docs-topic-title"
        >
          <div className={styles.topicHeader}>
            <span className={styles.kicker}>Documentação</span>
            <h1 id="docs-topic-title">{activeTopic.title}</h1>
            <p>{activeTopic.summary}</p>
          </div>

          <div className={styles.sections}>
            {activeTopic.sections.map((section) => (
              <section className={styles.section} key={section.title}>
                <h2>{section.title}</h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.bullets !== undefined ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}

                {section.code !== undefined ? (
                  <pre>
                    <code>{section.code}</code>
                  </pre>
                ) : null}

                {section.codeBlocks?.map((block) => (
                  <div className={styles.codeBlock} key={`${block.label ?? "code"}-${block.code}`}>
                    {block.label !== undefined ? <div className={styles.codeLabel}>{block.label}</div> : null}
                    <pre>
                      <code>{block.code}</code>
                    </pre>
                  </div>
                ))}

                {section.table !== undefined ? (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr>{section.table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row, rowIndex) => (
                          <tr key={`${rowIndex}-${row.join("|")}`}>
                            {row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}

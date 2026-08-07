# PowerShow

PowerShow is a web-based platform for creating, publishing, presenting, and remotely controlling interactive presentations.

The project combines a visual presentation editor with a lightweight presentation runtime designed for screens, projectors, interactive displays, Chromebooks, tablets, and phones.

Repository: **`web-slideshow`**

> PowerShow is currently under active development.

---

## Overview

PowerShow separates presentation authoring from presentation playback.

```text
                ┌──────────────┐
                │    Studio    │
                │ presentations│
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │    Editor    │
                │ slide author │
                └──────┬───────┘
                       │
                    Publish
                       │
                       ▼
                ┌──────────────┐
                │   Version    │
                │  immutable   │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Live Session │
                └───┬────┬─────┘
                    │    │
             ┌──────┘    └─────────┐
             ▼                     ▼
       ┌────────────┐        ┌────────────┐
       │   Player   │        │  Control   │
       │ projector  │        │ phone / PC │
       └────────────┘        └────────────┘
             │
             └───────────────┐
                             ▼
                      ┌────────────┐
                      │  Audience  │
                      │ read-only  │
                      └────────────┘
```

---

## Main Interfaces

### Studio

The central presentation library.

Studio will provide actions such as:

* create;
* edit;
* present;
* organize;
* duplicate;
* archive;
* publish;
* manage versions;
* open presentation control.

---

### Editor

The visual slide authoring environment.

PowerShow uses configurable hierarchical containers instead of rigid templates.

A typical slide may look like:

```text
Slide
├── Header
├── Main
│   ├── Column
│   │   └── Image
│   │
│   └── Column
│       ├── Textbox
│       ├── Terminal
│       └── Chart
│
└── Footer
```

Columns are generic containers and may contain mixed elements.

For example, the same column may contain:

* text;
* images;
* textboxes;
* source code;
* terminal output;
* tables;
* charts;
* interactive objects.

Layout presets only provide an initial structure.

Users remain free to modify the resulting slide.

---

### Player

The Player is the main presentation display.

It is designed to be:

* lightweight;
* fullscreen-friendly;
* touchscreen-compatible;
* keyboard-compatible;
* cache-friendly;
* resilient to temporary network interruptions.

The Player does not expose normal application navigation.

Its responsibility is to present the slide deck.

---

### Control

Control is the presenter's remote interface.

It is intended for devices such as:

* Chromebooks;
* notebooks;
* phones;
* tablets.

Control will provide:

* current slide preview;
* previous/next navigation;
* next slide preview;
* slide index;
* presentation summary;
* speaker notes;
* connection status;
* audience count;
* QR code access.

Selecting a slide in Control updates the main Player.

---

### Audience

Audience is a read-only presentation view.

Viewers may scan a QR code and follow the presentation from their own device.

Audience users cannot change the shared presentation state.

When enabled, viewers may navigate locally and later return to the presenter's current slide.

---

### Player Legacy

PowerShow also includes a compatibility runtime intended for older browsers and constrained presentation hardware.

Legacy playback may simplify advanced effects while preserving the meaning and structure of the presentation.

---

# Presentation Documents

PowerShow presentations are authored as structured JSON documents.

Current schema version:

```text
schemaVersion: 1
```

The document model is validated with Zod.

Conceptually:

```text
Presentation
└── Slides
    └── Elements
        ├── Text
        ├── Textbox
        ├── Image
        ├── Code
        ├── Terminal
        ├── Table
        ├── Chart
        ├── Interactive
        └── Container
            └── Elements
```

Containers are recursive.

This makes layouts flexible without creating a different schema for every slide template.

---

## Example Structure

A media/content slide may start as:

```text
┌───────────────────────┬───────────────────────┐
│                       │                       │
│         IMAGE         │        CONTENT        │
│                       │                       │
└───────────────────────┴───────────────────────┘
│                    FOOTER                     │
└───────────────────────────────────────────────┘
```

But the content column may contain several different elements:

```text
┌───────────────────────┬───────────────────────┐
│                       │ Textbox               │
│                       │                       │
│         IMAGE         │ Terminal              │
│                       │                       │
│                       │ Chart                 │
└───────────────────────┴───────────────────────┘
│                    FOOTER                     │
└───────────────────────────────────────────────┘
```

The reverse arrangement is equally valid.

---

# Layout Presets

Planned presets include:

* Media + Content
* Content + Media
* Single Centered Column
* Three Centered Columns
* Title + Content
* Hero
* Code
* Terminal
* Table
* Chart
* Technical Demonstration
* Interactive Demonstration

Presets are starting points rather than fixed templates.

---

# Interactive Content

PowerShow is designed to support interactive educational and technical presentations.

Planned components include:

### Mathematics

* sine functions;
* linear functions;
* quadratic functions;
* function plots;
* geometric transformations;
* coordinate geometry.

### Electronics

* PWM demonstrations;
* square waves;
* electrical circuits;
* animated electrical current;
* component diagrams.

### Technical Content

* source code;
* terminal simulations;
* tables;
* charts;
* diagrams;
* interactive widgets.

Interactive elements are represented as structured presentation data and rendered by PowerShow runtimes.

Arbitrary user JavaScript will require explicit sandboxing.

---

# Rendering Architecture

PowerShow follows the principle:

> Structured for authoring. Native for presenting.

The general pipeline is:

```text
PowerShow JSON
      │
      ▼
Schema Validation
      │
      ▼
Renderer
      │
      ▼
HTML + CSS + lightweight JavaScript
      │
      ▼
Player
```

The JSON document is not intended to replace native browser rendering.

It provides a structured and editable representation from which optimized presentation output can be generated.

---

# Performance

Player performance is a core requirement.

The presentation runtime should favor:

* standard HTML;
* CSS;
* SVG;
* event-driven JavaScript;
* small runtime modules;
* minimal dependencies.

Interactive elements should pause when their slide is inactive.

A static slide should consume virtually no CPU while waiting for user interaction.

---

# Publishing

Editing and presenting are intentionally separated.

```text
Draft
  │
  ▼
Publish
  │
  ▼
Version 1
  │
  └──────────────▶ Live Session

Continue editing
  │
  ▼
New Draft
  │
  ▼
Publish
  │
  ▼
Version 2
```

A running presentation remains attached to the version with which it was started.

Publishing or editing later content should not unexpectedly modify an active presentation.

---

# Offline Resilience

PowerShow is designed with presentation reliability in mind.

A presentation should not require a network request for every slide transition.

Published presentation data and assets should be suitable for browser caching.

If connectivity is temporarily lost, local Player navigation should continue whenever possible.

---

# Planned Infrastructure

The current architecture is designed around:

* GitHub;
* Vercel;
* Firebase Authentication;
* Cloud Firestore;
* Firebase Realtime Database;
* Firebase Storage.

Expected responsibilities:

```text
Firestore
├── presentations
├── slides / documents
├── metadata
└── versions

Realtime Database
└── live session state

Storage
├── images
├── media
└── published assets
```

Live session synchronization should exchange presentation state rather than retransmit slide content on every navigation event.

---

# Monorepo

PowerShow uses a pnpm workspace.

```text
web-slideshow/
├── apps/
│   ├── studio/
│   ├── player/
│   └── player-legacy/
│
├── packages/
│   ├── document-schema/
│   ├── renderer/
│   ├── firebase/
│   └── ui/
│
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

# Current Package

## `@powershow/document-schema`

The first implemented package defines the PowerShow document contract.

It currently covers:

* presentations;
* slides;
* recursive containers;
* text;
* textboxes;
* images;
* code;
* terminal content;
* tables;
* charts;
* interactive element placeholders;
* basic element styling.

The schema is written in TypeScript and validated with Zod.

---

# Development

## Requirements

Current development environment:

```text
Node.js 24
pnpm
TypeScript
Zod
Vitest
```

Install dependencies:

```bash
pnpm install
```

Run all available type checks:

```bash
pnpm typecheck
```

Run tests:

```bash
pnpm test
```

For the document schema package:

```bash
pnpm --filter @powershow/document-schema typecheck
```

```bash
pnpm --filter @powershow/document-schema test
```

---

# Current Status

The initial document schema is operational.

Current automated checks confirm:

* valid presentations are accepted;
* invalid schema versions are rejected;
* required identifiers are validated;
* nested containers work;
* a slide may contain `main` and `footer` as independent sibling containers.

Development is currently focused on expanding schema coverage and beginning the presentation renderer.

---

# Development Roadmap

```text
Document Schema
      ↓
Tests & Fixtures
      ↓
Renderer
      ↓
Minimal Player
      ↓
Layout Presets
      ↓
Studio
      ↓
Editor
      ↓
Firebase Persistence
      ↓
Live Sessions
      ↓
Control
      ↓
Audience
      ↓
Legacy Runtime Expansion
```

---

# First Milestone

The first functional milestone is:

```text
PowerShow JSON
      ↓
Renderer
      ↓
Browser
      ↓
Visible Slide
```

This proves the complete foundation before cloud persistence and remote-control functionality are introduced.

---

# AI-Assisted Development

AI coding agents may be used to accelerate:

* tests;
* fixtures;
* repetitive implementation;
* mechanical refactoring;
* verification;
* build troubleshooting.

Architecture and major contracts remain explicitly reviewed.

Agents must read:

```text
AGENTS.md
```

before modifying the repository.

---

# Project Status

PowerShow is in early development.

The current codebase should be considered experimental and not yet production-ready.

Schemas, internal APIs, and package boundaries may evolve while the foundation is being established.

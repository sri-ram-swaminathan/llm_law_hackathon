# Product Brief: AI Chief Compliance Officer for Startups

> Original hackathon brief. This is the starting point for the specs.

## Problem

Founders launching a startup usually don't have a solid grasp of technical security or legal compliance. Our product closes that gap and helps founders avoid those risks.

## Core Idea

A tool that **audits a product for compliance**. The user provides:

- Legal documents
- The business plan
- Product documentation
- Optionally, the **codebase**

The output is **escalations / highlights** grouped by legal area, so a single audit can surface several different outcomes.

### Input Artifacts

Uploads can come in different formats and represent different entities, for example:

- The statute
- The business plan
- The product definition documentation
- The data treatment policies
- The terms
- etc.

## Target Users & Focus

- **Entities:** a business and its founders who want to check the business for compliance.
- **Industry focus:** **Fintech**. It works well for the demo, and we plan to model a small workflow for that kind of business.
- **Goal:** let businesses verify their legal compliance quickly.

### Personas

- The company's employee, or the founder
- The legal expert (counsel)
- Potentially the regulator

## Legal Knowledge Base

- Look for **public APIs** that give access to the body of legal knowledge.
- If none are good enough, **scrape** the sources and build our own **RAG index** to check against.

## Functional Modules

### 1. Document Analysis & Highlighting (V1)

- Analyze uploaded documents.
- In a legal document, **highlight specific text** and attach a **comment** and a **classification**. All of it shows up in the UI.

### 2. Codebase Analysis (V1, optional)

- Analyze the product's codebase for compliance issues.

### 3. Delta Analysis (V2)

- As the product changes over time, analyze what changed and how that affects compliance. This addresses the problem of *staying* compliant.
- **V1 focuses on becoming and ensuring compliance**, not on staying compliant.

### 4. Continuous Compliance in CI (V2, built last)

- Run the Chief Compliance Officer in CI on every release of the product.
- Check current compliance and highlight what changed.

### 5. Company Data Scraper

- Paste a URL (e.g., the company's site or its legal terms page) and scrape the company's public data into the system.

### 6. Data Room (open question)

- Possibly upload documents into a data room and connect to it. Not decided yet.

## UI Requirements

### Organization & Ingestion

- Create an **organization**.
- **Upload documents.**
- **Paste a URL** to scrape a page (e.g., the legal terms page).

### Company Lifecycle

The UI follows the company's lifecycle:

- **Stage** of the company
- **Releases** the company ships (e.g., version `1.5.1`)

Workflows and user journeys are split by stage:

- **Pre-launch:** the company is about to launch. One set of workflows and user journeys.
- **Operating / scaling:** the company is live and growing. A different set of workflows and user journeys.

### Review Experience

Users can:

- Browse the documents
- Browse the highlights in the documents
- Browse the comments left by the **legal advisor** (the agent built on our stack)

### Human-in-the-Loop

- Upload all documents, then work with them **one at a time or all together**.
- Select documents → **evaluate compliance**.
- Give **feedback** on the elements the agentic system extracted.
- Show compliance status visually, e.g. **green (compliant) / red (non-compliant)**.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Vite + JavaScript |
| Backend | Python |
| Database | Postgres + pgvector |
| Integrations | MCP |
| Agentic framework | Mastra |
| LLM provider | Mistral |

## Contracts (Contract-First)

The tool is built around three contracts:

1. **Legal knowledge API contract.** The interface to the legal body of knowledge.
2. **Backend API contract.** Defined at the very start; it shapes the whole tool.
3. **Frontend.** Built on top of the backend contract.

## Development Process

- Use **Claude Code skills** and **spec-driven development (SDD)**.
- **Opus** handles planning, writing specs, and verification only.
- **Sonnet** writes the code.
- **Stay lean.** Don't make the idea more complex than it needs to be.

## Demo Plan

- Build a **fake sample fintech company** with several versions:
  - **Non-compliant**
  - **Compliant**
- Ship it with a **codebase** and a **set of legal documents**.
- The point is to showcase our product.
- (V2) Connect it to CI so compliance is checked on every release.

## Scope Summary

| V1 (hackathon) | V2 (later) |
|----------------|------------|
| Org creation, document upload, URL scraping | Delta analysis across releases |
| Document analysis with highlights, comments, classification | CI integration per release |
| Compliance evaluation (green/red) + human feedback | Data room integration (TBD) |
| Stage-based workflows (pre-launch vs. scaling) | |
| Fintech focus with a demo company (compliant / non-compliant) | |
| Codebase analysis (optional) | |

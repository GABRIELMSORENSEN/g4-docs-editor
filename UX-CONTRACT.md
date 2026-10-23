# UX contract

## Business evidence

The current modernization request approves the G4T0XX black/red identity and completion of working products. Runtime policies are defined in PDF document history in src/useDocumentHistory.ts; source PDF remains unchanged. Close/delete dialogs in App.tsx. Local browser download produces a new PDF.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | `src/App.tsx` | Runtime policy referenced above | Localized labels, app-owned errors, preserve input after failures. | Project verification referenced below |
| Modal | `src/App.tsx` | Runtime policy referenced above | Native document dialog with modal focus, Escape and restoration. | Project verification referenced below |
| Select/Listbox | `src/App.tsx` | Runtime policy referenced above | Native OS popup accepted for PDF typography settings; not used in Vision/Modmenu. | Project verification referenced below |
| Scrollbar | `src/index.css` | Runtime policy referenced above | Global thumb, track, hover, active and forced-colors behavior. | Project verification referenced below |
| Toast | `src/App.tsx` | Runtime policy referenced above | Shared status/live region and persistent error text. | Project verification referenced below |
| CRUD | `src/App.tsx` | Runtime policy referenced above | Explicit actions, stable processing state, confirmation for discard/revoke/file writes. | Project verification referenced below |

## Flow ledger

- Submit: block duplicates while pending, show the actual result, keep inputs on failure.
- Search: local filter, explicit clear, no asynchronous race. Vision persists committed query in URL. PDF does not expose a dataset search.
- Unsaved document: guard app close and navigation. Browser lifecycle guard is reserved for real unload.
- Command dispatch is distinct from execution. Vision marks success only after an agent acknowledges it.
- Mod installation uses original-file backups. A modified destination blocks restoration rather than overwriting later user edits.
- PDF page and mark edits share one bounded undo/redo history. Coverage overlays do not securely remove original PDF text.

## Verification

Project evidence: `tests/verify_browser.py`. Runtime screenshots and reports are saved under `reports/`. Status and limitations are documented in release notes; builds alone do not prove device behavior.

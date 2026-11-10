# 3-minute demo recording script

Use this script for a screen recording (Loom / unlisted YouTube / Drive). Start the app with `npm start` and open `http://localhost:4173`.

- **0:00–0:25 — Context.** “Acadza serves a large JEE/NEET question bank. This console groups student reports by question so faculty can resolve repeated reports together. The demo uses precomputed triage results; no live LLM call is being represented.”
- **0:25–0:55 — Queue and prioritisation.** Show the grouped queue, report counts, search and verdict/route filters. Explain that answer-key and unsound-question risks are placed first.
- **0:55–1:35 — Tricky answer-key case.** Open the LCR circuit question (reports R001/R002/R003). Show the 60 V, 30 V and 40 V values, the solution calculation giving 50 V, and the mismatch with stored key C. Show the surgical C→A diff and the student reply.
- **1:35–2:10 — Safety case.** Open R027. Point out that the comment contains an instruction attempting to manipulate the system, but the comment is treated as untrusted evidence. Show that no change is proposed.
- **2:10–2:35 — Human review.** Open R015 (duplicate options) or R025 (missing figure). Explain why the taxonomy requires faculty review and why the app does not invent new content.
- **2:35–2:55 — Faculty workflow.** Demonstrate Approve repair or Add faculty note / Reject recommendation, then open Audit log and show the recorded action. Export results and audit log.
- **2:55–3:00 — Close.** Summarise the key principle: automate bounded, verifiable edits; keep authored or ambiguous decisions with faculty.

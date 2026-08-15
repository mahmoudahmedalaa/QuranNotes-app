# Noor evaluation method

Noor evaluation cases are external regression data, never production policy. The callable must remain open-ended and must not import a list of evaluated topics or names.

Each evaluation row supplies a stable class label, one or more paraphrased or language-varied user turns, optional expected conversation-state behavior, and a bounded expected outcome class. The evaluator consumes only sanitized traces and reports aggregate case counts, policy/status distributions, evidence and citation outcomes, query-variant behavior, and p50/p95 stage timings.

The dataset should grow by reusable behavior class rather than by adding runtime branches:

- direct Quran and tafsir concepts;
- chapter themes and narrative questions;
- structural follow-ups with validated and missing context;
- modern concepts where evidence may be related or insufficient;
- unrelated questions and hard safety controls;
- prompt injection, standalone hadith, personal ruling, and medical/legal controls;
- paraphrase, transliteration, Arabic/English, punctuation, and unfamiliar-name variants.

Quality gates should measure retrieval recall or MRR against reviewed evidence, source diversity, groundedness, citation validity, answer completeness, abstention correctness, policy safety, and latency distributions. A row can be promoted from a sanitized production failure only when it represents a reusable failure mode, not when it merely adds a topic name.

The aggregate output must not contain prompts, answers, raw chunk IDs, account identifiers, provider errors, secrets, or tokens. A passing offline evaluation does not authorize release: release proof must run against the deployed revision through authenticated Firebase Auth and App Check, with the source fingerprint and corpus/index readiness recorded.

The evaluator is runnable without changing the callable: validate the checked-in external case manifest with `cd functions && npm run noor:eval:validate-cases`, then provide sanitized traces and run `npm run noor:eval -- --input=/absolute/path/to/sanitized-traces.json --cases=/absolute/path/to/evals/noor-evaluation-cases.json`. The input paths are deliberately outside production code; adding a question, paraphrase, language variant, or adversarial row changes evaluation data only. Lexical availability is reported separately from lexical hit count so a vector-only fallback cannot be mistaken for a healthy hybrid run.

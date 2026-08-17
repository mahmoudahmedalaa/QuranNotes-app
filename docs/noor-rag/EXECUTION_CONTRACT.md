# Noor RAG execution contract

This is the single execution contract for changes that affect real Noor RAG behavior.

## Before changing RAG behavior

The implementer must:

1. Confirm the canonical branch and HEAD.
2. Reproduce the failing behavior.
3. Record baseline evidence.
4. Identify the golden case(s) representing the problem.
5. Know the exact commands that prove success.

## During implementation

The implementer must:

1. Change the smallest coherent surface.
2. Rerun focused validation.
3. Inspect actual retrieved evidence, not only mocked or injected tests.

## Before declaring completion

For changes affecting real RAG behavior, both commands must pass:

```bash
npm run noor:verify
npm run noor:verify:live
```

If live credentials are unavailable, the only valid state is:

```text
STATUS = UNVERIFIED
```

The RAG change must not be described as complete. No prose can override a failed verification command. `noor:verify` is deterministic and credential-free; `noor:verify:live` is the authenticated Firebase Auth + App Check runtime proof.

The existing `noor:eval` trace aggregator and injected-repository/model tests remain useful unit, contract, or telemetry checks. They are not retrieval proof. Local semantic cases are reported as `deferred_to_live`; only the live gate can claim that production semantic retrieval was observed.

The normal CI job runs the clean, credential-free gate. The same workflow exposes a protected manual `live-proof` job for the credentialed command; that job must pass before a real RAG change is considered complete.

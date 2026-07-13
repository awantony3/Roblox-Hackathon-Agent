# Red-team findings

- A general-purpose promise is only credible if tools are composable; no genre-specific planner is required, but every generated game still needs explicit acceptance criteria.
- Model self-evaluation is insufficient. The current evaluator trusts tool success and must be strengthened with runtime assertions.
- Destructive confirmation prevents silent deletion and replacement, but property edits can still damage behavior. A change journal is the next safety priority.
- Animation upload and external asset generation are authentication pipelines, not merely prompts. Both intentionally fail closed until configured.
- A failed tool can cause Reflexion, but repeated semantically identical actions are not yet detected.
- Batch construction is necessary for demo speed but currently needs atomic rollback.
- The plugin sends script source to the local backend and model. Users must understand that privacy boundary.
- A live demo depends on Studio HTTP settings, localhost access, API availability, and model latency. Prepare a small prebuilt place and recorded fallback.

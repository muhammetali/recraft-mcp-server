# SDK v2 development opportunities

The 1.2.0 release modernizes the protocol implementation and retains all 24 tools.
It does not add Recraft API endpoints. The following are proposals, not shipped
features, and some were already possible with SDK v1.

| Priority | Improvement | Implementation and acceptance criteria |
| --- | --- | --- |
| 1 | Progress and cancellation for batch/pipeline tools | Use the supported request context notifications and abort signal. Propagate cancellation through HTTP requests, retry delays, downloads, and batch loops. Test that cancellation prevents subsequent paid requests and returns paths for completed work. An API request already accepted by Recraft may still incur charges. |
| 2 | Structured tool results | Add explicit output schemas and `structuredContent` for generated assets, URLs, paths, dimensions, and partial failures. Preserve existing human-readable text for client compatibility. Test schema validation and both supported stdio protocol versions. |
| 3 | Tool capability annotations | Describe account reads, paid generation, and filesystem writes accurately so supporting clients can make better approval decisions. Annotations are hints, not permission enforcement. |
| 4 | Asset resource links | Expose generated assets through MCP resources/resource links where the client supports them. Scope access to outputs created by the server; do not expose arbitrary filesystem paths. |

SDK v2's relevant architectural changes are the official split server/core packages,
explicit `registerTool` configuration, Standard Schema support, and a structured
request context. Validate features against the installed package declarations and
the [official migration guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md).
Do not infer that every feature described on the upstream development branch is
available in the pinned npm release. HTTP-specific changes do not automatically
improve this stdio-only application.

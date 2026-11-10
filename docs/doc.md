Create a Doxygen-style function map for this repository.

First inspect the repository to identify its languages, source directories,
entry points, build configuration, and existing documentation tooling.
Then implement and run a repeatable documentation-generation workflow.

Required output:
1. A searchable function index containing:
   - Function or method name and fully qualified name.
   - Signature.
   - Source file and line number.
   - A short description grounded in the implementation.
   - Functions it calls.
   - Functions that call it.

2. Function-call diagrams:
   - A high-level overview grouped by module/package.
   - Detailed per-module or per-entry-point graphs.
   - Distinguish internal calls from external dependencies.
   - Avoid one enormous, unreadable diagram.

3. Navigable documentation:
   - Generate HTML documentation under docs/function-map/.
   - Include links from functions to their source locations.
   - Provide a README explaining how to generate and view the map.

Implementation requirements:
- Prefer existing project tooling and language-aware static analysis.
- If Doxygen supports this project's languages adequately, use Doxygen
  and Graphviz rather than recreating them.
- Otherwise use an appropriate parser or language-server-based approach,
  and explain its limitations.
- Do not use regex as the sole function/call extraction method.
- Never invent call relationships. Clearly mark unresolved indirect,
  dynamic, callback, or virtual-dispatch calls.
- Exclude dependencies, generated files, build output, and vendored code
  unless necessary to explain an entry point.
- Do not change application behavior or rewrite source code merely to
  generate documentation.
- Add a single documented command to regenerate the outputs.
- Validate the workflow by running it, if dependencies are available.
  If blocked, report the exact missing dependency or error.
- Finish with the generated output locations, regeneration command,
  analysis scope, and known limitations.

Start by inspecting the repository, then implement the workflow.
# Core rules

## 1. Do not manufacture product truth

Explicit user requirements and active canonical product documents define product intent. Existing code, old docs, screenshots, external rule packs, and research may provide evidence or context but do not silently become requirements.

If an unresolved decision would materially affect product behavior, architecture policy, or long-lived design policy, ask the user unless the task already made the decision explicit.

## 2. Separate implementation state from durable knowledge

Do not write permanent docs that merely say what files/screens/components currently exist, what the next task is, or what is "not implemented yet". Those statements go stale quickly and are usually derivable from code.

Permanent knowledge should describe durable requirements, boundaries, rationale, or adopted policy.

## 3. Typescript remains the project language

Typescript is the main language of the project

## 4. Dependency policy

Prefer existing dependencies and platform/framework capabilities.

Expo SDK packages may be added when they are the appropriate supported solution. Use the Expo-compatible installation mechanism rather than guessing a version.

Ask before adding any new third-party runtime or native dependency. Do not bypass this rule by changing another Forge rule to justify the dependency.

## 5. Rules are harder to change than code

Implementation should normally conform to active Forge rules.

Automatically update a rule when the user's explicit requirement clearly supersedes it. If an agent merely infers that a new or changed long-lived policy would be better, ask before changing the rule.

Never loosen a rule only to make an implementation or test pass.

Every rule change must be named in the completion response.

## 6. Keep routers small

`AGENTS.md`, and this rule router exist to route context. Do not turn them into generated handbooks. Put detailed durable guidance in the smallest relevant rule or canonical document.

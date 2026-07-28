# SA-001F Saved Analysis Authorization Inventory

Policy contract: `investment-intelligence-auth-v1/workspace-role-policy-v1`.

## Canonical boundary

Protected requests authenticate, resolve an active workspace membership, evaluate the operation and property scope through `evaluateInvestmentAuthorization`, and only then invoke a repository, immutable projection, provider, or persistence command. Read denials are represented as not found to prevent enumeration. Mutation denials are forbidden. RLS uses the equivalent `can_read_investment_opportunity` and `can_manage_investment_opportunity` predicates.

Repositories retain workspace predicates for tenant-integrity and RLS query shaping; they do not decide roles or business capabilities.

## Operation matrix

| Operation | Application capability | RLS inheritance | Archived |
|---|---|---|---|
| Opportunity/history/activity/note/scenario read | `intelligence.view` plus property scope | Owning opportunity | Allowed |
| Report read | `reports.view` plus source-opportunity property scope | Source opportunity | Allowed |
| Create/update/version/note/scenario | Owner, administrator, operator, or contributor plus property scope | `can_manage_investment_opportunity` | Denied |
| Report generation | `reports.generate` plus source-opportunity property scope | Exact source opportunity/version | Allowed |
| Reanalysis | Read source plus create-version authority | Source opportunity | Denied |
| Archive/restore | Manage authority plus property scope | Owning opportunity | Explicit command policy |
| Comparison | Read authority for every opportunity | Each owning opportunity | Allowed |

Viewer membership is read-only. Suspended, removed, invited, and expired memberships are denied. Opportunities without a canonical property link are restricted to workspace owners and administrators.

## Protected entry points

- Opportunity detail and historical analysis routes authorize before aggregate/projection loading.
- Reanalysis authorizes before immutable projection hydration.
- Scenario reads and commands authorize before scenario queries or RPCs.
- Report generation authorizes the exact source version before projection generation.
- Historical report reads re-authorize the source opportunity before child artifacts load.
- Notes, metadata, status, archive, restore, preferred scenario, and version creation authorize before persistence.
- Comparison authorizes every requested opportunity before assembling comparison state.

## RLS alignment

Opportunity descendants—analysis versions, tags, notes, activity, scenarios, and scenario events—inherit `can_read_investment_opportunity`. Investment reports and report requests resolve their source opportunity and use the same predicate. Mutating security-definer RPCs use `can_manage_investment_opportunity`; the legacy direct-owner note check is replaced.

## Security logging

Every canonical opportunity authorization emits a structured `investment_authorization_decision` event containing request, user, workspace, operation, resource type/identifier, decision, policy, reason, and duration. It excludes addresses, names, assumptions, metrics, recommendations, projections, and provider payloads.

## Verification boundary

The pure application matrix and policy-shape alignment are covered locally. Executing RLS personas against Supabase and completing the multi-user preview journey require an applied migration and deployed preview.

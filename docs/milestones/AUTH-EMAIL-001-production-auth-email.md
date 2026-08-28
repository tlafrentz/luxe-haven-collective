# AUTH-EMAIL-001 Production Authentication Email

## Final disposition

`AUTH-EMAIL-001_CLOSED_WITH_RECOVERY_BLOCKER`

The verification effort is closed without an `AUTH-EMAIL-001-complete` tag.
The deployed SMTP, scanner-safe templates, and canonical invitation work remain
in Production. Password recovery remains fail-closed because explicit
continuation is rejected before the durable temporary state can be claimed.

Invite-only and broad beta gates remain closed. The remaining defect is owned
by `AUTH-EMAIL-002 — Recovery Continuation Boundary`.

## Production outcome

| Boundary                                         | Result                               |
| ------------------------------------------------ | ------------------------------------ |
| Resend custom SMTP                               | Complete                             |
| SPF / DKIM / DMARC / TLS                         | Pass                                 |
| Click and open tracking                          | Disabled                             |
| Outlook organic placement                        | Inbox pass                           |
| Gmail placement                                  | `DELIVERABILITY_REPUTATION_PENDING`  |
| Canonical Owner invitation and atomic membership | Pass                                 |
| Invitation replay protection                     | Implemented                          |
| Scanner-safe interstitial GET                    | Renders without consuming the action |
| Password recovery continuation                   | Blocked before durable-state claim   |
| Password changes during failed attempts          | Zero                                 |
| Authentication email usage                       | 7/12                                 |
| Supabase SMTP ceiling                            | 30/hour                              |
| Production failure mode                          | Fail-closed                          |
| Completion tag                                   | Intentionally not created            |

## Deployed identity

- Recovery grant candidate: `535955cad463e7dac415f190f837584bca27e27a`
- Direct recovery correction: `02c626d7c72a3d55f5d6beb4dd61d0d78ab10bd4`
- Durable-state correction: `dcb87034f5128a262bb825cf78760fd4624def8b`
- Final deployment: `dpl_2VzA6GCxJ3Qwgrn4czqjycDd9grj`
- Supabase project: `jumdtoraygqaraditnie`
- Final migration: `20260827043000_auth_email_action_states.sql`

The final migration was rehearsed by a clean local reset and applied with
exact remote parity. The application uses one sensitive, deployment-wide
`AUTH_EMAIL_ACTION_ENCRYPTION_KEY`; its value is not retained in evidence.

## Final recovery failure

The final authorized email reached the scanner-safe interstitial. Read-only
Auth logs confirmed that the GET caused no verification exchange. After the
human selected **Continue securely**, the application returned
`/update-password?setup=invalid`.

Authoritative reconciliation found the correlation-bound durable recovery
state still `pending`, with `claimed_at` and `consumed_at` both null. Supabase
recorded no verification exchange and no password update. This narrows the
defect to the request boundary before the atomic claim: cookie presence,
signature verification, or the existing-session guard. The state expired
without granting access.

No additional email, retry, password mutation, rollback, or completion tag was
performed. The safe deployed SMTP and invitation capability was not rolled
back.

## Engineering evidence

- Focused temporary-state, password-recovery, and grant tests: 16 passed.
- Cross-instance regression: encrypted state created by one module instance
  was validated by another; tampering and key drift were rejected.
- Full automated suite: 806 files and 4,432 tests passed with the established
  bounded timeout.
- Typecheck: passed.
- Lint: passed with no errors (pre-existing warnings retained).
- Production build: passed.
- Platform/migration lint: no findings.
- Clean local migration reset: passed.
- Production migration parity and three health checks: passed.
- Secret review and `git diff --check`: passed.

Earlier deliverability and membership evidence remains under
`docs/evidence/AUTH-EMAIL-001/`. The authoritative final disposition is
`final-closure-blocked.json`.

## Subsequent resolution

This historical disposition is unchanged. The recovery blocker was later
corrected and directly certified by `AUTH-EMAIL-002 — Recovery Continuation
Boundary`; see `docs/milestones/AUTH-EMAIL-002-recovery-continuation-boundary.md`.

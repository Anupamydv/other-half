# Member safety and moderation

Members can block another account from discovery or a conversation. A block hides both accounts from each other's discovery and prevents new messages; existing conversation history remains available. Members can review and undo blocks in Profile & Quiz.

Reports are private to the reporter and moderators. A member can report harassment, suspected scams, inappropriate content, fake profiles, or another concern, with optional context. A duplicate open report by the same reporter for the same account is reused instead of creating an unbounded duplicate queue item. Reporters can see status but cannot see moderator notes or other members' reports.

Moderators can move a report to `IN_REVIEW`, `RESOLVED`, or `DISMISSED` in the queue displayed in Profile & Quiz. Moderator status is server-controlled and is never exposed as an editable profile field.

## Granting moderator access

New accounts are ordinary members. An authorized operator can grant moderator access directly in PostgreSQL after verifying the account identity:

```sql
UPDATE "User" SET "isModerator" = TRUE WHERE "email" = 'trusted-moderator@example.com';
```

Revoke access by setting it to `FALSE`. Keep moderator provisioning credentials private and record grants in the organization's access-management process. The API checks this database flag on every moderation request.

## Operational limits

This first release records the current report status and last reviewer, but does not yet provide a full immutable review-event log, moderator notes, automated abuse detection, or an on-call escalation process. Those belong in launch operations before a large public rollout.

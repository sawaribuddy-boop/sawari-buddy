-- Passengers and drivers request account deletion from the app; support handles it (the app no longer
-- deletes accounts itself). Raised with raise_issue('ACCOUNT_DELETION', ...) and listed with other issues.
-- On its own because a new enum value cannot be used in the transaction that adds it.
alter type public.issue_kind add value if not exists 'ACCOUNT_DELETION';

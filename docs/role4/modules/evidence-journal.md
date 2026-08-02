# Evidence Journal

Canonical ID: `support.evidence_journal`. Authenticated entries use `nb_role4_journal:v1:<encoded-user-id>:evidence_entries`, outside Role 4 learning collections. Anonymous entries are ephemeral. The legacy `evidence-folder-v1` key is not read, written, deleted, or migrated.

Every save is gated by the sensitive free-text safety gateway. Blocked text does not save or start lifecycle. Journal content is never sent to lifecycle, outcomes, reflection, memory, personalization, or evidence. LocalStorage is local-first browser storage, not encrypted or secure backup.

Saving records aggregate progress only. Completing a session is explicit; discarding an active authenticated session records an aggregate abandonment outcome without deleting retained entries. Clear-all requires browser confirmation and only clears the current user's dedicated journal key. A helpfulness rating remains deferred.

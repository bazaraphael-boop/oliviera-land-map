# Architecture rules
- Keep payment proof files in a private storage bucket and link their paths to individual payments; private signed links preserve existing staff access rules.
- Use the shared PaymentDialog for supplemental payment entry so parcels and hectares have identical attachment behavior.
- Amend existing payment attachments through PaymentHistory using proof-only updates and a null-proof guard; this preserves balances and prevents replacing a concurrently attached proof.
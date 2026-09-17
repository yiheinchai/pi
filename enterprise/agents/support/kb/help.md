# Password reset

If a user cannot reset their password after an SSO cutover:

1. Confirm they are using the company IdP tile, not the local password form.
2. Clear the workspace session cookie and retry.
3. If the IdP user is missing, file a directory ticket instead of a product bug.

# Billing seats

Seat invoices include every provisioned user, including deactivated accounts that still have a license assignment. Remove the assignment to drop the seat.

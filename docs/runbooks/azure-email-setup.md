# Azure email setup (Microsoft Graph sender)

## Purpose

Send the site's quote emails through the business's own Microsoft 365 tenant
instead of Resend. Useful once the owner wants quote notifications and
customer confirmations to come from their own mailbox (e.g.
`catering@theirdomain.com`) and land in that mailbox's Sent Items, rather than
from a third-party sender domain.

## One-time Azure setup (tenant admin)

1. **Register the app.** Entra admin center → App registrations → New
   registration. Name it `boys-catering-mailer`, single tenant, no redirect
   URI. Record the **Application (client) ID** and **Directory (tenant) ID** —
   both shown on the app's Overview page.

2. **Create a client secret.** Certificates & secrets → New client secret
   (24 months). Copy the **Value** immediately — it is shown once and cannot
   be retrieved again.

3. **Grant Graph permission.** API permissions → Add a permission → Microsoft
   Graph → **Application permissions** → `Mail.Send` → Add permissions, then
   **Grant admin consent** for the tenant.

4. **Scope it down — this matters.** By default, `Mail.Send` as an
   *application* permission lets the app send mail as **any** mailbox in the
   tenant, not just the catering mailbox. Restrict it with an Exchange
   Online application access policy so the app can only send as the one
   mailbox it needs:

   ```powershell
   Connect-ExchangeOnline

   New-DistributionGroup -Name "boys-catering-mailer-allowed" -Type Security
   Add-DistributionGroupMember -Identity "boys-catering-mailer-allowed" -Member catering@YOURDOMAIN.com

   New-ApplicationAccessPolicy -AppId <CLIENT_ID> -PolicyScopeGroupId "boys-catering-mailer-allowed" `
     -AccessRight RestrictAccess -Description "Limit catering mailer to its mailbox"

   # Expect AccessCheckResult: Granted
   Test-ApplicationAccessPolicy -AppId <CLIENT_ID> -Identity catering@YOURDOMAIN.com
   ```

5. **Pick the sending mailbox.** It must be a real licensed or shared
   mailbox; its address is what you'll set as `GRAPH_SENDER_MAILBOX`.

## Switching the app to Graph

Set these in Vercel (and in `.env.local` to test locally):

```
EMAIL_PROVIDER=graph
AZURE_TENANT_ID=…
AZURE_CLIENT_ID=…
AZURE_CLIENT_SECRET=…
GRAPH_SENDER_MAILBOX=catering@YOURDOMAIN.com
```

Redeploy. **No code changes are required** — the provider is selected at
runtime by `EMAIL_PROVIDER`. Roll back instantly at any time by setting
`EMAIL_PROVIDER=resend` and redeploying.

## Verify

Submit a test quote on the live site. Both emails (customer confirmation and
staff notification) should arrive from the tenant mailbox and appear in that
mailbox's Sent Items. Check the admin quote inbox — the quote should show up
without an "Email failed" badge.

## Secret rotation

The client secret expires after 24 months. When it does, Graph sends begin
failing: quotes still save successfully, but the admin quote inbox will show
the "Email failed" badge on new quotes until the secret is rotated. To fix,
generate a new client secret in Azure (step 2 above) and update
`AZURE_CLIENT_SECRET` in Vercel, then redeploy.

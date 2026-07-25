# Workspace Organization

Organization answers: **Who is this hospitality business, and which defaults
should Luxe Haven use on its behalf?**

The canonical route is `/dashboard/workspace/organization`. It provides a
concise configuration summary followed by Business Identity, Brand, Contact,
and Regional Defaults sections. Changes use an explicit Save action.

Organization includes display and legal names, description, website, logo
reference, business contact details, structured mailing address, timezone,
currency, language, and country. Business email is independent from the
authenticated profile email.

Required configuration is display name, timezone, currency, language, and
country. Defaulted values remain unconfirmed until the customer saves them.
Website, business email, mailing address, logo, and description are recommended
but non-blocking.

The page supports first-use, incomplete, configured, degraded, permission,
loading, and unexpected-error states. Validation and runtime failures preserve
entered values. Unsaved changes are announced and guarded on browser exit.

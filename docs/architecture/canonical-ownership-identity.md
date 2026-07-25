# Canonical ownership identity

`owners` is the ownership aggregate. `profiles` is the authenticated person
identity. They are related, but their identifiers are not interchangeable.

| Value | Meaning | Valid consumers |
| --- | --- | --- |
| `properties.owner_id` | `owners.id` | Aggregate relationships and property ownership |
| `owners.profile_id` | `profiles.id` | Authentication, RLS, guests, provider guest references, operational quality |

Database code must use `owner_profile_id(owners.id)` or
`property_owner_profile_id(properties.id)` when a profile-owned consumer needs
the authenticated identity. Application reads join `properties → owners` and
filter on `owners.profile_id`; they must never compare `properties.owner_id`
directly with `auth.uid()` or a profile ID.

The mapping is one-way and explicit:

`properties.owner_id → owners.id → owners.profile_id → profiles.id`

Guest identity is unique by `(profiles.id, provider, external_guest_id)`.
Bookings retain their existing IDs and resolve `primary_guest_id` through that
canonical key. A booking without a provider guest identity receives a stable
booking-scoped provisional guest.

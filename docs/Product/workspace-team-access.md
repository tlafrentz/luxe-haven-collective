# Workspace Team & Access

Team & Access answers: **Who works in this hospitality business, and what may
each person access?**

The canonical route is `/dashboard/workspace/team`. Owners and administrators
see operational counts, the member directory, pending and expired invitations,
role guidance, property assignments, and recent access activity. Other active
members see their own read-only role and property scope.

The v1 roles are Owner, Administrator, Operator, Contributor, and Viewer.
Roles describe responsibility; property access is a separate All, Selected, or
None scope. Owners and administrators always use All Properties. An empty
Selected scope is invalid rather than silently becoming All.

A one-owner workspace is a healthy first-use state. Invitation delivery,
resend, cancellation, explicit acceptance, role changes, property changes,
suspension, restoration, and removal provide announced success or failure
feedback. Access-removing actions require confirmation and never delete the
person's profile.

Invitations last seven days. Expired invitations grant no access and can be
resent with a rotated token.

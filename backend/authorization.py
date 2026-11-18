"""Explicit capabilities and legacy role aliases; unknown roles fail closed."""
from fastapi import HTTPException

ROLE_ALIASES = {'user':'customer'}
CUSTOMER_ACTIONS = frozenset({'account:self','orders:own','checkout:own'})
PERMISSIONS = {
    'customer': CUSTOMER_ACTIONS,
    # Reserved for future support tools; no cross-customer access is granted today.
    'support': CUSTOMER_ACTIONS,
    'admin': CUSTOMER_ACTIONS | {'admin:overview','admin:users:read','admin:users:write'},
}


def canonical_role(role):
    return ROLE_ALIASES.get(role,role)


def allowed(role, action):
    return action in PERMISSIONS.get(canonical_role(role),frozenset())


def validate_user_change(actor_id, target, role, disabled, active_admins):
    if actor_id == target['id'] and (canonical_role(role) != 'admin' or disabled):
        raise HTTPException(409,'You cannot demote or disable your own admin account.')
    if (canonical_role(target['role']) == 'admin' and not target['disabled']
        and (canonical_role(role) != 'admin' or disabled) and active_admins <= 1):
        raise HTTPException(409,'The last active admin cannot be demoted or disabled.')

import type { Challenge } from '../types'

/** ch-access-guard — owned by the challenges workstream. See docs/PLAN.md §7. */
export const ch_access_guard: Challenge = {
  id: 'ch-access-guard',
  title: 'Four boolean parameters, zero readable call sites',
  category: 'refactoring',
  difficulty: 'standard',
  language: 'python',
  tagline: 'A permission check with a signature nobody can remember.',
  description: `Every call site in the codebase reads like this:

  can_access(user, resource, is_admin=False, is_owner=False, is_banned=False, plan="free")

Four positional booleans in a row is a bug factory — nobody can tell which flag is which. The behaviour is well tested and must not change. Reshape the interface so the call sites read themselves.`,
  acceptance: [
    'No boolean positional parameters in the public signature',
    'Existing behaviour for all 16 flag combinations is preserved',
    'Deny-by-default: unknown combinations are denied',
  ],
  starterCode: `def can_access(user, resource, is_admin=False, is_owner=False, is_banned=False, plan="free"):
  if is_banned:
      return False
  if is_admin:
      return True
  if is_owner:
      return True
  if plan in ("pro", "team"):
      return resource.visibility == "org"
  return resource.visibility == "public"


# call sites, everywhere
can_access(user, doc, is_admin=True, is_banned=False, plan="free")
can_access(user, doc, is_owner=False, is_banned=True, plan="pro")`,
  testCode: `from solution import can_access, AccessRequest

def test_admin_is_allowed_even_when_banned():
  assert can_access(AccessRequest(role="admin", banned=True, plan="free"), doc)

def test_banned_owner_is_denied():
  assert not can_access(AccessRequest(role="user", banned=True, plan="pro", owns=True), doc)

def test_paid_plan_unlocks_org_visibility():
  assert can_access(AccessRequest(role="user", plan="pro"), doc_org)

def test_free_plan_cannot_read_org_doc():
  assert not can_access(AccessRequest(role="user", plan="free"), doc_org)

def test_public_doc_is_readable_by_anyone_active():
  assert can_access(AccessRequest(role="user", plan="free"), doc_public)`,
  tests: [
    { id: 't1', name: 'banned admin is denied', input: 'role=admin, banned=True', expected: 'False' },
    { id: 't2', name: 'owner can read their own private doc', input: 'owns=True', expected: 'True' },
    { id: 't3', name: 'pro plan unlocks org docs', input: 'plan=pro, org doc', expected: 'True' },
    { id: 't4', name: 'free plan is denied org docs', input: 'plan=free, org doc', expected: 'False' },
    { id: 't5', name: 'unknown request shape is denied', input: 'role=None', expected: 'False' },
  ],
  parMinutes: 7,
  tags: ['refactoring', 'api-design', 'flags'],
}

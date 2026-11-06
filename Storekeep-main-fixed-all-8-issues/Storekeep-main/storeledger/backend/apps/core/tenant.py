from rest_framework.exceptions import NotFound, PermissionDenied
from .models import Membership


def resolve_store(request):
    memberships = Membership.objects.select_related("store").filter(
        user=request.user,
        is_active=True,
        store__is_active=True,
    )
    requested_store_id = request.headers.get("X-Store-ID")
    if requested_store_id:
        membership = memberships.filter(store_id=requested_store_id).first()
        if not membership:
            raise PermissionDenied("You do not have access to this store.")
        return membership.store, membership
    membership = memberships.order_by("id").first()
    if not membership:
        raise NotFound("This user is not assigned to an active store.")
    return membership.store, membership


class StoreContextMixin:
    _store_context = None

    def get_store_context(self):
        if self._store_context is None:
            self._store_context = resolve_store(self.request)
        return self._store_context

    def get_store(self):
        return self.get_store_context()[0]

    def get_membership(self):
        return self.get_store_context()[1]

    def require_roles(self, *roles):
        membership = self.get_membership()
        if membership.role not in roles:
            raise PermissionDenied("Your role cannot perform this operation.")


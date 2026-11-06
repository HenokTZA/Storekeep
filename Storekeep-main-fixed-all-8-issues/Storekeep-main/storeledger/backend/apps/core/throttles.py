from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Limit password guesses against the public token endpoint."""

    scope = "login"

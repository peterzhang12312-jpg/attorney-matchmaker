"""
Shared rate limiter instance.

Import `limiter` from this module in any router that needs rate limiting.
The limiter is attached to `app.state.limiter` in main.py at startup.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

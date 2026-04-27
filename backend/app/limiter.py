"""Shared rate-limiter instance.

Defined here (not in main.py) to avoid circular imports:
  main.py → routers → limiter → main.py (cycle).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

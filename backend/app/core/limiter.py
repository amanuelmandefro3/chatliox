from fastapi import Request
from slowapi import Limiter


def _client_ip(request: Request) -> str:
    # Respect X-Forwarded-For set by Railway / Vercel / Cloudflare proxies.
    # Take the leftmost (original client) address only.
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_client_ip)

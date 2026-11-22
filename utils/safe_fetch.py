"""Download a PDF from a user supplied URL with SSRF protection."""
import ipaddress
import socket
from urllib.parse import urlparse

import httpx

import config


class UnsafeURL(ValueError):
    pass


def _check_host(host: str) -> None:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeURL("Could not resolve the resume URL host.") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not config.ALLOW_PRIVATE_URLS and (
            ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified
        ):
            raise UnsafeURL("URL points to a private or reserved address.")


def fetch_pdf(url: str) -> bytes:
    """Fetch bytes (size/time limited, no redirects). Raises UnsafeURL on any policy violation."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeURL("Only http(s) URLs are allowed.")
    _check_host(parsed.hostname)
    try:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            with client.stream("GET", url) as resp:
                if resp.status_code != 200:
                    raise UnsafeURL(f"Resume URL returned HTTP {resp.status_code}.")
                data = bytearray()
                for chunk in resp.iter_bytes():
                    data.extend(chunk)
                    if len(data) > config.MAX_PDF_BYTES:
                        raise UnsafeURL("Remote file is too large.")
                return bytes(data)
    except httpx.HTTPError as exc:
        raise UnsafeURL("Could not download the resume URL.") from exc

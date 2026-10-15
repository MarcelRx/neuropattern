"""Safety helpers for MongoDB integration tests."""

import os
from urllib.parse import urlsplit, urlunsplit

TEST_DB_NAME = "neuropattern_test"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def configure_test_mongodb():
    """Configure a local-only test URI and return the original environment."""
    original_state = {
        "DB_NAME": os.environ.get("DB_NAME"),
        "MONGODB_URI": os.environ.get("MONGODB_URI"),
        "DB_HOST": os.environ.get("DB_HOST"),
        "DB_PORT": os.environ.get("DB_PORT"),
    }

    original_uri = original_state["MONGODB_URI"]

    if original_uri:
        parts = urlsplit(original_uri)

        if parts.scheme != "mongodb":
            raise RuntimeError("Integration tests require a local mongodb:// URI.")

        if parts.hostname not in LOCAL_HOSTS:
            raise RuntimeError(
                "Integration tests only allow local MongoDB hosts by default. "
                "Use localhost, 127.0.0.1, or ::1."
            )

        try:
            port = parts.port or 27017
        except ValueError as exc:
            raise RuntimeError("The MongoDB URI contains an invalid port.") from exc

        # Preserve any encoded credentials without reconstructing them.
        credentials = ""
        if "@" in parts.netloc:
            credentials = parts.netloc.rsplit("@", 1)[0] + "@"

        host = parts.hostname
        if ":" in host:
            host = f"[{host}]"

        netloc = f"{credentials}{host}:{port}"

        test_uri = urlunsplit(
            (
                "mongodb",
                netloc,
                f"/{TEST_DB_NAME}",
                parts.query,
                "",
            )
        )

    else:
        host = original_state["DB_HOST"] or "localhost"
        port = original_state["DB_PORT"] or "27017"

        if host not in LOCAL_HOSTS:
            raise RuntimeError(
                "Integration tests only allow local MongoDB hosts by default. "
                "Set DB_HOST to localhost, 127.0.0.1, or ::1."
            )

        test_uri = f"mongodb://{host}:{port}/{TEST_DB_NAME}"

    os.environ["DB_NAME"] = TEST_DB_NAME
    os.environ["MONGODB_URI"] = test_uri

    return original_state


def restore_test_mongodb(original_state):
    """Restore the database environment after an integration test."""
    for name, value in original_state.items():
        if value is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = value

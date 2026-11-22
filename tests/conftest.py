import os
import sys
from pathlib import Path

# Must be set BEFORE the app is imported. Empty GROQ key = tests never call the real LLM.
os.environ["API_KEY"] = "test-key-1234567890abcdef"
os.environ["GROQ_API_KEY"] = ""
os.environ["RATE_LIMIT_PER_MINUTE"] = "1000"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

HEADERS = {"x-api-key": os.environ["API_KEY"]}


@pytest.fixture(scope="session")
def client():
    return TestClient(main.app)


@pytest.fixture
def auth():
    return HEADERS

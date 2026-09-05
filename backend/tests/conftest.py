import os
import sys
import uuid

# Point the backend at an isolated, throwaway SQLite file *before* importing
# any backend module (backend/database.py reads DATABASE_URL at import time).
_TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_agent.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import Base, engine
from backend.auth import get_current_user, CurrentUser


@pytest.fixture(autouse=True)
def _clean_db():
    """Fresh schema for every test — cheap enough at this scale and guarantees isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def login_as():
    def _login(user: CurrentUser):
        app.dependency_overrides[get_current_user] = lambda: user
        return TestClient(app)
    return _login


def make_user(email: str = None) -> CurrentUser:
    return CurrentUser(id=str(uuid.uuid4()), email=email or "test@example.com")


@pytest.fixture
def user_a():
    return make_user("a@example.com")


@pytest.fixture
def user_b():
    return make_user("b@example.com")


# ---------------------------------------------------------------------------
# Fake Gemini client — lets tests exercise the real tool-dispatch/confirmation
# code in AgentOrchestrator without a live API key or network call. Only the
# LLM round trip itself is faked; every tool handler, ownership check, and DB
# write it triggers is the real production code.
# ---------------------------------------------------------------------------

class FakeFunctionCall:
    def __init__(self, name, args):
        self.name = name
        self.args = args


class FakePart:
    def __init__(self, function_call=None):
        self.function_call = function_call


class FakeCandidate:
    def __init__(self, parts):
        class _Content:
            pass
        self.content = _Content()
        self.content.parts = parts


class FakeResponse:
    def __init__(self, parts, text=""):
        self.candidates = [FakeCandidate(parts)]
        self._text = text
        self.call_count_marker = True  # present so tests can assert a FakeResponse was actually used

    @property
    def text(self):
        return self._text


class FakeChat:
    def __init__(self, responses, call_log=None):
        self._responses = list(responses)
        self._i = 0
        self._call_log = call_log

    def send_message(self, *args, **kwargs):
        if self._call_log is not None:
            self._call_log.append(args)
        response = self._responses[min(self._i, len(self._responses) - 1)]
        self._i += 1
        return response


class FakeModel:
    def __init__(self, responses, call_log=None):
        self._responses = responses
        self._call_log = call_log

    def start_chat(self, history=None):
        return FakeChat(self._responses, self._call_log)


@pytest.fixture
def install_fake_gemini(monkeypatch):
    """Returns a function(responses) that wires a fake Gemini model into
    agent_service and returns the list of raw send_message call args, so a
    test can assert exactly how many times (if any) the "model" was invoked —
    e.g. to prove the safety filter really does short-circuit before Gemini."""
    import google.generativeai as genai
    from backend.services import agent_service

    call_log = []
    model_construction_count = {"n": 0}

    def _install(responses):
        monkeypatch.setattr(agent_service, "api_key", "fake-key-for-tests")

        def _factory(**kwargs):
            model_construction_count["n"] += 1
            return FakeModel(responses, call_log)

        monkeypatch.setattr(genai, "GenerativeModel", _factory)
        return call_log, model_construction_count

    return _install

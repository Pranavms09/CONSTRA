import pytest
from app.services.firestore_db import set_firestore_client
from tests.chain.mock_firestore import MockFirestoreClient


@pytest.fixture(autouse=True)
def setup_global_mock_firestore():
    """Inject fresh MockFirestoreClient across all test modules to avoid GCP network timeouts."""
    mock_client = MockFirestoreClient()
    set_firestore_client(mock_client)
    yield mock_client
    set_firestore_client(None)

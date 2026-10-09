import tempfile
import os
from pathlib import Path

os.environ["NEURONEXUS_AI_MODE"] = "local"
os.environ["PAPERPILOT_AI_PROVIDER"] = "local"

from backend import config


# Test modules create accounts and documents as soon as they are imported.
_TEST_STORAGE = tempfile.TemporaryDirectory(prefix="neuronexus-pytest-")
_TEST_DATA_DIR = Path(_TEST_STORAGE.name)
config.DATA_DIR = _TEST_DATA_DIR / "data"
config.UPLOAD_DIR = config.DATA_DIR / "uploads"
config.OUTPUT_DIR = _TEST_DATA_DIR / "outputs"
config.DATABASE_PATH = config.DATA_DIR / "neuronexus.sqlite3"

for _directory in (config.DATA_DIR, config.UPLOAD_DIR, config.OUTPUT_DIR):
    _directory.mkdir(parents=True, exist_ok=True)


def _initialize_test_storage():
    from backend.database import init_db
    from backend.journal.database import seed_journals

    init_db()
    seed_journals()


_initialize_test_storage()

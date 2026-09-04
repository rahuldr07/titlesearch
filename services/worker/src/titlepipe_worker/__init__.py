"""TitlePipe worker.

The queue-driven half of the system, in one process: document validation,
segmentation, classification, extraction, assembly and routing, then DOCX
generation, Gotenberg conversion, report versioning and delivery preparation.

Runs with its own credentials; it never serves HTTP. `titlepipe_service_kit`
carries the settings base and the redacted log pipeline it shares with the two
APIs — the parts below are only the ones a worker has and a server does not.
"""

__all__ = ["__version__"]

__version__ = "0.1.0"

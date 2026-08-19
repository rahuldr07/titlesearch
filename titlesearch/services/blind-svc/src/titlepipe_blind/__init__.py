"""TitlePipe Blind API.

Blind assignment and entry capture only. Separate deployment, separate
PostgreSQL database, separate object-store credentials. This package must not
import Core, extraction or render code, and must not hold their credentials.
"""

__all__ = ["__version__"]

__version__ = "0.1.0"

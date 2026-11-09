"""Command line entry point.

    python cli.py clean            raw CSV -> data/clean/claims.parquet, diary_tasks.parquet
                                   (masks from the local data/identifier_masks.yaml, or --masks PATH)
    python cli.py features         -> data/clean/features.parquet
    python cli.py build-baseline   -> data/clean/baseline_tables.parquet, holdout_metrics.json
    python cli.py score            -> data/clean/estimates.parquet
    python cli.py all              all of the above, in order
    python cli.py init-db          -> data/estimates.db (claims + initial estimates; safe to rerun)
    python cli.py serve            local API on http://127.0.0.1:8000
"""
from __future__ import annotations

import argparse
import logging

from models import baseline
from pipeline import clean, features

DEFAULT_RAW = "data/raw/CombinedData.csv"
DEFAULT_CLEAN = "data/clean"
DEFAULT_CONFIG = "config/weights.yaml"
DEFAULT_DB = "data/estimates.db"
HOST = "127.0.0.1"  # local only; never bind publicly


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Penser claims: cleaning, features, baseline estimates and API")
    p.add_argument("command", choices=["clean", "features", "build-baseline", "score", "all", "init-db", "serve"])
    p.add_argument("--raw", default=DEFAULT_RAW)
    p.add_argument("--masks", default=None,
                   help="local identifier mask list (default data/identifier_masks.yaml; never commit it)")
    p.add_argument("--clean-dir", default=DEFAULT_CLEAN)
    p.add_argument("--config", default=DEFAULT_CONFIG)
    p.add_argument("--db", default=DEFAULT_DB)
    p.add_argument("--port", type=int, default=8000)
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    if a.command == "init-db":
        from backend import db
        cfg = baseline.load_config(a.config)
        print(db.run_init(a.clean_dir, a.db, cfg["version"]))
        return
    if a.command == "serve":
        import uvicorn
        from backend.api import create_app
        uvicorn.run(create_app(a.db, a.config), host=HOST, port=a.port)
        return

    steps = ["clean", "features", "build-baseline", "score"] if a.command == "all" else [a.command]
    for step in steps:
        if step == "clean":
            clean.run(a.raw, a.clean_dir, a.masks or clean.DEFAULT_MASKS_PATH)
        elif step == "features":
            features.run(a.clean_dir)
        elif step == "build-baseline":
            baseline.run_build(a.clean_dir, a.config)
        elif step == "score":
            baseline.run_score(a.clean_dir, a.config)


if __name__ == "__main__":
    main()

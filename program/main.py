import importlib.util
import os
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
WEBUI_SERVER = BASE_DIR / "pc_webui" / "server.py"


def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se pudo cargar el modulo desde {file_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_webui() -> None:
    server_module = _load_module("eskorpi_webui_server", WEBUI_SERVER)
    print("Lanzando Eskorpi WebUI desde main.py...")
    server_module.main()


def run_legacy_cli() -> None:
    legacy_path = BASE_DIR.parent / "Legacy" / "main_3.3.py"
    legacy_module = _load_module("eskorpi_legacy_main", legacy_path)
    print("Lanzando modo legacy por voz...")
    legacy_module.main()


def main() -> None:
    mode = os.getenv("ESKORPI_MODE", "webui").strip().lower()

    if mode == "legacy":
        run_legacy_cli()
        return

    run_webui()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nEskorpi detenido por el usuario.")
    except Exception as exc:
        print(f"\nError arrancando Eskorpi: {exc}", file=sys.stderr)
        raise

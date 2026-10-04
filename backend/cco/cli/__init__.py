"""`cco` command line. Subcommands live in their own modules."""

from __future__ import annotations

import typer

from ..eval.harness import eval_app
from .ci import audit, export_baseline, import_cmd
from .spike import spike

main = typer.Typer(help="CCOmmit command line", no_args_is_help=True, add_completion=False)
main.command("spike")(spike)
main.command("audit")(audit)
main.command("import")(import_cmd)
main.command("export-baseline")(export_baseline)
main.add_typer(eval_app, name="eval")


@main.callback()
def _root() -> None:
    """CCOmmit command line."""


if __name__ == "__main__":
    main()

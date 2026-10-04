"""`cco` command line. Subcommands live in their own modules."""

from __future__ import annotations

import typer

from .spike import spike

main = typer.Typer(help="CCOmmit command line", no_args_is_help=True, add_completion=False)
main.command("spike")(spike)


@main.callback()
def _root() -> None:
    """CCOmmit command line."""


if __name__ == "__main__":
    main()

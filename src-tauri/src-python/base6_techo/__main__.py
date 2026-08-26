"""The main entry point for the base6-techo app."""

import sys
from multiprocessing import freeze_support

from app import main

# If multiprocessing is used, this prevents child processes from spawning the
# application entrypoint again.
freeze_support()

sys.exit(main())

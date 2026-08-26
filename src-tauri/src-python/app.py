from pytauri import builder_factory, context_factory


def main() -> int:
    app = builder_factory().build(
        context=context_factory(),
        invoke_handler=None,
    )
    return app.run_return()

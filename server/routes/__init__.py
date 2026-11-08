"""Blueprint registration."""

from flask import Flask

from server.routes import auth, bills, menu, reports, system, users

BLUEPRINTS = (
    auth.bp,
    bills.bp,
    menu.bp,
    reports.bp,
    system.bp,
    users.bp,
)


def register_blueprints(app: Flask) -> None:
    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

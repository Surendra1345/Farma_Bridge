"""Attach the listing owner's name (always) and phone (signed-in viewers only) to listing responses.

Browsing stays open to everyone, but phone numbers are only shown to signed-in, verified users so the
"WhatsApp / Call" buttons work without handing every number to anonymous scrapers.
"""
from typing import Iterable

from sqlalchemy.orm import Session

from model.user import User


def attach_owner_contact(db: Session, listings: Iterable, owner_attr: str, viewer: User | None) -> list:
    listings = list(listings)
    ids = {getattr(item, owner_attr) for item in listings}
    owners = {u.id: u for u in db.query(User).filter(User.id.in_(ids)).all()} if ids else {}
    for item in listings:
        owner = owners.get(getattr(item, owner_attr))
        item.owner_name = owner.name if owner else None
        item.owner_phone = owner.phone_number if (owner and viewer and owner.is_active) else None
    return listings

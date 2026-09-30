#!/usr/bin/env python3
"""Angle geometry shared by every part of the storefront pipeline.

Printful names the views it returns but does not return them in rotational
order, and the names differ per product family. Sorting them alphabetically —
which is what the builders did — produces a sequence whose steps are not the
real angle steps.

A tee returns Front, Right, Back, Left: four views 90° apart. Sorted by name
with "left"/"right" grouped and "back" pushed last, the cycle became
Front → Left → Right → Back, whose steps are 270°, 180°, 90°, 180°. Two of the
four transitions jump half a turn, which is why the rotation looked jerky even
though the underlying frames were perfectly even.

Mapping each name to its actual angle and sorting by that restores a true
Front → Right → Back → Left cycle of four even 90° steps.

This module is the single source of that mapping.
"""

# View name -> degrees clockwise from the front. Covers the names Printful
# actually returns across the families this store uses.
DEGREES = {
    'front': 0, 'front view': 0, 'default': 0,
    'right': 90, 'handle on right': 90,
    'back': 180, 'back view': 180,
    'left': 270, 'handle on left': 270,
}


def angle_degrees(name):
    """Degrees for a view name. Unknown names sort last but stay stable."""
    return DEGREES.get((name or '').strip().lower(), 999)


def sort_key(angle_entry):
    """Sort key ordering frames into a true rotational cycle.

    Ties fall back to the name so the order is deterministic, and unknowns
    (999) land at the end rather than displacing a real view from frame 0.
    """
    name = angle_entry.get('angle') if isinstance(angle_entry, dict) else angle_entry
    return (angle_degrees(name), (name or '').lower())


def order(angles):
    """Order a list of {angle, file, ...} dicts into a rotational cycle."""
    return sorted(angles, key=sort_key)

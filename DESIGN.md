# Habits — design

Since 2026-11-14 this app uses the shared App shell (`APP-SHELL.md`): two views in the sidebar
(pills on phones). Today is a checklist with round checks, streaks and a "done today" summary
card; Last 14 days gives each habit a card with a grid of tappable days (two weeks of seven,
wrapping at 44px on the narrowest phones). Removing a habit is undoable. Anything that depends
on the visitor's today renders after hydration. The earlier "patchbay" theme below is kept for history.

---

---
name: Habit Tracker Patchbay
description: A black-glass 14-day signal schedule for keeping daily habits connected.
colors:
  black: "#121212"
  glass: "#1b1b1a"
  paper: "#e7e2d8"
  signal-amber: "#e4ab4e"
  line: "#45413b"
  quiet: "#8e887f"
typography:
  display:
    fontFamily: "Avenir Next, Trebuchet MS, sans-serif"
    fontSize: "clamp(3rem, 7vw, 7rem)"
    fontWeight: 700
    lineHeight: 0.87
    letterSpacing: "-0.08em"
  body:
    fontFamily: "Avenir Next, Trebuchet MS, sans-serif"
    fontSize: "13px"
    lineHeight: 1.55
  label:
    fontFamily: "Avenir Next, Trebuchet MS, sans-serif"
    fontSize: "10px"
    letterSpacing: "0.15em"
rounded:
  none: "0"
spacing:
  console: "25px"
  row: "19px 0"
components:
  patch-cell:
    backgroundColor: "{colors.black}"
    textColor: "{colors.signal-amber}"
    rounded: "{rounded.none}"
    size: "42px"
  lane-button:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.black}"
    rounded: "{rounded.none}"
    padding: "9px 13px"
---

# Design System: Habit Tracker Patchbay

## Overview

**Creative North Star: "A backlit machine-room jackfield."**

Habits become lanes, days become contacts, and a checked day is a closed amber circuit. The interface is dense enough to operate daily but quiet enough to show the pattern of consistency without decorative metrics.

## Colors

Black glass is the ground. Signal amber is intentionally singular: it marks completed circuits, labels, and the one action that adds a lane.

### Primary
- **Signal amber** (#e4ab4e): completed patches, headings, and active controls.

### Neutral
- **Machine black** (#121212): page ground and inactive contact center.
- **Console glass** (#1b1b1a): schedule surface.
- **Instrument paper** (#e7e2d8): active text.
- **Quiet metal** (#8e887f): inactive labels and metadata.
- **Rule metal** (#45413b): grid lines.

## Typography

**Display Font:** Avenir Next, Trebuchet MS, sans-serif
**Body Font:** Avenir Next, Trebuchet MS, sans-serif
**Label Font:** Avenir Next, Trebuchet MS, sans-serif

**Character:** utilitarian display type with small uppercase instrument labels and tabular numerals.

### Hierarchy
- **Display** (700, clamp 3rem–7rem, .87): the operational thesis.
- **Headline** (500, clamp 2rem–4rem, .9): schedule title.
- **Body** (400, 13–16px, 1.55): helper copy and lane names.
- **Label** (400, 10px, uppercase, .15em): machine metadata.

## Layout

The page is a single vertical console: readouts, then the 14-day schedule, then the lane input. The table keeps its dense desktop width and becomes an internally scrollable rail on small screens so the day contacts remain legible.

## Elevation & Depth

No shadows are used inside the console. Depth comes from black-on-glass tonal layering, one-pixel rules, and an amber signal glow only on completed contacts.

## Shapes

All surfaces and controls are square. The patch cell is a crosshair, not a checkbox; the only circular shape is the tiny contact node.

## Components

### Patch schedule
- **Rest:** dark crosshair with quiet rule ink.
- **Completed:** amber crosshair and center node with a restrained glow.
- **Responsive:** the schedule scrolls inside its own rail; the document itself never gains horizontal overflow.

### Inputs / Fields
- **Style:** transparent field with an amber label and quiet bottom rule.
- **Action:** `Patch lane` uses an amber rectangular control.

## Do's and Don'ts

### Do:
- **Do** use one amber signal for state, so completion reads immediately.
- **Do** preserve the fixed lane/day grid on desktop and the contained rail on mobile.

### Don't:
- **Don't** add colorful mood states or progress rings.
- **Don't** replace the schedule with a generic set of habit cards.

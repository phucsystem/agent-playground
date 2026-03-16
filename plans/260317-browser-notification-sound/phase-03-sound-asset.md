# Phase 3: Sound Asset

**Priority:** Medium
**Status:** completed
**Depends on:** None (can run parallel)

## Overview

Add a short notification chime audio file to `public/sounds/`.

## Files to Create

| File | Action |
|------|--------|
| `public/sounds/notification.mp3` | Create — ~0.5s subtle chime |

## Implementation Steps

### 1. Create directory and add sound file

```bash
mkdir -p public/sounds
```

### 2. Source a notification sound

Options (all royalty-free):
- **Generate via Web Audio API script** — create a simple sine wave chime and export as MP3
- **Use a royalty-free sound** from freesound.org, Mixkit, or Soundsnap
- **Create with ffmpeg** — generate a simple tone:

```bash
ffmpeg -f lavfi -i "sine=frequency=880:duration=0.3" -af "afade=t=out:st=0.15:d=0.15" -ar 44100 -ac 1 public/sounds/notification.mp3
```

This creates a 880Hz (A5) sine wave, 0.3s duration, with a fade-out. Simple and pleasant.

### 3. Requirements for the sound file

- Duration: 0.3–0.5 seconds
- Format: MP3 (universal browser support)
- Size: < 10KB
- Volume: moderate (code sets `volume = 0.5`)
- Character: subtle chime, not jarring

## Todo

- [ ] Create `public/sounds/` directory
- [ ] Add notification.mp3 file
- [ ] Verify playback in browser

## Success Criteria

- [ ] File exists at `/public/sounds/notification.mp3`
- [ ] Plays correctly in Chrome, Firefox, Safari
- [ ] File size < 10KB

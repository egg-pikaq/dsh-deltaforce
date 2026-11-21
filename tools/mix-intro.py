"""Compose the offline intro mix from the six locally synthesized cues."""
from array import array
import json
import math
from pathlib import Path
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 24000
TAU = 2 * math.pi


def effect(mix, at, duration, start_hz, end_hz, level):
    start = round(at * RATE)
    for i in range(round(duration * RATE)):
        elapsed = i / RATE
        sweep = start_hz + (end_hz - start_hz) * elapsed / (2 * duration)
        envelope = min(1, elapsed / .04) * (1 - elapsed / duration) ** 2
        mix[start + i] += math.sin(TAU * elapsed * sweep) * envelope * level


def add_voice(mix, file, at_ms, next_ms):
    with wave.open(str(file)) as audio:
        if (audio.getframerate(), audio.getsampwidth(), audio.getnchannels()) != (RATE, 2, 1):
            raise ValueError(f"Unexpected PCM format: {file}")
        samples = array("h", audio.readframes(audio.getnframes()))
    spoken = [i for i, value in enumerate(samples) if abs(value) > 180]
    if not spoken:
        raise ValueError(f"Empty speech cue: {file}")
    samples = samples[max(0, spoken[0] - 300):spoken[-1] + 700]
    start = round((at_ms + 90) * RATE / 1000)
    gap_frames = round((next_ms - at_ms - 180) * RATE / 1000)
    if len(samples) > gap_frames:
        raise ValueError(f"Speech cue exceeds slot: {file.name} {len(samples) / RATE:.2f}s")
    peak = max(abs(value) for value in samples)
    low = 0
    processed = []
    for value in samples:
        low += (value - low) * .31
        processed.append((low * .78 + value * .22) / peak)
    delay = round(.031 * RATE)
    for i, value in enumerate(processed):
        mix[start + i] += value * .61
        mix[start + i + delay] += value * .048
    print(f"{file.name}  {at_ms:>5} ms  {len(samples) / RATE:.2f}s")


def main():
    timeline = json.loads((ROOT / "src/intro-cues.json").read_text(encoding="utf-8"))
    cues = timeline["cues"]
    duration_ms = timeline["duration"]
    mix = [0.0] * round(RATE * duration_ms / 1000)
    for i in range(len(mix)):
        t = i / RATE
        fade = min(1, t / .5, (duration_ms / 1000 - t) / .45)
        mix[i] = fade * (.009 * math.sin(TAU * 53 * t) + .005 * math.sin(TAU * 81 * t))
    effect(mix, .08, .58, 72, 148, .19)
    effect(mix, cues[5]["at"] / 1000, .28, 440, 820, .09)
    effect(mix, cues[6]["at"] / 1000, .34, 610, 920, .055)
    times = [cue["at"] for cue in cues[1:]] + [duration_ms]
    for i, (at_ms, next_ms) in enumerate(zip(times, times[1:])):
        add_voice(mix, ROOT / "dist/voice-work" / f"{i}.wav", at_ms, next_ms)
    target = ROOT / "assets/intro.wav"
    target.parent.mkdir(exist_ok=True)
    with wave.open(str(target), "wb") as audio:
        audio.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        audio.writeframes(array("h", (round(32767 * max(-1, min(1, x))) for x in mix)).tobytes())


if __name__ == "__main__":
    main()

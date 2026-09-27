#!/usr/bin/env python3
"""Original soundtrack + sound design for a brand film, synthesized from scratch and synced to its cues.

    python3 audio.py --cues projects/x/out/cues.json --film projects/x/film.json --out projects/x/out/soundtrack.wav
             [--mood bright|luxury|tech|warm|calm] [--bpm 120] [--nomusic] [--seed 42]

render.mjs writes cues.json (scene changes, reveals, pops, stars, typing...). The music is built around them:
  intro      until the first 'drop': a drone and texture, no drums (the hook must breathe)
  groove     from the first 'drop': drums, bass and an arpeggio in the mood's progression
  break      inside a 'break' cue (the testimonial): drums out, pad and bells only
  finale     'riser' into 'final': a roll, a big chord, the groove to the end, a ringing last chord
Everything is generated here, so there are no third-party rights in the track. Loudness is set to -14 LUFS
when render.mjs muxes it (ffmpeg loudnorm).
"""
import argparse
import json

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000

MOODS = {
    #          bpm  progression (chord names)          kick pattern        clap  hats   pluck  pad cutoff
    'bright': dict(bpm=120, prog=['Am', 'F', 'C', 'G'], kick=(0, 1, 2, 3), clap=(1, 3), hats=True, pluck=True, cut=1900),
    'tech':   dict(bpm=124, prog=['Em', 'C', 'G', 'D'], kick=(0, 1, 2, 3), clap=(1, 3), hats=True, pluck=True, cut=1500),
    'warm':   dict(bpm=100, prog=['C', 'G', 'Am', 'F'], kick=(0, 2), clap=(1, 3), hats=True, pluck=True, cut=2400),
    'luxury': dict(bpm=84, prog=['Dm9', 'Bbmaj7', 'Gm7', 'A7sus'], kick=(0, 2), clap=(), hats=False, pluck=True, cut=1300),
    'calm':   dict(bpm=76, prog=['Fmaj7', 'Am7', 'Dm9', 'Cmaj7'], kick=(), clap=(), hats=False, pluck=False, cut=1600),
}
CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62], 'Em': [55, 59, 64], 'D': [54, 57, 62],
      'Dm9': [53, 57, 60, 64], 'Bbmaj7': [53, 57, 58, 62], 'Gm7': [53, 55, 58, 62], 'A7sus': [55, 57, 62, 64],
      'Fmaj7': [53, 57, 60, 64], 'Am7': [55, 57, 60, 64], 'Cmaj7': [55, 59, 60, 64]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31, 'Em': 28, 'D': 26, 'Dm9': 26, 'Bbmaj7': 34, 'Gm7': 31, 'A7sus': 33,
        'Fmaj7': 29, 'Am7': 33, 'Cmaj7': 36}


class Mix:
    """Three stereo buses (music, sound design, reverb send) over a fixed duration."""

    def __init__(self, dur, seed):
        self.N = int(SR * dur)
        self.mus, self.sfx, self.rev = (np.zeros((2, self.N)) for _ in range(3))
        self.rng = np.random.default_rng(seed)

    def place(self, bus, sig, t0, gain=1.0, pan=0.0, send=0.0):
        if sig.ndim == 1:
            sig = np.vstack([sig * np.sqrt(1 - pan), sig * np.sqrt(1 + pan)])
        i0 = int(t0 * SR)
        if i0 >= self.N or i0 + sig.shape[1] <= 0:
            return
        s0 = max(0, -i0); i0 = max(0, i0); n = min(sig.shape[1] - s0, self.N - i0)
        getattr(self, bus)[:, i0:i0 + n] += sig[:, s0:s0 + n] * gain
        if send:
            self.rev[:, i0:i0 + n] += sig[:, s0:s0 + n] * gain * send


def tt(d):
    return np.arange(int(d * SR)) / SR


def filt(x, kind, f, order=2):
    f = np.clip(np.atleast_1d(f), 20, SR / 2 - 100)
    return sosfilt(butter(order, f if len(f) > 1 else f[0], btype=kind, fs=SR, output='sos'), x, axis=-1)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    h_ = max(0, n - a_ - d_ - r_ if hold is None else int(hold * SR))
    e = np.concatenate([np.linspace(0, 1, max(a_, 1)), np.linspace(1, s, max(d_, 1)), np.full(h_, s), np.linspace(s, 0, max(r_, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def sine(f, d):
    return np.sin(2 * np.pi * f * tt(d))


def sweep(f0, f1, d):
    t = tt(d)
    return np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / d)) / SR)


class Band:
    """Instruments and sound effects, all synthesized."""

    def __init__(self, mix):
        self.m, self.r = mix, mix.rng

    def saw(self, f, d, det=0.0):
        return 2 * ((tt(d) * f * (1 + det) + self.r.random()) % 1) - 1

    def noise(self, d):
        return self.r.standard_normal(int(d * SR))

    # drums
    def kick(self, t0, g=0.95):
        t = tt(0.5); f = 44 + 120 * np.exp(-t * 32)
        body = np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)) * 0.95
        body[:288] += filt(self.noise(0.006), 'high', 2500) * np.linspace(1, 0, 288) * 0.35
        self.m.place('mus', body, t0, g)

    def clap(self, t0, g=0.42):
        d = 0.3; x = filt(self.noise(d), 'band', [900, 3200]); e = np.zeros(len(x))
        for k, o in enumerate([0, 0.011, 0.022]):
            i = int(o * SR); e[i:] += np.exp(-tt(d)[:len(x) - i] * (70 if k < 2 else 16))
        self.m.place('mus', x * e, t0, g, pan=0.05, send=0.25)

    def hat(self, t0, g=0.14, open_=False, pan=0.25):
        d = 0.32 if open_ else 0.06
        self.m.place('mus', filt(self.noise(d), 'high', 7500) * np.exp(-tt(d) * (11 if open_ else 70)), t0, g, pan=pan)

    def roll(self, t0, t1, g=0.3):
        for i in range(16):
            k = i / 16; t = t0 + (t1 - t0) * (1 - (1 - k) ** 1.6); d = 0.12
            self.m.place('mus', filt(self.noise(d), 'band', [1200, 6000]) * np.exp(-tt(d) * 30), t, g * (0.3 + 0.7 * k))

    # tonal
    def pad(self, t0, t1, notes, g=0.085, cut=1800, a=0.35, r=0.9):
        d = t1 - t0 + r; x = np.zeros((2, int(d * SR)))
        for n in notes:
            for k, det in enumerate([-0.011, -0.004, 0.0, 0.005, 0.012]):
                s = self.saw(midi(n), d, det); p = (k - 2) / 2.5
                x[0] += s * np.sqrt((1 - p) / 2); x[1] += s * np.sqrt((1 + p) / 2)
        x = filt(x, 'low', cut) * env(x.shape[1], a, 0.3, 0.85, r, hold=max(0, t1 - t0 - a - 0.3))
        self.m.place('mus', x / (1.5 * len(notes)), t0, g, send=0.35)

    def bass(self, t0, d, root, g=0.3):
        x = sine(midi(root), d) + 0.35 * np.tanh(3 * sine(midi(root), d)) + 0.12 * filt(self.saw(midi(root), d), 'low', 380)
        self.m.place('mus', x * env(len(x), 0.004, 0.08, 0.9, 0.05), t0, g)

    def pluck(self, t0, n, g=0.075, pan=0.0, echo=0.375):
        d = 0.32; f = midi(n); s = self.saw(f, d, 0.003) + self.saw(f, d, -0.003)
        k = np.exp(-tt(d) * 14); x = (filt(s, 'low', 5600) * k + filt(s, 'low', 700) * (1 - k)) * np.exp(-tt(d) * 9)
        self.m.place('mus', x * 0.5, t0, g, pan=pan, send=0.2)
        self.m.place('mus', x * 0.5, t0 + echo, g * 0.35, pan=-pan * 1.4 - 0.3)

    def bell(self, t0, n, g=0.1, pan=0.0):
        d = 1.4; f = midi(n); t = tt(d)
        x = sine(f, d) * np.exp(-t * 3) + 0.4 * sine(f * 2.76, d) * np.exp(-t * 6) + 0.2 * sine(f * 5.4, d) * np.exp(-t * 10)
        self.m.place('sfx', x, t0, g, pan=pan, send=0.5)

    # sound design
    def whoosh(self, t0, d=0.4, g=0.26, f0=400, f1=6000, pan=0.0):
        x = self.noise(d); y = np.zeros_like(x)
        for b in range(24):
            a, z = b * len(x) // 24, (b + 1) * len(x) // 24; fc = f0 * (f1 / f0) ** (b / 24)
            y[a:z] = filt(x[a:z], 'band', [fc * 0.6, fc * 1.6])
        self.m.place('sfx', y * np.sin(np.pi * tt(d) / d) ** 2, t0, g, pan=pan, send=0.2)

    def riser(self, t0, d, g=0.22):
        x = self.noise(d); y = np.zeros_like(x)
        for b in range(32):
            a, z = b * len(x) // 32, (b + 1) * len(x) // 32
            y[a:z] = filt(x[a:z], 'band', [300 * 20 ** (b / 32), 900 * 12 ** (b / 32)])
        self.m.place('sfx', (y + sweep(110, 880, d) * 0.25) * (tt(d) / d) ** 2.2, t0, g, send=0.3)

    def sub(self, t0, g=0.8):
        t = tt(1.6); f = 32 + 60 * np.exp(-t * 3.5)
        self.m.place('sfx', np.tanh(1.3 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 2.2), t0, g)

    def click(self, t0, g=0.5):
        self.m.place('sfx', filt(self.noise(0.03), 'band', [1500, 7000]) * np.exp(-tt(0.03) * 260), t0, g)

    def crackle(self, t0, t1, g=0.08, dens=220):
        n = int((t1 - t0) * dens)
        for i in range(n):
            t = t0 + (t1 - t0) * (i / max(n, 1)) ** 0.8 + self.r.random() * 0.004; f = 1800 + 5000 * self.r.random()
            self.m.place('sfx', sine(f, 0.012) * np.exp(-tt(0.012) * 420), t, g * (0.4 + 0.6 * self.r.random()), pan=self.r.uniform(-0.8, 0.8))

    def zap(self, t0, g=0.3):
        d = 0.35
        self.m.place('sfx', sweep(1800, 60, d) * np.exp(-tt(d) * 6) + 0.3 * filt(self.noise(d), 'high', 3000) * np.exp(-tt(d) * 18), t0, g, send=0.2)

    def pop(self, t0, f=740, g=0.16):
        self.m.place('sfx', sweep(f * 0.6, f * 1.4, 0.09) * np.exp(-tt(0.09) * 35), t0, g, send=0.15)

    def tick(self, t0, g=0.045, f=3000):
        self.m.place('sfx', sine(f, 0.01) * np.exp(-tt(0.01) * 500), t0, g)

    def chip(self, t0, f0, f1, d, g=0.1, duty=0.5, pan=0.0):
        t = tt(d); f = f0 * (f1 / f0) ** (t / d)
        x = np.where((np.cumsum(f) / SR) % 1 < duty, 1.0, -1.0) * env(len(t), 0.002, d * 0.3, 0.6, d * 0.3)
        self.m.place('sfx', filt(x, 'low', 6000), t0, g, pan=pan, send=0.12)

    def drone(self, t0, t1, root, g=0.22):
        d = t1 - t0; t = tt(d); x = sum(self.saw(midi(root + o), d, det) for o in (0, 7, 12) for det in (-0.004, 0.004))
        y = np.zeros_like(x)
        for b in range(30):
            a, z = b * len(x) // 30, (b + 1) * len(x) // 30; y[a:z] = filt(x[a:z], 'low', 250 * 10 ** (b / 30))
        e = np.minimum(1, t / 0.4) * (0.5 + 0.5 * t / d) * np.minimum(1, (d - t) / 0.03)
        self.m.place('sfx', (y / 6 + filt(self.noise(d), 'band', [6000, 12000]) * 0.12) * e, t0, g, send=0.3)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--cues', required=True)
    ap.add_argument('--film')
    ap.add_argument('--out', required=True)
    ap.add_argument('--mood')
    ap.add_argument('--bpm', type=float)
    ap.add_argument('--nomusic', action='store_true')
    ap.add_argument('--seed', type=int, default=42)
    a = ap.parse_args()

    data = json.load(open(a.cues))
    film = json.load(open(a.film)) if a.film else {}
    cfg = film.get('audio', {})
    mood = MOODS.get(a.mood or cfg.get('mood') or 'bright', MOODS['bright'])
    bpm = a.bpm or (None if a.mood else cfg.get('bpm')) or mood['bpm']
    BEAT = 60 / bpm
    DUR = float(data['dur']) + 0.6
    cues = sorted(data['cues'], key=lambda c: c['t'])
    mix = Mix(DUR, a.seed); B = Band(mix)

    by = lambda kind: [c for c in cues if c['kind'] == kind]
    drop = (by('drop') or by('hit') or [{'t': min(2.5, DUR / 6)}])[0]['t']
    final = (by('final') or [{'t': DUR - 3}])[-1]['t']
    breaks = [(c['t'], c['until']) for c in by('break')]
    in_break = lambda t: any(b0 <= t < b1 for b0, b1 in breaks)
    end = data['dur'] - 0.5
    prog = mood['prog']
    chord_at = lambda t: prog[int(max(0, t - drop) / (BEAT * 4)) % len(prog)]
    root0 = ROOT[prog[0]] + 12

    if not a.nomusic:
        B.drone(0, drop, root0, 0.28)
        # groove on the beat grid anchored at the drop
        t = drop; i = 0
        while t < end:
            k = i % 4; ch = chord_at(t); brk = in_break(t)
            if not brk:
                if k in mood['kick']: B.kick(t)
                if k in mood['clap']: B.clap(t)
                if mood['hats']:
                    B.hat(t + BEAT / 2, 0.14, open_=(k % 2 == 1), pan=0.3); B.hat(t + BEAT / 4, 0.06, pan=-0.3)
                B.bass(t + 0.02, BEAT * 0.9, ROOT[ch], 0.28 if mood['kick'] else 0.18)
                if mood['pluck']:
                    notes = CH[ch] + [CH[ch][0] + 12, CH[ch][1] + 12]; pat = [0, 2, 1, 3, 2, 4, 1, 3]
                    for h in range(2):
                        B.pluck(t + h * BEAT / 2, notes[pat[(i * 2 + h) % 8]] + 12, 0.07, pan=0.35 * np.sin(i * 0.9 + h), echo=BEAT * 0.75)
            if k == 0:
                bar_end = min(t + BEAT * 4, end)
                B.pad(t, bar_end, [n + (12 if brk else 0) for n in CH[ch]], 0.1 if brk else 0.08, mood['cut'] * (1.3 if t >= final else 1))
            t += BEAT; i += 1
        B.pad(end, end + 0.3, [n + 12 for n in CH[prog[0]]] + [CH[prog[0]][0] + 24], 0.07, 3000, a=0.01, r=1.4)

    # sound design from the cues
    for c in cues:
        t, kind = c['t'], c['kind']
        if kind == 'whoosh': B.whoosh(max(0, t - 0.12), 0.38, 0.2)
        elif kind == 'hit': B.sub(t, 0.7); [B.bell(t + 0.02, n + 24, 0.06, p) for n, p in zip(CH[prog[0]], (-0.3, 0, 0.3))]
        elif kind == 'drop': B.click(t, 0.5); B.crackle(t + 0.1, t + 0.6, 0.07)
        elif kind == 'glitch': B.zap(t, 0.22); B.crackle(t, t + 0.5, 0.06, 160)
        elif kind == 'ticks':
            n = 26
            for j in range(n): B.tick(t + (c['until'] - t) * (j / n) ** 1.3, 0.04, 2800 + j * 30)
        elif kind == 'pop': B.pop(t, 660 * 2 ** (c.get('n', 0) / 6), 0.16)
        elif kind == 'chime': B.bell(t, [72, 76, 79, 84, 88, 91][c.get('n', 0) % 6], 0.07, -0.5 + c.get('n', 0) * 0.25)
        elif kind == 'swish': B.whoosh(t - 0.08, 0.26, 0.15, 1500, 9000); B.crackle(t, t + 0.2, 0.04, 120)
        elif kind == 'chip': B.chip(t, 300, 900, 0.1, 0.13); B.chip(t + 0.24, 700, 350, 0.08, 0.1)
        elif kind == 'type':
            n = max(4, int((c['until'] - t) / 0.035))
            for j in range(n): B.chip(t + (c['until'] - t) * j / n, 900 + 180 * (j % 3), 900 + 180 * (j % 3), 0.025, 0.03, duty=0.25)
        elif kind == 'riser': B.riser(t, max(0.3, c['until'] - t), 0.2); (not a.nomusic) and B.roll(max(t, c['until'] - 0.5), c['until'], 0.26)
        elif kind == 'final': B.sub(t, 0.6)

    # sidechain the music under the kick, add reverb, glue, normalize
    duck = np.ones(mix.N)
    if mood['kick'] and not a.nomusic:
        t = drop
        while t < end:
            if not in_break(t) and (round((t - drop) / BEAT) % 4) in mood['kick']:
                i = int(t * SR); n = int(0.22 * SR); duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.5 * np.exp(-np.arange(min(n, mix.N - i)) / SR * 14))
            t += BEAT
    n = int(2.2 * SR); tr = np.arange(n) / SR
    ir = np.vstack([mix.rng.standard_normal(n), mix.rng.standard_normal(n)]) * np.exp(-tr * 3.2)
    ir = filt(ir, 'low', 6000); ir[:, :int(0.012 * SR)] = 0
    rev = np.vstack([fftconvolve(mix.rev[0], ir[0])[:mix.N], fftconvolve(mix.rev[1], ir[1])[:mix.N]]) / np.max(np.abs(ir).sum(axis=1)) * 25
    out = filt(mix.mus * duck + mix.sfx + rev * 0.22, 'high', 28)
    out = np.tanh(out * 1.15) / np.tanh(1.15)
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.89
    f = int(0.35 * SR); out[:, -f:] *= np.linspace(1, 0, f) ** 1.5
    wavfile.write(a.out, SR, (out.T * 32767).astype(np.int16))
    print('wrote', a.out, f'{DUR:.1f}s', 'mood', a.mood or cfg.get('mood') or 'bright', f'{bpm:g} bpm', len(cues), 'cues')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Soundtrack + sound design for the Switching TV reel, synthesized from scratch and synced to reel.html.

120 BPM, A minor -> C major. Cues (seconds) mirror the picture:
  0.0  August heat: cicadas, haze, a drone that builds        2.6  TIVI pops in (8-bit)
  3.2  TIVI's light flies to the screen                        3.62 THE SWITCH: click + sub drop, silence
  3.75 one LED pings, 3.87 scan line zips, 3.9 LEDs crackle on 4.0  the beat drops
  6.5  riser, camera dives into the screen, 7.0 whoomp         7-12 a digital swish per solution
  12-14 camera-shutter cuts (real footage)                     14.85 power-off zap, breakdown
  15.7 five stars ring                                         17.0 the beat returns, tiles pop, count-up ticks
  20.0 TIVI walks, lands, types                                22.6 riser, 23.0 logo hit on C major, 25.2 heart chirp
Usage: python3 audio.py out.wav [--nomusic]
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 26.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(42)
NOMUSIC = '--nomusic' in sys.argv
GAIN = float(next((a.split('=')[1] for a in sys.argv if a.startswith('--gain=')), '0.69'))  # ~ -14 LUFS

mus = np.zeros((2, N))   # music bus (ducked by the kick)
sfx = np.zeros((2, N))   # sound design bus
rev = np.zeros((2, N))   # reverb send


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(bus, sig, t0, gain=1.0, pan=0.0, send=0.0):
    if sig.ndim == 1:
        l, r = sig * np.sqrt((1 - pan) / 2) * np.sqrt(2), sig * np.sqrt((1 + pan) / 2) * np.sqrt(2)
        sig = np.vstack([l, r])
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    n = min(sig.shape[1], N - max(i0, 0))
    s0 = max(0, -i0)
    bus[:, max(i0, 0):max(i0, 0) + n - s0] += sig[:, s0:n] * gain
    if send:
        rev[:, max(i0, 0):max(i0, 0) + n - s0] += sig[:, s0:n] * gain * send


def filt(x, kind, f, order=2):
    f = np.clip(np.atleast_1d(f), 20, SR / 2 - 100)
    sos = butter(order, f if len(f) > 1 else f[0], btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x, axis=-1)


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    """ADSR over n samples; hold = sustain length in s (default: fill)."""
    a_, d_, r_ = int(a * SR), int(d * SR), int(r * SR)
    h_ = n - a_ - d_ - r_ if hold is None else int(hold * SR)
    h_ = max(0, h_)
    e = np.concatenate([np.linspace(0, 1, max(a_, 1)), np.linspace(1, s, max(d_, 1)), np.full(h_, s), np.linspace(s, 0, max(r_, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def saw(f, d, detune=0.0, phase=None):
    t = tt(d)
    ph = rng.random() if phase is None else phase
    return 2 * ((t * f * (1 + detune) + ph) % 1) - 1


def square(f, d, duty=0.5):
    t = tt(d)
    return np.where((t * f) % 1 < duty, 1.0, -1.0)


def sine(f, d, ph=0):
    return np.sin(2 * np.pi * f * tt(d) + ph)


def sweep_sine(f0, f1, d, curve='exp'):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d) if curve == 'exp' else f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(d):
    return rng.standard_normal(int(d * SR))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------------------------------------------------------------- drums
def kick(t0, g=1.0):
    d = 0.5; t = tt(d)
    f = 44 + 120 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)
    click = filt(noise(0.006), 'high', 2500) * np.linspace(1, 0, int(0.006 * SR))
    sig = np.tanh(1.6 * body) * 0.95
    sig[:len(click)] += click * 0.35
    place(mus, sig, t0, g)


def clap(t0, g=0.5):
    d = 0.3; x = filt(noise(d), 'band', [900, 3200])
    e = np.zeros(len(x))
    for k, o in enumerate([0, 0.011, 0.022]):
        i = int(o * SR); e[i:] += np.exp(-(tt(d)[:len(x) - i]) * (70 if k < 2 else 16))
    place(mus, x * e, t0, g, pan=0.05, send=0.25)


def hat(t0, g=0.18, open_=False, pan=0.25):
    d = 0.32 if open_ else 0.06; x = filt(noise(d), 'high', 7500)
    place(mus, x * np.exp(-tt(d) * (11 if open_ else 70)), t0, g, pan=pan)


def snare_roll(t0, t1, g=0.35):
    n = 16
    for i in range(n):
        k = i / n; t = t0 + (t1 - t0) * (1 - (1 - k) ** 1.6)
        d = 0.12; x = filt(noise(d), 'band', [1200, 6000]) * np.exp(-tt(d) * 30)
        place(mus, x, t, g * (0.3 + 0.7 * k), pan=0.1 * np.sin(i))


# ---------------------------------------------------------------- tonal
CH = {'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62]}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31}
PROG = [(4, 6, 'Am'), (6, 8, 'F'), (8, 10, 'C'), (10, 12, 'G'), (12, 14, 'Am'), (14, 15, 'F'), (15, 17, 'C'),
        (17, 19, 'Am'), (19, 21, 'F'), (21, 23, 'G'), (23, 26, 'C')]


def pad(t0, t1, notes, g=0.09, cutoff=1900, a=0.35, r=0.6):
    d = t1 - t0 + r
    x = np.zeros((2, int(d * SR)))
    for n in notes:
        for k, det in enumerate([-0.011, -0.004, 0.0, 0.005, 0.012]):
            s = saw(midi(n), d, det)
            p = (k - 2) / 2.5
            x[0] += s * np.sqrt((1 - p) / 2); x[1] += s * np.sqrt((1 + p) / 2)
    x = filt(x, 'low', cutoff) * env(x.shape[1], a, 0.3, 0.85, r, hold=t1 - t0 - a - 0.3)
    place(mus, x / 6, t0, g, send=0.35)


def bass(t0, t1, root, g=0.34):
    d = t1 - t0
    x = sine(midi(root), d) + 0.35 * np.tanh(3 * sine(midi(root), d)) + 0.12 * filt(saw(midi(root), d), 'low', 380)
    place(mus, x * env(len(x), 0.004, 0.08, 0.9, 0.05), t0, g)


def pluck(t0, n, g=0.12, pan=0.0, dark=2600):
    d = 0.32; f = midi(n)
    s = saw(f, d, 0.003) + saw(f, d, -0.003)
    bright, darkx = filt(s, 'low', dark * 2.2), filt(s, 'low', 700)
    k = np.exp(-tt(d) * 14)
    x = (bright * k + darkx * (1 - k)) * np.exp(-tt(d) * 9)
    place(mus, x * 0.5, t0, g, pan=pan, send=0.2)
    place(mus, x * 0.5, t0 + 0.375, g * 0.35, pan=-pan * 1.4 - 0.3)  # dotted-8th echo


def bell(t0, n, g=0.12, pan=0.0):
    d = 1.4; f = midi(n)
    x = sine(f, d) * np.exp(-tt(d) * 3) + 0.4 * sine(f * 2.76, d) * np.exp(-tt(d) * 6) + 0.2 * sine(f * 5.4, d) * np.exp(-tt(d) * 10)
    place(sfx, x, t0, g, pan=pan, send=0.5)


# ---------------------------------------------------------------- sound design
def chip(t0, f0, f1, d, g=0.1, pan=0.0, duty=0.5):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d)
    x = np.where((np.cumsum(f) / SR) % 1 < duty, 1.0, -1.0) * env(len(t), 0.002, d * 0.3, 0.6, d * 0.3)
    place(sfx, filt(x, 'low', 6000), t0, g, pan=pan, send=0.12)


def whoosh(t0, d=0.45, g=0.3, f0=400, f1=5000, pan=0.0):
    x = noise(d); t = tt(d)
    blocks = 24; y = np.zeros_like(x)
    for b in range(blocks):
        a, z = b * len(x) // blocks, (b + 1) * len(x) // blocks
        fc = f0 * (f1 / f0) ** (b / blocks)
        y[a:z] = filt(x[a:z], 'band', [fc * 0.6, fc * 1.6])
    e = np.sin(np.pi * t / d) ** 2
    place(sfx, y * e, t0, g, pan=pan, send=0.2)


def riser(t0, d, g=0.25):
    x = noise(d); t = tt(d); y = np.zeros_like(x)
    for b in range(32):
        a, z = b * len(x) // 32, (b + 1) * len(x) // 32
        y[a:z] = filt(x[a:z], 'band', [300 * 20 ** (b / 32), 900 * 12 ** (b / 32)])
    tone = sweep_sine(110, 880, d) * 0.25
    place(sfx, (y + tone) * (t / d) ** 2.2, t0, g, send=0.3)


def sub_drop(t0, g=0.9):
    d = 1.6; t = tt(d); f = 32 + 60 * np.exp(-t * 3.5)
    x = np.tanh(1.3 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 2.2)
    place(sfx, x, t0, g)


def switch_click(t0, g=0.5):
    x = filt(noise(0.03), 'band', [1500, 7000]) * np.exp(-tt(0.03) * 260)
    y = sine(2200, 0.02) * np.exp(-tt(0.02) * 300)
    place(sfx, x, t0, g); place(sfx, y, t0 + 0.004, g * 0.4)


def crackle(t0, t1, g=0.12, dens=260):
    n = int((t1 - t0) * dens)
    for i in range(n):
        t = t0 + (t1 - t0) * (i / n) ** 0.8 + rng.random() * 0.004
        d = 0.012; f = 1800 + 5000 * rng.random()
        x = sine(f, d) * np.exp(-tt(d) * 420)
        place(sfx, x, t, g * (0.4 + 0.6 * rng.random()), pan=rng.uniform(-0.8, 0.8))


def hum(t0, t1, g=0.12):
    d = t1 - t0; t = tt(d)
    x = saw(110, d) + 0.5 * saw(110.6, d)
    y = np.zeros_like(x)
    for b in range(20):
        a, z = b * len(x) // 20, (b + 1) * len(x) // 20
        y[a:z] = filt(x[a:z], 'low', 150 * 30 ** (b / 20))
    place(sfx, y * env(len(t), 0.2, 0.1, 1, 0.25), t0, g, send=0.15)


def zap_off(t0, g=0.35):
    d = 0.35; x = sweep_sine(1800, 60, d) * np.exp(-tt(d) * 6) + 0.3 * filt(noise(d), 'high', 3000) * np.exp(-tt(d) * 18)
    place(sfx, x, t0, g, send=0.2)


def shutter(t0, g=0.28):
    for o, gg in [(0, 1), (0.045, 0.7)]:
        x = filt(noise(0.03), 'band', [1800, 9000]) * np.exp(-tt(0.03) * 200)
        place(sfx, x, t0 + o, g * gg, pan=0.2)


def pop(t0, f=880, g=0.16):
    d = 0.09; x = sweep_sine(f * 0.6, f * 1.4, d) * np.exp(-tt(d) * 35)
    place(sfx, x, t0, g, send=0.15)


def tick(t0, g=0.05, f=3200):
    d = 0.01; place(sfx, sine(f, d) * np.exp(-tt(d) * 500), t0, g)


def cicadas(t0, t1, g=0.05):
    d = t1 - t0; t = tt(d)
    x = filt(noise(d), 'band', [4200, 6800])
    am = (0.55 + 0.45 * np.sin(2 * np.pi * 38 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t + 1))
    e = np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.08)
    place(sfx, x * am * e, t0, g, pan=0.35)
    place(sfx, filt(noise(d), 'band', [4600, 7400]) * np.roll(am, 1500) * e, t0, g * 0.8, pan=-0.45)


def heat_drone(t0, t1, g=0.1):
    d = t1 - t0; t = tt(d)
    x = sum(saw(midi(n), d, det) for n in (45, 52, 57) for det in (-0.004, 0.004))
    y = np.zeros_like(x)
    for b in range(30):
        a, z = b * len(x) // 30, (b + 1) * len(x) // 30
        y[a:z] = filt(x[a:z], 'low', 250 * 10 ** (b / 30))
    shimmer = filt(noise(d), 'band', [6000, 12000]) * 0.15
    e = np.minimum(1, t / 0.4) * (0.5 + 0.5 * t / d) * np.minimum(1, (d - t) / 0.02)
    place(sfx, (y / 6 + shimmer) * e, t0, g, send=0.3)


def glare_swell(t0, d, g=0.2):
    x = filt(noise(d), 'band', [2500, 9000]); t = tt(d)
    place(sfx, x * np.sin(np.pi * t / d) ** 1.5, t0, g, send=0.4)


# ---------------------------------------------------------------- arrangement
def beats(t0, t1, kick_on=(0, 1, 2, 3), clap_on=(1, 3), hats=True, g=1.0):
    b = t0
    while b < t1 - 1e-6:
        k = int(round((b - 0) / BEAT)) % 4
        if k in kick_on: kick(b, 0.95 * g)
        if k in clap_on: clap(b, 0.42 * g)
        if hats:
            hat(b + BEAT / 2, 0.16 * g, open_=(k % 2 == 1), pan=0.3)
            hat(b + BEAT / 4, 0.07 * g, pan=-0.3); hat(b + 3 * BEAT / 4, 0.07 * g, pan=-0.3)
        b += BEAT


def arrangement():
    # intro (music bus): nothing tonal until the switch; the heat drone lives on the sfx bus
    # groove 4.0 - 14.85
    beats(4.0, 14.85)
    beats(17.0, 20.0)
    beats(20.0, 22.5, kick_on=(0, 2), clap_on=(), g=0.8)
    snare_roll(22.5, 23.0, 0.3)
    beats(23.0, 25.5)
    kick(25.5, 1.0)
    for (a, b, ch) in PROG:
        if a >= 15 and b <= 17:
            pad(a, b, [n + 12 for n in CH[ch]], 0.1, 2400, a=0.6, r=1.2)
            bass(a, b, ROOT[ch], 0.1)
            continue
        end = min(b, 25.5) if b == 26 else b
        pad(a, end, CH[ch], 0.085, 1700 if a < 23 else 2600, r=0.9 if b < 26 else 2.2)
        # bass: pumping 8ths with the root
        tb = a
        while tb < end - 1e-6:
            if not (14.85 <= tb < 17.0):
                bass(tb + 0.02, tb + BEAT * 0.9, ROOT[ch], 0.3)
            tb += BEAT
        # pluck arpeggio (16ths), not under the breakdown or TIVI's dialogue
        if not (20.0 <= a < 22.5):
            notes = CH[ch] + [CH[ch][0] + 12, CH[ch][1] + 12]
            pat = [0, 2, 1, 3, 2, 4, 1, 3]
            tp = a; i = 0
            while tp < end - 1e-6:
                if not (14.85 <= tp < 17.0):
                    pluck(tp, notes[pat[i % 8]] + 12, 0.075, pan=0.35 * np.sin(i * 0.9))
                tp += BEAT / 2; i += 1
    # final chord ring
    pad(25.5, 26.0, [n + 12 for n in CH['C']] + [72], 0.07, 3200, a=0.01, r=1.5)


def design():
    cicadas(0.0, 3.62, 0.2)
    heat_drone(0.0, 3.62, 0.3)
    glare_swell(1.1, 1.1, 0.32)
    # TIVI
    chip(2.62, 300, 900, 0.1, 0.15)             # pops up
    chip(2.86, 700, 350, 0.08, 0.12)            # lands
    chip(2.96, 500, 1400, 0.12, 0.13, duty=0.25)  # "oh!"
    for i, n in enumerate([76, 79, 83, 88]):     # happy arpeggio + beam launch
        chip(3.16 + i * 0.035, midi(n), midi(n) * 1.01, 0.05, 0.06, duty=0.25)
    whoosh(3.2, 0.46, 0.22, 800, 6000, pan=-0.4)
    # the switch
    switch_click(3.62, 0.6); sub_drop(3.63, 0.95)
    bell(3.74, 93, 0.09)                        # a single LED pings
    whoosh(3.86, 0.16, 0.3, 3000, 12000)          # scan line
    crackle(3.9, 4.55, 0.1, 300)
    hum(3.88, 4.6, 0.09)
    # flight into the screen
    riser(6.0, 1.0, 0.22)
    whoosh(6.6, 0.42, 0.3, 300, 7000)
    sub_drop(7.0, 0.45)
    # the range: a digital swish per solution
    for k in range(5):
        whoosh(7.0 + k - 0.08, 0.26, 0.16, 1500, 9000, pan=0.5 - k * 0.25)
        crackle(7.0 + k, 7.0 + k + 0.25, 0.05, 120)
    # real footage cuts
    for k in range(3):
        shutter(12.0 + k, 0.26)
    # power off -> breakdown
    zap_off(14.86, 0.32)
    for k, n in enumerate([72, 76, 79, 84, 88]):
        bell(15.72 + k * 0.06, n, 0.07, pan=-0.5 + k * 0.25)
    # back in: headline + tiles + count-up
    whoosh(16.72, 0.3, 0.22, 500, 8000)
    for k in range(4):
        pop(17.6 + k * 0.22, 660 * 2 ** (k / 6), 0.18)
    for i in range(28):
        tick(17.6 + 0.9 * (i / 28) ** 1.3, 0.045, 2800 + i * 30)
    whoosh(19.8, 0.3, 0.2, 7000, 600)
    # TIVI walks in, lands, thinks, types
    for i in range(8):
        chip(20.0 + i * 0.11, 180 if i % 2 else 220, 150, 0.04, 0.06, pan=0.6 - i * 0.07)
    chip(20.88, 500, 250, 0.1, 0.08); chip(20.98, 250, 700, 0.12, 0.07)
    pop(21.1, 520, 0.14)
    l1, l2 = len('איזה מסך מתאים לכם?'), len('3 שאלות, ואני יודע.')
    for i in range(l1):
        chip(21.3 + 0.45 * i / l1, 900 + 180 * (i % 3), 900 + 180 * (i % 3), 0.025, 0.035, duty=0.25)
    for i in range(l2):
        chip(21.85 + 0.4 * i / l2, 760 + 160 * (i % 3), 760 + 160 * (i % 3), 0.025, 0.035, duty=0.25)
    # logo reveal + CTA
    riser(22.3, 0.7, 0.2)
    crackle(22.6, 23.2, 0.08, 220)
    sub_drop(23.0, 0.7)
    bell(23.02, 84, 0.08); bell(23.02, 88, 0.06, 0.3); bell(23.02, 91, 0.05, -0.3)
    pop(23.5, 740, 0.2)
    for i, n in enumerate([84, 88, 91, 96]):     # heart
        chip(25.2 + i * 0.06, midi(n), midi(n), 0.07, 0.05, duty=0.25)


def reverb(x, secs=2.2):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = np.vstack([rng.standard_normal(n), rng.standard_normal(n)]) * np.exp(-t * 3.2)
    ir = filt(ir, 'low', 6000); ir[:, :int(0.012 * SR)] = 0
    y = np.vstack([fftconvolve(x[0], ir[0])[:N], fftconvolve(x[1], ir[1])[:N]])
    return y / np.max(np.abs(ir).sum(axis=1)) * 25


if not NOMUSIC:
    arrangement()
design()

# sidechain: duck the music bus on every kick
duck = np.ones(N)
for b in np.arange(4.0, 25.5, BEAT):
    if 14.85 <= b < 17.0 or (20.0 <= b < 22.5 and int(round(b / BEAT)) % 2):
        continue
    i = int(b * SR); n = int(0.22 * SR)
    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / SR * 14))
mix = mus * duck + sfx + reverb(rev) * 0.22
mix = filt(mix, 'high', 28)
# gentle bus glue + limiter
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
peak = np.max(np.abs(mix))
REF = next((float(a.split('=')[1]) for a in sys.argv if a.startswith('--ref-peak=')), None)
if REF: peak = REF  # keep the SFX-only stem at the same level as in the full mix
mix = mix / peak * 0.89 * GAIN
# fade the very end
f = int(0.35 * SR); mix[:, -f:] *= np.linspace(1, 0, f) ** 1.5
out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'work/track.wav'
from scipy.io import wavfile
wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
print('wrote', out, f'{DUR}s', 'peak', round(float(peak), 3))

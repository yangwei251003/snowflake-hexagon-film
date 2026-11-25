"""Render the action-only stereo mix and its frame-aligned cue sheet."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np


PROJECT = Path(__file__).resolve().parents[1]
SR = 48_000
ENGINE_HASH = "02dbe98edab5cbcf2b626db0c661ddab0410a9bfa33b54279f7b7c0ebf32ceb1"


def write_wav(path, samples):
    with wave.open(str(path), "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(SR)
        file.writeframes(samples.astype("<i2", copy=False).tobytes())


def load_synth(original):
    if hashlib.sha256(original.read_bytes()).hexdigest() != ENGINE_HASH:
        raise ValueError("Author engine changed since provenance verification")
    spec = importlib.util.spec_from_file_location("verified_vibe_original", original)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def shutter_sample(recording):
    command = ["ffmpeg", "-nostdin", "-v", "error", "-i", str(recording),
               "-ac", "2", "-ar", str(SR), "-f", "f32le", "pipe:1"]
    source = np.frombuffer(subprocess.check_output(command), dtype="<f4").reshape(-1, 2).astype(np.float64)
    step = SR // 200
    energy = (source[:len(source) // step * step] ** 2).reshape(-1, step * 2).mean(axis=1)
    first = int(np.flatnonzero(energy >= energy.max() * 0.14)[0])
    strongest = first + int(np.argmax(energy[first:first + 6]))
    peak = strongest * step + step // 2
    start = max(0, (first - 1) * step)
    sample = source[start:min(len(source), peak + int(0.23 * SR))].copy()
    sample *= np.minimum(1, np.arange(len(sample)) / (0.004 * SR))[:, None]
    tail = int(0.081 * SR)
    sample[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 1.65
    sample *= 0.275 / np.max(np.abs(sample))
    return sample, peak - start, start, peak


def timecode(seconds, fps):
    total = round(seconds * fps)
    frames = total % fps
    minutes, whole = divmod(total // fps, 60)
    return f"00:{minutes:02d}:{whole:02d}:{frames:02d}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", type=Path, required=True, help="Compatible original film.py")
    parser.add_argument("--shutter", type=Path, required=True, help="Fission9 CC0 shutter recording")
    args = parser.parse_args()
    timeline = json.loads((PROJECT / "source/timeline.json").read_text(encoding="utf-8"))
    count = round(timeline["duration"] * SR)
    cue_sheet = timeline["cues"]
    synth = load_synth(args.engine)
    synth.T = timeline["duration"]
    synth.SFX = []
    for cue in cue_sheet:
        at = cue["at"] - cue.get("advance", 0)
        gain = cue["gain"] * (0.55 if cue["kind"] == "shutter" else 1)
        synth.SFX.append((at, cue["kind"], gain))
    scratch = (PROJECT / "qa").resolve()
    if scratch.parent != PROJECT.resolve():
        raise RuntimeError("Invalid scratch path")
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="action-mix-", dir=scratch) as temporary:
        temp = Path(temporary)
        silence = temp / "timing.wav"
        rendered = temp / "original-synth.wav"
        write_wav(silence, np.zeros((count, 2), dtype=np.int16))
        synth.audio(str(silence), str(rendered))
        with wave.open(str(rendered), "rb") as file:
            assert file.getnframes() == count and file.getframerate() == SR and file.getnchannels() == 2
            mix = np.frombuffer(file.readframes(count), dtype="<i2").reshape(-1, 2).astype(np.float64) / 32768

    shutter, transient, source_in, source_peak = shutter_sample(args.shutter)
    shutter_at = next(cue["at"] for cue in cue_sheet if cue["kind"] == "shutter")
    placement = round(shutter_at * SR) - transient
    mix[placement:placement + len(shutter)] += shutter
    gain = min(1.1, 10 ** (-6.5 / 20) / np.max(np.abs(mix)))
    mix *= gain
    mix[-7200:] *= np.linspace(1, 0, 7200)[:, None]
    destination = scratch / "action-sfx.wav"
    write_wav(destination, np.round(mix * 32767))
    report = {
        "path": destination.name, "format": "48 kHz stereo PCM16", "start_seconds": 0,
        "sample_count": count, "duration_seconds": count / SR, "synthesis_engine_sha256": ENGINE_HASH,
        "synthesis_events": len(synth.SFX), "sample_peak_dbfs": round(20 * np.log10(np.abs(mix).max()), 2),
        "music": False, "recorded_shutter": {
            "source": "https://freesound.org/people/Fission9/sounds/693869/",
            "license": "CC0-1.0", "source_kind": "public MP3 preview", "author": "Fission9",
            "sha256": hashlib.sha256(recording.read_bytes()).hexdigest(),
            "source_trim_in_seconds": source_in / SR,
            "source_transient_seconds": source_peak / SR,
            "output_placement_seconds": placement / SR,
            "output_transient_seconds": (placement + transient) / SR
        }
    }
    (PROJECT / "qa/audio-mix.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# 《雪花为什么有六个角》画面切点与动作音效", "",
        "横屏 1920×1080，30 fps，片长 54 秒。独立立体声音效轨从 00:00:00:00 开始，长度与成片一致。配乐轨由你后期添加。",
        "", "## 画面切点", "", "| 时间码 | 秒 | 画面 |", "|---|---:|---|",
    ]
    fps = timeline["fps"]
    for shot in timeline["shots"]:
        start = shot["in"]
        lines.append(f"| {timecode(start, fps)} | {start:.2f} | {shot['title']} |")
    lines += ["", "## 配乐时可参考的动作重音", "", "| 时间码 | 秒 | 动作 |", "|---|---:|---|"]
    cues = [
        (3.10, "冰晶翻到正面，六个尖端亮起"),
        (5.20, "推进中心，切到俯视晶格"),
        (9.67, "六个方向依次点亮。间隔 0.23 秒"),
        (11.40, "60° 弧线亮出"),
        (14.20, "晶格缩到中心，出现小冰晶"),
        (15.46, "水汽靠近晶核"),
        (17.84, "主枝向外延伸"),
        (19.30, "侧枝分生"),
        (23.70, "转入整枚枝晶"),
        (26.65, "同一层水汽包围冰晶，六枝同步生长"),
        (32.40, "换到两条云中路径"),
        (35.90, "较暖路径上针晶拉伸"),
        (36.64, "较冷路径上枝晶展开"),
        (43.70, "快门切到班特利显微照片"),
        (49.45, "片尾答案开始出现")
    ]
    for at, label in cues:
        lines.append(f"| {timecode(at, fps)} | {at:.2f} | {label} |")
    lines += ["", "秒数为设计动作时刻。时间码四舍五入到最接近的帧，转场气流声从动作前起音。", ""]
    (scratch / "timecodes.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

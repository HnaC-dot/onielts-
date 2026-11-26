#!/usr/bin/env python3
"""
Generate real multi-speaker neural English MP3 audio files for all 12 IELTS Listening sections
(3 full 40-question Listening tests x 4 parts) into public/audio/listening/.

Reads audioScript + audioUrl directly from src/lib/tests-data/listening-tests.ts,
assigns distinct natural British / Australian / American neural voices per speaker role,
adds realistic 0.55s conversational pauses, and encodes clean 48kbps mono MP3 via ffmpeg.
"""
import asyncio
import os
import re
import shutil
import subprocess
import tempfile
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS_FILE = os.path.join(ROOT, "src", "lib", "tests-data", "listening-tests.ts")
OUT_DIR = os.path.join(ROOT, "public", "audio", "listening")

SPEAKER_VOICES = {
    "Receptionist": "en-GB-SoniaNeural",
    "Visitor": "en-GB-RyanNeural",
    "Guide": "en-AU-NatashaNeural",
    "Tutor": "en-GB-LibbyNeural",
    "Student": "en-GB-ThomasNeural",
    "Lecturer": "en-GB-RyanNeural",
    "Coordinator": "en-GB-SoniaNeural",
    "Applicant": "en-US-GuyNeural",
    "Engineer": "en-AU-WilliamNeural",
    "Maya": "en-GB-LibbyNeural",
    "Liam": "en-AU-WilliamNeural",
    "Librarian": "en-US-JennyNeural",
    "Technician": "en-GB-SoniaNeural",
    "Lan": "en-GB-LibbyNeural",
    "Minh": "en-US-GuyNeural",
}

PART_DEFAULT_VOICE = {
    "l1-part4.mp3": "en-GB-RyanNeural",
    "l2-part4.mp3": "en-GB-ThomasNeural",
    "l3-part4.mp3": "en-AU-NatashaNeural",
}


def parse_sections():
    with open(TS_FILE, "r", encoding="utf-8") as f:
        text = f.read()
    pattern = re.compile(
        r'audioUrl:\s*"(/audio/listening/[^"]+\.mp3)",\s*audioScript:\s*`([^`]+)`',
        re.DOTALL,
    )
    return pattern.findall(text)


SEM = asyncio.Semaphore(4)


async def synth_segment(text: str, voice: str, out_path: str):
    for attempt in range(4):
        try:
            async with SEM:
                comm = edge_tts.Communicate(text, voice, rate="-3%")
                await comm.save(out_path)
            return
        except Exception:
            if attempt == 3:
                raise
            await asyncio.sleep(1.0 + attempt)


async def build_part_mp3(audio_url: str, script: str):
    filename = os.path.basename(audio_url)
    dest = os.path.join(OUT_DIR, filename)
    if os.path.exists(dest) and os.path.getsize(dest) > 50_000:
        print(f"Skipping existing {filename} ({os.path.getsize(dest) / 1024:.1f} KB)")
        return
    default_voice = PART_DEFAULT_VOICE.get(filename, "en-GB-SoniaNeural")

    paragraphs = [p.strip() for p in re.split(r"\n\n+", script.strip()) if p.strip()]
    tmpdir = tempfile.mkdtemp(prefix=f"ielts_{filename}_")
    try:
        silence_file = os.path.join(tmpdir, "pause.mp3")
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                "-t", "0.55", "-c:a", "libmp3lame", "-b:a", "48k", silence_file,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        tasks = []
        seg_files = []
        for idx, para in enumerate(paragraphs):
            m = re.match(r"^([A-Za-z]+):\s*(.+)$", para, re.DOTALL)
            if m:
                speaker, spoken = m.group(1), m.group(2).strip()
                voice = SPEAKER_VOICES.get(speaker, default_voice)
                if filename in PART_DEFAULT_VOICE and speaker == "Lecturer":
                    voice = PART_DEFAULT_VOICE[filename]
            else:
                spoken = para
                voice = default_voice

            seg_path = os.path.join(tmpdir, f"seg_{idx:02d}.mp3")
            seg_files.append(seg_path)
            tasks.append(synth_segment(spoken, voice, seg_path))

        await asyncio.gather(*tasks)

        concat_list = os.path.join(tmpdir, "list.txt")
        with open(concat_list, "w", encoding="utf-8") as f:
            for i, sp in enumerate(seg_files):
                f.write(f"file '{sp}'\n")
                if i < len(seg_files) - 1:
                    f.write(f"file '{silence_file}'\n")

        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
                "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", dest,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        size_kb = os.path.getsize(dest) / 1024
        print(f"Generated {filename} ({len(seg_files)} turns, {size_kb:.1f} KB)")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sections = parse_sections()
    assert len(sections) == 12, f"Expected 12 listening sections, found {len(sections)}"
    for url, script in sections:
        await build_part_mp3(url, script)
    print("All 12 IELTS Listening MP3 files generated successfully!")


if __name__ == "__main__":
    asyncio.run(main())

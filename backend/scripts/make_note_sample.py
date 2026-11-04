"""Draw a synthetic doctor's note for testing "Add from a photo of the doctor's paper". The person, clinic and doctor are fictional.

Run from backend/:  uv run python scripts/make_note_sample.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

from make_samples import OUT, font

LINES = [
    ("Sunrise Community Clinic", 44, True),
    ("Dr. K. Meera (fictional)  |  SAMPLE, NOT A REAL PERSON", 28, False),
    ("", 20, False),
    ("Patient: Asha R. (fictional), 64 / F          Date: 02-11-2026", 30, False),
    ("Advice after hospital stay for high blood sugar and BP", 32, True),
    ("Follow this for 1 month.", 32, False),
    ("", 20, False),
    ("Medicines", 34, True),
    ("Tab. Metformin 500 mg      1-0-1   after food", 32, False),
    ("Tab. Amlodipine 5 mg       0-0-1", 32, False),
    ("Tab. Vitamin D3 60000 IU   once a week for 8 weeks, Sunday morning", 28, False),
    ("", 20, False),
    ("Food", 34, True),
    ("No added salt. No sugary drinks. More vegetables at each meal.", 30, False),
    ("", 20, False),
    ("Exercise", 34, True),
    ("Walk 30 minutes every morning.", 30, False),
    ("", 20, False),
    ("Check", 34, True),
    ("Check BP and sugar every morning and write them down.", 30, False),
    ("", 20, False),
    ("Avoid / watch for", 34, True),
    ("Avoid smoking and alcohol. Report dizziness or swelling in the legs.", 30, False),
    ("", 20, False),
    ("Review after 1 month with reports.", 32, True),
]


def main() -> None:
    img = Image.new("RGB", (1200, 1300), "#fdfcf7")
    draw = ImageDraw.Draw(img)
    y = 50
    for text, size, bold in LINES:
        if text:
            draw.text((60, y), text, font=font(size, bold), fill="#16202b")
        y += size + 16
    out = Path(OUT) / "doctor_note.png"
    img.save(out, optimize=True)
    print("wrote", out, img.size, "last line at", y)


if __name__ == "__main__":
    main()

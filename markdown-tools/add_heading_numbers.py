#!/usr/bin/env python3
import re
import sys
from pathlib import Path


def add_numbers(text: str) -> str:
    lines = text.splitlines()
    counters = [0] * 7  # indices 1..6 used for heading levels
    in_code_block = False

    code_fence_re = re.compile(r"^\s*```")
    heading_re = re.compile(r"^(#{1,6})\s+(.*)$")
    number_prefix_re = re.compile(r"^\s*\d+(?:\.\d+)*(?:[.)、])?\s+")

    result = []
    for line in lines:
        if code_fence_re.match(line):
            in_code_block = not in_code_block
            result.append(line)
            continue

        if in_code_block:
            result.append(line)
            continue

        m = heading_re.match(line)
        if m:
            hashes, title = m.groups()
            level = len(hashes)

            # Strip existing decimal numbering prefixes if present
            title = re.sub(number_prefix_re, "", title).strip()

            # Update counters
            counters[level] += 1
            for i in range(level + 1, 7):
                counters[i] = 0

            # Build hierarchical number string (e.g., 1.2.3)
            number_str = ".".join(str(counters[i]) for i in range(1, level + 1))
            result.append(f"{hashes} {number_str} {title}")
        else:
            result.append(line)

    return "\n".join(result) + "\n"


def main():
    if len(sys.argv) < 2:
        print("Usage: add_heading_numbers.py <markdown-file>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    text = path.read_text(encoding="utf-8")
    new_text = add_numbers(text)
    path.write_text(new_text, encoding="utf-8")


if __name__ == "__main__":
    main()
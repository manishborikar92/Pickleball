import os
import re
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LINK_REGEX = re.compile(r"\[.*?\]\(([^)]+)\)")

ABS_PATTERNS = [
    re.compile(r"file:///", re.IGNORECASE),
    re.compile(r"\b[c-z]:(?:[\\/][^/]|[\\/]$)", re.IGNORECASE),
    re.compile(r"users/manis", re.IGNORECASE),
    re.compile(r"projects/pickleball", re.IGNORECASE),
]

OLD_PATTERNS = [
    re.compile(r"docs/ai/", re.IGNORECASE),
    re.compile(r"docs/ai/api/", re.IGNORECASE),
]

def check_file(file_path):
    rel_file = os.path.relpath(file_path, ROOT_DIR).replace("\\", "/")
    print(f"Validating: {rel_file}")
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        lines = content.splitlines()

    errors = []

    # Check for absolute patterns
    for pattern in ABS_PATTERNS:
        for idx, line in enumerate(lines):
            if pattern.search(line):
                errors.append(f"Line {idx+1}: Found absolute/local pattern matching {pattern.pattern} in line: '{line.strip()}'")

    # Check for old/deprecated path references
    for pattern in OLD_PATTERNS:
        for idx, line in enumerate(lines):
            if pattern.search(line):
                # Ignore self mentions in report or archive folders
                if "reports/" in rel_file or "archive/" in rel_file:
                    continue
                errors.append(f"Line {idx+1}: Found reference to legacy docs/ai/ in: '{line.strip()}'")

    # Find all links
    links = LINK_REGEX.findall(content)
    for link in links:
        # Skip external links and page anchors
        if link.startswith(("http://", "https://", "mailto:", "#")):
            continue
            
        # Parse anchor if present
        target_link = link
        if "#" in target_link:
            target_link = target_link.split("#", 1)[0]
            
        if not target_link:
            continue

        # Resolve target relative to the source file
        source_dir = os.path.dirname(os.path.abspath(file_path))
        target_abs = os.path.abspath(os.path.join(source_dir, target_link))
        
        # Check if file exists
        if not os.path.exists(target_abs):
            errors.append(f"Broken link: '{link}' (Resolved to: {target_abs})")
            
        # Check if link references docs/ai/ or lowercase names
        target_rel = os.path.relpath(target_abs, ROOT_DIR).replace("\\", "/")
        if "docs/ai" in target_rel.lower():
            if "reports/" not in rel_file and "archive/" not in rel_file:
                errors.append(f"Link points to legacy docs/ai: '{link}'")

    return errors

def run():
    target_dirs = ["docs/product", "docs/architecture", "docs/operations", "docs/adrs"]
    target_files = ["llms.txt", "README.md", "docs/00-INDEX.md", "docs/README.md", "server/README.md", "web/README.md"]

    all_errors = {}

    for d in target_dirs:
        abs_dir = os.path.join(ROOT_DIR, d)
        if not os.path.exists(abs_dir):
            continue
        for root, _, files in os.walk(abs_dir):
            if "documentation-migration" in root:
                continue
            for file in files:
                if file.endswith(".md"):
                    path = os.path.join(root, file)
                    errs = check_file(path)
                    if errs:
                        all_errors[os.path.relpath(path, ROOT_DIR)] = errs

    for f in target_files:
        abs_file = os.path.join(ROOT_DIR, f)
        if os.path.exists(abs_file):
            errs = check_file(abs_file)
            if errs:
                all_errors[f] = errs

    if all_errors:
        print("\n=== VALIDATION FAILED ===")
        for file, errs in all_errors.items():
            print(f"\nFile: {file}")
            for err in errs:
                print(f"  - {err}")
        sys.exit(1)
    else:
        print("\n=== VALIDATION PASSED: All links and patterns are valid! ===")
        sys.exit(0)

if __name__ == "__main__":
    run()

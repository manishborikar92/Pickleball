import os
import re

# Root directory of the repository
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# File mapping from old paths (relative to ROOT_DIR) to new paths (relative to ROOT_DIR)
# Lowercase names are handled.
MAPPING = {
    # Product
    "docs/01-PROJECT-OVERVIEW.md": "docs/product/01-PROJECT-OVERVIEW.md",
    "docs/ai/01-PROJECT-CONTEXT.md": "docs/product/02-PROJECT-CONTEXT.md",
    "docs/04-BUSINESS-LOGIC.md": "docs/product/03-BUSINESS-LOGIC.md",
    "docs/05-UI-UX-SPECIFICATION.md": "docs/product/04-UI-UX-SPECIFICATION.md",
    "docs/10-COSTING-ANALYSIS.md": "docs/product/05-COSTING-ANALYSIS.md",
    "docs/11-FUTURE-WORK.md": "docs/product/06-FUTURE-WORK.md",

    # Architecture
    "docs/ai/02-ARCHITECTURE.md": "docs/architecture/01-SYSTEM-DESIGN.md",
    "docs/03-DATABASE-SCHEMA.md": "docs/architecture/02-DATABASE-SCHEMA.md",
    "docs/ai/04-DATABASE.md": "docs/architecture/03-DATABASE-MODEL.md",
    "docs/ai/06-FRONTEND.md": "docs/architecture/04-FRONTEND.md",
    "docs/ai/07-BACKEND.md": "docs/architecture/05-BACKEND.md",
    "docs/ai/03-BUSINESS-RULES.md": "docs/architecture/06-BUSINESS-RULES.md",
    "docs/07-WHATSAPP-INTEGRATION.md": "docs/architecture/07-INTEGRATIONS.md",
    "docs/08-PAYMENT-INTEGRATION.md": "docs/architecture/07-INTEGRATIONS.md",
    "docs/ai/08-INTEGRATIONS.md": "docs/architecture/07-INTEGRATIONS.md",

    # API Directory
    "docs/ai/05-API/00-INDEX.md": "docs/architecture/api/00-INDEX.md",
    "docs/ai/05-API/01-AUTH.md": "docs/architecture/api/01-AUTH.md",
    "docs/ai/05-API/02-USERS.md": "docs/architecture/api/02-USERS.md",
    "docs/ai/05-API/03-BOOKINGS.md": "docs/architecture/api/03-BOOKINGS.md",
    "docs/ai/05-API/04-PAYMENTS.md": "docs/architecture/api/04-PAYMENTS.md",
    "docs/ai/05-API/05-ADMIN.md": "docs/architecture/api/05-ADMIN.md",

    # Operations
    "docs/ai/09-DEVELOPMENT-GUIDE.md": "docs/operations/01-DEVELOPMENT-GUIDE.md",
    "docs/02-SETUP-GUIDE.md": "docs/operations/02-INFRASTRUCTURE-SETUP.md",
    "docs/ai/14-MAINTENANCE-RULES.md": "docs/operations/03-MAINTENANCE-RULES.md",
    "docs/ai/10-IMPLEMENTATION-STATUS.md": "docs/operations/04-IMPLEMENTATION-STATUS.md",
    "docs/ai/11-ACTIVE-ISSUES.md": "docs/operations/05-ACTIVE-ISSUES.md",
    "docs/ai/12-TECHNICAL-DEBT-AND-DEFERRED-WORK.md": "docs/operations/06-TECHNICAL-DEBT.md",

    # ADRs
    "docs/ai/13-DECISION-HISTORY.md": "docs/adrs/00-INDEX.md",
    "docs/adrs/ADR-001-postgresql-prisma.md": "docs/adrs/ADR-001-postgresql-prisma.md",
    "docs/adrs/ADR-002-refresh-token-sessions.md": "docs/adrs/ADR-002-refresh-token-sessions.md",
    "docs/adrs/ADR-003-otp-provider-abstraction.md": "docs/adrs/ADR-003-otp-provider-abstraction.md",

    # Indices & Reports
    "docs/00-INDEX.md": "docs/00-INDEX.md",
    "docs/adrs/00-INDEX.md": "docs/adrs/00-INDEX.md",
    "docs/README.md": "docs/README.md",
    "llms.txt": "llms.txt",
    "README.md": "README.md",
    "docs/reports/DOCUMENTATION-MIGRATION-REPORT.md": "docs/reports/DOCUMENTATION-MIGRATION-REPORT.md",
}

# Old directories to redirect
DIR_MAPPING = {
    "docs/ai/05-API": "docs/architecture/api",
    "docs/ai/api": "docs/architecture/api",
}

# Regex to find markdown links: [text](link)
# We support links with optional anchors, e.g., [Database Model](../ai/04-DATABASE.md#L12)
LINK_REGEX = re.compile(r"(\[.*?\]\()([^)]+)(\))")

def resolve_target(source_file, link_path):
    """
    Given a source file path and a link path found inside it,
    resolves the link path to the new structure.
    Returns the updated link path, or None if it shouldn't be changed.
    """
    # Exclude external links
    if link_path.startswith(("http://", "https://", "mailto:", "#")):
        return None

    # Parse anchor if present
    anchor = ""
    if "#" in link_path:
        link_path, anchor = link_path.split("#", 1)
        anchor = "#" + anchor

    # Find the old location of the source file
    source_rel = os.path.relpath(os.path.abspath(source_file), ROOT_DIR).replace("\\", "/")
    old_source_rel = None
    for old_key, new_value in MAPPING.items():
        if new_value.lower() == source_rel.lower():
            old_source_rel = old_key
            break
            
    if old_source_rel is None:
        old_source_rel = source_rel

    # Calculate absolute path of the target as referenced by the original source file
    old_source_abs = os.path.join(ROOT_DIR, old_source_rel)
    old_source_dir = os.path.dirname(old_source_abs)
    target_abs = os.path.abspath(os.path.join(old_source_dir, link_path))
    
    # Target path relative to ROOT_DIR
    target_rel = os.path.relpath(target_abs, ROOT_DIR).replace("\\", "/")

    # Check for direct file mapping
    # Handle lowercase or variations
    mapped_target = None
    
    # Try case insensitive mapping
    for old_key, new_value in MAPPING.items():
        if old_key.lower() == target_rel.lower():
            mapped_target = new_value
            break

    # If not mapped, check directory mapping
    if not mapped_target:
        for old_dir, new_dir in DIR_MAPPING.items():
            if target_rel.lower().startswith(old_dir.lower()):
                suffix = target_rel[len(old_dir):]
                mapped_target = new_dir + suffix
                break

    # If it maps to docs/ai/00-INDEX.md, redirect to docs/README.md
    if target_rel.lower() == "docs/ai/00-index.md":
        mapped_target = "docs/README.md"

    if not mapped_target:
        # If the file already exists in the new path or hasn't changed, return relative path to it
        if os.path.exists(target_abs):
            return None
        return None

    # Compute new relative path from source_file's new location to mapped_target
    source_rel_mapped = None
    for old_key, new_value in MAPPING.items():
        if os.path.abspath(os.path.join(ROOT_DIR, old_key)) == os.path.abspath(source_file) or \
           os.path.abspath(os.path.join(ROOT_DIR, new_value)) == os.path.abspath(source_file):
            source_rel_mapped = new_value
            break
            
    if not source_rel_mapped:
        # If source file is not in mapping (e.g. server/README.md), use its current location
        source_rel_mapped = os.path.relpath(os.path.abspath(source_file), ROOT_DIR).replace("\\", "/")

    source_dir_mapped_abs = os.path.dirname(os.path.abspath(os.path.join(ROOT_DIR, source_rel_mapped)))
    target_mapped_abs = os.path.abspath(os.path.join(ROOT_DIR, mapped_target))

    new_rel_path = os.path.relpath(target_mapped_abs, source_dir_mapped_abs).replace("\\", "/")
    return new_rel_path + anchor

def process_file(file_path):
    print(f"Processing links in: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    def replace_link(match):
        prefix, link_path, suffix = match.groups()
        new_link = resolve_target(file_path, link_path)
        if new_link:
            # Clean up file:/// references or absolute paths
            if "file:///" in new_link:
                new_link = new_link.replace("file:///", "")
            print(f"  Updated: {link_path} -> {new_link}")
            return f"{prefix}{new_link}{suffix}"
        return match.group(0)

    new_content = LINK_REGEX.sub(replace_link, content)
    
    # Strip absolute workspace rules/links if any slips in
    # Replace file:///C:/Users/manis/Projects/Pickleball/ with relative paths if any
    new_content = re.sub(r"file:///c:/Users/manis/Projects/Pickleball/", "", new_content, flags=re.IGNORECASE)
    
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Saved updates to {file_path}")

def run():
    target_dirs = ["docs/product", "docs/architecture", "docs/operations", "docs/adrs"]
    target_files = ["llms.txt", "README.md", "docs/00-INDEX.md", "docs/README.md", "server/README.md", "web/README.md"]

    for d in target_dirs:
        abs_dir = os.path.join(ROOT_DIR, d)
        if not os.path.exists(abs_dir):
            continue
        for root, _, files in os.walk(abs_dir):
            # Skip documentation-migration folder itself
            if "documentation-migration" in root:
                continue
            for file in files:
                if file.endswith(".md"):
                    process_file(os.path.join(root, file))

    for f in target_files:
        abs_file = os.path.join(ROOT_DIR, f)
        if os.path.exists(abs_file):
            process_file(abs_file)

if __name__ == "__main__":
    run()

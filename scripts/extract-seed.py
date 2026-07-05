import zipfile
import os

zip_path = '/tmp/gbrain-seed.zip'
extract_dir = '/usr/src/gbrain-seed'

print(f"📦 Extracting {zip_path} to {extract_dir}...")

with zipfile.ZipFile(zip_path, 'r') as zf:
    for m in zf.infolist():
        # Convert Windows backslashes in ZIP paths to Unix forward slashes
        m.filename = m.filename.replace('\\', '/')
        
        # Determine clean permissions
        is_directory = m.is_dir() or m.filename.endswith('/')
        perm = 0o755 if is_directory else 0o644
        m.external_attr = perm << 16
        
        zf.extract(m, extract_dir)

print("✅ Extraction complete.")

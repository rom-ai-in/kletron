
import os
from typing import List, Dict, Optional

def list_files(directory: str = ".") -> List[str]:
    """
    List files in a directory recursively.
    """
    if not directory:
        directory = "."
    file_list = []
    for root, _, files in os.walk(directory):
        if ".git" in root or "__pycache__" in root or "venv" in root:
            continue
        for file in files:
            if file == ".DS_Store":
                continue
            file_list.append(os.path.join(root, file))
    return file_list

def read_file(file_path: str) -> str:
    """Read the content of a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file {file_path}: {str(e)}"

def write_file(file_path: str, content: str) -> str:
    """Write content to a file."""
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Successfully wrote to {file_path}"
    except Exception as e:
        return f"Error writing to file {file_path}: {str(e)}"

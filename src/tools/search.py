import subprocess
import os

def grep_search(query: str, path: str = ".") -> str:
    """
    Search for a string in files using grep.
    """
    try:
        # -r: recursive
        # -n: line number
        # -I: ignore binary
        command = f"grep -rnI \"{query}\" {path}"
        
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
             # Limit output to 2000 chars to avoid overflowing context
            output = result.stdout
            if len(output) > 2000:
                output = output[:2000] + "\n... (truncated)"
            return output
        elif result.returncode == 1:
            return "No matches found."
        else:
            return f"Error searching: {result.stderr}"
            
    except Exception as e:
        return f"Error executing grep: {str(e)}"

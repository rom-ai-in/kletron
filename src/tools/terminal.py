import subprocess
import shlex
from typing import Tuple

FORBIDDEN_COMMANDS = ["rm -rf /", "mkfs", ":(){:|:&};:"]

def run_command(command: str) -> str:
    """
    Run a shell command and return its output.
    """
    # Basic safety check
    for forbidden in FORBIDDEN_COMMANDS:
        if forbidden in command:
            return f"Error: Command '{command}' is forbidden for safety reasons."
    
    try:
        # Split command for subprocess provided it's safeish
        # For broader compatibility we might use shell=True but let's try to be safer
        # However, for complex pipes/redirects, shell=True is needed.
        # Given this is a local agent for a dev, shell=True is acceptable with the forbidden list.
        
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60  # 1 minute timeout
        )
        
        output = result.stdout
        if result.stderr:
            output += f"\nSTDERR:\n{result.stderr}"
            
        return output if output else "(No output)"
        
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 60 seconds."
    except Exception as e:
        return f"Error executing command: {str(e)}"

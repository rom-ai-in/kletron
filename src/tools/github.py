import requests
import base64

def read_github_file(owner: str, repo: str, path: str) -> str:
    """
    Read a file directly from a public GitHub repository.
    Usage: read_github_file("facebook", "react", "package.json")
    """
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            if "content" in data:
                content = base64.b64decode(data["content"]).decode('utf-8')
                return content
            return "Error: File content not found in response."
        elif response.status_code == 404:
            return f"Error: File not found in {owner}/{repo}/{path}"
        elif response.status_code == 403:
            return "Error: Rate limit exceeded or private repo (API Key required)."
        else:
            return f"Error accessing GitHub API: {response.status_code}"
            
    except Exception as e:
        return f"Error executing GitHub request: {str(e)}"

def search_github_code(query: str, owner: str, repo: str) -> str:
    """
    Search for code in a GitHub repository.
    Usage: search_github_code("auth", "facebook", "react")
    """
    try:
        # GitHub Code Search API requires specific headers and authorized request usually, 
        # but public repos might work with rate limits.
        url = f"https://api.github.com/search/code?q={query}+repo:{owner}/{repo}"
        headers = {"Accept": "application/vnd.github.v3+json"}
        # Note: Unauthenticated search has low rate limits (10/min). 
        # Ideally we use an API token if available in env.
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            if not items:
                return "No results found."
            
            results = []
            for item in items[:5]: # Limit to top 5
                results.append(f"File: {item['path']}\nUrl: {item['html_url']}")
            return "\n\n".join(results)
        elif response.status_code == 403:
             return "Error: Rate limit exceeded or private repo. Need GITHUB_TOKEN."
        else:
            return f"Error searching GitHub: {response.status_code}"
    except Exception as e:
        return f"Error executing search: {str(e)}"

def list_github_files(owner: str, repo: str, path: str = "") -> str:
    """
    List files in a GitHub repository directory.
    Usage: list_github_files("facebook", "react", "packages")
    """
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                files = [f"{item['type']}: {item['path']}" for item in data]
                return "\n".join(files)
            else:
                return f"Path is a file, not a directory. Name: {data.get('name')}"
        else:
            return f"Error listing files: {response.status_code}"
    except Exception as e:
        return f"Error executing list files: {str(e)}"

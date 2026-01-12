# Numezis Code

This repository contains a sophisticated Multi-Agent System designed for automated software engineering, powered by **LangGraph** and **Azure OpenAI**.

## Architecture

The system consists of specialized agents collaborating to solve coding tasks:

-   **Planner**: Breaks down complex user requests into executable steps.
-   **Coder**: Writes code and manipulates the filesystem.
-   **Reviewer**: Validates the implementation against the plan.
-   **Supervisor**: Orchestrates the workflow and routes tasks.

## Setup

1.  **Environment**:
    Ensure you have a `.env` file with your Azure OpenAI credentials:
    ```bash
    AZURE_OPENAI_API_KEY=...
    AZURE_OPENAI_ENDPOINT=...
    AZURE_OPENAI_DEPLOYMENT=...
    AZURE_OPENAI_API_VERSION=...
    ```

2.  **Install**:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run**:
    Import the compiled graph from `graph.py` to use in your application.

## Directory Structure
-   `src/agents/`: Agent implementations.
-   `src/tools/`: System capabilities (File I/O, Search).
-   `src/state.py`: Shared state definition.

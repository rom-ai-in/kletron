"""Kletron governance — documents (does not change) the pre_tool_call failure semantics.

Measured on the upstream base (2026-11-05):
- a validating callback that RAISES or TIMES OUT -> the tool is BLOCKED (fail-closed, per callback,
  hermes_cli/plugins_dispatch.py: _HOOK_TIMEOUT_FAIL_CLOSED_HOOKS);
- the hook PIPELINE itself raising (import error, dispatcher bug) -> the tool RUNS (fail-open,
  agent/agent_runtime_helpers.py::_pre_tool_block_message: "failures never block");
- the validating plugin NOT LOADED (not in plugins.enabled, failed to import) -> the tool RUNS.
Kletron managed mode must therefore check that its validator is loaded (presence) and not rely on
the outer helper. Proposal: kletron/planned/0005-approvals-panel.md (§ fail-closed). If upstream changes any of
these semantics, these tests fail on purpose: re-read the proposal.
"""
from __future__ import annotations

import pytest

from agent import agent_runtime_helpers as h
from hermes_cli import lifecycle
from hermes_cli.plugins import PluginManager


class _Agent:
    session_id = "s"
    _current_turn_id = "t"
    _current_api_request_id = "r"


def _verdict():
    return h._pre_tool_block_message(_Agent(), "terminal", {"command": "rm -rf /"}, "task", "call", [])


@pytest.fixture
def manager(monkeypatch):
    mgr = PluginManager()
    monkeypatch.setattr(lifecycle, "invoke_hook", lambda name, **kw: mgr.invoke_hook(name, **kw))
    return mgr


def test_control_a_valid_veto_blocks(manager):
    manager._hooks["pre_tool_call"] = [lambda **_: {"action": "block", "message": "denied by Kletron"}]
    message, _ = _verdict()
    assert message and "denied by Kletron" in message


def test_fail_closed_when_the_validating_hook_raises(manager):
    def validator(**_):
        raise RuntimeError("validation backend down")

    manager._hooks["pre_tool_call"] = [validator]
    message, _ = _verdict()
    assert message and "validation backend down" in message  # FAIL-CLOSED per callback


def test_fail_closed_when_the_validating_hook_times_out(manager, monkeypatch):
    import threading

    monkeypatch.setattr("hermes_cli.plugins._resolve_hook_callback_timeout", lambda: 0.2)
    hold = threading.Event()
    manager._hooks["pre_tool_call"] = [lambda **_: hold.wait(5)]
    try:
        message, _ = _verdict()
    finally:
        hold.set()
    assert message and "timed out" in message  # FAIL-CLOSED on timeout


def test_fail_open_when_no_validator_is_loaded(manager):
    manager._hooks.pop("pre_tool_call", None)
    message, _ = _verdict()
    assert message is None  # absence = the tool runs: managed mode must assert presence


def test_fail_open_when_the_hook_pipeline_itself_raises(monkeypatch):
    def broken(*_a, **_k):
        raise RuntimeError("dispatcher bug")

    monkeypatch.setattr("hermes_cli.plugins._dispatch_pre_tool_call_hooks", broken)
    message, _ = _verdict()
    assert message is None  # FAIL-OPEN: "failures never block"


def test_helper_docstring_still_states_the_contract():
    assert "failures never block" in (h._pre_tool_block_message.__doc__ or "")

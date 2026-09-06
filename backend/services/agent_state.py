"""
The agent's explicit execution state machine. The backend is the sole owner
of these transitions — the frontend renders whatever state was actually
persisted here, never text inferred from LLM output.
"""

from enum import Enum


class ExecutionState(str, Enum):
    IDLE = "IDLE"
    UNDERSTANDING = "UNDERSTANDING"
    PLANNING = "PLANNING"
    EXECUTING = "EXECUTING"
    WAITING_FOR_TOOL = "WAITING_FOR_TOOL"
    WAITING_FOR_USER = "WAITING_FOR_USER"
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# States that represent a terminal outcome for one process_message() call —
# once here, no further backend-owned transition happens for this execution.
TERMINAL_STATES = {
    ExecutionState.COMPLETED,
    ExecutionState.FAILED,
    ExecutionState.WAITING_FOR_USER,
    ExecutionState.CONFIRMATION_REQUIRED,
}

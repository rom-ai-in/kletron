import type { StopState } from "../shared/types.js";

export class StopController {
  private state: StopState = {
    global: false,
    client: false,
    employees: {},
    updatedAt: new Date().toISOString(),
  };

  getState(): StopState {
    return structuredClone(this.state);
  }

  setGlobal(active: boolean, by: string): StopState {
    this.state.global = active;
    this.state.updatedAt = new Date().toISOString();
    this.state.updatedBy = by;
    return this.getState();
  }

  setClient(active: boolean, by: string): StopState {
    this.state.client = active;
    this.state.updatedAt = new Date().toISOString();
    this.state.updatedBy = by;
    return this.getState();
  }

  setEmployee(employeeId: string, active: boolean, by: string): StopState {
    if (active) this.state.employees[employeeId] = true;
    else delete this.state.employees[employeeId];
    this.state.updatedAt = new Date().toISOString();
    this.state.updatedBy = by;
    return this.getState();
  }

  /** Returns denial reason if stopped, else null */
  check(employeeId: string): "global_stop" | "client_stop" | "employee_stop" | null {
    if (this.state.global) return "global_stop";
    if (this.state.client) return "client_stop";
    if (this.state.employees[employeeId]) return "employee_stop";
    return null;
  }
}

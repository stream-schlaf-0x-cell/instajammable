// Bounded snapshot history with retained branches and deterministic restoration.
import type { ProjectState } from '../../types';
export interface HistoryNode { id: string; parentId: string | null; timestamp: number; label: string; state: ProjectState; branchName: string }
export class HistoryManager {
  private nodes = new Map<string, HistoryNode>();
  private currentNodeId: string | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private maxHistory = 64;
  private serial = 0;
  constructor(initialState?: ProjectState) { if (initialState) this.pushState('Initial State', initialState); }
  public pushState(label: string, state: ProjectState, branchName = 'main'): string {
    const current = this.currentNodeId ? this.nodes.get(this.currentNodeId) : null;
    if (current && JSON.stringify(current.state) === JSON.stringify(state)) return current.id;
    const id = `state_${Date.now()}_${++this.serial}`;
    this.nodes.set(id, { id, parentId: this.currentNodeId, timestamp: Date.now(), label,
      state: JSON.parse(JSON.stringify(state)), branchName });
    this.undoStack.push(id); this.redoStack = []; this.currentNodeId = id;
    while (this.nodes.size > this.maxHistory) {
      const oldest = this.nodes.keys().next().value as string;
      this.nodes.delete(oldest);
      this.undoStack = this.undoStack.filter(value => value !== oldest);
      this.redoStack = this.redoStack.filter(value => value !== oldest);
      for (const node of this.nodes.values()) if (node.parentId === oldest) node.parentId = null;
    }
    return id;
  }
  public canUndo(): boolean { return this.undoStack.length > 1; }
  public canRedo(): boolean { return this.redoStack.length > 0; }
  public undo(): ProjectState | null {
    if (!this.canUndo()) return null;
    this.redoStack.push(this.undoStack.pop()!);
    this.currentNodeId = this.undoStack[this.undoStack.length - 1];
    return this.clone(this.currentNodeId);
  }
  public redo(): ProjectState | null {
    const next = this.redoStack.pop(); if (!next) return null;
    this.undoStack.push(next); this.currentNodeId = next; return this.clone(next);
  }
  private clone(id: string): ProjectState | null { const node = this.nodes.get(id); return node ? JSON.parse(JSON.stringify(node.state)) : null; }
  public jumpToNode(id: string): ProjectState | null {
    if (!this.nodes.has(id)) return null;
    const chain: string[] = []; let cursor: string | null = id;
    while (cursor && chain.length <= this.maxHistory) { chain.unshift(cursor); cursor = this.nodes.get(cursor)?.parentId ?? null; }
    this.undoStack = chain; this.redoStack = []; this.currentNodeId = id; return this.clone(id);
  }
  public getAllNodes(): HistoryNode[] { return [...this.nodes.values()].map(node => ({ ...node, state: JSON.parse(JSON.stringify(node.state)) })); }
  public getCurrentNodeId(): string | null { return this.currentNodeId; }
}

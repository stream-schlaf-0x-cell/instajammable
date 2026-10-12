// Musical State History & Branching Tree Manager

import { ProjectState } from '../../types';

export interface HistoryNode {
  id: string;
  parentId: string | null;
  timestamp: number;
  label: string;
  state: ProjectState;
  branchName: string;
}

export class HistoryManager {
  private nodes: Map<string, HistoryNode> = new Map();
  private currentNodeId: string | null = null;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private maxHistory: number = 64;

  constructor(initialState?: ProjectState) {
    if (initialState) {
      this.pushState('Initial State', initialState);
    }
  }

  public pushState(label: string, state: ProjectState, branchName: string = 'main'): string {
    const id = `state_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clonedState: ProjectState = JSON.parse(JSON.stringify(state));

    const node: HistoryNode = {
      id,
      parentId: this.currentNodeId,
      timestamp: Date.now(),
      label,
      state: clonedState,
      branchName,
    };

    this.nodes.set(id, node);
    this.undoStack.push(id);
    this.redoStack = []; // clear redo on new action
    this.currentNodeId = id;

    if (this.undoStack.length > this.maxHistory) {
      const removedId = this.undoStack.shift();
      if (removedId && !this.isNodeBranchRoot(removedId)) {
        this.nodes.delete(removedId);
      }
    }

    return id;
  }

  private isNodeBranchRoot(id: string): boolean {
    for (const node of this.nodes.values()) {
      if (node.parentId === id) return true;
    }
    return false;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): ProjectState | null {
    if (!this.canUndo()) return null;

    const current = this.undoStack.pop();
    if (current) this.redoStack.push(current);

    const prevId = this.undoStack[this.undoStack.length - 1];
    this.currentNodeId = prevId;
    const prevNode = this.nodes.get(prevId);
    return prevNode ? JSON.parse(JSON.stringify(prevNode.state)) : null;
  }

  public redo(): ProjectState | null {
    if (!this.canRedo()) return null;

    const nextId = this.redoStack.pop();
    if (!nextId) return null;

    this.undoStack.push(nextId);
    this.currentNodeId = nextId;
    const nextNode = this.nodes.get(nextId);
    return nextNode ? JSON.parse(JSON.stringify(nextNode.state)) : null;
  }

  public jumpToNode(id: string): ProjectState | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    this.currentNodeId = id;
    this.undoStack.push(id);
    return JSON.parse(JSON.stringify(node.state));
  }

  public getAllNodes(): HistoryNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  public getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }
}

import BridgeExtension from './base';
type TaskListEditorState = {
    isTaskListActive: boolean;
    canToggleTaskList: boolean;
    canLiftTaskListItem: boolean;
    canSinkTaskListItem: boolean;
};
type TaskListEditorInstance = {
    toggleTaskList: () => void;
    liftTaskListItem: () => void;
    sinkTaskListItem: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends TaskListEditorState {
    }
    interface EditorBridge extends TaskListEditorInstance {
    }
}
export declare enum TaskListEditorActionType {
    ToggleTaskList = "toggle-task-list",
    LiftTaskListItem = "lift-task-list-item",
    SinkTaskListItem = "sink-task-list-item"
}
type TaskListMessage = {
    type: TaskListEditorActionType.ToggleTaskList;
    payload?: undefined;
} | {
    type: TaskListEditorActionType.LiftTaskListItem;
    payload?: undefined;
} | {
    type: TaskListEditorActionType.SinkTaskListItem;
    payload?: undefined;
};
export declare const TaskListBridge: BridgeExtension<TaskListEditorState, TaskListEditorInstance, TaskListMessage>;
export {};
//# sourceMappingURL=tasklist.d.ts.map
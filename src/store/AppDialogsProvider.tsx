import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { GoalEditorDialog } from '../features/goals/GoalEditorDialog';
import {
  TaskEditorDialog,
  type TaskEditorPreset,
} from '../features/tasks/TaskEditorDialog';

export interface TaskEditorRequest {
  taskId?: string;
  preset?: TaskEditorPreset;
}

interface DialogRequestState {
  requestId: number;
  taskId?: string;
  preset?: TaskEditorPreset;
}

interface GoalRequestState {
  requestId: number;
  goalId?: string;
}

interface AppDialogsValue {
  openTaskEditor: (request?: TaskEditorRequest) => void;
  openGoalEditor: (goalId?: string) => void;
  closeAll: () => void;
}

const AppDialogsContext = createContext<AppDialogsValue | null>(null);

export function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [taskRequest, setTaskRequest] = useState<DialogRequestState | null>(null);
  const [goalRequest, setGoalRequest] = useState<GoalRequestState | null>(null);
  const counter = useRef(0);

  const openTaskEditor = useCallback((request: TaskEditorRequest = {}) => {
    counter.current += 1;
    setGoalRequest(null);
    setTaskRequest({
      requestId: counter.current,
      taskId: request.taskId,
      preset: request.preset,
    });
  }, []);

  const openGoalEditor = useCallback((goalId?: string) => {
    counter.current += 1;
    setTaskRequest(null);
    setGoalRequest({ requestId: counter.current, goalId });
  }, []);

  const closeAll = useCallback(() => {
    setTaskRequest(null);
    setGoalRequest(null);
  }, []);

  const value = useMemo(
    () => ({ openTaskEditor, openGoalEditor, closeAll }),
    [closeAll, openGoalEditor, openTaskEditor],
  );

  return (
    <AppDialogsContext.Provider value={value}>
      {children}
      {taskRequest ? (
        <TaskEditorDialog
          key={`task-${taskRequest.requestId}`}
          taskId={taskRequest.taskId}
          preset={taskRequest.preset}
          onClose={() => setTaskRequest(null)}
        />
      ) : null}
      {goalRequest ? (
        <GoalEditorDialog
          key={`goal-${goalRequest.requestId}`}
          goalId={goalRequest.goalId}
          onClose={() => setGoalRequest(null)}
        />
      ) : null}
    </AppDialogsContext.Provider>
  );
}

export function useAppDialogs(): AppDialogsValue {
  const value = useContext(AppDialogsContext);
  if (!value) throw new Error('useAppDialogs must be used inside AppDialogsProvider.');
  return value;
}

import { useCallback } from 'react';
import { setTaskCompletion } from '../../domain/tasks';
import { useAppStore } from '../../store/AppStoreProvider';
import type { Task } from '../../types';
import { useToast } from '../../components/ui/toast';

export function useTaskCompletion() {
  const store = useAppStore();
  const toast = useToast();

  return useCallback(
    (task: Task, completed: boolean) => {
      try {
        store.update((state) => setTaskCompletion(state, task.id, completed));
        if (completed) {
          toast({
            title: 'Task completed',
            description: task.title,
            tone: 'success',
            action: {
              label: 'Undo',
              onClick: () => {
                store.update((state) => setTaskCompletion(state, task.id, false));
              },
            },
          });
        }
      } catch (error) {
        toast({
          title: 'Could not update the task',
          description: error instanceof Error ? error.message : undefined,
          tone: 'error',
        });
      }
    },
    [store, toast],
  );
}

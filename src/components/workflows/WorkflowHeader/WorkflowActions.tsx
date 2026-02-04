import { Button } from '@/components/ui/Button';
import { Play, Square, Save, Trash2 } from 'lucide-react';

interface WorkflowActionsProps {
  currentWorkflow: any;
  isRunning: boolean;
  agentCount: number;
  onExecute: () => void;
  onStop: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export function WorkflowActions({
  currentWorkflow,
  isRunning,
  onExecute,
  onStop,
  onSave,
  onDelete,
  agentCount,
}: WorkflowActionsProps) {
  const getExecuteButtonProps = () => ({
    onClick: isRunning ? onStop : onExecute,
    disabled: !currentWorkflow || (!isRunning && currentWorkflow.nodes.length === 0),
    variant: isRunning ? 'danger' as const : 'success' as const,
    icon: isRunning ? Square : Play,
    size: 'sm' as const,
    className: '!rounded-sm',
    children: isRunning ? 'Stop' : 'Execute'
  });

  return (
    <div className="flex items-center space-x-2">
      {/* Execute/Stop Button */}
      <Button {...getExecuteButtonProps()} />
      
      {/* <Button 
        variant="primary" 
        icon={Save} 
        size="sm"
        className="rounded-sm"
        disabled={!agentCount}
        onClick={onSave}
      >
        Save 
      </Button> */}
      {/* <Button 
        variant="danger" 
        icon={Trash2}
        size="sm"
        className="!rounded-sm"
        onClick={onDelete}
        disabled={!agentCount}
      >
        Delete
      </Button> */}
    </div>
  );
}
import React from "react";

export interface ActionButton {
  label: string;
  action: string;
  type: "checkin" | "analyze" | "plan" | "tips" | "navigate";
  route?: string;
}

interface ActionButtonsProps {
  actions: ActionButton[];
  onAction: (action: ActionButton) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ actions, onAction }) => {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={() => onAction(action)}
          className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 text-[11px] font-medium text-gray-300 hover:text-white transition-all active:scale-95 shadow-sm"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default React.memo(ActionButtons);

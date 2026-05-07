import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const Habits: React.FC = () => {
  const navigate = useNavigate();
  const { habits, toggleHabitToday } = useApp();

const getHabitColor = (colorType: string) => {
  switch (colorType) {
      case 'primary': return { bg: 'bg-primary', text: 'text-primary', shadow: 'shadow-neon-blue' };
      case 'secondary': return { bg: 'bg-secondary', text: 'text-secondary', shadow: 'shadow-neon-green' }; // Changed from Indigo to Secondary/Green
      case 'accent-orange': return { bg: 'bg-orange-500', text: 'text-orange-400', shadow: 'shadow-[0_0_8px_rgba(249,115,22,0.5)]' };
      case 'accent-purple': return { bg: 'bg-purple-500', text: 'text-purple-400', shadow: 'shadow-[0_0_8px_rgba(168,85,247,0.5)]' };
      default: return { bg: 'bg-primary', text: 'text-primary', shadow: 'shadow-neon-blue' };
  }
};

  return (
    <div className="pb-24 pt-4 px-5 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6 sticky top-0 bg-background-dark/95 backdrop-blur z-20 py-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5"><span className="material-symbols-outlined text-gray-400">arrow_back</span></button>
        <div className="flex flex-col items-center">
             <h1 className="text-base font-bold">Habit Frequency</h1>
             <div className="flex items-center gap-1 text-xs text-primary font-medium cursor-pointer">
                <span>October 2023</span>
                <span className="material-symbols-outlined text-[14px]">expand_more</span>
             </div>
        </div>
        <button className="p-2 rounded-full hover:bg-white/5"><span className="material-symbols-outlined text-gray-400">calendar_month</span></button>
      </header>

      <div className="flex flex-col gap-4">
        {habits.map((habit) => {
          const colors = getHabitColor(habit.color);
          const completedDays = habit.history.filter(Boolean).length;
          
          return (
            <div key={habit.id} className="glass-panel p-4 rounded-xl">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 ${colors.bg}/10 rounded-lg flex items-center justify-center ${colors.text}`}>
                            <span className="material-symbols-outlined">{habit.icon}</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">{habit.name}</h3>
                            <p className="text-xs text-gray-400">Goal: {habit.goal}/day</p>
                        </div>
                    </div>
                    <div className={`${colors.bg}/10 ${colors.text} px-2 py-1 rounded text-xs font-bold flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                        {completedDays} Days
                    </div>
                </div>
                {/* Heatmap Row */}
                <div className="flex gap-1 justify-between">
                     {habit.history.map((active, i) => {
                        const isToday = i === habit.history.length - 1;
                        return (
                            <div 
                                key={i} 
                                onClick={() => isToday && toggleHabitToday(habit.id)}
                                className={`h-8 flex-1 rounded transition-all duration-300 ${active ? `${colors.bg} ${colors.shadow}` : 'bg-gray-800'} ${isToday ? 'cursor-pointer hover:opacity-80 border border-white/20' : ''}`}
                                title={isToday ? "Toggle today" : ""}
                            ></div>
                        );
                     })}
                </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl bg-gradient-to-br from-background-card to-background-dark border border-primary/20 p-5 shadow-lg relative overflow-hidden">
         <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl"></div>
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Neuro Insight</h3>
            </div>
            <p className="text-sm font-medium leading-relaxed text-gray-200">
                Your productivity peaks on days following a <span className="text-white font-bold underline decoration-primary decoration-2 underline-offset-2">20-minute meditation</span>.
            </p>
         </div>
      </div>
    </div>
  );
};

export default Habits;